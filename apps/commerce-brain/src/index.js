import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {MODULE_PARAMETER_DEFAULTS, sanitizeModuleParameters} from "./module-engine.js";
import {completeBrainConversation} from "../../../packages/inter-brain-protocol/src/chat.js";

import {NAME, KIND, PORT, PAPER_MODE, SYSTEM_DATA_MODE, MASTER_BRAIN_URL, AUTOMATION_ENABLED, AUTOMATION_INTERVAL_MS, AMAZON_AFFILIATE_ACTOR_ID, envValue} from "./core/config.js";
import {store, emit, persist} from "./core/store.js";
import {findBot, findProduct, findWorkflow} from "./core/productCatalog.js";
import {enrichProduct} from "./core/economics.js";
import {discoverProducts} from "./core/discovery.js";
import {funnelSummary} from "./core/funnel.js";
import {moduleReadiness, systemReadiness} from "./core/readiness.js";
import {getModuleMode, setModuleStage, permissionMatrixFor, assertPermission, PermissionDeniedError} from "./core/modeControl.js";
import {listRuns} from "./core/runRegistry.js";
import {executeMasterCommand} from "./core/masterCommand.js";
import {runProductLaunchWorkflow, approveWorkflow, rejectWorkflow} from "./core/workflowEngine.js";
import {runCommerceCycle} from "./core/automationCycle.js";

import {runModule, hasModuleRunner} from "./modules/moduleRunner.js";
import {landingFor} from "./modules/creativeFactory.js";
import {campaignFor} from "./modules/traffic.js";

import {connectorStatus, connector, probeAllConnectors} from "./connectors/connectorRegistry.js";
import {probeApifyDataset, runAmazonAffiliateScout} from "./connectors/apifyConnector.js";
import {mediaAsset} from "./connectors/mediaConnector.js";
import {probeShopify, shopifyConfigured} from "./connectors/shopifyConnector.js";

import {copilotSnapshot, chatWithModuleCopilot} from "./copilot/moduleCopilotService.js";
import {commerceChatContext, commerceFallback} from "./copilot/brainChatContext.js";

try { process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env")); } catch {}

const app = express();
app.use(cors());
app.use(express.json({limit: "1mb"}));

// Boot-time enrichment — mirrors the pre-refactor boot sequence: score whatever was persisted, then
// compute real readiness (not the old presence-only botReadiness()) for every module.
store.products.forEach(enrichProduct);
store.commerceBots.forEach(bot => {
  bot.readiness = moduleReadiness(bot.id);
  if (bot.active && !bot.readiness.ready) bot.status = "ATTENTION";
});

function moduleNotFound(res) { return res.status(404).json({ok: false, error: "MODULE_NOT_FOUND"}); }

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({error: "MESSAGE_REQUIRED"});
  try {
    const context = commerceChatContext();
    const answer = await completeBrainConversation({
      brain: "commerce", name: "Commerce Brain", message, conversation: req.body?.conversation,
      context, scope: "descubrimiento de productos, dropshipping, ofertas, marketing, contenidos, CRM, operaciones de tienda y revenue allocation",
      fallback: commerceFallback
    });
    res.json({ok: true, ...answer, speak: true, brain: "commerce", contextAt: context.generatedAt});
  } catch (error) { res.status(502).json({error: "COMMERCE_CHAT_ERROR", message: error.message}); }
});

