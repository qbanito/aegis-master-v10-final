import {store, emit, persist} from "../core/store.js";
import {APIFY_BASE_URL, AMAZON_AFFILIATE_ACTOR_ID, envValue} from "../core/config.js";
import {fetchJson, fetchJsonNonIdempotent} from "./httpClient.js";
import {normalizeFeedItem, findProduct} from "../core/productCatalog.js";
import {enrichProduct} from "../core/economics.js";

export async function probeApifyDataset() {
  const token = envValue("APIFY_API_TOKEN", "APIFY_API_KEY");
  const datasetId = process.env.APIFY_DATASET_ID;
  if (!token || !datasetId) return {online: false, readiness: "BLOCKED", error: "APIFY_TOKEN_OR_DATASET_MISSING", checkedAt: new Date().toISOString()};
  const {ok, status, body} = await fetchJson(`${APIFY_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=1`, {headers: {authorization: `Bearer ${token}`, accept: "application/json"}}, {timeoutMs: 8000, retries: 1});
  return {online: ok, readiness: ok ? "READY" : "DEGRADED", itemCount: Array.isArray(body) ? body.length : 0, error: ok ? null : `APIFY_HTTP_${status}`, checkedAt: new Date().toISOString()};
}

// Cheap, free Actor metadata probe (GET, no billed run) — used by readiness/connector status instead
// of firing a real paid run-sync just to check "is this configured and reachable".
let metadataCache = null;
export async function probeApifyActorMetadata({maxAgeMs = 600000} = {}) {
  const token = envValue("APIFY_API_TOKEN", "APIFY_API_KEY");
  if (!token) return {online: false, configured: false, readiness: "BLOCKED", error: "APIFY_TOKEN_MISSING", checkedAt: new Date().toISOString()};
  if (metadataCache && Date.now() - metadataCache.checkedAt < maxAgeMs) return metadataCache.result;
  const {ok, status, body} = await fetchJson(`${APIFY_BASE_URL}/acts/${encodeURIComponent(AMAZON_AFFILIATE_ACTOR_ID)}`, {headers: {authorization: `Bearer ${token}`, accept: "application/json"}}, {timeoutMs: 8000, retries: 1});
  const result = {online: ok, configured: true, readiness: ok ? "READY" : "DEGRADED", actorName: body?.data?.name || body?.name || null, error: ok ? null : `APIFY_HTTP_${status}`, checkedAt: new Date().toISOString()};
  metadataCache = {result, checkedAt: Date.now()};
  return result;
}

export function amazonAffiliateActorInput(input = {}) {
  const keywords = Array.isArray(input.keywords) ? input.keywords.map(item => String(item).trim()).filter(Boolean).slice(0, 25) : String(input.keywords || "").split(",").map(item => item.trim()).filter(Boolean).slice(0, 25);
  return {
    keywords: keywords.length ? keywords : ["home organization", "travel gadgets", "wellness accessories"],
    marketplace: String(input.marketplace || "www.amazon.com"),
    searchIndex: String(input.searchIndex || "All"),
    maxItemsPerKeyword: Math.min(10, Math.max(1, Number(input.maxItemsPerKeyword || 10))),
    maxPagesPerKeyword: Math.min(10, Math.max(1, Number(input.maxPagesPerKeyword || 1))),
    minPrice: Number(input.minPrice || 0),
    maxPrice: Number(input.maxPrice || 0),
    commissionRate: Number(input.commissionRate || 0.04),
    contentCostPerProduct: Number(input.contentCostPerProduct || 1.5),
    minScore: Math.min(100, Math.max(0, Number(input.minScore || 55))),
    maxRequests: Math.min(50, Math.max(1, Number(input.maxRequests || 10))),
    requestDelayMs: Math.min(5000, Math.max(100, Number(input.requestDelayMs || 300)))
  };
}

export async function runAmazonAffiliateScout(input = {}) {
  const token = envValue("APIFY_API_TOKEN", "APIFY_API_KEY");
  if (!token) throw new Error("APIFY_TOKEN_MISSING");
  const actorInput = amazonAffiliateActorInput(input);
  const url = `${APIFY_BASE_URL}/acts/${encodeURIComponent(AMAZON_AFFILIATE_ACTOR_ID)}/run-sync-get-dataset-items?clean=true&format=json`;
  const {ok, status, body, error} = await fetchJsonNonIdempotent(url, {method: "POST", headers: {authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json"}, body: JSON.stringify(actorInput)}, {timeoutMs: 180000, retries: 1});
  if (!ok && status === 0) {
    emit("commerce_provider_error", {source: "apify_amazon_affiliate_actor", actorId: AMAZON_AFFILIATE_ACTOR_ID, message: error}, .8);
    throw new Error(`APIFY_ACTOR_NETWORK_ERROR:${error}`);
  }
  if (!ok) {
    const detail = typeof body?.error?.message === "string" ? body.error.message : (typeof body?.message === "string" ? body.message : `HTTP_${status}`);
    emit("commerce_provider_error", {source: "apify_amazon_affiliate_actor", actorId: AMAZON_AFFILIATE_ACTOR_ID, status, message: detail}, .8);
    throw new Error(`APIFY_ACTOR_RUN_${status}:${detail}`);
  }
  const rows = Array.isArray(body) ? body : (Array.isArray(body?.items) ? body.items : []);
  const runStatus = rows.find(item => item?.recordType === "run_status") || null;
  const discovered = rows.filter(item => item?.recordType === "product" || item?.asin).map((item, index) => normalizeFeedItem(item, "amazon", index));
  discovered.forEach(item => { item.sourceStatus = "AMAZON_CREATORS_API"; item.discoveredVia = "APIFY_ACTOR"; item.paper = true; });
  discovered.forEach(item => {
    const existing = findProduct(item.id);
    const target = existing ? Object.assign(existing, item) : item;
    if (!existing) store.products.push(target);
    enrichProduct(target);
  });
  const result = {actorId: AMAZON_AFFILIATE_ACTOR_ID, input: actorInput, status: runStatus?.status || (discovered.length ? "READY" : "NO_RESULTS"), summary: runStatus, discovered: discovered.length, items: discovered, mode: "PAPER", shopifyPublishAllowed: false};
  emit("commerce_amazon_affiliate_scout_completed", {actorId: result.actorId, status: result.status, discovered: result.discovered, summary: result.summary}, .8);
  persist();
  return result;
}
