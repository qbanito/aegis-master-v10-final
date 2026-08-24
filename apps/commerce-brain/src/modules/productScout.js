import {store} from "../core/store.js";
import {connector} from "../connectors/connectorRegistry.js";
import {discoverProducts} from "../core/discovery.js";
import {runAmazonAffiliateScout} from "../connectors/apifyConnector.js";

// Product Scout previously had no real logic of its own — it only ever ran through the generic
// fake-signal runBot() path. This gives it a genuine Amazon-scoped action.
export async function run(input = {}) {
  const amazon = connector("amazon");
  const apify = connector("apify");
  if (!amazon?.configured && !apify?.configured) {
    return {status: "BLOCKED", mode: "PAPER", source: "amazon", blockers: ["amazon_provider_credentials_missing"], message: "Configura AMAZON_PRODUCT_FEED_URL, credenciales de Amazon Creators API, o APIFY_API_TOKEN antes de escanear Amazon."};
  }
  if (input.useApifyActor === true && apify?.configured) {
    const result = await runAmazonAffiliateScout(input);
    return {status: result.discovered > 0 ? "READY" : "NO_RESULTS", mode: "PAPER", source: "apify_actor", ...result};
  }
  const discovery = await discoverProducts(["amazon"]);
  if (discovery.noSignalSources.includes("amazon")) {
    return {status: "DEGRADED", mode: "PAPER", source: "amazon", blockers: ["AMAZON_FEED_EMPTY_OR_UNAVAILABLE"], message: "El conector está configurado pero no entregó candidatos válidos en este ciclo."};
  }
  const ranked = store.products.filter(product => product.source === "amazon").slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 10).map(product => ({id: product.id, name: product.name, score: product.score, tier: product.tier, marginPct: product.economics?.marginPct}));
  return {status: "READY", mode: "PAPER", source: "amazon", discovered: discovery.discovered, ranked};
}
