import {ROLE_DEFINITIONS} from "./config.js";
import {computeSecurityScore} from "./securityScore.js";
import {computeComplianceScore} from "./complianceEngine.js";
import {networkFit} from "./networkIntelligence.js";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

// 9 independent risk categories (each 0-100, higher = safer), each derived from data the deal
// already has — no separate fake risk API. An Overall Deal Risk Score is the equal-weighted mean.
export function computeRisk(deal) {
  const leverage = deal.asset.valueUsd > 0 ? deal.finance.seniorCapitalUsd / deal.asset.valueUsd : 0;
  const financial = clamp(100 - leverage * 110);

  const assignedRoles = Object.values(deal.roles || {}).filter(role => role.assigned).length;
  const roleCoverage = assignedRoles / ROLE_DEFINITIONS.length;
  const counterpartyScore = deal.counterparties?.length
    ? clamp(deal.counterparties.reduce((sum, c) => sum + (c.riskScore || 70), 0) / deal.counterparties.length)
    : clamp(50 + roleCoverage * 50);

  const compliance = computeComplianceScore(deal);
  const security = computeSecurityScore(deal);

  const governanceStages = Object.keys(deal.governance || {}).length;
  const operational = clamp((deal.simulationRun ? 50 : 20) + governanceStages * 8);

  const custody = deal.custody.model === "self" ? 45 : deal.custody.model === "custodian" ? 75 : clamp(60 + (deal.custody.multisigThreshold / Math.max(1, deal.custody.multisigSigners)) * 40);

  const reserveCoverage = deal.finance.annualCashflowUsd > 0 ? deal.finance.reserveTargetUsd / deal.finance.annualCashflowUsd : 0;
  const liquidity = clamp(100 - deal.lockupMonths * 1.5 + reserveCoverage * 60);

  const bestNetworkMatch = networkFit(deal.dealType).results[0]?.matchPct || 50;
  const blockchain = clamp(bestNetworkMatch);

  const jurisdiction = clamp(100 - Math.max(0, (deal.jurisdictions || []).length - 1) * 15);

  const categories = [
    {id: "financial", name: "Financial Risk", score: financial, reason: `Leverage ~${Math.round(leverage * 100)}% of asset value`},
    {id: "counterparty", name: "Counterparty Risk", score: counterpartyScore, reason: `${assignedRoles}/${ROLE_DEFINITIONS.length} institutional roles assigned`},
    {id: "compliance", name: "Compliance Risk", score: compliance.score, reason: compliance.blockedBy ? `Blocked by: ${compliance.blockedBy}` : "All compliance checks satisfied"},
    {id: "smartContract", name: "Smart Contract Risk", score: security.score, reason: security.externalAudit === "PENDING" ? "External audit pending" : "Audit complete"},
    {id: "operational", name: "Operational Risk", score: operational, reason: `${governanceStages} governance stage(s) recorded`},
    {id: "custody", name: "Custody Risk", score: custody, reason: `Custody model: ${deal.custody.model}`},
    {id: "liquidity", name: "Liquidity Risk", score: liquidity, reason: `${deal.lockupMonths}-month lock-up, reserve covers ${Math.round(reserveCoverage * 100)}% of annual cashflow`},
    {id: "blockchain", name: "Blockchain Risk", score: blockchain, reason: `Best network fit: ${bestNetworkMatch}%`},
    {id: "jurisdiction", name: "Jurisdiction Risk", score: jurisdiction, reason: `${(deal.jurisdictions || []).length} jurisdiction(s): ${(deal.jurisdictions || []).join(", ")}`}
  ];

  const overall = clamp(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);

  return {overall, categories};
}
