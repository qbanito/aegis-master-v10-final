import {store} from "../core/store.js";
import {AMAZON_AFFILIATE_ACTOR_ID, MASTER_BRAIN_URL, MEDIA_BRAIN_URL, ASSET_MODE, PAPER_MODE, configuredEnv, envValue} from "../core/config.js";
import {probeApifyActorMetadata} from "./apifyConnector.js";
import {probeShopify, shopifyConfigured} from "./shopifyConnector.js";
import {probeMedia} from "./mediaConnector.js";
import {probeManager} from "./managerConnector.js";

// Synchronous, presence-only status — kept byte-compatible with the pre-refactor connectorStatus()
// so every existing inline `connector(id)` call site in the module functions stays unchanged. This
// answers "is it configured", not "is it actually reachable right now" — for that, use probeConnector().
export function connectorStatus() {
  const shopify = shopifyConfigured();
  const amazonCreators = Boolean(envValue("AMAZON_CREATORS_CLIENT_ID") && envValue("AMAZON_CREATORS_CLIENT_SECRET") && envValue("AMAZON_PARTNER_TAG", "AMAZON_CREATORS_PARTNER_TAG"));
  const amazon = amazonCreators || Boolean(process.env.AMAZON_PRODUCT_FEED_URL);
  const aliexpress = configuredEnv("ALIEXPRESS_API_KEY") || Boolean(process.env.ALIEXPRESS_API_URL);
  const apifyToken = Boolean(envValue("APIFY_API_TOKEN", "APIFY_API_KEY"));
  const apify = apifyToken && Boolean(AMAZON_AFFILIATE_ACTOR_ID);
  return {
    mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED",
    policy: "read_only_until_explicit_publish",
    connectors: [
      {id: "aliexpress", name: "AliExpress", provider: "product feed / affiliate adapter", configured: aliexpress, live: false, detail: aliexpress ? "credentials detected; discovery adapter ready" : "API key or feed URL required"},
      {id: "amazon", name: "Amazon Affiliate Product Scout", provider: "Amazon Creators API", configured: amazon, live: false, readiness: amazonCreators ? "CREATORS_API_READY" : (amazon ? "FEED_CONFIGURED" : "BLOCKED"), detail: amazonCreators ? "Creators API credentials detected; affiliate content only" : (amazon ? "Amazon feed configured; affiliate adapter available" : "Creators API client credentials + partner tag required")},
      {id: "shopify", name: "Shopify", provider: "Admin API", configured: shopify, live: false, detail: shopify ? "store configured; drafts only" : "store domain + admin token required"},
      {id: "apify", name: "Apify Amazon Affiliate Scout", provider: "private Actor", configured: apify, online: null, live: false, readiness: apify ? "ACTOR_CONFIGURED" : "BLOCKED", actorId: AMAZON_AFFILIATE_ACTOR_ID, detail: apify ? "private Actor configured; explicit run required" : "APIFY_API_TOKEN required"},
      {id: "master", name: "Manager / Brain Master", provider: MASTER_BRAIN_URL, configured: Boolean(MASTER_BRAIN_URL), online: null, live: false, readiness: store.masterControl.connected ? "CONNECTED" : "DEGRADED", detail: "Can inspect modules, change bounded parameters and run PAPER actions"},
      {id: "media", name: "Media Brain / MuAPI", provider: MEDIA_BRAIN_URL, configured: Boolean(MEDIA_BRAIN_URL), live: false, detail: `asset mode: ${ASSET_MODE}`}
    ]
  };
}

export function connector(id) { return connectorStatus().connectors.find(item => item.id === id); }

const PROBES = {
  apify: () => probeApifyActorMetadata(),
  shopify: () => probeShopify(),
  media: () => probeMedia(),
  master: () => probeManager()
};

// Honest, staleness-aware, cached probes for connectors that can be probed for free (or cheaply).
// amazon/aliexpress have no free real-verification call available — they report UNVERIFIED (not a
// false READY or BLOCKED) until the first real successful run flips them, which callers do themselves.
export async function probeConnector(id) {
  const base = connector(id);
  if (!base) return null;
  const probeFn = PROBES[id];
  if (!probeFn) return base.configured ? {...base, readiness: "UNVERIFIED", detail: `${base.detail} (no automated probe available for this connector — verified only after its first real successful run)`} : {...base, readiness: "BLOCKED"};
  if (!base.configured) return {...base, readiness: "BLOCKED"};
  const probed = await probeFn();
  return {...base, ...probed};
}

export async function probeAllConnectors() {
  const status = connectorStatus();
  const probed = await Promise.all(status.connectors.map(item => probeConnector(item.id)));
  return {...status, connectors: probed};
}
