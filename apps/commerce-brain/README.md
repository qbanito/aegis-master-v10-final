# Commerce Brain

Commerce Brain orchestrates ten commerce modules in PAPER mode:

1. Product discovery: Amazon and AliExpress feeds or provider adapters.
2. Product scoring: demand, rating, image availability, contribution margin and CAC guardrails.
3. Offer/pricing: payment, platform, refund and advertising reserves are included in the economics.
4. Landing drafts: structured copy/HTML plus optional Media Brain/MuAPI assets.
5. Campaign drafts: channels, UTM parameters, target CAC and pause rules.
6. Shopify drafts and read-only probe.
7. Funnel events and lead capture.
8. Verified order webhook and revenue metrics.
9. Retention/CRM signals from leads and orders.
10. Revenue allocation recommendations; no spend is activated automatically.

Useful routes:

- `GET /api/operations/summary`
- `GET /api/modules`
- `GET /api/master/status`
- `POST /api/master/command`
- `POST /api/automation/run`
- `POST /api/products/discover`
- `POST /api/modules/dropship-hunter/run`
- `POST /api/modules/digital-builder/run`
- `POST /api/modules/offer-pricing/run`
- `POST /api/modules/creative-factory/run`
- `POST /api/modules/store-manager/run`
- `POST /api/modules/traffic/run`
- `POST /api/modules/closer/run`
- `POST /api/modules/retention/run`
- `POST /api/modules/allocator/run`
- `GET /api/digital-products`
- `GET /api/apify/amazon-affiliate-scout/status`
- `POST /api/apify/amazon-affiliate-scout/run`
- `POST /api/products/:id/score`
- `POST /api/products/:id/landing`
- `POST /api/products/:id/campaign`
- `POST /api/workflows/product-launch`
- `GET /api/workflows/:id`
- `POST /api/workflows/:id/approve`
- `POST /api/workflows/:id/reject`
- `GET /api/store-drafts`
- `GET /api/funnel/summary`
- `POST /api/orders/webhook`
- `POST /api/shopify/probe`

The service persists operational state in `data/commerce.json`. It never activates ads or publishes Shopify products while `COMMERCE_MODE=PAPER`. Real publication requires separate explicit gates and verified provider credentials.

## Brain Master control

Manager/Brain Master can inspect `/api/operations/summary`, run any bounded module action through `/api/master/command`, update whitelisted parameters, and pause or resume a bot. Every command is persisted and emitted as an inter-brain event. The permissions are deliberately limited to PAPER actions: no Shopify publication, ad spend, external messaging, purchase, withdrawal or credential mutation is accepted by this control surface.

## Product Launch Workflow

`POST /api/workflows/product-launch` connects Product Scout to scoring, compliance, offer/pricing, creative brief or MuAPI asset generation, Shopify draft, campaign draft and PAPER readiness. It is idempotent by `idempotencyKey` or active product workflow. Provider data is required before a product can become `TEST_READY`; synthetic samples remain review-only. Every transition is persisted in the workflow timeline and emitted as an inter-brain event.

### Amazon Affiliate separation

Amazon results from the private Apify Actor use the official Amazon Creators API and are marked `monetizationModel: AMAZON_AFFILIATE`. Their economics estimate commission minus content cost; they do not contain fulfillment cost or a resale margin. The launch workflow creates editorial/clickout content and an affiliate disclosure, skips the Shopify inventory draft, and keeps price/availability refresh plus demand verification as review gates. AliExpress and other physical-product modules remain separate Shopify consumers.
