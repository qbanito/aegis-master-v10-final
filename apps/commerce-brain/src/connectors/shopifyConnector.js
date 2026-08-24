import {configuredEnv} from "../core/config.js";
import {fetchJson} from "./httpClient.js";

export function shopifyConfigured() {
  return configuredEnv("SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_ACCESS_TOKEN");
}

let cache = null;

/**
 * Honest Shopify probe: a real GET against shop.json, cached for maxAgeMs so the dashboard/readiness
 * poll doesn't hammer Shopify's API. Pass force:true to bypass the cache (explicit operator probe).
 */
export async function probeShopify({maxAgeMs = 900000, force = false} = {}) {
  if (!shopifyConfigured()) return {online: false, configured: false, readiness: "BLOCKED", error: "SHOPIFY_CREDENTIALS_NOT_CONFIGURED", checkedAt: new Date().toISOString()};
  if (!force && cache && Date.now() - cache.checkedAt < maxAgeMs) return cache.result;
  const domain = String(process.env.SHOPIFY_STORE_DOMAIN).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const version = process.env.SHOPIFY_API_VERSION || "2025-07";
  const {ok, status, body, error} = await fetchJson(`https://${domain}/admin/api/${version}/shop.json`, {headers: {"x-shopify-access-token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN, accept: "application/json"}}, {timeoutMs: 8000, retries: 1});
  const result = {online: ok, configured: true, readiness: ok ? "READY" : "DEGRADED", status, shop: body?.shop || null, error: ok ? null : (body?.errors ? JSON.stringify(body.errors) : error), checkedAt: new Date().toISOString()};
  cache = {result, checkedAt: Date.now()};
  return result;
}
