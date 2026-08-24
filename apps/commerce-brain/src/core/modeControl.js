import {store, persist} from "./store.js";
import {SYSTEM_DATA_MODE, OPERATOR_TOKEN} from "./config.js";
import {moduleReadiness} from "./readiness.js";

const STAGES = ["OBSERVE", "DRAFT", "APPROVAL", "LIVE"];
const DATA_MODE_CEILING_STAGE = {DEMO: "DRAFT", PAPER_WITH_REAL_DATA: "APPROVAL", LIVE: "LIVE"};

export const ACTIONS = ["generate_assets", "publish_products", "activate_ads", "send_emails", "process_orders", "reassign_budget"];

// Only modules that actually own a mutating action need the full OBSERVE→LIVE ladder — pure
// intelligence modules (scout/dropship/digital-builder/offer-pricing) never call assertPermission.
export const MODULE_ACTION_OWNER = {
  "creative-factory": ["generate_assets"],
  "store-manager": ["publish_products", "process_orders"],
  "traffic": ["activate_ads"],
  "closer": ["send_emails"],
  "retention": ["send_emails"],
  "allocator": ["reassign_budget"]
};

const STAGE_PERMISSION = {
  OBSERVE: {generate_assets: false, publish_products: false, activate_ads: false, send_emails: false, process_orders: false, reassign_budget: false},
  DRAFT: {generate_assets: true, publish_products: false, activate_ads: false, send_emails: false, process_orders: false, reassign_budget: false},
  APPROVAL: {generate_assets: true, publish_products: false, activate_ads: false, send_emails: false, process_orders: false, reassign_budget: false},
  LIVE: {generate_assets: true, publish_products: true, activate_ads: true, send_emails: true, process_orders: true, reassign_budget: true}
};

// Independent env kill-switches that must ALSO pass even at actionStage=LIVE — assertPermission
// composes with these pre-existing gates, it never replaces them. send_emails/process_orders/
// reassign_budget have no real connector wired yet (Resend/Stripe-style/ad-platform-write
// integrations are a later block), so they always fail closed until that block lands.
const ENV_GATE = {
  publish_products: () => String(process.env.COMMERCE_LIVE_PUBLISH || "false").toLowerCase() === "true",
  activate_ads: () => String(process.env.COMMERCE_LIVE_ADS_ENABLED || "false").toLowerCase() === "true",
  generate_assets: () => true,
  send_emails: () => false,
  process_orders: () => false,
  reassign_budget: () => false
};

export class PermissionDeniedError extends Error {
  constructor(code, detail = {}) { super(code); this.name = "PermissionDeniedError"; this.code = code; this.detail = detail; }
}

function defaultModuleMode() {
  return {actionStage: "OBSERVE", dataMode: SYSTEM_DATA_MODE === "DEMO" ? "DEMO" : "PAPER_WITH_REAL_DATA", updatedAt: null, updatedBy: null, history: []};
}

export function getModuleMode(moduleId) {
  if (!store.modeControl.modules[moduleId]) store.modeControl.modules[moduleId] = defaultModuleMode();
  return store.modeControl.modules[moduleId];
}

export function permissionMatrixFor(moduleId) {
  const mode = getModuleMode(moduleId);
  const owned = MODULE_ACTION_OWNER[moduleId] || [];
  const row = {};
  for (const action of ACTIONS) {
    const isOwner = owned.includes(action);
    const stageAllows = STAGE_PERMISSION[mode.actionStage]?.[action] === true;
    const envGatePasses = ENV_GATE[action] ? ENV_GATE[action]() : true;
    row[action] = {allowed: isOwner && stageAllows && envGatePasses, owned: isOwner, stageAllows, envGatePasses};
  }
  return row;
}

/**
 * Route handlers / module functions call this before doing anything mutating/external. Throws
 * PermissionDeniedError when not allowed — callers must surface a BLOCKED result, never silently
 * no-op or fabricate success.
 */
export function assertPermission(moduleId, action) {
  if (!ACTIONS.includes(action)) throw new PermissionDeniedError("UNKNOWN_ACTION", {action});
  const owned = MODULE_ACTION_OWNER[moduleId] || [];
  if (!owned.includes(action)) throw new PermissionDeniedError("ACTION_NOT_OWNED_BY_MODULE", {moduleId, action});
  const mode = getModuleMode(moduleId);
  if (STAGE_PERMISSION[mode.actionStage]?.[action] !== true) throw new PermissionDeniedError("ACTION_STAGE_TOO_LOW", {moduleId, action, actionStage: mode.actionStage});
  if (ENV_GATE[action] && !ENV_GATE[action]()) throw new PermissionDeniedError("ENV_KILL_SWITCH_LOCKED", {moduleId, action});
  return true;
}

export function setModuleStage(moduleId, targetStage, {confirmLive = false, actor = "operator", reason = "", operatorToken} = {}) {
  if (!STAGES.includes(targetStage)) throw new PermissionDeniedError("UNKNOWN_STAGE", {targetStage});
  const mode = getModuleMode(moduleId);
  const ceilingStage = DATA_MODE_CEILING_STAGE[SYSTEM_DATA_MODE] || "OBSERVE";
  if (STAGES.indexOf(targetStage) > STAGES.indexOf(ceilingStage)) throw new PermissionDeniedError("SYSTEM_DATA_MODE_CEILING", {targetStage, systemDataMode: SYSTEM_DATA_MODE, ceilingStage});
  if (targetStage === "APPROVAL") {
    const readiness = moduleReadiness(moduleId);
    if (!["DRAFT_READY", "APPROVAL_READY", "LIVE_READY"].includes(readiness.state)) throw new PermissionDeniedError("READINESS_NOT_DRAFT_READY", {state: readiness.state, blockers: readiness.blockers});
  }
  if (targetStage === "LIVE") {
    const readiness = moduleReadiness(moduleId);
    if (readiness.state !== "LIVE_READY") throw new PermissionDeniedError("READINESS_NOT_LIVE_READY", {state: readiness.state, blockers: readiness.blockers});
    if (!confirmLive) throw new PermissionDeniedError("LIVE_CONFIRMATION_REQUIRED", {});
    if (OPERATOR_TOKEN && operatorToken !== OPERATOR_TOKEN) throw new PermissionDeniedError("OPERATOR_TOKEN_REQUIRED", {});
  }
  const entry = {from: mode.actionStage, to: targetStage, actor: String(actor || "operator").slice(0, 60), reason: String(reason || "").slice(0, 240), at: new Date().toISOString()};
  mode.actionStage = targetStage;
  mode.updatedAt = entry.at;
  mode.updatedBy = entry.actor;
  mode.history = [entry, ...(mode.history || [])].slice(0, 20);
  persist();
  return mode;
}
