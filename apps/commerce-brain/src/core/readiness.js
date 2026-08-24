import {store} from "./store.js";
import {SYSTEM_DATA_MODE} from "./config.js";
import {connector} from "../connectors/connectorRegistry.js";

// Modules that never gate a mutating action (per the permission matrix in modeControl.js) never need
// to progress past DRAFT_READY — they are intelligence-only. Modules that DO own a mutating action
// (generate_assets/publish_products/activate_ads/send_emails/reassign_budget) can progress to
// APPROVAL_READY/LIVE_READY once a linked workflow artifact clears compliance and gets human approval.
const NEVER_MUTATES = new Set(["product-scout", "dropship-hunter", "digital-builder", "offer-pricing"]);

// Maps a mutating module to the workflow artifact key it contributes, so readiness can check whether
// THIS module's own output — not just "some product somewhere" — cleared compliance and was approved.
const WORKFLOW_ARTIFACT_KEY = {
  "creative-factory": "landingPage",
  "store-manager": "storeDraft",
  "traffic": "campaign"
};

const STATE_SCORE = {BLOCKED: 0, DEGRADED: 20, OBSERVE_READY: 40, DRAFT_READY: 60, APPROVAL_READY: 80, LIVE_READY: 100};

function realProducts() { return store.products.filter(product => product.sourceStatus !== "PAPER_SAMPLE"); }
function testReadyProducts() { return realProducts().filter(product => product.tier === "TEST_READY").sort((a, b) => Number(b.score || 0) - Number(a.score || 0)); }
function lastRunFor(moduleId) { return store.runs.find(run => run.moduleId === moduleId) || null; }

function connectorBlockersFor(moduleId) {
  const blockers = [];
  if (moduleId === "product-scout" && !connector("amazon")?.configured && !connector("apify")?.configured) blockers.push("amazon_provider_credentials_missing");
  if (moduleId === "dropship-hunter" && !connector("aliexpress")?.configured) blockers.push("aliexpress_connector_not_configured");
  return blockers;
}

function evidenceFor(moduleId) {
  const real = realProducts();
  const testReady = testReadyProducts();
  const hotLeadScore = Number(store.moduleConfigs.closer?.hotLeadScore || 70);
  switch (moduleId) {
    case "product-scout":
    case "dropship-hunter":
      return {realProducts: real.length, testReadyProducts: testReady.length, syntheticOnly: store.products.length > 0 && real.length === 0, hasRealEvidence: real.length > 0};
    case "digital-builder":
      return {digitalProducts: store.digitalProducts.length, supported: store.digitalProducts.filter(item => item.validation?.status === "SUPPORTED").length, hasRealEvidence: store.digitalProducts.some(item => item.validation?.status === "SUPPORTED")};
    case "offer-pricing":
      return {pricedProducts: real.filter(product => product.pricing).length, hasRealEvidence: real.some(product => product.pricing)};
    case "creative-factory":
      return {landingPages: store.landingPages.length, hasRealEvidence: store.landingPages.length > 0};
    case "store-manager":
      return {storeDrafts: store.storeDrafts.length, hasRealEvidence: store.storeDrafts.length > 0};
    case "traffic":
      return {campaigns: store.campaigns.length, activeCampaigns: store.campaigns.filter(item => item.status === "ACTIVE").length, hasRealEvidence: store.campaigns.length > 0};
    case "closer":
      return {leads: store.leads.length, hotLeads: store.leads.filter(lead => Number(lead.score || 0) >= hotLeadScore).length, hasRealEvidence: store.leads.length > 0};
    case "retention":
      return {orders: store.orders.length, repeatCustomers: new Set(store.orders.filter(order => order.customerId).map(order => order.customerId)).size, hasRealEvidence: store.orders.length > 0};
    case "allocator":
      return {testReadyProducts: testReady.length, hasRealEvidence: testReady.length > 0};
    default:
      return {hasRealEvidence: false};
  }
}

