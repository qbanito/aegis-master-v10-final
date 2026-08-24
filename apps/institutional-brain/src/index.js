import express from "express";
import cors from "cors";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {NAME, KIND, PORT, DEAL_TYPE_DEFINITIONS, ADAPTER_DEFINITIONS, dealTypeDefinition, adapterDefinition} from "./core/config.js";
import {store, findDeal, upsertDeal} from "./core/store.js";
import {buildDealFromForm, dealTypePreset} from "./core/dealSpec.js";
import {glossaryList} from "./core/glossary.js";
import {buildContractArchitecture} from "./core/contractArchitecture.js";
import {generateEvmSource} from "./adapters/evmAdapter.js";
import {generateStellarSource} from "./adapters/stellarAdapter.js";
import {generateCantonSource} from "./adapters/cantonAdapter.js";
import {buildComparisonTable} from "./adapters/comparisonTable.js";
import {runBaseSimulation, runPresetSimulation, run1Month, run12Months, runFullLifecycle, runStressTest, runScenario, SCENARIO_IDS} from "./core/simulationEngine.js";
import {computeSecurityScore} from "./core/securityScore.js";
import {networkFit} from "./core/networkIntelligence.js";
import {buildTransactionPackage, transactionPackageToMarkdown} from "./core/transactionPackage.js";

import {brainSummary, askFinancialBrain} from "./core/dealState.js";
import {listRoles, assignRole} from "./core/roleMapper.js";
import {listCounterparties, addCounterparty} from "./core/counterpartyIntelligence.js";
import {listInvestors, attemptTransfer} from "./core/investorManagement.js";
import {computeComplianceScore} from "./core/complianceEngine.js";
import {computeRisk} from "./core/riskEngine.js";
import {listTranches, runWaterfall} from "./core/capitalStack.js";
import {digitalTwinAt} from "./core/digitalTwin.js";
import {listGovernance, decideStage} from "./core/governanceWorkflow.js";
import {treasuryState, recordMovement} from "./core/treasurySimulator.js";
import {testnetState, deploySimulated} from "./core/testnetCenter.js";
import {monitoringFeed} from "./core/monitoringCenter.js";
import {listAuditTrail, recordAction} from "./core/auditTrail.js";
import {listVersions, diffVersions, bumpVersion} from "./core/versionControl.js";
import {runWhatIf} from "./core/whatIf.js";
import {computeRevenueModel} from "./core/revenueModel.js";
import {buildExecutiveSummary} from "./core/executiveSummary.js";
import {listTenants} from "./core/tenants.js";

import {listAgents} from "./core/agentRegistry.js";
import {runAgent} from "./core/agentRuntime.js";
import {availableFlows, runFlow, conveneCommittee} from "./core/orchestrator.js";
import {listActions, completeAction} from "./core/actionEngine.js";
import {listScenarioPresets} from "../agents-scenarios/scenarioLibrary.js";
import {runScenarioSession, listNexusSessions, latestNexusSession} from "./core/nexusSession.js";
import {evaluateApprovalGates} from "./core/approvalGates.js";
import {evaluateTokenizationFit} from "./core/tokenizationEngine.js";
import {buildDealReport} from "./core/dealReport.js";
import {renderDealReportPdf} from "./core/pdfRenderer.js";

try { process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env")); } catch {}

const app = express();
app.use(cors());
app.use(express.json({limit: "1mb"}));

const ADAPTER_GENERATORS = {evm: generateEvmSource, stellar: generateStellarSource, canton: generateCantonSource};
const startedAt = new Date().toISOString();

function dealNotFound(res) { return res.status(404).json({ok: false, error: "DEAL_NOT_FOUND"}); }
function save(deal) { deal.updatedAt = new Date().toISOString(); upsertDeal(deal); return deal; }

app.get("/health", (req, res) => res.json({
  name: NAME, kind: KIND, status: "online",
  dealTypes: DEAL_TYPE_DEFINITIONS.length, deals: store.deals.length,
  agentsTotal: DEAL_TYPE_DEFINITIONS.length, agentsOnline: DEAL_TYPE_DEFINITIONS.length,
  startedAt: startedAt
}));

app.get("/api/deal-types", (req, res) => res.json({dealTypes: DEAL_TYPE_DEFINITIONS, adapters: ADAPTER_DEFINITIONS}));
app.get("/api/glossary", (req, res) => res.json({terms: glossaryList()}));
app.get("/api/tenants", (req, res) => res.json({tenants: listTenants()}));
app.get("/api/executive-summary", (req, res) => res.json(buildExecutiveSummary(store.deals)));

app.get("/api/deals", (req, res) => res.json({deals: store.deals}));

app.get("/api/deals/:id", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(deal);
});

