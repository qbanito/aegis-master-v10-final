import crypto from "node:crypto";

export const PROTOCOL_VERSION = "1.0";

export const BrainKinds = Object.freeze({
  FINANCE: "finance",
  COMMERCE: "commerce",
  SAAS: "saas",
  MEDIA: "media",
  MANAGER: "manager",
  CEO: "ceo"
});

export function envelope({
  source,
  target,
  type,
  priority = 0.5,
  payload = {},
  correlationId = crypto.randomUUID()
}) {
  return {
    schema: "aegis.interbrain",
    version: PROTOCOL_VERSION,
    id: crypto.randomUUID(),
    correlation_id: correlationId,
    source,
    target,
    type,
    priority,
    timestamp: new Date().toISOString(),
    payload
  };
}

export function healthShape(name, kind, status="online", extra={}) {
  return {
    name,
    kind,
    status,
    timestamp: new Date().toISOString(),
    ...extra
  };
}
