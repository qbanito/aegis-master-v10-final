# Finance Brain connectors

Finance Brain now exposes controlled connectors for the three markets that were present in the sibling projects.

## Binance

Reuses the existing spot/futures market configuration and adds an HMAC client for authenticated account reads and orders.

- `GET /api/integrations/binance/status`
- `POST /api/integrations/binance/probe` with `{ "market": "spot" | "futures" }`
- `GET /api/integrations/binance/account?market=spot`
- `POST /api/integrations/binance/order`

Orders require API credentials, `BINANCE_LIVE_ENABLED=true`, the exact confirmation string, an allowed symbol and the configured notional limit. Use an API key without withdrawals enabled.

## Solana

Reuses the Jupiter quote/serialized-transaction flow from `volatility-hunter-ai-v10` and the Jito-first/fallback-RPC submission flow from `SolanaLaunchSentinelX`.

- `GET /api/integrations/solana/status`
- `POST /api/integrations/solana/probe`
- `GET /api/integrations/solana/quote?inputMint=...&outputMint=...&amount=...&slippageBps=...`
- `POST /api/integrations/solana/swap/prepare`
- `POST /api/integrations/solana/swap/submit`

The server does not store a Solana private key. The prepare endpoint returns a serialized transaction for an external wallet/signer. Submission requires a signed base64 transaction and both Solana live gates.

## Polymarket

Reuses the existing CLOB client and EIP-712 bridge signer from `polymarket-intelligence-bot-v10`.

- `GET /api/integrations/polymarket/status`
- `POST /api/integrations/polymarket/wallet/connect`
- `GET /api/integrations/polymarket/pending-signature`
- `POST /api/integrations/polymarket/pending-signature/:id`
- `GET /api/integrations/polymarket/proposals`
- `POST /api/integrations/polymarket/proposals/:id/approve`
- `POST /api/integrations/polymarket/proposals/:id/reject`

A qualifying Polymarket opportunity can create a proposal, but the order is not posted until a human approves the EIP-712 signature through MetaMask. `POLYMARKET_LIVE_ENABLED=false` remains the default.

## Required operational sequence

1. Configure public RPC/API endpoints and run probes.
2. Test with PAPER or dry-run credentials first.
3. Use isolated wallets/API keys with minimal permissions and small limits.
4. Enable one connector at a time and verify receipts, balances and kill switches.