app.post("/api/deals", (req, res) => {
  try {
    const presetId = req.query.preset || req.body?.preset;
    const input = presetId ? {...dealTypePreset(presetId), ...(req.body?.overrides || {})} : req.body;
    const deal = buildDealFromForm(input);
    recordAction(deal, "deal_created", "demo-user", {dealType: deal.dealType});
    upsertDeal(deal);
    res.status(201).json(deal);
  } catch (error) {
    res.status(400).json({ok: false, error: "INVALID_DEAL_SPEC", message: error.message});
  }
});

app.post("/api/deals/:id/architecture", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({dealId: deal.id, architecture: buildContractArchitecture(deal)});
});

app.get("/api/deals/:id/contracts/:adapter", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  const generator = ADAPTER_GENERATORS[req.params.adapter];
  if (!generator) return res.status(404).json({ok: false, error: "UNKNOWN_ADAPTER"});
  const architecture = buildContractArchitecture(deal);
  res.json({dealId: deal.id, adapter: adapterDefinition(req.params.adapter), contracts: generator(deal, architecture)});
});

app.get("/api/deals/:id/comparison", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({dealId: deal.id, comparison: buildComparisonTable(deal)});
});

const SIMULATION_RUNNERS = {"1m": run1Month, "12m": run12Months, lifecycle: runFullLifecycle, stress: runStressTest};

app.post("/api/deals/:id/simulate", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  const definition = dealTypeDefinition(deal.dealType);
  const duration = req.body?.duration || "12m";
  const runner = SIMULATION_RUNNERS[duration];
  const result = definition.fullyModeled && runner ? runner(deal) : runPresetSimulation(deal);
  deal.simulationRun = true;
  deal.lastSimulation = result;
  deal.investors.list.forEach((investor, index) => {
    investor.distributionsReceivedUsd = result.investorBalances?.[index]?.cumulativeDistributionUsd ?? investor.distributionsReceivedUsd;
  });
  recordAction(deal, `simulation_run:${duration}`, "demo-user", {duration});
  save(deal);
  res.json(result);
});

app.post("/api/deals/:id/simulate/scenario", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  const scenarioId = req.body?.scenarioId || req.query.scenarioId;
  if (!SCENARIO_IDS.includes(scenarioId)) return res.status(400).json({ok: false, error: "UNKNOWN_SCENARIO", scenarios: SCENARIO_IDS});
  const result = runScenario(deal, scenarioId);
  deal.lastScenarios = {...(deal.lastScenarios || {}), [scenarioId]: result};
  recordAction(deal, `scenario_run:${scenarioId}`, "demo-user", {result: result.result});
  save(deal);
  res.json(result);
});

app.get("/api/deals/:id/scenarios", (req, res) => res.json({scenarios: SCENARIO_IDS}));

app.get("/api/deals/:id/security-score", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(computeSecurityScore(deal));
});

app.get("/api/deals/:id/network-fit", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(networkFit(deal.dealType));
});

app.get("/api/deals/:id/approval-gates", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(evaluateApprovalGates(deal));
});

app.get("/api/deals/:id/tokenization-fit", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(evaluateTokenizationFit(deal));
});

app.get("/api/deals/:id/report", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(buildDealReport(deal));
});

app.get("/api/deals/:id/report.pdf", async (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const pdf = await renderDealReportPdf(buildDealReport(deal));
    recordAction(deal, "report_pdf_downloaded", req.query.actor || "demo-user", {});
    save(deal);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${deal.name.replace(/[^a-z0-9]+/gi, "-")}-report.pdf"`);
    res.send(pdf);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

app.get("/api/deals/:id/package", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  const pkg = buildTransactionPackage(deal);
  if (req.query.format === "md") {
    res.type("text/markdown").send(transactionPackageToMarkdown(pkg));
    return;
  }
  res.json(pkg);
});

// --- Financial Brain (central node) -----------------------------------------------------
app.get("/api/deals/:id/brain", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(brainSummary(deal));
});
app.post("/api/deals/:id/brain/ask", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  const question = req.body?.question || "";
  res.json({question, answer: askFinancialBrain(deal, question)});
});

