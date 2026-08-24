import {emit} from "../core/store.js";
import {envValue, APIFY_BASE_URL} from "../core/config.js";
import {normalizeFeedItem} from "../core/productCatalog.js";
import {fetchJson} from "./httpClient.js";

// Covers both amazon and aliexpress: tries a direct provider feed URL first, then falls back to a
// shared Apify dataset if one is configured. Returns null (not []) when nothing could be fetched at
// all, distinct from an empty real feed — callers use that distinction to decide NO_SIGNAL vs empty.
export async function providerFeedCandidates(source) {
  const feedUrl = source === "amazon" ? process.env.AMAZON_PRODUCT_FEED_URL : process.env.ALIEXPRESS_API_URL;
  if (feedUrl) {
    const headers = process.env.ALIEXPRESS_API_KEY && source === "aliexpress" ? {authorization: `Bearer ${process.env.ALIEXPRESS_API_KEY}`, "x-api-key": process.env.ALIEXPRESS_API_KEY} : {};
    const {ok, status, body, error} = await fetchJson(feedUrl, {headers}, {timeoutMs: 8000, retries: 1});
    if (ok) {
      const items = Array.isArray(body) ? body : body?.items || body?.products || body?.data || [];
      return items.slice(0, 30).map((item, index) => normalizeFeedItem(item, source, index));
    }
    emit("commerce_provider_error", {source, message: status === 0 ? error : `provider ${status}`}, .7);
  }
  const token = envValue("APIFY_API_TOKEN", "APIFY_API_KEY");
  const datasetId = process.env.APIFY_DATASET_ID;
  if (!token || !datasetId) return null;
  const {ok, status, body, error} = await fetchJson(`${APIFY_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`, {headers: {authorization: `Bearer ${token}`, accept: "application/json"}}, {timeoutMs: 10000, retries: 1});
  if (!ok) { emit("commerce_provider_error", {source: "apify", message: status === 0 ? error : `apify ${status}`}, .7); return null; }
  const items = Array.isArray(body) ? body : body?.items || body?.data || [];
  const tagged = items.filter(item => { const marker = String(item.source || item.marketplace || item.platform || "").toLowerCase(); return !marker || marker.includes(source); });
  return (tagged.length ? tagged : items).slice(0, 30).map((item, index) => normalizeFeedItem({...item, sourceStatus: "APIFY_DATASET"}, source, index));
}
