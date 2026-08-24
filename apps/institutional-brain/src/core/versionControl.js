import {GOVERNANCE_STAGES} from "./governanceWorkflow.js";

// Version Control — every material spec change creates a new version and invalidates any
// governance approval recorded against an earlier version. Smart contracts generated from the
// spec are implicitly tied to whichever version was active when they were generated (the
// Transaction Package always records the version hash alongside the code).
export function bumpVersion(deal, snapshot) {
  deal.version = (deal.version || 1) + 1;
  const invalidated = [];
  GOVERNANCE_STAGES.forEach(stage => {
    const decision = deal.governance?.[stage];
    if (decision && decision.decision === "APPROVED" && decision.versionApprovedAt < deal.version) {
      deal.governance[stage] = {...decision, decision: "INVALIDATED", invalidatedAt: new Date().toISOString(), invalidatedReason: "Material spec change after approval"};
      invalidated.push(stage);
    }
  });
  deal.versions = deal.versions || [];
  deal.versions.push({version: deal.version, at: new Date().toISOString(), snapshot: JSON.parse(JSON.stringify(snapshot)), approvalsInvalidated: invalidated});
  deal.updatedAt = new Date().toISOString();
  return {version: deal.version, invalidated};
}

export function listVersions(deal) {
  return deal.versions || [];
}

export function diffVersions(deal, versionA, versionB) {
  const a = (deal.versions || []).find(v => v.version === Number(versionA));
  const b = (deal.versions || []).find(v => v.version === Number(versionB));
  if (!a || !b) throw new Error("VERSION_NOT_FOUND");
  const changes = [];
  const keys = new Set([...Object.keys(a.snapshot), ...Object.keys(b.snapshot)]);
  keys.forEach(key => {
    const beforeStr = JSON.stringify(a.snapshot[key]);
    const afterStr = JSON.stringify(b.snapshot[key]);
    if (beforeStr !== afterStr) changes.push({field: key, before: a.snapshot[key], after: b.snapshot[key]});
  });
  return {versionA: a.version, versionB: b.version, changes};
}
