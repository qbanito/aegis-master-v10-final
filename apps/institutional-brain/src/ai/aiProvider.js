import * as openaiProvider from "./openaiProvider.js";
import * as muapiProvider from "./muapiProvider.js";

const PROVIDERS = {openai: openaiProvider, muapi: muapiProvider};

function providerOrder() {
  const configured = String(process.env.AEGIS_AI_PROVIDER || "openai").toLowerCase();
  const rest = Object.keys(PROVIDERS).filter(name => name !== configured);
  return [configured, ...rest].filter(name => PROVIDERS[name]);
}

export function providerStatus() {
  return {
    openai: {configured: Boolean(process.env.OPENAI_API_KEY)},
    muapi: {configured: Boolean(process.env.MUAPI_API_KEY)},
    order: providerOrder()
  };
}

// Tries providers in AEGIS_AI_PROVIDER order (default openai, then muapi), never falling silently
// to fabricated content — if every provider fails, the caller (agentRuntime.js) is responsible for
// the deterministic local fallback, exactly like the pattern already established in
// apps/commerce-brain/src/copilot/providerAdapter.js.
// Errors from every attempted provider are preserved (not just the last one) — a silent
// openai-then-muapi fallback chain that only surfaces muapi's error makes the real failure
// undiagnosable, which is exactly what happened during implementation testing here.
export async function generateStructured(args) {
  const errors = [];
  for (const name of providerOrder()) {
    try { return await PROVIDERS[name].generateStructured(args); }
    catch (error) { errors.push(`${name}: ${error.message}`); }
  }
  throw new Error(errors.length ? errors.join(" | ") : "NO_AI_PROVIDER_AVAILABLE");
}

export async function generate(args) {
  const errors = [];
  for (const name of providerOrder()) {
    try { return await PROVIDERS[name].generate(args); }
    catch (error) { errors.push(`${name}: ${error.message}`); }
  }
  throw new Error(errors.length ? errors.join(" | ") : "NO_AI_PROVIDER_AVAILABLE");
}
