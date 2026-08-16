#!/usr/bin/env python3
"""Read-only Solana research worker for AEGIS.

It never owns a keypair, signs a transaction, or submits an order.  Finance
uses it to validate candidates and, only when asked, simulate a user-provided
unsigned/signed transaction through an RPC.  Wallet signing remains in the
browser.
"""
from __future__ import annotations

import asyncio
import base64
import os
from datetime import datetime, timezone
from typing import Any

import numpy as np
import orjson
import polars as pl
from aiohttp import web
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction

PORT = int(os.getenv("PORT", "8791"))
RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
TIMEOUT_SECONDS = float(os.getenv("SOLANA_WORKER_TIMEOUT_SECONDS", "8"))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def candidate_report(row: dict[str, Any]) -> dict[str, Any]:
    """Produce an inspectable score from data already collected by Finance.

    This is a deterministic risk filter, not a price prediction.  A candidate
    cannot be marked ready unless its on-chain authority checks are present.
    """
    mint = str(row.get("mint") or row.get("address") or "")
    mint_valid = False
    try:
        if mint:
            Pubkey.from_string(mint)
            mint_valid = True
    except ValueError:
        pass
    audit = row.get("audit") or {}
    liquidity = number(row.get("liquidityUsd"))
    volume5m = number(row.get("volume5mUsd"))
    volume24h = number(row.get("volume24hUsd"))
    change5m = number(row.get("priceChange5m"))
    age_minutes = number(row.get("ageMinutes"))
    top10 = number(audit.get("top10HolderPct") or row.get("top10HolderPct"))
    mint_revoked = audit.get("mintAuthorityRevoked") is True
    freeze_revoked = audit.get("freezeAuthorityRevoked") is True
    volume_ratio = volume5m / max(liquidity, 1.0)

    components = {
        "validMint": 1.0 if mint_valid else 0.0,
        "liquidity": min(1.0, liquidity / 100_000),
        "volumeFlow": min(1.0, volume5m / 20_000),
        "age": 1.0 if 1 <= age_minutes <= 1_440 else 0.45,
        "concentration": max(0.0, 1 - max(0.0, top10 - 25) / 45),
        "authority": 1.0 if mint_revoked and freeze_revoked else 0.0,
        "momentum": max(0.0, 1 - abs(change5m - 5) / 30),
        "flowSanity": max(0.0, 1 - max(0.0, volume_ratio - 0.4) / 2),
    }
    weights = {"validMint": .10, "liquidity": .20, "volumeFlow": .14, "age": .08,
               "concentration": .16, "authority": .20, "momentum": .06, "flowSanity": .06}
    score = sum(components[key] * weights[key] for key in weights) * 100
    blockers = []
    if not mint_valid:
        blockers.append("INVALID_MINT")
    if liquidity < 50_000:
        blockers.append("LIQUIDITY_BELOW_FLOOR")
    if not mint_revoked:
        blockers.append("MINT_AUTHORITY_NOT_REVOKED")
    if not freeze_revoked:
        blockers.append("FREEZE_AUTHORITY_NOT_REVOKED")
    if top10 > 35:
        blockers.append("TOP_HOLDERS_CONCENTRATED")
    if volume_ratio > 2:
        blockers.append("VOLUME_LIQUIDITY_ANOMALY")
    return {
        "mint": mint or None,
        "symbol": row.get("symbol") or row.get("name") or (mint[:8] if mint else "UNKNOWN"),
        "score": round(score, 2),
        "blockers": blockers,
        "readyForPaper": not blockers and score >= 72,
        "readyForLive": False,
        "components": {key: round(value, 3) for key, value in components.items()},
        "evidence": {"liquidityUsd": liquidity, "volume5mUsd": volume5m, "volume24hUsd": volume24h,
                     "priceChange5m": change5m, "ageMinutes": age_minutes, "top10HolderPct": top10,
                     "mintAuthorityRevoked": mint_revoked, "freezeAuthorityRevoked": freeze_revoked},
    }


async def health(_: web.Request) -> web.Response:
    started = asyncio.get_running_loop().time()
    try:
        async with AsyncClient(RPC_URL, timeout=TIMEOUT_SECONDS) as client:
            slot = await client.get_slot(commitment="processed")
        return respond({"ok": True, "service": "AEGIS Solana Market Worker", "mode": "READ_ONLY_PAPER",
                        "rpc": {"online": True, "slot": int(slot.value), "latencyMs": round((asyncio.get_running_loop().time() - started) * 1000)},
                        "capabilities": ["candidate-analysis", "versioned-transaction-simulation", "no-signing"], "checkedAt": utc_now()})
    except Exception as exc:  # service stays observable even if an RPC is down
        return respond({"ok": False, "service": "AEGIS Solana Market Worker", "mode": "READ_ONLY_PAPER",
                        "rpc": {"online": False, "error": str(exc), "latencyMs": round((asyncio.get_running_loop().time() - started) * 1000)}, "checkedAt": utc_now()}, status=503)


async def analyze(request: web.Request) -> web.Response:
    payload = await request.json(loads=orjson.loads)
    rows = [item for item in payload.get("candidates", []) if isinstance(item, dict)][:100]
    reports = [candidate_report(row) for row in rows]
    # Polars is used for ranking; it stays robust with an empty candidate set.
    ranked = pl.DataFrame(reports) if reports else pl.DataFrame({"score": []})
    if reports:
        reports = ranked.sort("score", descending=True).to_dicts()
    scores = np.array([item["score"] for item in reports], dtype=float)
    return respond({"ok": True, "mode": "PAPER_RESEARCH", "live": False, "candidateCount": len(reports),
                    "paperReady": sum(1 for item in reports if item["readyForPaper"]), "score": {"mean": round(float(scores.mean()), 2) if scores.size else 0, "max": round(float(scores.max()), 2) if scores.size else 0},
                    "reports": reports, "generatedAt": utc_now(),
                    "notice": "Deterministic risk research only. A wallet signature and a separate live policy are required for any real transaction."})


async def simulate(request: web.Request) -> web.Response:
    payload = await request.json(loads=orjson.loads)
    encoded = str(payload.get("transactionBase64") or "")
    if not encoded:
        return respond({"ok": False, "error": "TRANSACTION_BASE64_REQUIRED"}, status=400)
    try:
        transaction = VersionedTransaction.from_bytes(base64.b64decode(encoded, validate=True))
        async with AsyncClient(RPC_URL, timeout=TIMEOUT_SECONDS) as client:
            result = await client.simulate_transaction(transaction, sig_verify=False, replace_recent_blockhash=True)
        value = result.value
        return respond({"ok": value.err is None, "mode": "SIMULATION_ONLY", "live": False,
                        "simulation": {"error": value.err, "logs": value.logs or [], "unitsConsumed": value.units_consumed}, "simulatedAt": utc_now()})
    except Exception as exc:
        return respond({"ok": False, "mode": "SIMULATION_ONLY", "live": False, "error": str(exc), "simulatedAt": utc_now()}, status=422)


def respond(body: dict[str, Any], status: int = 200) -> web.Response:
    return web.Response(body=orjson.dumps(body), status=status, content_type="application/json")


app = web.Application(client_max_size=512 * 1024)
app.router.add_get("/health", health)
app.router.add_post("/analyze", analyze)
app.router.add_post("/simulate", simulate)

if __name__ == "__main__":
    web.run_app(app, host="0.0.0.0", port=PORT)
