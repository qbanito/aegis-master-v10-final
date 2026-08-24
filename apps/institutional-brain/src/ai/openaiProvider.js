// OpenAI Provider — uses the Responses API (matching the convention already established in
// packages/inter-brain-protocol/src/chat.js), with a structured-output mode (JSON Schema) for
// agent decisions and a plain-text mode for free-form questions. Every call has a timeout and
// throws on failure so the caller can fall back to deterministic local reasoning — this provider
// never silently returns fabricated content.
function extractText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text) return payload.output_text.trim();
  return (payload?.output || [])
    .flatMap(item => item?.content || [])
    .map(item => item?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function callResponsesApi(body, timeoutMs) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {authorization: `Bearer ${apiKey}`, "content-type": "application/json"},
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OPENAI_HTTP_${response.status}`);
  return payload;
}

export async function generate({system, input, model, maxOutputTokens = 800, timeoutMs = 20000}) {
  const payload = await callResponsesApi({model, instructions: system, input, max_output_tokens: maxOutputTokens}, timeoutMs);
  const text = extractText(payload);
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  return {text, provider: "openai", model: payload.model || model};
}

export async function generateStructured({system, input, model, schemaName, jsonSchema, maxOutputTokens = 3500, reasoningEffort = "low", timeoutMs = 75000}) {
  const payload = await callResponsesApi({
    model,
    instructions: system,
    input,
    max_output_tokens: maxOutputTokens,
    reasoning: {effort: reasoningEffort},
    text: {format: {type: "json_schema", name: schemaName, schema: jsonSchema, strict: true}}
  }, timeoutMs);
  // Reasoning tokens are drawn from the same max_output_tokens budget as the JSON answer — if the
  // model spent it all reasoning, the JSON text comes back truncated mid-string. Fail loudly with
  // a clear cause instead of handing JSON.parse a broken string.
  if (payload.status === "incomplete" && payload.incomplete_details?.reason === "max_output_tokens") {
    throw new Error("OPENAI_RESPONSE_TRUNCATED_MAX_OUTPUT_TOKENS");
  }
  const text = extractText(payload);
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  const parsed = JSON.parse(text);
  return {json: parsed, provider: "openai", model: payload.model || model};
}