app.get("/health", (req, res) => res.json({name: NAME, kind: KIND, status: store.state.status, startedAt: store.state.startedAt, agentsOnline: store.commerceBots.filter(bot => bot.active).length, agentsTotal: store.commerceBots.length, processed: store.state.processed, mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", systemDataMode: SYSTEM_DATA_MODE}));
app.get("/api/agents", (req, res) => res.json(store.agents));
app.get("/api/modules", (req, res) => res.json({mode: "PAPER", master: {url: MASTER_BRAIN_URL, connected: store.masterControl.connected, lastCommandAt: store.masterControl.lastCommandAt}, modules: store.commerceBots.map(bot => ({...bot, parameters: store.moduleConfigs[bot.id], control: {actions: ["run_module", "set_parameters", "toggle_bot"], paperOnly: true}}))}));
app.get("/api/master/status", (req, res) => res.json({ok: true, mode: "PAPER", master: {url: MASTER_BRAIN_URL, connected: store.masterControl.connected, lastCommandAt: store.masterControl.lastCommandAt, lastCommand: store.masterControl.lastCommand}, permissions: {inspect: true, setBoundedParameters: true, runPaperActions: true, publish: false, spend: false, withdraw: false}}));
app.post("/api/master/command", async (req, res) => { try { res.json({ok: true, mode: "PAPER", result: await executeMasterCommand(req.body || {})}); } catch (error) { res.status(409).json({ok: false, mode: "PAPER", error: error.message}); } });

// One POST route per module — now including product-scout, which previously had no real runner.
for (const moduleId of ["product-scout", "dropship-hunter", "digital-builder", "offer-pricing", "creative-factory", "store-manager", "traffic", "closer", "retention", "allocator"]) {
  app.post(`/api/modules/${moduleId}/run`, async (req, res) => {
    try {
      const {result} = await runModule(moduleId, req.body || {}, {trigger: "manual"});
      res.json({ok: true, ...result});
    } catch (error) { res.status(502).json({ok: false, error: error.message}); }
  });
}

app.get("/api/digital-products", (req, res) => res.json({mode: "PAPER", items: store.digitalProducts.slice(0, 100)}));
app.get("/api/bots", (req, res) => res.json(store.commerceBots));
app.get("/api/bots/:id", (req, res) => { const bot = findBot(req.params.id); if (!bot) return res.status(404).json({error: "Commerce bot not found"}); res.json(bot); });
app.post("/api/bots/:id/toggle", (req, res) => { const bot = findBot(req.params.id); if (!bot) return res.status(404).json({error: "Commerce bot not found"}); bot.active = !bot.active; bot.enabled = bot.active; bot.status = bot.active ? "STANDBY" : "PAUSED"; emit("commerce_bot_toggled", {botId: bot.id, active: bot.active}); res.json({ok: true, bot}); });
app.post("/api/bots/:id/scan", async (req, res) => {
  const bot = findBot(req.params.id); if (!bot) return res.status(404).json({error: "Commerce bot not found"});
  if (!bot.active) return res.status(409).json({error: "Bot is paused"});
  if (!hasModuleRunner(bot.id)) return res.status(409).json({error: "MODULE_HAS_NO_RUNNER"});
  try { const {result} = await runModule(bot.id, req.body || {}, {trigger: "manual"}); res.json({ok: true, bot, result}); }
  catch (error) { res.status(502).json({ok: false, error: error.message}); }
});
app.post("/api/bots/:id/run", async (req, res) => {
  const bot = findBot(req.params.id); if (!bot) return res.status(404).json({error: "Commerce bot not found"});
  if (!bot.active) return res.status(409).json({error: "Bot is paused"});
  try { const {result} = await runModule(bot.id, req.body || {}, {trigger: "manual"}); res.json({ok: true, bot, result}); }
  catch (error) { res.status(502).json({ok: false, error: error.message}); }
});

// ---- Truth Layer routes ----
app.get("/api/modules/:id/readiness", (req, res) => { if (!findBot(req.params.id)) return moduleNotFound(res); res.json({ok: true, moduleId: req.params.id, readiness: moduleReadiness(req.params.id)}); });
app.get("/api/operations/readiness", (req, res) => res.json({ok: true, ...systemReadiness()}));
app.get("/api/modules/:id/runs", (req, res) => { if (!findBot(req.params.id)) return moduleNotFound(res); const items = listRuns(req.params.id, {limit: req.query.limit, status: req.query.status}); res.json({ok: true, moduleId: req.params.id, total: items.length, items}); });
app.get("/api/modules/:id/results", (req, res) => {
  if (!findBot(req.params.id)) return moduleNotFound(res);
  const items = listRuns(req.params.id, {limit: req.query.limit}).map(run => ({runId: run.id, at: run.finishedAt || run.startedAt, status: run.status, trigger: run.trigger, newSignal: run.newSignal, evidenceSummary: run.summary, blockers: run.blockers, warnings: run.warnings}));
  res.json({ok: true, moduleId: req.params.id, items});
});
app.get("/api/modules/:id/mode", (req, res) => {
  if (!findBot(req.params.id)) return moduleNotFound(res);
  const mode = getModuleMode(req.params.id);
  res.json({ok: true, moduleId: req.params.id, actionStage: mode.actionStage, dataMode: mode.dataMode, systemDataMode: SYSTEM_DATA_MODE, permissions: permissionMatrixFor(req.params.id), history: mode.history});
});
app.post("/api/modules/:id/mode", (req, res) => {
  if (!findBot(req.params.id)) return moduleNotFound(res);
  try {
    const mode = setModuleStage(req.params.id, String(req.body?.actionStage || ""), {confirmLive: req.body?.confirmLive === true, actor: req.body?.actor, reason: req.body?.reason, operatorToken: req.get("x-operator-token")});
    res.json({ok: true, moduleId: req.params.id, mode});
  } catch (error) {
    res.status(error instanceof PermissionDeniedError ? 409 : 400).json({ok: false, error: error.code || error.message, detail: error.detail || null});
  }
});
app.get("/api/modules/:id/copilot", (req, res) => { if (!findBot(req.params.id)) return moduleNotFound(res); res.json({ok: true, ...copilotSnapshot(req.params.id)}); });
app.post("/api/modules/:id/copilot/chat", async (req, res) => {
  if (!findBot(req.params.id)) return moduleNotFound(res);
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ok: false, error: "MESSAGE_REQUIRED"});
  try { const response = await chatWithModuleCopilot(req.params.id, message, req.body?.conversation); res.json({ok: true, moduleId: req.params.id, ...response}); }
  catch (error) { res.status(502).json({ok: false, error: "COPILOT_CHAT_ERROR", message: error.message}); }
});
app.get("/api/modules/:id/policy", (req, res) => { if (!store.moduleConfigs[req.params.id]) return moduleNotFound(res); res.json({ok: true, moduleId: req.params.id, parameters: store.moduleConfigs[req.params.id], defaults: MODULE_PARAMETER_DEFAULTS[req.params.id]}); });
app.post("/api/modules/:id/policy", (req, res) => {
  if (!store.moduleConfigs[req.params.id]) return moduleNotFound(res);
  store.moduleConfigs[req.params.id] = sanitizeModuleParameters(req.params.id, {...store.moduleConfigs[req.params.id], ...(req.body?.parameters || {})});
  store.products.forEach(enrichProduct);
  persist();
  res.json({ok: true, moduleId: req.params.id, parameters: store.moduleConfigs[req.params.id]});
});
// ---- end Truth Layer routes ----

app.get("/api/connectors/status", async (req, res) => {
  const status = await probeAllConnectors();
  const apify = status.connectors.find(item => item.id === "apify");
  if (apify?.configured && process.env.APIFY_DATASET_ID && String(process.env.APIFY_USE_LEGACY_DATASET || "false").toLowerCase() === "true") apify.legacyDatasetProbe = await probeApifyDataset();
  res.json(status);
});
app.get("/api/apify/amazon-affiliate-scout/status", (req, res) => {
  const apify = connector("apify");
  res.json({ok: true, mode: "PAPER", actor: {id: AMAZON_AFFILIATE_ACTOR_ID, configured: Boolean(apify?.configured), readiness: apify?.readiness || "BLOCKED", private: true, purpose: "Amazon Affiliate product discovery via official Creators API"}, credentials: {apifyToken: Boolean(envValue("APIFY_API_TOKEN", "APIFY_API_KEY")), amazonCreatorsCredentials: Boolean(envValue("AMAZON_CREATORS_CLIENT_ID") && envValue("AMAZON_CREATORS_CLIENT_SECRET") && envValue("AMAZON_PARTNER_TAG", "AMAZON_CREATORS_PARTNER_TAG"))}, policy: {scraping: false, shopifyInventoryImport: false, adSpend: false, affiliateClickout: true}});
});
app.post("/api/apify/amazon-affiliate-scout/run", async (req, res) => {
  try { const result = await runAmazonAffiliateScout(req.body || {}); res.json({ok: true, ...result}); }
  catch (error) { res.status(String(error.message).startsWith("APIFY_ACTOR_RUN_403") ? 503 : 502).json({ok: false, mode: "PAPER", actorId: AMAZON_AFFILIATE_ACTOR_ID, error: error.message, message: "El Actor no devolvió productos. Revisa el build/cuota de Apify y las credenciales del Amazon Creators API dentro del Actor."}); }
});
app.get("/api/products", (req, res) => res.json({items: store.products, mode: "PAPER", sources: connectorStatus().connectors.filter(item => ["amazon", "aliexpress", "apify"].includes(item.id))}));
app.post("/api/products/discover", async (req, res) => {
  const requested = req.body?.source === "amazon" || req.body?.source === "aliexpress" ? [req.body.source] : ["amazon", "aliexpress"];
  if (requested.length === 1 && requested[0] === "amazon" && req.body?.useApifyActor === true) {
    try { return res.json({ok: true, ...(await runAmazonAffiliateScout(req.body || {}))}); }
    catch (error) { return res.status(502).json({ok: false, mode: "PAPER", error: error.message}); }
  }
  const result = await discoverProducts(requested);
  res.json({ok: true, mode: "PAPER", liveData: false, providerFeedUsed: result.providerFeedUsed, warning: result.providerFeedUsed ? "Feed de proveedor leído en modo PAPER; no se publicaron ni compraron productos." : (result.noSignalSources?.length ? `Sin señal real de: ${result.noSignalSources.join(", ")}. No se generaron muestras sintéticas (systemDataMode=${SYSTEM_DATA_MODE}).` : "Estas son muestras PAPER hasta conectar las credenciales o feeds del proveedor."), items: result.items});
});
app.get("/api/workflows", (req, res) => {
  const productId = req.query.productId ? String(req.query.productId) : null;
  const rows = productId ? store.workflows.filter(item => item.productId === productId) : store.workflows;
  res.json({mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", workflows: rows.slice(0, 100)});
});
app.get("/api/workflows/:id", (req, res) => { const workflow = findWorkflow(req.params.id); if (!workflow) return res.status(404).json({error: "WORKFLOW_NOT_FOUND"}); res.json(workflow); });
app.post("/api/workflows/product-launch", async (req, res) => {
  try { const workflow = await runProductLaunchWorkflow(req.body || {}); res.status(201).json({ok: true, workflow}); }
  catch (error) { store.state.alerts = [{id: crypto.randomUUID(), code: "PRODUCT_WORKFLOW_ERROR", message: error.message, at: new Date().toISOString()}, ...store.state.alerts].slice(0, 20); persist(); res.status(400).json({ok: false, error: error.message}); }
});
app.post("/api/workflows/:id/approve", (req, res) => { try { const workflow = approveWorkflow(findWorkflow(req.params.id), req.body || {}); res.json({ok: true, workflow}); } catch (error) { res.status(409).json({ok: false, error: error.message}); } });
app.post("/api/workflows/:id/reject", (req, res) => { const workflow = findWorkflow(req.params.id); if (!workflow) return res.status(404).json({error: "WORKFLOW_NOT_FOUND"}); res.json({ok: true, workflow: rejectWorkflow(workflow, req.body || {})}); });
app.get("/api/store-drafts", (req, res) => res.json(store.storeDrafts.slice(0, 100)));
app.post("/api/automation/run", async (req, res) => { try { res.json({ok: true, cycle: await runCommerceCycle(req.body || {})}); } catch (error) { store.state.alerts = [{id: crypto.randomUUID(), code: "AUTOMATION_ERROR", message: error.message, at: new Date().toISOString()}, ...store.state.alerts].slice(0, 20); persist(); res.status(502).json({error: error.message}); } });
app.get("/api/automation/status", (req, res) => res.json({enabled: AUTOMATION_ENABLED, intervalMs: AUTOMATION_INTERVAL_MS, mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", lastCycle: store.events.find(event => event.type === "commerce_cycle_completed")?.payload || null}));
app.get("/api/operations/summary", (req, res) => {
  const readiness = store.commerceBots.map(bot => ({id: bot.id, name: bot.name, active: bot.active, status: bot.status, readiness: bot.readiness || moduleReadiness(bot.id), lastRunAt: bot.lastRunAt}));
  const readyProducts = store.products.filter(product => product.tier === "TEST_READY").sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  res.json({mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", systemDataMode: SYSTEM_DATA_MODE, automation: {enabled: AUTOMATION_ENABLED, intervalMs: AUTOMATION_INTERVAL_MS}, pipeline: {discovered: store.products.length, scored: store.products.filter(product => product.score !== undefined).length, testReady: readyProducts.length, landingDrafts: store.landingPages.length, storeDrafts: store.storeDrafts.length, campaignDrafts: store.campaigns.length, workflows: store.workflows.length, workflowsReadyForPaper: store.workflows.filter(item => item.status === "READY_FOR_PAPER_TEST").length}, readiness, truthLayer: systemReadiness(), topProducts: readyProducts.slice(0, 5), workflows: store.workflows.slice(0, 5), funnel: funnelSummary(), connectors: connectorStatus()});
});
app.post("/api/products/:id/score", (req, res) => { const product = findProduct(req.params.id); if (!product) return res.status(404).json({error: "Product not found"}); Object.assign(product, req.body || {}); enrichProduct(product); emit("commerce_product_scored", {productId: product.id, score: product.score, tier: product.tier}); res.json({ok: true, product}); });
app.post("/api/products/:id/landing", async (req, res) => {
  const product = findProduct(req.params.id); if (!product) return res.status(404).json({error: "Product not found"});
  const asset = await mediaAsset(`Hero product image for ${product.name}, category ${product.category}, premium ecommerce studio lighting, clean background, conversion-focused composition.`);
  const landing = landingFor(product, asset); store.landingPages.unshift(landing); emit("commerce_landing_draft", {landingId: landing.id, productId: product.id, assetMode: asset.mode});
  res.json({ok: true, landing});
});
app.get("/api/landing-pages", (req, res) => res.json(store.landingPages));
app.post("/api/products/:id/campaign", (req, res) => { const product = findProduct(req.params.id); if (!product) return res.status(404).json({error: "Product not found"}); enrichProduct(product); const campaign = campaignFor(product, req.body || {}); store.campaigns.unshift(campaign); emit("commerce_campaign_draft", {campaignId: campaign.id, productId: product.id}); res.json({ok: true, campaign, message: "Promotion plan prepared. No ad spend activated."}); });
app.get("/api/campaigns", (req, res) => res.json(store.campaigns));
app.post("/api/campaigns/:id/activate", (req, res) => {
  const campaign = store.campaigns.find(item => item.id === req.params.id); if (!campaign) return res.status(404).json({error: "Campaign not found"});
  try { assertPermission("traffic", "activate_ads"); }
  catch (error) { return res.status(409).json({ok: false, error: error.code || error.message, detail: error.detail || null, campaign}); }
  const enabled = String(process.env.COMMERCE_LIVE_ADS_ENABLED || "false").toLowerCase() === "true";
  if (PAPER_MODE || !enabled) return res.status(409).json({ok: false, error: "LIVE_ADS_LOCKED", blockers: [PAPER_MODE ? "COMMERCE_MODE=PAPER" : null, !enabled ? "COMMERCE_LIVE_ADS_ENABLED=false" : null].filter(Boolean), campaign});
  campaign.status = "ACTIVE"; campaign.activatedAt = new Date().toISOString(); emit("commerce_campaign_activated", {campaignId: campaign.id}); res.json({ok: true, campaign});
});
app.post("/api/shopify/probe", async (req, res) => {
  const probe = await probeShopify({force: true});
  if (!probe.configured) return res.status(409).json({ok: false, error: "SHOPIFY_CREDENTIALS_NOT_CONFIGURED", connector: connector("shopify")});
  res.status(probe.online ? 200 : 502).json({ok: probe.online, status: probe.status, shop: probe.shop, error: probe.error});
});
app.post("/api/shopify/draft", (req, res) => { const product = findProduct(req.body?.productId); if (!product) return res.status(404).json({error: "Product not found"}); if (product.monetizationModel === "AMAZON_AFFILIATE") return res.status(409).json({ok: false, error: "AMAZON_AFFILIATE_NOT_SHOPIFY_INVENTORY", message: "Los productos Amazon Afiliados se publican como contenido con clickout; no se convierten en inventario de Shopify."}); enrichProduct(product); const draft = {id: crypto.randomUUID(), productId: product.id, status: "DRAFT_ONLY", paper: true, connector: connector("shopify"), product: {title: product.name, price: product.economics?.price || product.price, description: `Draft listing for ${product.name}`}, createdAt: new Date().toISOString()}; emit("commerce_shopify_draft", draft); res.json({ok: true, draft, message: "Draft prepared. No se publicó nada en Shopify."}); });
app.post("/api/shopify/publish", (req, res) => {
  try { assertPermission("store-manager", "publish_products"); }
  catch (error) { return res.status(409).json({ok: false, error: error.code || error.message, detail: error.detail || null}); }
  const enabled = String(process.env.COMMERCE_LIVE_PUBLISH || "false").toLowerCase() === "true";
  const shop = connector("shopify");
  if (PAPER_MODE || !enabled || !shop.configured) return res.status(409).json({ok: false, error: "SHOPIFY_PUBLISH_LOCKED", blockers: [PAPER_MODE ? "COMMERCE_MODE=PAPER" : null, !enabled ? "COMMERCE_LIVE_PUBLISH=false" : null, !shop.configured ? "SHOPIFY_CREDENTIALS_NOT_CONFIGURED" : null].filter(Boolean)});
  res.status(501).json({ok: false, error: "SHOPIFY_PUBLISH_ADAPTER_REQUIRES_APPROVED_PRODUCT_MUTATION", message: "Connector validated; product mutation remains an explicit implementation gate."});
});

app.post("/api/leads", (req, res) => { const lead = {id: crypto.randomUUID(), email: String(req.body?.email || "").trim().toLowerCase(), name: req.body?.name || "", source: req.body?.source || "unknown", score: Number(req.body?.score || 0), status: "new", createdAt: new Date().toISOString(), metadata: req.body?.metadata || {}}; if (!lead.email || !lead.email.includes("@")) return res.status(400).json({error: "VALID_EMAIL_REQUIRED"}); store.leads.unshift(lead); emit("commerce_lead_captured", {leadId: lead.id, source: lead.source}); res.status(201).json({ok: true, lead}); });
app.get("/api/leads", (req, res) => res.json(store.leads));
app.post("/api/funnel/event", (req, res) => { const allowed = ["landing_view", "cta_click", "checkout_started", "purchase", "refund", "email_signup", "add_to_cart"]; const type = String(req.body?.type || ""); if (!allowed.includes(type)) return res.status(400).json({error: "UNSUPPORTED_FUNNEL_EVENT", allowed}); const event = {id: crypto.randomUUID(), type, productId: req.body?.productId || null, campaignId: req.body?.campaignId || null, sessionId: req.body?.sessionId || null, value: Number(req.body?.value || 0), createdAt: new Date().toISOString(), metadata: req.body?.metadata || {}}; store.funnelEvents.unshift(event); emit("commerce_funnel_event", event); res.status(201).json({ok: true, event, funnel: funnelSummary()}); });
app.get("/api/funnel/summary", (req, res) => res.json(funnelSummary()));
app.post("/api/orders/webhook", (req, res) => {
  const configuredSecret = process.env.COMMERCE_WEBHOOK_SECRET;
  const suppliedSecret = req.get("x-commerce-webhook-secret");
  const verified = configuredSecret ? suppliedSecret === configuredSecret : PAPER_MODE && req.body?.paper === true;
  if (!verified) return res.status(401).json({error: "ORDER_WEBHOOK_NOT_VERIFIED", message: "Provide the server webhook secret or an explicit paper:true event."});
  const order = {id: String(req.body?.id || req.body?.orderId || crypto.randomUUID()), customerId: req.body?.customerId || req.body?.email || null, productId: req.body?.productId || null, total: Number(req.body?.total || 0), status: req.body?.status || "paid", verified: true, createdAt: req.body?.createdAt || new Date().toISOString()};
  if (store.orders.some(item => item.id === order.id)) return res.json({ok: true, duplicate: true, order});
  store.orders.unshift(order);
  if (order.status === "paid") { store.state.metrics.revenue += order.total; store.state.metrics.contribution += Number(req.body?.contribution || 0); }
  emit("commerce_order_received", {orderId: order.id, status: order.status, verified: order.verified, total: order.total});
  res.status(201).json({ok: true, order, funnel: funnelSummary()});
});

app.get("/api/events", (req, res) => res.json(store.events.slice(0, 100)));
app.get("/api/summary", (req, res) => res.json({name: NAME, kind: KIND, state: store.state, mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", agents: store.agents, bots: store.commerceBots, products: store.products, landingPages: store.landingPages, storeDrafts: store.storeDrafts, campaigns: store.campaigns, workflows: store.workflows, leads: store.leads.length, orders: store.orders.length, funnel: funnelSummary(), connectors: connectorStatus(), opportunities: store.opportunities, latestEvents: store.events.slice(0, 10)}));
app.post("/api/event", (req, res) => res.json({ok: true, event: emit(req.body.type || "external_event", req.body.payload || {}, Number(req.body.priority || .5))}));
app.get("/api/opportunities", (req, res) => res.json(store.opportunities));
app.post("/api/opportunities", (req, res) => { const opportunity = {id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "testing", score: Number(req.body.score || .5), ...req.body}; store.opportunities.unshift(opportunity); emit("commerce_opportunity", opportunity, opportunity.score); res.json({ok: true, opportunity}); });
app.get("/api/kpis", (req, res) => res.json({experiments: store.opportunities.length, active: store.opportunities.filter(item => item.status === "testing").length, revenue: Number(store.state.metrics.revenue || 0), contribution: Number(store.state.metrics.contribution || 0), spend: Number(store.state.metrics.spend || 0), products: store.products.length, testReady: store.products.filter(product => product.tier === "TEST_READY").length, landings: store.landingPages.length, campaigns: store.campaigns.length, leads: store.leads.length, orders: store.orders.length, activeBots: store.commerceBots.filter(bot => bot.active).length}));

let automationBusy = false;
if (AUTOMATION_ENABLED) setInterval(async () => {
  if (automationBusy) return;
  automationBusy = true;
  try { await runCommerceCycle({reason: "scheduled"}); }
  catch (error) { store.state.alerts = [{id: crypto.randomUUID(), code: "SCHEDULED_CYCLE_ERROR", message: error.message, at: new Date().toISOString()}, ...store.state.alerts].slice(0, 20); persist(); }
  finally { automationBusy = false; }
}, AUTOMATION_INTERVAL_MS);

app.listen(PORT, () => console.log(`${NAME} listening on ${PORT} · ${PAPER_MODE ? "PAPER" : "LIVE LOCKED"} · systemDataMode ${SYSTEM_DATA_MODE} · automation ${AUTOMATION_ENABLED ? "on" : "off"}`));
