import {store, emit} from "../core/store.js";

export function run(input = {}) {
  const budget = Math.max(0, Number(input.budget || 100));
  const eligible = store.products.filter(product => product.tier === "TEST_READY" && Number(product.economics?.contribution || 0) >= store.moduleConfigs.allocator.minContribution);
  const totalWeight = eligible.reduce((sum, product) => sum + Math.max(0, Number(product.score || 0)) * Math.max(0, Number(product.economics?.contribution || 0)), 0);
  const allocations = eligible.map(product => { const raw = totalWeight ? budget * (Number(product.score || 0) * Math.max(0, Number(product.economics?.contribution || 0)) / totalWeight) : 0; const capped = Math.min(raw, budget * store.moduleConfigs.allocator.maxProductAllocationPct); return {productId: product.id, name: product.name, recommendedBudget: Number(capped.toFixed(2)), maxCac: product.economics?.targetCac || 0, rationale: "score × positive contribution", paperOnly: true}; });
  const result = {status: allocations.length ? "READY_FOR_PAPER_TEST" : "REVIEW_REQUIRED", mode: "PAPER", budget, allocations, totalAllocated: Number(allocations.reduce((sum, item) => sum + item.recommendedBudget, 0).toFixed(2)), blockers: allocations.length ? [] : ["NO_TEST_READY_PRODUCTS"], spendAllowed: false};
  emit("commerce_revenue_allocation_proposed", {allocations: allocations.length, budget, mode: "PAPER"}, .75);
  return result;
}
