# AEGIS Kronos sidecar

Este servicio ejecuta `NeoQuasar/Kronos-mini` fuera del proceso Node y solo devuelve previsiones OHLCV. No firma, envía ni autoriza órdenes.

## Preparación real

```bash
cd apps/kronos-service
./setup.sh
KRONOS_ENABLED=true PYTHON_BIN=python3.11 ./start.sh
```

El modelo necesita el repositorio oficial de Kronos y su tokenizer compatible:

- `NeoQuasar/Kronos-mini`
- `NeoQuasar/Kronos-Tokenizer-2k`

## Endpoints

- `GET /health`
- `GET /api/kronos/status`
- `POST /forecast`

Con `KRONOS_ENABLED=false` el servicio permanece desactivado. Finance Brain trata un sidecar apagado como ausencia de señal, nunca como una predicción sintética.