// --- Roles & Counterparties ---------------------------------------------------------------
app.get("/api/deals/:id/roles", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({roles: listRoles(deal)});
});
app.post("/api/deals/:id/roles/:roleId", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const roles = assignRole(deal, req.params.roleId, req.body?.provider);
    recordAction(deal, "role_assigned", "demo-user", {roleId: req.params.roleId, provider: req.body?.provider});
    save(deal);
    res.json({roles});
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

app.get("/api/deals/:id/counterparties", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({counterparties: listCounterparties(deal)});
});
app.post("/api/deals/:id/counterparties", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const profile = addCounterparty(deal, req.body || {});
    recordAction(deal, "counterparty_added", "demo-user", {name: profile.name});
    save(deal);
    res.status(201).json(profile);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

// --- Investors -----------------------------------------------------------------------------
app.get("/api/deals/:id/investors", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({investors: listInvestors(deal)});
});
app.post("/api/deals/:id/investors/:investorId/transfer", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const result = attemptTransfer(deal, req.params.investorId, req.body?.toWallet, req.body?.monthsElapsed || 0);
    recordAction(deal, "investor_transfer_attempt", "demo-user", result);
    save(deal);
    res.json(result);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

// --- Compliance & Risk -----------------------------------------------------------------------
app.get("/api/deals/:id/compliance-score", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(computeComplianceScore(deal));
});
app.get("/api/deals/:id/risk", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(computeRisk(deal));
});

// --- Capital Stack & Cash Flow -----------------------------------------------------------------
app.get("/api/deals/:id/capital-stack", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  const availableCashUsd = Number(req.query.availableCashUsd) || deal.lastSimulation?.periods?.[0]?.availableCashUsd || deal.finance.annualCashflowUsd / 4;
  res.json({tranches: listTranches(deal), waterfall: runWaterfall(deal, availableCashUsd)});
});

// --- Simulation Lab (Digital Twin) --------------------------------------------------------------
app.get("/api/deals/:id/digital-twin", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  const periodIndex = req.query.at !== undefined ? Number(req.query.at) : undefined;
  res.json(digitalTwinAt(deal, periodIndex));
});

// --- Governance & Treasury -----------------------------------------------------------------
app.get("/api/deals/:id/governance", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({stages: listGovernance(deal)});
});
app.post("/api/deals/:id/governance/:stage", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const stages = decideStage(deal, req.params.stage, req.body?.decision, req.body?.actor);
    recordAction(deal, `governance_${req.body?.decision?.toLowerCase() || "decision"}`, req.body?.actor || "demo-user", {stage: req.params.stage});
    save(deal);
    res.json({stages});
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

app.get("/api/deals/:id/treasury", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(treasuryState(deal));
});
app.post("/api/deals/:id/treasury/movement", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const movement = recordMovement(deal, req.body || {});
    recordAction(deal, "treasury_movement", "demo-user", {status: movement.status, amountUsd: movement.amountUsd});
    save(deal);
    res.status(201).json(movement);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

// --- Deployment & Monitoring -----------------------------------------------------------------
app.get("/api/deals/:id/testnet", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(testnetState(deal));
});
app.post("/api/deals/:id/testnet/deploy", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const record = deploySimulated(deal, req.body?.adapterId);
    recordAction(deal, "testnet_deploy_simulated", "demo-user", {adapterId: req.body?.adapterId, contractAddress: record.contractAddress});
    save(deal);
    res.status(201).json(record);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

app.get("/api/deals/:id/monitoring", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(monitoringFeed(deal));
});

// --- Reports & Business ----------------------------------------------------------------------
app.get("/api/deals/:id/audit-trail", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({entries: listAuditTrail(deal)});
});
app.get("/api/deals/:id/versions", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  if (req.query.a && req.query.b) return res.json(diffVersions(deal, req.query.a, req.query.b));
  res.json({versions: listVersions(deal)});
});
app.get("/api/deals/:id/revenue-model", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(computeRevenueModel(deal));
});

