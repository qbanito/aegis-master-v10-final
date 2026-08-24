function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Retry-with-backoff fetch for idempotent (GET/HEAD) or otherwise safe-to-repeat calls.
 * Retries on network failure and on retryable 5xx/429-style statuses.
 */
export async function fetchJson(url, options = {}, {retries = 2, baseDelayMs = 300, timeoutMs = 8000} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {...options, signal: AbortSignal.timeout(timeoutMs)});
      if (!response.ok && RETRYABLE_STATUS.has(response.status) && attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      const body = await response.json().catch(() => null);
      return {ok: response.ok, status: response.status, body, error: response.ok ? null : `HTTP_${response.status}`};
    } catch (error) {
      lastError = error;
      if (attempt < retries) { await sleep(baseDelayMs * 2 ** attempt); continue; }
    }
  }
  return {ok: false, status: 0, body: null, error: lastError?.message || "NETWORK_ERROR"};
}

/**
 * For non-idempotent calls that start/pay for real work (e.g. Apify's run-sync POST, which starts
 * and bills an Actor run). Only retries when the network failed BEFORE any HTTP response was
 * received (DNS/timeout/connection-reset) — never on a received status code, since we can't know
 * whether the side effect already happened.
 */
export async function fetchJsonNonIdempotent(url, options = {}, {retries = 1, baseDelayMs = 500, timeoutMs = 180000} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {...options, signal: AbortSignal.timeout(timeoutMs)});
      const body = await response.json().catch(() => null);
      return {ok: response.ok, status: response.status, body, error: response.ok ? null : `HTTP_${response.status}`};
    } catch (error) {
      lastError = error;
      if (attempt < retries) { await sleep(baseDelayMs * 2 ** attempt); continue; }
    }
  }
  return {ok: false, status: 0, body: null, error: lastError?.message || "NETWORK_ERROR"};
}
