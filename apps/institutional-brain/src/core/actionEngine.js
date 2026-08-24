import crypto from "node:crypto";

// Action Engine — the only durable output of an agent's `required_actions`. Actions are plain
// data, never executed automatically; a human (or a future workflow) marks them complete.
export function createAction(deal, {createdBy, assignedTo, type = "TASK", priority = "MEDIUM", description, blocking = false, due = null}) {
  if (!description) throw new Error("ACTION_DESCRIPTION_REQUIRED");
  deal.actions = deal.actions || [];
  const action = {
    action_id: `action_${crypto.randomUUID()}`,
    deal_id: deal.id,
    created_by: createdBy || "system",
    assigned_to: assignedTo || null,
    type, priority, description, blocking,
    status: "OPEN",
    due,
    createdAt: new Date().toISOString()
  };
  deal.actions.unshift(action);
  return action;
}

export function listActions(deal) {
  return deal.actions || [];
}

export function completeAction(deal, actionId) {
  const action = (deal.actions || []).find(item => item.action_id === actionId);
  if (!action) throw new Error(`ACTION_NOT_FOUND:${actionId}`);
  action.status = "COMPLETED";
  action.completedAt = new Date().toISOString();
  return action;
}
