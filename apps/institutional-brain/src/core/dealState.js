import {DEAL_STATUSES, ROLE_DEFINITIONS} from "./config.js";
import {computeSecurityScore} from "./securityScore.js";
import {computeComplianceScore} from "./complianceEngine.js";
import {computeRisk} from "./riskEngine.js";
import {networkFit} from "./networkIntelligence.js";

// The Financial Brain: not a dashboard, a state machine + deterministic reasoning layer. Every
// deal always knows: where it is, what's missing, what's risky, and what happens next. No LLM —
// every answer is derived directly from the deal's own computed state (invariants, compliance,
// security, roles, governance), which keeps it correct by construction.
const STATUS_ORDER = DEAL_STATUSES;

export function missingRequirements(deal) {
  const missing = [];
  const unassignedRoles = ROLE_DEFINITIONS.filter(role => !deal.roles?.[role.id]?.assigned);
  if (unassignedRoles.length) missing.push(`${unassignedRoles.length} institutional role(s) unassigned: ${unassignedRoles.map(r => r.name).join(", ")}`);
  const pendingKyc = (deal.investors.list || []).filter(investor => investor.kyc !== "PASSED");
  if (pendingKyc.length) missing.push(`${pendingKyc.length} investor(s) with KYC pending`);
  if (!deal.simulationRun) missing.push("Base simulation has not been run");
  const security = computeSecurityScore(deal);
  if (security.externalAudit === "PENDING") missing.push("External audit still pending");
  const compliance = computeComplianceScore(deal);
  if (compliance.score < 100) missing.push(`Compliance readiness at ${compliance.score}/100`);
  const governanceStages = Object.keys(deal.governance || {});
  if (governanceStages.length === 0) missing.push("No governance approvals recorded yet");
  return missing;
}

export function activeRisks(deal) {
  const risks = [];
  const risk = computeRisk(deal);
  risk.categories.filter(category => category.score < 70).forEach(category => risks.push(`${category.name} risk elevated (${category.score}/100): ${category.reason}`));
  const overLockup = (deal.investors.list || []).some(investor => investor.kyc !== "PASSED");
  if (overLockup) risks.push("Unverified investor(s) present — restricted asset transfer risk");
  if (deal.custody.model === "multisig" && deal.custody.multisigThreshold < 2) risks.push("Treasury multisig threshold below 2 — single point of failure");
  return risks;
}

export function nextAction(deal) {
  const missing = missingRequirements(deal);
  if (missing.length === 0 && deal.status !== "Deployed" && deal.status !== "Closed") return "Ready to advance to the next lifecycle stage.";
  if (missing.length) return `Resolve: ${missing[0]}`;
  return "No further action required.";
}

export function suggestedStatus(deal) {
  // A deterministic status suggestion (not auto-applied) based on completed prerequisites.
  const security = computeSecurityScore(deal);
  const compliance = computeComplianceScore(deal);
  if (deal.testnet?.deployments?.length) return "Deployed";
  if (security.score >= 90 && compliance.score >= 90 && deal.simulationRun) return "ReadyForTestnet";
  if (deal.simulationRun) return "Simulation";
  if (security.checklist?.some(item => item.satisfied)) return "SecurityReview";
  if (compliance.score > 0) return "Compliance";
  if (deal.roles && Object.values(deal.roles).some(role => role.assigned)) return "Structuring";
  return "Draft";
}

function canonicalQuestionKey(question) {
  const q = String(question || "").toLowerCase();
  if (q.includes("qué está pasando") || q.includes("que esta pasando") || q.includes("explica") || q.includes("explain")) return "explain";
  if (q.includes("falta") || q.includes("missing")) return "missing";
  if (q.includes("riesgo") || q.includes("risk")) return "risk";
  if (q.includes("siguiente") || q.includes("next")) return "next";
  if (q.includes("canton")) return "canton";
  if (q.includes("bloquead") || q.includes("blocked")) return "blockedInvestors";
  if (q.includes("smart contract") || q.includes("contrato")) return "contracts";
  return "explain";
}

// Deterministic Q&A — answers the 7 canned questions from the spec using only computed deal
// state. Explicitly rule-based, not a generative LLM call.
export function askFinancialBrain(deal, question) {
  const key = canonicalQuestionKey(question);
  const missing = missingRequirements(deal);
  const risks = activeRisks(deal);
  switch (key) {
    case "missing":
      return missing.length ? `Falta: ${missing.join("; ")}.` : "No falta ningún requisito conocido para avanzar.";
    case "risk":
      return risks.length ? `Riesgos activos: ${risks.join("; ")}.` : "No hay riesgos elevados detectados en este momento.";
    case "next":
      return nextAction(deal);
    case "canton": {
      const fit = networkFit(deal.dealType).results.find(item => item.networkId === "canton");
      return fit ? `Canton obtiene ${fit.matchPct}% de match para ${deal.dealType} por: ${fit.strengths.join(", ")}.` : "Canton no está en el conjunto de redes evaluadas para este tipo de deal.";
    }
    case "blockedInvestors": {
      const blocked = (deal.investors.list || []).filter(investor => investor.kyc !== "PASSED");
      return blocked.length ? `${blocked.length} inversionista(s) bloqueados por KYC pendiente: ${blocked.map(i => i.name).join(", ")}.` : "Ningún inversionista está bloqueado actualmente.";
    }
    case "contracts":
      return "Ver Contracts & Security para la arquitectura completa generada a partir de la Financial Specification.";
    case "explain":
    default:
      return `${deal.name} es un ${deal.dealType} en estado ${deal.status}. Activo: $${deal.asset.valueUsd.toLocaleString()}. ${deal.investors.count} inversionistas. ${missing.length ? `Pendiente: ${missing[0]}.` : "Sin bloqueos conocidos."}`;
  }
}

export function brainSummary(deal) {
  return {
    dealId: deal.id,
    status: deal.status,
    suggestedStatus: suggestedStatus(deal),
    statusOrder: STATUS_ORDER,
    missing: missingRequirements(deal),
    risks: activeRisks(deal),
    nextAction: nextAction(deal),
    qa: {
      "¿Qué está pasando?": askFinancialBrain(deal, "que esta pasando"),
      "¿Qué falta?": askFinancialBrain(deal, "que falta"),
      "¿Qué riesgo existe?": askFinancialBrain(deal, "que riesgo"),
      "¿Cuál es la siguiente acción?": askFinancialBrain(deal, "siguiente accion")
    }
  };
}
