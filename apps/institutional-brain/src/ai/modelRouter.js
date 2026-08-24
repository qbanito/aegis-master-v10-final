// Model Router — fast/standard/deep tiers, configurable via env but defaulting to the names the
// user specified. `fast` is reserved for future pre-classification use; agent runs in this build
// start at `standard` and escalate to `deep` deterministically (never the model deciding for itself).
const TIER_MODELS = {
  fast: process.env.AEGIS_MODEL_FAST || "gpt-5.6-luna",
  standard: process.env.AEGIS_MODEL_STANDARD || "gpt-5.6-terra",
  deep: process.env.AEGIS_MODEL_DEEP || "gpt-5.6-sol"
};

export function modelForTier(tier) {
  return TIER_MODELS[tier] || TIER_MODELS.standard;
}

const TIER_REASONING_EFFORT = {fast: "low", standard: "low", deep: "high"};

export function reasoningEffortForTier(tier) {
  return TIER_REASONING_EFFORT[tier] || TIER_REASONING_EFFORT.standard;
}

// Deterministic escalation rule (spec section 11): confidence < 70, a REJECT/BLOCK decision, or
// detected disagreement across agents all push the next run to the deep tier.
export function escalateTier(currentTier, {confidence, decision, disagreement} = {}) {
  const needsEscalation = (typeof confidence === "number" && confidence < 70)
    || ["REJECT", "BLOCK"].includes(decision)
    || disagreement === true;
  if (!needsEscalation) return currentTier;
  if (currentTier === "fast") return "standard";
  return "deep";
}
