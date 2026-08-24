import {store, emit} from "../core/store.js";
import {buildDigitalProductOpportunity} from "../module-engine.js";

export function run(input = {}) {
  const top = store.products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || {};
  const opportunity = buildDigitalProductOpportunity(input, top);
  store.digitalProducts.unshift(opportunity);
  const blockers = opportunity.validation.status === "SUPPORTED" ? [] : ["problem_validation_required"];
  emit("commerce_digital_product_draft", {opportunityId: opportunity.id, validation: opportunity.validation, mode: "PAPER"}, .7);
  return {status: opportunity.validation.status === "SUPPORTED" ? "READY_FOR_PAPER_TEST" : "REVIEW_REQUIRED", mode: "PAPER", opportunity, blockers};
}