// --- What-If Mode ------------------------------------------------------------------------------
app.post("/api/deals/:id/what-if", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const overrides = req.body?.overrides || {};
    const result = runWhatIf(deal, overrides);
    if (req.body?.commit) {
      const {mergedSpec} = result;
      Object.assign(deal, {
        asset: mergedSpec.asset, investors: mergedSpec.investors, finance: mergedSpec.finance,
        lockupMonths: mergedSpec.lockupMonths, distribution: mergedSpec.distribution
      });
      const {version, invalidated} = bumpVersion(deal, deal);
      recordAction(deal, "what_if_committed", "demo-user", {overrides, version, invalidated});
      save(deal);
      result.committedVersion = version;
      result.invalidatedApprovals = invalidated;
    }
    res.json(result);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

// --- NEXUS Institutional Simulation Lab (Agent Council) -----------------------------------------
app.get("/api/agents", (req, res) => res.json({agents: listAgents(), flows: availableFlows()}));

app.get("/api/deals/:id/agents", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({agents: deal.agents || {}});
});

app.post("/api/deals/:id/agents/:agentId/run", async (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const result = await runAgent(deal, req.params.agentId, {task: req.body?.task, actor: req.body?.actor || "demo-user"});
    recordAction(deal, `agent_run:${req.params.agentId}`, req.body?.actor || "demo-user", {decision: result.decision, confidence: result.confidence, usedFallback: result.usedFallback});
    save(deal);
    res.json(result);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

app.post("/api/deals/:id/committee", async (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const flow = req.body?.flow || "new_deal";
    const summary = await conveneCommittee(deal, flow, {task: req.body?.task});
    recordAction(deal, `committee_convened:${flow}`, req.body?.actor || "demo-user", {atlasDecision: summary.atlasExecutiveDecision, disagreements: summary.disagreements.length});
    save(deal);
    res.json(summary);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

app.get("/api/deals/:id/actions", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({actions: listActions(deal)});
});

app.post("/api/deals/:id/actions/:actionId/complete", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const action = completeAction(deal, req.params.actionId);
    recordAction(deal, "action_completed", req.body?.actor || "demo-user", {actionId: action.action_id});
    save(deal);
    res.json(action);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

app.get("/api/deals/:id/blackboard", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json(deal.blackboard || {facts: [], assumptions: [], openQuestions: [], risks: [], decisions: [], opinions: []});
});

// --- NEXUS Session (40-scenario library) --------------------------------------------------------
app.get("/api/scenario-presets", (req, res) => res.json({presets: listScenarioPresets()}));

app.post("/api/deals/:id/nexus-sessions/:scenarioId/run", async (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  try {
    const session = await runScenarioSession(deal, req.params.scenarioId, {actor: req.body?.actor || "demo-user"});
    recordAction(deal, `nexus_session_run:${req.params.scenarioId}`, req.body?.actor || "demo-user", {sessionId: session.sessionId, agreements: session.synthesis.agreements.length, disagreements: session.synthesis.disagreements.length});
    save(deal);
    res.json(session);
  } catch (error) { res.status(400).json({ok: false, error: error.message}); }
});

// Streaming variant — NDJSON, one event per line, flushed as each agent actually finishes
// thinking, so the client can render this as a live conversation (typing indicator -> real
// message) instead of one long blocking wait. Same underlying runScenarioSession, just with a
// progress callback wired to the response stream.
app.post("/api/deals/:id/nexus-sessions/:scenarioId/run-stream", async (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-cache",
    "x-accel-buffering": "no"
  });
  const write = event => { try { res.write(`${JSON.stringify(event)}\n`); } catch {} };
  try {
    const session = await runScenarioSession(deal, req.params.scenarioId, {actor: req.body?.actor || "demo-user", onEvent: write});
    recordAction(deal, `nexus_session_run:${req.params.scenarioId}`, req.body?.actor || "demo-user", {sessionId: session.sessionId, agreements: session.synthesis.agreements.length, disagreements: session.synthesis.disagreements.length});
    save(deal);
  } catch (error) {
    write({type: "error", message: error.message});
  } finally {
    res.end();
  }
});

app.get("/api/deals/:id/nexus-sessions", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  res.json({sessions: listNexusSessions(deal)});
});

app.get("/api/deals/:id/nexus-sessions/:scenarioId", (req, res) => {
  const deal = findDeal(req.params.id);
  if (!deal) return dealNotFound(res);
  const session = latestNexusSession(deal, req.params.scenarioId);
  if (!session) return res.status(404).json({ok: false, error: "NO_SESSION_YET"});
  res.json(session);
});

app.listen(PORT, () => console.log(`${NAME} listening on :${PORT}`));
