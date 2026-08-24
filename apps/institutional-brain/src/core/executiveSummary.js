import {computeSecurityScore} from "./securityScore.js";
import {computeComplianceScore} from "./complianceEngine.js";
import {computeRisk} from "./riskEngine.js";
import {GOVERNANCE_STAGES} from "./governanceWorkflow.js";

// Executive Dashboard — a non-technical, cross-deal view meant to be understood in under 60
// seconds: how many deals, how much simulated capital, how many investors, how much has been
// distributed, and where compliance/security/risk stand across the whole book.
export function buildExecutiveSummary(deals) {
  const activeDeals = deals.filter(deal => deal.status !== "Closed");
  const totalSimulatedAssetsUsd = deals.reduce((sum, deal) => sum + deal.asset.valueUsd, 0);
  const capitalDeployedUsd = deals.reduce((sum, deal) => sum + deal.finance.seniorCapitalUsd + deal.finance.juniorCapitalUsd, 0);
  const investors = deals.reduce((sum, deal) => sum + deal.investors.count, 0);
  const distributionsUsd = deals.reduce((sum, deal) => sum + (deal.lastSimulation?.totals?.distributedCashUsd || 0), 0);
  const blockchainDeployments = deals.reduce((sum, deal) => sum + (deal.testnet?.deployments?.length || 0), 0);
  const pendingApprovals = deals.reduce((sum, deal) => sum + GOVERNANCE_STAGES.filter(stage => !deal.governance?.[stage] || deal.governance[stage].decision === "PENDING").length, 0);

  const avg = list => list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;

  return {
    activeDeals: activeDeals.length,
    totalDeals: deals.length,
    totalSimulatedAssetsUsd,
    capitalDeployedUsd,
    investors,
    distributionsUsd,
    blockchainDeployments,
    pendingApprovals,
    avgRiskScore: avg(deals.map(deal => computeRisk(deal).overall)),
    avgComplianceScore: avg(deals.map(deal => computeComplianceScore(deal).score)),
    avgSecurityScore: avg(deals.map(deal => computeSecurityScore(deal).score)),
    byStatus: deals.reduce((acc, deal) => { acc[deal.status] = (acc[deal.status] || 0) + 1; return acc; }, {}),
    byDealType: deals.reduce((acc, deal) => { acc[deal.dealType] = (acc[deal.dealType] || 0) + 1; return acc; }, {})
  };
}
