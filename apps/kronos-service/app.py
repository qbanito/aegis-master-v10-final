#!/usr/bin/env python3
"""Kronos inference sidecar for AEGIS.

The service never places orders. It accepts normalized OHLCV candles and
returns a forecast that the Node.js risk/fusion layer may use as one feature.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
from datetime import timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

LOG = logging.getLogger("aegis-kronos")
HOST = os.getenv("KRONOS_HOST", "127.0.0.1")
PORT = int(os.getenv("KRONOS_PORT", "8815"))
ENABLED = os.getenv("KRONOS_ENABLED", "false").lower() == "true"
MODEL_NAME = os.getenv("KRONOS_MODEL", "NeoQuasar/Kronos-mini")
TOKENIZER_NAME = os.getenv("KRONOS_TOKENIZER", "NeoQuasar/Kronos-Tokenizer-2k")
DEVICE = os.getenv("KRONOS_DEVICE", "auto")
MAX_CONTEXT = int(os.getenv("KRONOS_MAX_CONTEXT", "2048"))
LOOKBACK_MIN = int(os.getenv("KRONOS_LOOKBACK_MIN", "96"))
MAX_PRED_LEN = int(os.getenv("KRONOS_MAX_PRED_LEN", "256"))
REPO_PATH = os.getenv("KRONOS_REPO_PATH", str(Path(__file__).parent / "vendor" / "Kronos"))


def interval_delta(interval: str) -> timedelta:
    text = str(interval or "5m").strip().lower()
    units = {"m": 60, "h": 3600, "d": 86400, "w": 604800}
    try:
        number = int(text[:-1])
        return timedelta(seconds=max(1, number) * units[text[-1]])
    except (ValueError, KeyError):
        raise ValueError("UNSUPPORTED_INTERVAL") from None


def clean_timestamp_values(values: list[Any]):
    import pandas as pd

    parsed = pd.to_datetime(values, utc=True, errors="raise")
    return pd.Series(parsed.tz_convert(None))


class KronosRuntime:
    def __init__(self):
        self.lock = threading.Lock()
        self.inference_lock = threading.Lock()
        self.predictor = None
        self.device = None
        self.load_error = None
        self.requests = 0
        self.errors = 0
        self.last_forecast_at = None

    def status(self) -> dict[str, Any]:
        return {
            "enabled": ENABLED,
            "loaded": self.predictor is not None,
            "mode": "REAL" if self.predictor is not None else ("DISABLED" if not ENABLED else "UNAVAILABLE"),
            "model": MODEL_NAME,
            "tokenizer": TOKENIZER_NAME,
            "device": self.device,
            "maxContext": MAX_CONTEXT,
            "lookbackMin": LOOKBACK_MIN,
            "requests": self.requests,
            "errors": self.errors,
            "lastForecastAt": self.last_forecast_at,
            "loadError": self.load_error,
        }

    def load(self) -> None:
        if not ENABLED or self.predictor is not None:
            return
        with self.lock:
            if not ENABLED or self.predictor is not None:
                return
            try:
                repo = Path(REPO_PATH).expanduser().resolve()
                if repo.exists():
                    sys.path.insert(0, str(repo))
                import torch
                from model import Kronos, KronosPredictor, KronosTokenizer

                if DEVICE == "auto":
                    if torch.cuda.is_available():
                        device = "cuda:0"
                    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                        device = "mps"
                    else:
                        device = "cpu"
                else:
                    device = DEVICE
                tokenizer = KronosTokenizer.from_pretrained(TOKENIZER_NAME)
                model = Kronos.from_pretrained(MODEL_NAME)
                self.predictor = KronosPredictor(model, tokenizer, device=device, max_context=MAX_CONTEXT)
                self.device = device
                self.load_error = None
                LOG.info("Kronos loaded: %s / %s on %s", MODEL_NAME, TOKENIZER_NAME, device)
            except Exception as exc:  # startup remains inspectable instead of crashing the trading brain
                self.load_error = f"{type(exc).__name__}: {exc}"
                self.errors += 1
                LOG.exception("Kronos could not load")

    def forecast(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.requests += 1
        self.load()
        if self.predictor is None:
            raise RuntimeError("KRONOS_NOT_LOADED")

        import pandas as pd

        candles = payload.get("candles") or []
        if len(candles) < LOOKBACK_MIN:
            raise ValueError("NOT_ENOUGH_CANDLES")
        pred_len = min(MAX_PRED_LEN, max(1, int(payload.get("pred_len", 12))))
        interval = str(payload.get("interval", "5m"))
        delta = interval_delta(interval)
        rows = []
        for candle in candles[-MAX_CONTEXT:]:
            row = {key: float(candle[key]) for key in ("open", "high", "low", "close")}
            row["volume"] = float(candle.get("volume", 0) or 0)
            row["amount"] = float(candle.get("amount", candle.get("quoteVolume", row["volume"] * row["close"])) or 0)
            rows.append(row)
        df = pd.DataFrame(rows)
        raw_timestamps = payload.get("timestamps")
        if raw_timestamps:
            timestamps = clean_timestamp_values(list(raw_timestamps)[-len(df):])
        else:
            last = pd.Timestamp.utcnow().tz_localize(None)
            timestamps = pd.Series([last - delta * (len(df) - index - 1) for index in range(len(df))])
        y_timestamps = pd.Series([timestamps.iloc[-1] + delta * (index + 1) for index in range(pred_len)])
        with self.inference_lock:
            prediction = self.predictor.predict(
                df=df,
                x_timestamp=timestamps,
                y_timestamp=y_timestamps,
                pred_len=pred_len,
                T=float(payload.get("temperature", 1.0)),
                top_p=float(payload.get("top_p", .9)),
                sample_count=max(1, min(8, int(payload.get("sample_count", 1)))),
                verbose=False,
            )
        last_close = float(df["close"].iloc[-1])
        forecast_close = float(prediction["close"].iloc[-1])
        return_pct = (forecast_close / last_close - 1) * 100 if last_close else 0
        forecast_returns = prediction["close"].pct_change().dropna()
        volatility_pct = float(forecast_returns.std() * 100) if len(forecast_returns) > 1 else 0
        direction = "LONG" if return_pct > .05 else "SHORT" if return_pct < -.05 else "NEUTRAL"
        confidence = min(.95, max(.05, .5 + min(.35, abs(return_pct) / 2) - min(.2, volatility_pct / 20)))
        forecast_rows = []
        for stamp, row in prediction.iterrows():
            open_price = float(row["open"])
            close_price = float(row["close"])
            forecast_rows.append({
                "timestamp": stamp.isoformat(),
                "open": open_price,
                "high": max(float(row["high"]), open_price, close_price),
                "low": min(float(row["low"]), open_price, close_price),
                "close": close_price,
                "volume": max(0.0, float(row["volume"])),
            })
        from datetime import datetime, timezone
        self.last_forecast_at = datetime.now(timezone.utc).isoformat()
        return {
            "available": True,
            "mode": "REAL",
            "model": MODEL_NAME,
            "tokenizer": TOKENIZER_NAME,
            "device": self.device,
            "symbol": payload.get("symbol"),
            "interval": interval,
            "lookback": len(df),
            "predLen": pred_len,
            "summary": {
                "lastClose": last_close,
                "forecastClose": forecast_close,
                "returnPct": round(return_pct, 6),
                "volatilityPct": round(volatility_pct, 6),
                "direction": direction,
                "confidence": round(confidence, 4),
                "confidenceType": "heuristic_from_forecast_path",
            },
            "forecast": forecast_rows,
            "generatedAt": self.last_forecast_at,
        }


runtime = KronosRuntime()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        LOG.info("%s - %s", self.address_string(), format % args)

    def _send(self, status: int, body: dict[str, Any]) -> None:
        try:
            encoded = json.dumps(body, separators=(",", ":"), allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(encoded)
        except BrokenPipeError:
            # El cliente puede agotar el timeout mientras termina una inferencia
            # encolada en MPS; eso no es un fallo del modelo.
            return

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path in ("/health", "/api/kronos/status"):
            self._send(200, {"ok": True, "service": "AEGIS Kronos", **runtime.status()})
            return
        self._send(404, {"error": "NOT_FOUND"})

    def do_POST(self) -> None:
        if self.path not in ("/forecast", "/api/kronos/forecast"):
            self._send(404, {"error": "NOT_FOUND"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 4_000_000)
            payload = json.loads(self.rfile.read(length) or b"{}")
            self._send(200, runtime.forecast(payload))
        except ValueError as exc:
            self._send(400, {"available": False, "error": str(exc)})
        except RuntimeError as exc:
            if str(exc) == "KRONOS_NOT_LOADED":
                self._send(503, {"available": False, "error": str(exc), "status": runtime.status()})
            else:
                runtime.errors += 1
                self._send(500, {"available": False, "error": f"RUNTIME_ERROR: {exc}"})
        except Exception as exc:
            runtime.errors += 1
            LOG.exception("Kronos forecast failed")
            self._send(500, {"available": False, "error": f"{type(exc).__name__}: {exc}"})


def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
    if ENABLED:
        runtime.load()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    LOG.info("AEGIS Kronos listening on http://%s:%s enabled=%s", HOST, PORT, ENABLED)
    server.serve_forever()


if __name__ == "__main__":
    main()
