import {dealTypeDefinition} from "./config.js";
import {runBaseSimulation, runPresetSimulation} from "./simulationEngine.js";
import {computeSecurityScore} from "./securityScore.js";
import {computeComplianceScore} from "./complianceEngine.js";
import {computeRisk} from "./riskEngine.js";
import {generateInvestors} from "./dealSpec.js";

function deepMerge(base, overrides) {
  const result = {...base};
  for (const [key, value] of Object.entries(overrides || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof base[key] === "object") {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// What-If Mode — applies a variable override to a clone of the deal and recomputes cash flow,
// waterfall, risk, and compliance/security impact immediately. Does not persist unless the
// caller explicitly commits (index.js handles the commit + audit trail + version bump).
export function runWhatIf(deal, overrides) {
  const merged = deepMerge(deal, overrides);
  if (overrides.investors?.count) merged.investors.list = generateInvestors(merged);

  const definition = dealTypeDefinition(merged.dealType);
  const simulation = definition.fullyModeled ? runBaseSimulation(merged) : runPresetSimulation(merged);

  return {
    overridesApplied: overrides,
    simulation,
    risk: computeRisk(merged),
    compliance: computeComplianceScore(merged),
    security: computeSecurityScore(merged),
    mergedSpec: merged
  };
}
