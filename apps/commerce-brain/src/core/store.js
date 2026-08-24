import crypto from "node:crypto";
import fs from "node:fs";
import {MODULE_PARAMETER_DEFAULTS, sanitizeModuleParameters} from "../module-engine.js";
import {aegisData} from "../../../../packages/aegis-data/src/index.js";
import {AGENT_DEFINITIONS, DATA_DIR, DATA_FILE} from "./config.js";

function loadPersistence() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}

const persisted = (await aegisData.readState("commerce")) || loadPersistence();

const agents = AGENT_DEFINITIONS;
const commerceBots = agents.map((agent, index) => ({
  ...agent,
  order: index + 1,
  status: index % 3 === 0 ? "SCANNING" : "STANDBY",
  active: true,
  lastRunAt: null,
  lastResult: null,
  metrics: {signals: 0, candidates: 0, drafts: 0, confidence: 0}
}));
const savedBots = Array.isArray(persisted.bots) ? persisted.bots : [];
savedBots.forEach(saved => { const bot = commerceBots.find(item => item.id === saved.id); if (bot) Object.assign(bot, saved, {description: bot.description, strategy: bot.strategy}); });

const events = Array.isArray(persisted.events) ? persisted.events : [];
const opportunities = Array.isArray(persisted.opportunities) ? persisted.opportunities : [];
const products = Array.isArray(persisted.products) ? persisted.products : [];
const landingPages = Array.isArray(persisted.landingPages) ? persisted.landingPages : [];
const storeDrafts = Array.isArray(persisted.storeDrafts) ? persisted.storeDrafts : [];
const leads = Array.isArray(persisted.leads) ? persisted.leads : [];
const orders = Array.isArray(persisted.orders) ? persisted.orders : [];
const funnelEvents = Array.isArray(persisted.funnelEvents) ? persisted.funnelEvents : [];
const campaigns = Array.isArray(persisted.campaigns) ? persisted.campaigns : [];
const workflows = Array.isArray(persisted.workflows) ? persisted.workflows : [];
const digitalProducts = Array.isArray(persisted.digitalProducts) ? persisted.digitalProducts : [];
const moduleConfigs = Object.fromEntries(Object.entries(MODULE_PARAMETER_DEFAULTS).map(([id, defaults]) => [id, sanitizeModuleParameters(id, persisted.moduleConfigs?.[id] || defaults)]));
const masterControl = {...(persisted.masterControl || {}), connected: true, brain: "manager", lastCommandAt: persisted.masterControl?.lastCommandAt || null, lastCommand: persisted.masterControl?.lastCommand || null};
const state = {...(persisted.state || {}), startedAt: new Date().toISOString(), status: "online", processed: Number(persisted.state?.processed || 0), alerts: persisted.state?.alerts || [], metrics: {...(persisted.state?.metrics || {}), revenue: Number(persisted.state?.metrics?.revenue || 0), contribution: Number(persisted.state?.metrics?.contribution || 0), spend: Number(persisted.state?.metrics?.spend || 0)}};

// NEW Truth Layer collections — additive keys, backward compatible with the previously deployed blob.
const runs = Array.isArray(persisted.runs) ? persisted.runs : [];
const modeControl = {
  systemDataMode: persisted.modeControl?.systemDataMode, // recomputed at boot in modeControl.js from env; stored value is informational only
  modules: {...(persisted.modeControl?.modules || {})}
};
const readinessCache = {...(persisted.readinessCache || {})};
const copilotSessions = {...(persisted.copilotSessions || {})};

export const store = {
  agents, commerceBots, events, opportunities, products, landingPages, storeDrafts, leads, orders,
  funnelEvents, campaigns, workflows, digitalProducts, moduleConfigs, masterControl, state,
  runs, modeControl, readinessCache, copilotSessions
};

function snapshot() {
  return {
    state: store.state, bots: store.commerceBots, moduleConfigs: store.moduleConfigs, masterControl: store.masterControl,
    events: store.events.slice(0, 300), opportunities: store.opportunities.slice(0, 300), products: store.products.slice(0, 500),
    digitalProducts: store.digitalProducts.slice(0, 200), landingPages: store.landingPages.slice(0, 200), storeDrafts: store.storeDrafts.slice(0, 200),
    leads: store.leads.slice(0, 500), orders: store.orders.slice(0, 500), funnelEvents: store.funnelEvents.slice(0, 1000),
    campaigns: store.campaigns.slice(0, 200), workflows: store.workflows.slice(0, 300),
    runs: store.runs.slice(0, 500), modeControl: store.modeControl, readinessCache: store.readinessCache, copilotSessions: store.copilotSessions
  };
}

// persist() used to run synchronously on every single mutation (every emit() call), serializing the
// whole ~19k-line blob each time. Debounce collapses bursts of mutations within one tick into a single write.
// Tests import this module directly and mutate `store` with fixtures — persistence must be a no-op
// in that context so a test run never overwrites the real commerce.json / Neon snapshot on disk.
const TEST_MODE = process.env.NODE_ENV === "test";

let persistTimer = null;
let persistScheduled = false;

function writeSnapshotNow() {
  if (TEST_MODE) return;
  try {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    const data = snapshot();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    void aegisData.writeState("commerce", data);
  } catch (error) {
    store.state.alerts = [{id: crypto.randomUUID(), code: "PERSISTENCE_ERROR", message: error.message, at: new Date().toISOString()}, ...store.state.alerts].slice(0, 20);
  }
}

export function persist() {
  if (TEST_MODE) return;
  persistScheduled = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!persistScheduled) return;
    persistScheduled = false;
    writeSnapshotNow();
  }, 250);
  if (typeof persistTimer.unref === "function") persistTimer.unref();
}

export function persistNow() {
  persistScheduled = false;
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  writeSnapshotNow();
}

export function emit(type, payload = {}, priority = .5) {
  const event = {schema: "aegis.interbrain", version: "1.0", id: crypto.randomUUID(), correlation_id: crypto.randomUUID(), source: "commerce", target: "manager", type, priority, timestamp: new Date().toISOString(), payload};
  store.events.unshift(event);
  if (store.events.length > 300) store.events.pop();
  store.state.processed++;
  persist();
  return event;
}

export function recordRun(run) {
  store.runs.unshift(run);
  if (store.runs.length > 500) store.runs.length = 500;
  if (!TEST_MODE) void aegisData.appendEvent("commerce", "run_completed", run, {id: run.id});
  persist();
}
