# AEGIS Command Center — Complete Project

This package is the integrated AEGIS trading research command center with the interface rebuilt from the approved visual reference and connected to the existing AEGIS Core architecture.

## What is included

- Dark neon command-center dashboard closely matching the approved layout.
- Animated **AEGIS Brain** with visual states: `IDLE`, `LISTENING`, `THINKING`, `EXECUTING`, `ALERT`.
- Animated SVG/neon links between the Brain and all 10 strategy agents.
- Clickable bot modules and strategy drawer.
- Real-time state updates with Socket.IO.
- Opportunity feed, execution pipeline, treasury, capital allocator, bot PNL, wallet strip, recent executions and network status.
- MetaMask administrative connection from the browser using ethers.
- AEGIS Agent Console with text input and browser speech recognition when supported.
- Provider abstraction for **OpenAI**, **Anthropic Claude**, or a local/mock provider.
- Server-side secrets only; API keys are never placed in the browser bundle.
- Agent tool router that can call AEGIS read-only scanners and PAPER actions.
- Existing AEGIS scanners: Liquidations, DEX Arbitrage, Solana Radar, Volatility, Momentum, Perpetuals/Funding, Polymarket, Smart Money, DeFi Yield and Meta Allocator.
- Liquidation Strategy Lab recovered from AEGIS 2.0: health-factor bands, economic ranking, configurable Aave markets and persistent research snapshots.
- Brain scoring, Universal Simulator, Risk Engine, Circuit Breakers, Signal Fusion, Intelligence Layer, Performance DB, Replay Engine, Health Supervisor, RPC routing and execution adapter.
- Docker deployment files.
- PAPER mode by default; LIVE signing remains locked until an external signer/vault is implemented.

The original interface reference is included at `docs/interface-reference.png`.

## Architecture

```text
User text / voice
       │
       ▼
 AEGIS Agent Console
       │
       ▼
 Provider Adapter
 OpenAI / Claude / Mock
       │
       ▼
 Agent Orchestrator / Tool Router
       │
       ├── Liquidation Hunter
       ├── DEX Arbitrage Hunter
       ├── Solana Early Token Radar
       ├── Volatility Hunter
       ├── Momentum / Trend Agent
       ├── Perpetuals & Funding Hunter
       ├── Polymarket Intelligence
       ├── Whale & Smart-Money Tracker
       ├── DeFi Yield Hunter
       └── Meta Strategy / Capital Allocator
                    │
                    ▼
               AEGIS BRAIN
                    │
          Universal Simulator
                    │
               Risk Engine
                    │
          Strategy Circuit Breaker
                    │
            Execution Adapter
                    │
                 PAPER
                    │
      Performance / Fusion / Intelligence
                    │
            Capital Allocator
```

## Local installation

Requirements: Node.js 20+ and npm.

```bash
npm run install:all
cp server/.env.example server/.env
npm run dev
```

Open:

- UI: `http://localhost:5173`
- Core API: `http://localhost:8787`

## AI provider

Edit `server/.env`.

### Local/mock mode

```env
AEGIS_AI_PROVIDER=mock
AEGIS_AI_MODEL=AEGIS local demo
```

### OpenAI

```env
AEGIS_AI_PROVIDER=openai
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=your_model_name
```

### Anthropic Claude

```env
AEGIS_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_server_side_key
ANTHROPIC_MODEL=your_model_name
```

Keys stay on the server. Do not expose them through Vite environment variables or frontend code.

## Agent commands

The console can coordinate the following tools:

```text
scan_liquidations
scan_arbitrage
scan_volatility
scan_perpetuals
scan_solana
scan_polymarket
scan_smart_money
scan_momentum
scan_yield
rebalance
probe_rpc
```

The LLM does not receive unrestricted wallet access. Tool requests still pass through AEGIS application logic and PAPER/risk controls.

## Liquidation Strategy Lab

The lab is read-only and ranks observed borrowers into `LIQUIDATABLE`, `CRITICAL`, `NEAR`, `WATCH` and `SAFE` bands.

```text
GET  /api/liquidation/lab
POST /api/liquidation/lab/rescore
```

Configure one or more Aave markets with `AAVE_MARKETS_JSON` or use the single-market `AAVE_V3_POOL_ADDRESS` fallback. Ranking parameters are controlled with the `LIQ_LAB_*` variables in `server/.env.example`.

## MetaMask

The top-right MetaMask button connects an administrative browser wallet. The current project does not store its private key and does not use it for unattended autonomous signing.

## Docker

```bash
cp server/.env.example server/.env
docker compose up --build
```

Services:

- `aegis-core`: port `8787`
- `aegis-ui`: port `5173`

## Main folders

```text
aegis-command-center/
├── client/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.jsx          # Complete command-center interface
│       ├── style.css         # Dark neon visual system + animations
│       └── api.js            # Core API client
├── server/
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── agent/            # LLM provider + orchestration
│   │   ├── bots/             # 9 scanners + runtimes
│   │   ├── core/             # Brain, risk, sim, fusion, allocator, replay
│   │   ├── infrastructure/   # RPC, market data, health, vault interface
│   │   ├── storage/
│   │   └── index.js
│   └── test/
├── docs/interface-reference.png
├── Dockerfile.client
├── Dockerfile.server
├── docker-compose.yml
└── package.json
```

## Safety / execution boundary

`AEGIS_LIVE_EXECUTION_ENABLED=false` is the default. This project is complete as a command center and PAPER/research system, but the LIVE adapter intentionally rejects autonomous signing until a dedicated external signer/vault is implemented and audited. Never store seed phrases or private keys in React, Git, JSON state or frontend environment variables.

## Build verification note

Source files and local import paths were checked in the build environment. Dependency installation was attempted but the environment timed out while downloading npm packages, so dependencies are intentionally not bundled in this archive. Run `npm run install:all` on the target machine before starting it.