function workflowApprovalFor(moduleId) {
  const artifactKey = WORKFLOW_ARTIFACT_KEY[moduleId];
  if (!artifactKey) return null;
  const workflow = store.workflows.find(item => item.artifacts?.[artifactKey] && item.compliance?.blockers?.length === 0);
  if (!workflow) return null;
  return {workflowId: workflow.id, productId: workflow.productId, approved: (workflow.approvals || []).length > 0};
}

export function moduleReadiness(moduleId) {
  const testReady = testReadyProducts();
  const topProduct = testReady[0] || null;
  const lastRun = lastRunFor(moduleId);
  const evidence = evidenceFor(moduleId);
  const connectorBlockers = connectorBlockersFor(moduleId);
  const blockers = [...connectorBlockers];
  const warnings = [];

  // Legacy blocker signals from the pre-refactor botReadiness(), kept so `ready`/`blockers` stay
  // backward-compatible with the frontend fields already in use.
  const hasScoredProduct = store.products.some(product => ["TEST_READY", "REVIEW"].includes(product.tier));
  if (["creative-factory", "store-manager"].includes(moduleId) && !hasScoredProduct) blockers.push("no_scored_product");
  if (moduleId === "traffic" && !store.campaigns.length) blockers.push("campaign_draft_missing");
  if (["closer", "retention"].includes(moduleId) && !store.leads.length) blockers.push("crm_empty");
  if (moduleId === "allocator" && !topProduct) blockers.push("no_test_ready_products");

  let state;
  if (connectorBlockers.length > 0) {
    state = "BLOCKED";
  } else if (lastRun?.status === "ERROR") {
    state = "DEGRADED";
    warnings.push("last_run_error");
  } else if (lastRun?.status === "DEGRADED") {
    state = "DEGRADED";
    warnings.push("last_run_degraded");
  } else if (lastRun?.status === "BLOCKED") {
    state = "BLOCKED";
    blockers.push(...(lastRun.blockers || []));
  } else if (!lastRun || !evidence.hasRealEvidence) {
    state = "OBSERVE_READY";
  } else if (NEVER_MUTATES.has(moduleId)) {
    state = "DRAFT_READY";
  } else {
    const workflowApproval = workflowApprovalFor(moduleId);
    if (!workflowApproval) state = "DRAFT_READY";
    else if (!workflowApproval.approved) state = "APPROVAL_READY";
    else state = "LIVE_READY";
  }

  if (evidence.syntheticOnly) warnings.push("synthetic_samples_only_not_promotable");
  if (SYSTEM_DATA_MODE === "DEMO") warnings.push("system_data_mode_demo_synthetic_allowed");

  const uniqueBlockers = [...new Set(blockers)];
  return {
    moduleId,
    state,
    score: STATE_SCORE[state] ?? 0,
    ready: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    warnings: [...new Set(warnings)],
    nextAction: topProduct ? `Prioritize ${topProduct.name}` : "Run discovery and scoring",
    topProductId: topProduct?.id || null,
    evidence,
    connectorBlockers,
    lastRun: lastRun ? {id: lastRun.id, status: lastRun.status, finishedAt: lastRun.finishedAt, trigger: lastRun.trigger} : null,
    canMutate: !NEVER_MUTATES.has(moduleId),
    checkedAt: new Date().toISOString()
  };
}

export function systemReadiness() {
  const modules = store.commerceBots.map(bot => moduleReadiness(bot.id));
  const summary = modules.reduce((acc, item) => {
    const key = {BLOCKED: "blocked", DEGRADED: "degraded", OBSERVE_READY: "observeReady", DRAFT_READY: "draftReady", APPROVAL_READY: "approvalReady", LIVE_READY: "liveReady"}[item.state];
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {modules: modules.length});
  return {version: 1, evaluatedAt: new Date().toISOString(), systemDataMode: SYSTEM_DATA_MODE, summary, modules};
}
