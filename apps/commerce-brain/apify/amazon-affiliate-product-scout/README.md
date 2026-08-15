# Amazon Affiliate Product Scout

Private Apify Actor for AEGIS Commerce Brain. It searches Amazon through the official Amazon Creators API, normalizes affiliate product data, computes a configurable planning score, and writes candidates plus a run summary to the default Apify Dataset.

This Actor is intentionally **Amazon Affiliate only**:

- It does not search or import AliExpress products.
- It does not scrape Amazon product pages.
- It does not buy inventory, create a Shopify product, publish a store listing, or spend on ads.
- It never emits synthetic products when Amazon credentials are missing.
- Its output is for affiliate-content workflows; Shopify product workflows are separate consumers for other Commerce modules.

## Credentials

Configure these as Apify secret inputs or Actor environment variables:

- `AMAZON_CREATORS_CLIENT_ID`
- `AMAZON_CREATORS_CLIENT_SECRET`
- `AMAZON_PARTNER_TAG`
- `AMAZON_CREATORS_CREDENTIAL_VERSION` (`3.1` by default)

Amazon Creators API uses OAuth 2.0 and the `https://creatorsapi.amazon` catalog API. The Actor caches the access token for one run, limits requests, and records errors without exposing credentials.

## Output contract

Product records use:

- `source: amazon`
- `monetizationModel: AMAZON_AFFILIATE`
- `asin`
- `affiliateUrl`
- `price` and `currency`
- `imageUrl`, `features`, `availability`
- `scoutScore`, `tier`, `blockers`
- `economics.expectedCommission` and `economics.contribution` as planning estimates
- `demandSignalStatus: MISSING` until a separate demand signal is connected

The absence of a demand signal is deliberately visible. A product cannot be treated as proven solely because it exists in Amazon's catalog.

## Apify deployment

The private Actor registered for this workspace is `connected_monkey~amazon-affiliate-product-scout`. Commerce Brain invokes it explicitly through `POST /api/apify/amazon-affiliate-scout/run`; automatic Commerce cycles do not invoke it, preventing unexpected Apify request usage.

Amazon credentials belong in the Actor's secret input/environment, not in browser requests and not in Shopify. If the Actor is not built or the Apify account has reached its monthly hard limit, Commerce Brain returns the provider error and does not create synthetic affiliate products.
