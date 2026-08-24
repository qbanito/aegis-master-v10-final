import {computeSecurityScore} from "./securityScore.js";
import {computeComplianceScore} from "./complianceEngine.js";
import {computeRisk} from "./riskEngine.js";
import {computeRevenueModel} from "./revenueModel.js";
import {evaluateApprovalGates} from "./approvalGates.js";
import {evaluateTokenizationFit} from "./tokenizationEngine.js";
import {listGovernance} from "./governanceWorkflow.js";
import {listNexusSessions} from "./nexusSession.js";

// Assembles everything a professional report needs from a deal — pure data, no layout — so the
// PDF renderer (pdfRenderer.js) only has to lay it out, never decide what belongs in it. Every
// section reuses the exact same deterministic engines the rest of the app already runs; nothing
// here is computed specially for the report.
export function buildDealReport(deal) {
  const sessionsByScenario = listNexusSessions(deal);
  const allSessions = Object.values(sessionsByScenario).flat();
  const latestSessions = allSessions
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    deal: {
      id: deal.id, name: deal.name, dealType: deal.dealType, status: deal.status,
      vehicle: deal.vehicle, assetName: deal.asset.name, assetValueUsd: deal.asset.valueUsd,
      investorsCount: deal.investors.count, eligibility: deal.investors.eligibility,
      lockupMonths: deal.lockupMonths, jurisdictions: deal.jurisdictions,
      distributionFrequency: deal.distribution.frequency,
      seniorCapitalUsd: deal.finance.seniorCapitalUsd, juniorCapitalUsd: deal.finance.juniorCapitalUsd,
      annualCashflowUsd: deal.finance.annualCashflowUsd, ratePct: deal.finance.ratePct
    },
    simulation: deal.lastSimulation ? {
      invariants: deal.lastSimulation.invariants,
      totals: deal.lastSimulation.totals
    } : null,
    scores: {
      security: computeSecurityScore(deal),
      compliance: computeComplianceScore(deal),
      risk: computeRisk(deal),
      revenue: computeRevenueModel(deal)
    },
    approvalGates: evaluateApprovalGates(deal),
    tokenizationFit: evaluateTokenizationFit(deal),
    governance: listGovernance(deal),
    nexusSessions: latestSessions.map(session => ({
      scenarioNumber: session.scenarioNumber, title: session.title, category: session.category,
      completedAt: session.completedAt,
      transcript: session.transcript.map(entry => ({alias: entry.alias, reference: entry.reference, decision: entry.decision, confidence: entry.confidence, team_message: entry.team_message})),
      synthesis: session.synthesis
    }))
  };
}
