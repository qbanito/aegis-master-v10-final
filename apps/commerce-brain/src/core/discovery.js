import {store, emit, persist} from "./store.js";
import {SYSTEM_DATA_MODE} from "./config.js";
import {findProduct} from "./productCatalog.js";
import {enrichProduct} from "./economics.js";
import {providerFeedCandidates} from "../connectors/feedConnector.js";
import {syntheticCandidates} from "../storage/syntheticCandidates.js";

// Structural rule (not a heuristic): synthetic samples only ever get created when the deploy-time
// systemDataMode is DEMO. In PAPER_WITH_REAL_DATA/LIVE, an empty real feed produces no fabricated
// backfill — callers see noSignalSources instead and should report NO_SIGNAL, never invent products.
export async function discoverProducts(sources = ["amazon", "aliexpress"]) {
  const requested = sources.filter(source => ["amazon", "aliexpress"].includes(source));
  const providerResults = await Promise.all(requested.map(source => providerFeedCandidates(source)));
  const allowSynthetic = SYSTEM_DATA_MODE === "DEMO";
  const noSignalSources = [];
  const discovered = requested.flatMap((source, index) => {
    if (providerResults[index]?.length) return providerResults[index];
    if (allowSynthetic) return syntheticCandidates(source);
    noSignalSources.push(source);
    return [];
  });
  discovered.forEach(item => { const existing = findProduct(item.id); const target = existing ? Object.assign(existing, item) : item; if (!existing) store.products.push(target); enrichProduct(target); });
  emit("commerce_product_discovery", {sources: requested, count: discovered.length, mode: SYSTEM_DATA_MODE, providerFeedUsed: providerResults.some(items => items?.length), noSignalSources});
  persist();
  return {items: store.products, providerFeedUsed: providerResults.some(items => items?.length), discovered: discovered.length, noSignalSources};
}
