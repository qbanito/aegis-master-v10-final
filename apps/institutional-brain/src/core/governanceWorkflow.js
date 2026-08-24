export const GOVERNANCE_STAGES = ["DealManager", "Compliance", "Legal", "Security", "InvestmentCommittee", "DeploymentAuthority"];

// Approval & Governance Workflow — staged sign-off recorded against the deal's current
// version. versionControl.js invalidates any stage whose approved version predates a
// material spec change, so an approval never silently survives a variable edit.
export function listGovernance(deal) {
  return GOVERNANCE_STAGES.map(stage => ({
    stage,
    ...(deal.governance?.[stage] || {decision: "PENDING", actor: null, at: null, versionApprovedAt: null})
  }));
}

export function decideStage(deal, stage, decision, actor) {
  if (!GOVERNANCE_STAGES.includes(stage)) throw new Error(`UNKNOWN_GOVERNANCE_STAGE:${stage}`);
  if (!["APPROVED", "REJECTED"].includes(decision)) throw new Error(`INVALID_DECISION:${decision}`);
  deal.governance = deal.governance || {};
  deal.governance[stage] = {decision, actor: actor || "demo-user", at: new Date().toISOString(), versionApprovedAt: deal.version};
  return listGovernance(deal);
}

export function allApproved(deal) {
  return GOVERNANCE_STAGES.every(stage => deal.governance?.[stage]?.decision === "APPROVED");
}
