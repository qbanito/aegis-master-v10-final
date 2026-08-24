import test from "node:test";
import assert from "node:assert/strict";
import {runBaseSimulation, runScenario, SCENARIO_IDS} from "../src/core/simulationEngine.js";
import {dealTypePreset} from "../src/core/dealSpec.js";
import {DealSpecSchema} from "../src/core/dealSpec.js";

function manhattanDeal() {
  return DealSpecSchema.parse(dealTypePreset("real-estate-spv"));
}

test("base simulation runs 4 quarterly periods and reconciles investor distributions", () => {
  const result = runBaseSimulation(manhattanDeal());
  assert.equal(result.periods.length, 4);
  const totalToInvestors = result.investorBalances.reduce((sum, investor) => sum + investor.cumulativeDistributionUsd, 0);
  assert.ok(Math.abs(totalToInvestors - result.totals.distributedCashUsd) < 1, "per-investor distributions should reconcile with total distributed cash");
  assert.equal(result.investorBalances.length, 25);
});

test("base simulation satisfies all 7 financial invariants", () => {
  const result = runBaseSimulation(manhattanDeal());
  assert.equal(result.invariants.length, 7);
  assert.ok(result.invariants.every(item => item.satisfied), JSON.stringify(result.invariants.filter(i => !i.satisfied)));
});

test("debt service is interest-only: principal outstanding stays flat within the 12-month window", () => {
  const result = runBaseSimulation(manhattanDeal());
  assert.equal(result.principalOutstandingUsd, manhattanDeal().finance.seniorCapitalUsd);
  assert.ok(result.totals.debtServiceUsd > 0);
});

test("base simulation distributes positive cash to investors each period", () => {
  const result = runBaseSimulation(manhattanDeal());
  assert.ok(result.totals.distributedCashUsd > 0, "Manhattan preset should cashflow positively after interest-only debt service");
  assert.ok(result.investorBalances.every(investor => investor.cumulativeDistributionUsd > 0));
});

test("every adverse scenario is covered and each produces a defensive result with a reason", () => {
  assert.ok(SCENARIO_IDS.length >= 16, `expected at least 16 adverse scenarios, got ${SCENARIO_IDS.length}`);
  const deal = manhattanDeal();
  const validResults = ["REJECTED", "BLOCKED", "HALTED", "FLAGGED", "DELAYED", "PAUSED"];
  for (const scenarioId of SCENARIO_IDS) {
    const result = runScenario(deal, scenarioId);
    assert.ok(validResults.includes(result.result), `${scenarioId} returned unexpected result: ${result.result}`);
    assert.ok(result.reason && result.ruleViolated, `${scenarioId} missing reason/ruleViolated`);
  }
});

test("distribution-error scenario is flagged as a financial invariant violation", () => {
  const result = runScenario(manhattanDeal(), "distribution-error");
  assert.equal(result.ruleViolated, "distributedCash<=availableCash");
  assert.equal(result.detail.satisfied, false);
});

test("treasury-compromise scenario requires the configured multisig threshold", () => {
  const deal = manhattanDeal();
  const result = runScenario(deal, "treasury-compromise");
  assert.ok(result.reason.includes(`${deal.custody.multisigThreshold}/${deal.custody.multisigSigners}`));
});
