import {buildContractArchitecture} from "./contractArchitecture.js";
import {computeSecurityScore} from "./securityScore.js";
import {computeComplianceScore} from "./complianceEngine.js";
import {computeRisk} from "./riskEngine.js";
import {runBaseSimulation} from "./simulationEngine.js";

// Digital Twin — reproduces the deal's full state (legal structure, financial state,
// participants, cash, ownership, contracts, blockchain state, risks, approvals, events) as of
// a given simulated period. Reuses every other engine rather than re-deriving anything.
export function digitalTwinAt(deal, periodIndex) {
  const architecture = buildContractArchitecture(deal);
  const security = computeSecurityScore(deal);
  const compliance = computeComplianceScore(deal);
  const risk = computeRisk(deal);

  let cashState = null;
  if (deal.simulationRun && deal.dealType === "real-estate-spv") {
    const simulation = runBaseSimulation(deal);
    const index = Math.min(Math.max(0, periodIndex ?? simulation.periods.length - 1), simulation.periods.length - 1);
    cashState = {
      period: simulation.periods[index],
      cumulativeInvestorBalances: simulation.investorBalances
    };
  }

  return {
    dealId: deal.id,
    asOfPeriod: periodIndex ?? "latest",
    legalStructure: {vehicle: deal.vehicle, dealType: deal.dealType, jurisdictions: deal.jurisdictions},
    financialState: {asset: deal.asset, finance: deal.finance, tranches: deal.tranches},
    participants: {investors: deal.investors.list, roles: deal.roles, counterparties: deal.counterparties},
    cash: cashState,
    ownership: (deal.investors.list || []).map(i => ({investorId: i.id, ownershipPct: i.ownershipPct})),
    contracts: architecture,
    blockchainState: deal.testnet,
    risks: risk,
    compliance,
    security,
    approvals: deal.governance,
    events: deal.auditTrail || []
  };
}
