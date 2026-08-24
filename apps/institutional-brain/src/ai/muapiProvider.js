// MuAPI Provider — experimental alternative LLM endpoint (spec section 12: MuAPI is primarily a
// generative-media provider; its LLM endpoint is used here only as an optional secondary text/
// structured-output provider, never for media generation, and never as the sole provider for a
// financial decision). Ported from the working submit+poll pattern already proven in
// apps/finance-brain/server/src/agent/providerAdapter.js.
const clean = value => String(value || "").trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function extractMuapiText(payload) {
  const candidates = [payload?.output_text, payload?.text, payload?.response, payload?.result, payload?.output, payload?.data?.output_text, payload?.data?.text, payload?.data?.response, payload?.data?.result, payload?.data?.output];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) { const text = value.map(item => typeof item === "string" ? item : item?.text || item?.content || "").filter(Boolean).join("\n").trim(); if (text) return text; }
    if (value && typeof value === "object") { const text = value.text || value.content || value.output_text || value.response; if (typeof text === "string" && text.trim()) return text.trim(); }
  }
  return "";
}

async function submitAndPoll({system, input, model, jsonSchema, timeoutMs}) {
  const apiKey = process.env.MUAPI_API_KEY;
  if (!apiKey) throw new Error("MUAPI_API_KEY_MISSING");
  const base = clean(process.env.MUAPI_BASE_URL || "https://api.muapi.ai").replace(/\/$/, "");
  // MuAPI's REST path uses dash-separated model slugs (e.g. gpt-5-6-sol), not the dotted names
  // used elsewhere (gpt-5.6-sol) — matches the convention already established in
  // apps/finance-brain/server/src/agent/providerAdapter.js's MUAPI_COPILOT_MODEL default.
  const muapiModel = String(model).replace(/\./g, "-");
  const schemaInstruction = jsonSchema ? `\n\nDevuelve solamente JSON válido que cumpla este JSON Schema:\n${JSON.stringify(jsonSchema)}` : "";
  const submit = await fetch(`${base}/api/v1/${muapiModel}`, {
    method: "POST",
    headers: {"content-type": "application/json", "x-api-key": apiKey},
    body: JSON.stringify({prompt: input, system_prompt: `${system}${schemaInstruction}`, reasoning_effort: "high", web_search_switch: false}),
    signal: AbortSignal.timeout(Math.min(timeoutMs, 30000))
  });
  const submitted = await submit.json().catch(() => ({}));
  if (!submit.ok) throw new Error(submitted?.message || submitted?.error || `MUAPI_HTTP_${submit.status}`);

  let result = submitted;
  const requestId = submitted?.request_id || submitted?.id || submitted?.data?.request_id;
  if (requestId) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(900);
      const response = await fetch(`${base}/api/v1/predictions/${encodeURIComponent(requestId)}/result`, {headers: {"x-api-key": apiKey}, signal: AbortSignal.timeout(Math.min(15000, Math.max(1500, deadline - Date.now())))});
      result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.error || `MUAPI_RESULT_HTTP_${response.status}`);
      const status = clean(result?.status || result?.data?.status).toLowerCase();
      if (["failed", "error", "cancelled"].includes(status)) throw new Error(result?.error || result?.message || `MUAPI_${status.toUpperCase()}`);
      const text = extractMuapiText(result);
      if (text) return text;
      if (["completed", "succeeded", "success"].includes(status)) break;
    }
  }
  const text = extractMuapiText(result);
  if (!text) throw new Error(requestId ? "MUAPI_RESULT_TIMEOUT_OR_EMPTY" : "MUAPI_EMPTY_RESPONSE");
  return text;
}

export async function generate({system, input, model, timeoutMs = 25000}) {
  const text = await submitAndPoll({system, input, model, timeoutMs});
  return {text, provider: "muapi", model};
}

export async function generateStructured({system, input, model, jsonSchema, timeoutMs = 30000}) {
  const text = await submitAndPoll({system, input, model, jsonSchema, timeoutMs});
  return {json: JSON.parse(text), provider: "muapi", model};
}
