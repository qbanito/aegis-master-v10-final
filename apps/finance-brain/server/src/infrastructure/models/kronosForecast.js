const SERVICE_URL = String(process.env.KRONOS_SERVICE_URL || 'http://127.0.0.1:8815').replace(/\/$/, '');
const ENABLED = String(process.env.KRONOS_ENABLED || 'false').toLowerCase() === 'true';
const TIMEOUT_MS = Math.max(500, Number(process.env.KRONOS_TIMEOUT_MS || 15000));
const metrics = {requests: 0, available: 0, unavailable: 0, errors: 0, lastRequestAt: null, lastSuccessAt: null, lastError: null};

export function kronosStatus() {
  return {provider: 'Kronos-mini', serviceUrl: SERVICE_URL, enabled: ENABLED, mode: ENABLED ? 'SHADOW_OR_PAPER' : 'DISABLED', timeoutMs: TIMEOUT_MS, ...metrics};
}

export async function kronosForecast({symbol, interval, candles, timestamps, predLen = 12, sampleCount = 1} = {}) {
  metrics.requests += 1;
  metrics.lastRequestAt = new Date().toISOString();
  if (!ENABLED) {
    metrics.unavailable += 1;
    return {available: false, mode: 'DISABLED', reason: 'KRONOS_ENABLED_FALSE'};
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${SERVICE_URL}/forecast`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({symbol, interval, candles, timestamps, pred_len: predLen, sample_count: sampleCount}), signal: controller.signal});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.available !== true) {
      metrics.unavailable += 1;
      metrics.lastError = body.error || `KRONOS_HTTP_${response.status}`;
      return {available: false, mode: 'UNAVAILABLE', reason: metrics.lastError, status: body.status || null};
    }
    metrics.available += 1;
    metrics.lastSuccessAt = new Date().toISOString();
    metrics.lastError = null;
    return body;
  } catch (error) {
    metrics.errors += 1;
    metrics.lastError = error?.name === 'AbortError' ? 'KRONOS_TIMEOUT' : error?.message || 'KRONOS_REQUEST_ERROR';
    return {available: false, mode: 'UNAVAILABLE', reason: metrics.lastError};
  } finally {
    clearTimeout(timer);
  }
}
