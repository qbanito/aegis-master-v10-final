import {ROLE_DEFINITIONS} from "./config.js";

// Institutional Role Mapper — no operation may silently assume the sponsor fills every role.
// Unassigned roles are surfaced as risks/dependencies by dealState.js.
export function listRoles(deal) {
  return ROLE_DEFINITIONS.map(role => ({
    ...role,
    ...(deal.roles?.[role.id] || {assigned: false, provider: null}),
    isRisk: !deal.roles?.[role.id]?.assigned
  }));
}

export function assignRole(deal, roleId, provider) {
  if (!ROLE_DEFINITIONS.some(role => role.id === roleId)) throw new Error(`UNKNOWN_ROLE:${roleId}`);
  deal.roles = deal.roles || {};
  deal.roles[roleId] = {assigned: Boolean(provider), provider: provider || null};
  return listRoles(deal);
}
