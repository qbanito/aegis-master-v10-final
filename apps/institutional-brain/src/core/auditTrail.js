import crypto from "node:crypto";

// Complete Audit Trail — every mutating action on a deal appends one immutable entry here.
// Called from index.js route handlers, never mutated after the fact.
export function recordAction(deal, action, actor = "demo-user", detail = {}) {
  deal.auditTrail = deal.auditTrail || [];
  const entry = {
    id: `audit_${crypto.randomUUID()}`,
    action,
    actor,
    at: new Date().toISOString(),
    versionAfter: deal.version,
    detail
  };
  deal.auditTrail.unshift(entry);
  if (deal.auditTrail.length > 500) deal.auditTrail.length = 500;
  return entry;
}

export function listAuditTrail(deal) {
  return deal.auditTrail || [];
}
