import {ASSET_MODE, MEDIA_BRAIN_URL} from "../core/config.js";
import {fetchJson} from "./httpClient.js";

export async function mediaAsset(prompt) {
  if (ASSET_MODE === "brief") return {mode: "brief", status: "NOT_REQUESTED", prompt};
  try {
    const response = await fetch(`${MEDIA_BRAIN_URL}/api/generate/image`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({preset: "product-launch", prompt, brain: "commerce", provider: ASSET_MODE === "remote" ? "muapi" : "mock"})});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Media Brain ${response.status}`);
    return {mode: ASSET_MODE, status: body.job?.status || "QUEUED", job: body.job || body};
  } catch (error) { return {mode: ASSET_MODE, status: "DEGRADED", error: error.message, prompt}; }
}

let cache = null;
export async function probeMedia({maxAgeMs = 120000} = {}) {
  if (cache && Date.now() - cache.checkedAt < maxAgeMs) return cache.result;
  const {ok, body, error} = await fetchJson(`${MEDIA_BRAIN_URL}/api/media/status`, {}, {timeoutMs: 2500, retries: 0});
  const result = ok
    ? {online: true, configured: Boolean(body?.provider?.configured), readiness: "READY", live: body?.provider?.mode === "REMOTE_API", detail: `${body?.provider?.provider || "unknown"} · ${body?.provider?.mode || "offline"} · ${body?.models || 0} models`, checkedAt: new Date().toISOString()}
    : {online: false, configured: false, readiness: "DEGRADED", live: false, detail: `Media Brain unavailable: ${error || "unknown error"}`, checkedAt: new Date().toISOString()};
  cache = {result, checkedAt: Date.now()};
  return result;
}
