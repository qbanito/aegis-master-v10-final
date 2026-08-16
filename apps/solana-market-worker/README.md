# AEGIS Solana Market Worker

Servicio asíncrono de investigación para los bots Solana. Usa `solana-py` para
RPC, `solders` para tipos y transacciones versionadas, y `numpy`/`polars` para
el scoring. Nunca recibe ni guarda claves privadas y nunca envía órdenes.

Variables requeridas en Render: `SOLANA_RPC_URL`. Opcionalmente
`SOLANA_WORKER_TIMEOUT_SECONDS`.

Endpoints:

- `GET /health` — estado y latencia RPC.
- `POST /analyze` — analiza hasta 100 candidatos de un scan existente.
- `POST /simulate` — simula una transacción Base64 sin firmar ni enviar.
