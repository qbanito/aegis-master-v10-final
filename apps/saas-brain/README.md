# AEGIS SaaS Brain — Brain 3 / V3

V3 adds the first real Revenue Intelligence layer on top of the persistent SaaS telemetry core.

## New in V3
- Revenue Intelligence Engine
- MRR movement classification:
  - New MRR
  - Expansion MRR
  - Contraction MRR
  - Churned MRR
  - Net New MRR
- Revenue snapshots persisted to `server/data/revenue-snapshots.jsonl`
- Time-series portfolio snapshots
- Basic SaaS revenue cohorts by signup/subscription month
- Per-SaaS revenue health summary
- Portfolio growth score
- Stripe-compatible webhook adapter endpoint
- Revenue trend endpoint
- Cohort endpoint
- New dashboard sections for Revenue Intelligence and SaaS Growth
- Event Bus + persistent Event Store from V2 retained
- AI Brain now receives revenue intelligence context

## Architecture

SaaS / Stripe / Billing Systems
            |
            v
      Webhook Gateway
            |
            v
 Universal SaaS Event Schema
            |
            v
     Persistent Event Store
            |
            v
       SaaS Event Bus
      /      |       \
     v       v        v
 Metrics   Alerts   Revenue Engine
                      |
                      v
           Revenue Snapshot Store
                      |
                      v
                 SaaS Brain
                 /      \
                v        v
          Dashboard    AI Agent

## Run

```bash
npm run install:all
cp server/.env.example server/.env
npm run dev
```

UI: http://localhost:5173
Core: http://localhost:8790

## New endpoints

```text
GET  /api/revenue/summary
GET  /api/revenue/trend?limit=100
GET  /api/revenue/cohorts
GET  /api/revenue/:saasId
POST /api/integrations/stripe/:saasId
```

## Stripe-compatible adapter

V3 includes a normalization layer for common Stripe-style billing events.

Supported mappings include:

- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed
- charge.refunded

The adapter translates them into the internal AEGIS event schema before they enter the Event Bus.

For production, signature verification should use the official Stripe SDK and the raw webhook payload. V3 keeps the adapter isolated so that official verification can be plugged in without changing the rest of the Brain.

## Safety

V3 remains observation-first:
- No external SaaS write actions
- No billing mutations
- No automatic campaign changes
- No customer-account changes

The Brain can inspect, rank, summarize and recommend.
