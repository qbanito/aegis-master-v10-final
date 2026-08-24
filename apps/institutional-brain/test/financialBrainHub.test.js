import test from "node:test";
import assert from "node:assert/strict";
import {buildDealFromForm, dealTypePreset} from "../src/core/dealSpec.js";
import {brainSummary, missingRequirements} from "../src/core/dealState.js";
import {listRoles, assignRole} from "../src/core/roleMapper.js";
import {attemptTransfer} from "../src/core/investorManagement.js";
import {computeComplianceScore} from "../src/core/complianceEngine.js";
import {computeRisk} from "../src/core/riskEngine.js";
import {runWaterfall} from "../src/core/capitalStack.js";
import {decideStage, GOVERNANCE_STAGES} from "../src/core/governanceWorkflow.js";
import {bumpVersion} from "../src/core/versionControl.js";
import {recordMovement, treasuryState} from "../src/core/treasurySimulator.js";
import {deploySimulated} from "../src/core/testnetCenter.js";
import {runWhatIf} from "../src/core/whatIf.js";
import {buildExecutiveSummary} from "../src/core/executiveSummary.js";

function manhattanDeal() { return buildDealFromForm(dealTypePreset("real-estate-spv")); }

test("dealSpec generates a named investor roster with one KYC-pending investor per 7", () => {
  const deal = manhattanDeal();
  assert.equal(deal.investors.list.length, 25);
  assert.ok(deal.investors.list.some(i => i.kyc === "PENDING"));
  assert.ok(deal.investors.list.every(i => i.name && i.wallet));
});

test("Financial Brain reports missing requirements before any progress is made", () => {
  const deal = manhattanDeal();
  const missing = missingRequirements(deal);
  assert.ok(missing.length > 0);
  assert.ok(missing.some(m => m.includes("role")));
});

test("Financial Brain brainSummary answers all 4 canned questions", () => {
  const deal = manhattanDeal();
  const summary = brainSummary(deal);
  assert.equal(Object.keys(summary.qa).length, 4);
  assert.ok(summary.statusOrder.includes("Draft"));
});

test("Role Mapper starts with unassigned roles for a fresh deal and can assign one", () => {
  const deal = manhattanDeal();
  const before = listRoles(deal).find(r => r.id === "custodian");
  assert.equal(before.assigned, false);
  assignRole(deal, "custodian", "State Street Custody (SIMULATED)");
  const after = listRoles(deal).find(r => r.id === "custodian");
  assert.equal(after.assigned, true);
});

test("Investor transfer to an unverified wallet is rejected", () => {
  const deal = manhattanDeal();
  const investor = deal.investors.list[0];
  const result = attemptTransfer(deal, investor.id, "0xNOT_A_REAL_INVESTOR_WALLET");
  assert.equal(result.result, "REJECTED");
  assert.equal(result.ruleViolated, "unverifiedInvestorCannotReceiveRestrictedAsset");
});

test("Investor transfer to a KYC-pending investor's own wallet blocks on KYC first", () => {
  const deal = manhattanDeal();
  const pendingInvestor = deal.investors.list.find(i => i.kyc === "PENDING");
  const result = attemptTransfer(deal, pendingInvestor.id, pendingInvestor.wallet);
  assert.equal(result.result, "REJECTED");
});

test("Compliance score drops below 100 while any investor KYC is pending", () => {
  const deal = manhattanDeal();
  const score = computeComplianceScore(deal);
  assert.ok(score.score < 100);
  assert.ok(score.blockedBy);
});

test("Risk engine returns 9 categories and an overall score in range", () => {
  const deal = manhattanDeal();
  const risk = computeRisk(deal);
  assert.equal(risk.categories.length, 9);
  assert.ok(risk.overall >= 0 && risk.overall <= 100);
});

test("Capital stack waterfall pays senior debt before residual equity", () => {
  const deal = manhattanDeal();
  const waterfall = runWaterfall(deal, 1_000_000);
  const senior = waterfall.payouts.find(p => p.trancheId === "senior-debt");
  const equity = waterfall.payouts.find(p => p.trancheId === "common-equity");
  assert.ok(senior.paidUsd > 0);
  assert.ok(equity.paidUsd >= 0);
  assert.ok(senior.paidUsd + equity.paidUsd <= 1_000_000 + 0.01);
});

test("Governance: approving all stages passes, and a later spec change invalidates them", () => {
  const deal = manhattanDeal();
  GOVERNANCE_STAGES.forEach(stage => decideStage(deal, stage, "APPROVED", "demo-user"));
  assert.ok(GOVERNANCE_STAGES.every(stage => deal.governance[stage].decision === "APPROVED"));
  const {invalidated} = bumpVersion(deal, deal);
  assert.deepEqual(invalidated.sort(), [...GOVERNANCE_STAGES].sort());
  assert.ok(GOVERNANCE_STAGES.every(stage => deal.governance[stage].decision === "INVALIDATED"));
});

test("Treasury movement without enough signatures is rejected, blocking the withdrawal", () => {
  const deal = manhattanDeal();
  const movement = recordMovement(deal, {amountUsd: 3_000_000, signatures: 1, purpose: "test withdrawal"});
  assert.equal(movement.status, "REJECTED");
  const state = treasuryState(deal);
  assert.equal(state.movements[0].id, movement.id);
});

test("Testnet deployment is blocked until a simulation has run, then produces a simulated record", () => {
  const deal = manhattanDeal();
  assert.throws(() => deploySimulated(deal, "evm"));
  deal.simulationRun = true;
  const record = deploySimulated(deal, "evm");
  assert.match(record.contractAddress, /^0xSIM/);
  assert.ok(record.dataMode.includes("SIMULATED"));
});

test("What-If mode recomputes distributable cash immediately without persisting by default", () => {
  const deal = manhattanDeal();
  const result = runWhatIf(deal, {finance: {annualCashflowUsd: deal.finance.annualCashflowUsd * 0.75}});
  assert.ok(result.simulation.totals.distributedCashUsd < deal.finance.annualCashflowUsd);
  assert.equal(deal.finance.annualCashflowUsd, dealTypePreset("real-estate-spv").finance.annualCashflowUsd);
});

test("Executive summary aggregates across multiple deals", () => {
  const dealA = manhattanDeal();
  const dealB = buildDealFromForm(dealTypePreset("private-credit"));
  const summary = buildExecutiveSummary([dealA, dealB]);
  assert.equal(summary.totalDeals, 2);
  assert.ok(summary.totalSimulatedAssetsUsd > 0);
});
