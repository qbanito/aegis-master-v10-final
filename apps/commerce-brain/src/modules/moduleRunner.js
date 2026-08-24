import {store, persist} from "../core/store.js";
import {findBot} from "../core/productCatalog.js";
import {moduleReadiness} from "../core/readiness.js";
import {getModuleMode} from "../core/modeControl.js";
import {createRun, completeRun} from "../core/runRegistry.js";
import * as productScout from "./productScout.js";
import * as dropshipHunter from "./dropshipHunter.js";
import * as digitalBuilder from "./digitalBuilder.js";
import * as offerPricing from "./offerPricing.js";
import * as creativeFactory from "./creativeFactory.js";
import * as storeManager from "./storeManager.js";
import * as traffic from "./traffic.js";
import * as closer from "./closer.js";
import * as retention from "./retention.js";
import * as allocator from "./allocator.js";

const MODULE_FUNCTIONS = {
  "product-scout": productScout.run,
  "dropship-hunter": dropshipHunter.run,
  "digital-builder": digitalBuilder.run,
  "offer-pricing": offerPricing.run,
  "creative-factory": creativeFactory.run,
  "store-manager": storeManager.run,
  "traffic": traffic.run,
  "closer": closer.run,
  "retention": retention.run,
  "allocator": allocator.run
};

const BLOCKED_STATUSES = new Set(["BLOCKED", "NOT_APPLICABLE"]);
const DEGRADED_STATUSES = new Set(["DEGRADED"]);

function evidenceCountFromResult(result) {
  if (Array.isArray(result.ranked)) return result.ranked.length;
  if (Array.isArray(result.queue)) return result.queue.length;
  if (Array.isArray(result.allocations)) return result.allocations.length;
  if (result.opportunity) return 1;
  if (result.landingId) return 1;
  if (result.draft) return 1;
  if (result.campaign) return 1;
  if (result.pricing) return 1;
  return 0;
}

// Classifies a module's own result into a Run outcome. This is the single place that decides
// whether a scan produced a genuinely NEW signal — replacing the old runBot() behavior of
// incrementing `signals` unconditionally on every call regardless of whether anything happened.
function classifyResult(result) {
  const status = String(result?.status || "");
  if (BLOCKED_STATUSES.has(status)) {
    return {runStatus: "BLOCKED", newSignal: false, evidence: [], summary: result.message || `Blocked: ${(result.blockers || []).join(", ") || "unknown"}`, metricsPatch: {}};
  }
  if (DEGRADED_STATUSES.has(status)) {
    return {runStatus: "DEGRADED", newSignal: false, evidence: [], summary: result.message || "Degraded — connector configured but returned no usable data", metricsPatch: {}};
  }
  const count = evidenceCountFromResult(result);
  return {
    runStatus: count > 0 ? "SUCCESS" : "NO_SIGNAL",
    newSignal: count > 0,
    evidence: count > 0 ? [{type: "result", summary: `${count} item(s) produced`}] : [],
    summary: `${status || "COMPLETED"}${count ? ` · ${count} item(s)` : ""}`,
    metricsPatch: count > 0 ? {candidates: count} : {}
  };
}

function botStatusFor(bot, runStatus) {
  if (!bot.active) return "PAUSED";
  if (runStatus === "SUCCESS") return "READY";
  if (runStatus === "NO_SIGNAL") return "SCANNING";
  return "ATTENTION";
}

/**
 * The single entry point every route/automation-cycle call goes through — replaces the old generic
 * runBot(). Every execution produces a durable Run record; bot.metrics.signals only increments when
 * the underlying module actually produced new evidence this run.
 */
export async function runModule(moduleId, input = {}, {trigger = "manual"} = {}) {
  const fn = MODULE_FUNCTIONS[moduleId];
  const bot = findBot(moduleId);
  if (!fn) throw new Error("MODULE_HAS_NO_RUNNER");
  if (bot && !bot.active) throw new Error("BOT_PAUSED");

  const mode = getModuleMode(moduleId);
  const {run, deduped} = createRun({moduleId, trigger, actionStage: mode.actionStage, dataMode: mode.dataMode, input});
  if (deduped) {
    return {result: {...(bot?.lastResult || {}), deduped: true, runId: run.id}, run, deduped: true};
  }

  let result;
  try {
    result = await fn(input);
  } catch (error) {
    completeRun(run, {status: "ERROR", error: {message: error.message}, summary: `${moduleId} failed: ${error.message}`});
    if (bot) {
      bot.lastRunAt = new Date().toISOString();
      bot.status = bot.active ? "ATTENTION" : "PAUSED";
      bot.lastResult = {status: "ERROR", mode: mode.dataMode, error: error.message, runId: run.id};
      bot.readiness = moduleReadiness(moduleId);
    }
    persist();
    throw error;
  }

  const classification = classifyResult(result);
  completeRun(run, {
    status: classification.runStatus,
    newSignal: classification.newSignal,
    evidence: classification.evidence,
    blockers: result.blockers || [],
    warnings: result.warnings || [],
    summary: classification.summary
  });

  if (bot) {
    bot.lastRunAt = new Date().toISOString();
    bot.status = botStatusFor(bot, classification.runStatus);
    bot.lastResult = {...result, runId: run.id};
    bot.metrics = {
      ...bot.metrics,
      ...classification.metricsPatch,
      signals: classification.newSignal ? (bot.metrics?.signals || 0) + 1 : (bot.metrics?.signals || 0)
    };
    bot.readiness = moduleReadiness(moduleId);
  }
  persist();
  return {result, run, deduped: false};
}

export function listModuleIds() { return Object.keys(MODULE_FUNCTIONS); }
export function hasModuleRunner(moduleId) { return Boolean(MODULE_FUNCTIONS[moduleId]); }
