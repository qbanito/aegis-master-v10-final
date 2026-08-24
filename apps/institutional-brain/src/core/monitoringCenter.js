import {computeComplianceScore} from "./complianceEngine.js";

// Monitoring Center — after a simulated deployment, watches transactions, balance changes,
// treasury movements, failed transactions, compliance status and investor status, surfacing
// everything as one alert feed around the Financial Brain. Derived entirely from data the deal
// already carries (audit trail + treasury log + investor roster) — no separate event store.
export function monitoringFeed(deal) {
  const alerts = [];

  (deal.treasury?.movements || []).forEach(movement => {
    alerts.push({
      id: movement.id,
      severity: movement.status === "REJECTED" ? "CRITICAL" : "INFO",
      message: movement.status === "REJECTED"
        ? `Treasury movement rejected — ${movement.reason}`
        : `Treasury ${movement.type.toLowerCase()} executed: $${movement.amountUsd.toLocaleString()} (${movement.purpose})`,
      at: movement.at
    });
  });

  (deal.investors.list || []).filter(i => i.kyc !== "PASSED").forEach(investor => {
    alerts.push({id: `kyc_${investor.id}`, severity: "WARNING", message: `${investor.name}: KYC status ${investor.kyc}`, at: deal.updatedAt});
  });

  (deal.testnet?.deployments || []).forEach(deployment => {
    alerts.push({id: deployment.id, severity: "INFO", message: `Simulated deployment: ${deployment.adapterId} contract at ${deployment.contractAddress}`, at: deployment.deployedAt});
  });

  Object.entries(deal.governance || {}).forEach(([stage, decision]) => {
    alerts.push({id: `gov_${stage}`, severity: decision.decision === "REJECTED" ? "WARNING" : "INFO", message: `${stage}: ${decision.decision} by ${decision.actor}`, at: decision.at});
  });

  alerts.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  const compliance = computeComplianceScore(deal);
  const failedTransactions = (deal.treasury?.movements || []).filter(m => m.status === "REJECTED");

  return {
    alerts,
    transactions: deal.treasury?.movements || [],
    failedTransactions,
    complianceStatus: {score: compliance.score, blockedBy: compliance.blockedBy},
    investorStatus: (deal.investors.list || []).map(i => ({id: i.id, name: i.name, kyc: i.kyc, eligible: i.eligible})),
    unusualActivity: failedTransactions.length > 2 ? ["Multiple rejected treasury movements — review access controls"] : []
  };
}
