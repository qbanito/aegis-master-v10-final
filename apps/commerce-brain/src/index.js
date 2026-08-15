import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {MODULE_PARAMETER_DEFAULTS, buildDigitalProductOpportunity, normalizeDropshipCandidate, priceOffer, sanitizeModuleParameters, scoreDropshipCandidate} from "./module-engine.js";
import {completeBrainConversation} from "../../../packages/inter-brain-protocol/src/chat.js";

try { process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env")); } catch {}

const app = express();
app.use(cors());
app.use(express.json({limit: "1mb"}));

const NAME = "AEGIS Commerce Brain";
const KIND = "commerce";
const PORT = Number(process.env.PORT || 8802);
const PAPER_MODE = String(process.env.COMMERCE_MODE || "PAPER").toUpperCase() !== "LIVE";
const serviceUrl = (value, fallback) => { const url = String(value || fallback).trim().replace(/\/$/, ""); return /^https?:\/\//i.test(url) ? url : `http://${url}`; };
const MEDIA_BRAIN_URL = serviceUrl(process.env.MEDIA_BRAIN_URL, "http://localhost:8804");
const MASTER_BRAIN_URL = serviceUrl(process.env.MANAGER_BRAIN_URL, "http://localhost:8805");
const ASSET_MODE = String(process.env.COMMERCE_ASSET_MODE || (process.env.MUAPI_API_KEY ? "remote" : "brief")).toLowerCase();
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const DATA_FILE = path.join(DATA_DIR, "commerce.json");
const AUTOMATION_ENABLED = String(process.env.COMMERCE_AUTOMATION_ENABLED || "true").toLowerCase() !== "false";
const AUTOMATION_INTERVAL_MS = Math.max(60000, Number(process.env.COMMERCE_AUTOMATION_INTERVAL_MS || 900000));
const APIFY_BASE_URL = String(process.env.APIFY_API_BASE_URL || "https://api.apify.com/v2").replace(/\/$/, "");
const AMAZON_AFFILIATE_ACTOR_ID = String(process.env.APIFY_AMAZON_AFFILIATE_SCOUT_ACTOR_ID || "connected_monkey~amazon-affiliate-product-scout");

const agents = [
  {id: "product-scout", name: "Amazon Product Scout", description: "Detecta productos con demanda y margen potencial en Amazon.", strategy: "demanda · margen · reviews", enabled: true},
  {id: "dropship-hunter", name: "Dropshipping Hunter", description: "Busca productos de AliExpress con señales de demanda y proveedores viables.", strategy: "tendencia · proveedor · logística", enabled: true},
  {id: "digital-builder", name: "Digital Product Builder", description: "Convierte problemas detectados en productos digitales y bundles.", strategy: "problema · solución · bundle", enabled: true},
  {id: "offer-pricing", name: "Offer & Pricing Engine", description: "Calcula precio, margen, anclaje y sensibilidad de la oferta.", strategy: "coste · margen · elasticidad", enabled: true},
  {id: "creative-factory", name: "Content & Creative Factory", description: "Crea briefs de landing, imágenes y piezas de contenido con Media Brain.", strategy: "brief · asset · conversión", enabled: true},
  {id: "store-manager", name: "Store & Marketplace Manager", description: "Prepara drafts de producto y sincronización controlada con Shopify.", strategy: "catalogo · draft · sync", enabled: true},
  {id: "traffic", name: "Traffic Acquisition Agent", description: "Ordena canales, audiencias y experimentos de adquisición.", strategy: "audiencia · canal · CAC", enabled: true},
  {id: "closer", name: "Sales Closer / CRM", description: "Prioriza leads, conversaciones y próximos pasos comerciales.", strategy: "lead · intención · cierre", enabled: true},
  {id: "retention", name: "Retention & Upsell Agent", description: "Detecta oportunidades de recompra, cross-sell y recuperación.", strategy: "cohorte · recompra · LTV", enabled: true},
  {id: "allocator", name: "Revenue Allocator", description: "Distribuye presupuesto entre productos y experimentos con límites PAPER.", strategy: "ROI · riesgo · presupuesto", enabled: true}
];

const commerceBots = agents.map((agent, index) => ({
  ...agent,
  order: index + 1,
  status: index % 3 === 0 ? "SCANNING" : "STANDBY",
  active: true,
  lastRunAt: null,
  lastResult: null,
  metrics: {signals: 0, candidates: 0, drafts: 0, confidence: 0}
}));

function loadPersistence() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}
const persisted = loadPersistence();
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

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(DATA_FILE, JSON.stringify({state, bots: commerceBots, moduleConfigs, masterControl, events: events.slice(0, 300), opportunities: opportunities.slice(0, 300), products: products.slice(0, 500), digitalProducts: digitalProducts.slice(0, 200), landingPages: landingPages.slice(0, 200), storeDrafts: storeDrafts.slice(0, 200), leads: leads.slice(0, 500), orders: orders.slice(0, 500), funnelEvents: funnelEvents.slice(0, 1000), campaigns: campaigns.slice(0, 200), workflows: workflows.slice(0, 300)}, null, 2));
  } catch (error) { state.alerts = [{id: crypto.randomUUID(), code: "PERSISTENCE_ERROR", message: error.message, at: new Date().toISOString()}, ...state.alerts].slice(0, 20); }
}

function emit(type, payload = {}, priority = .5) {
  const event = {schema: "aegis.interbrain", version: "1.0", id: crypto.randomUUID(), correlation_id: crypto.randomUUID(), source: KIND, target: "manager", type, priority, timestamp: new Date().toISOString(), payload};
  events.unshift(event);
  if (events.length > 300) events.pop();
  state.processed++;
  persist();
  return event;
}

function envValue(...keys) { return keys.map(key => process.env[key]).find(value => Boolean(value)) || ""; }
function configured(...keys) { return keys.every(key => Boolean(process.env[key])); }
function connectorStatus() {
  const shopify = configured("SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_ACCESS_TOKEN");
  const amazonCreators = Boolean(envValue("AMAZON_CREATORS_CLIENT_ID") && envValue("AMAZON_CREATORS_CLIENT_SECRET") && envValue("AMAZON_PARTNER_TAG", "AMAZON_CREATORS_PARTNER_TAG"));
  const amazon = amazonCreators || Boolean(process.env.AMAZON_PRODUCT_FEED_URL);
  const aliexpress = configured("ALIEXPRESS_API_KEY") || Boolean(process.env.ALIEXPRESS_API_URL);
  const apifyToken = Boolean(envValue("APIFY_API_TOKEN", "APIFY_API_KEY"));
  const apify = apifyToken && Boolean(AMAZON_AFFILIATE_ACTOR_ID);
  return {
    mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED",
    policy: "read_only_until_explicit_publish",
    connectors: [
      {id: "aliexpress", name: "AliExpress", provider: "product feed / affiliate adapter", configured: aliexpress, live: false, detail: aliexpress ? "credentials detected; discovery adapter ready" : "API key or feed URL required"},
      {id: "amazon", name: "Amazon Affiliate Product Scout", provider: "Amazon Creators API", configured: amazon, live: false, readiness: amazonCreators ? "CREATORS_API_READY" : (amazon ? "FEED_CONFIGURED" : "BLOCKED"), detail: amazonCreators ? "Creators API credentials detected; affiliate content only" : (amazon ? "Amazon feed configured; affiliate adapter available" : "Creators API client credentials + partner tag required")},
      {id: "shopify", name: "Shopify", provider: "Admin API", configured: shopify, live: false, detail: shopify ? "store configured; drafts only" : "store domain + admin token required"},
      {id: "apify", name: "Apify Amazon Affiliate Scout", provider: "private Actor", configured: apify, online: null, live: false, readiness: apify ? "ACTOR_CONFIGURED" : "BLOCKED", actorId: AMAZON_AFFILIATE_ACTOR_ID, detail: apify ? "private Actor configured; explicit run required" : "APIFY_API_TOKEN required"},
      {id: "master", name: "Manager / Brain Master", provider: MASTER_BRAIN_URL, configured: Boolean(MASTER_BRAIN_URL), online: null, live: false, readiness: masterControl.connected ? "CONNECTED" : "DEGRADED", detail: "Can inspect modules, change bounded parameters and run PAPER actions"},
      {id: "media", name: "Media Brain / MuAPI", provider: MEDIA_BRAIN_URL, configured: Boolean(MEDIA_BRAIN_URL), live: false, detail: `asset mode: ${ASSET_MODE}`}
    ]
  };
}

function connector(id) { return connectorStatus().connectors.find(item => item.id === id); }
async function probeApifyDataset() {
  const token = envValue("APIFY_API_TOKEN", "APIFY_API_KEY");
  const datasetId = process.env.APIFY_DATASET_ID;
  const base = String(process.env.APIFY_API_BASE_URL || "https://api.apify.com/v2").replace(/\/$/, "");
  if (!token || !datasetId) return {online: false, readiness: "BLOCKED", error: "APIFY_TOKEN_OR_DATASET_MISSING", checkedAt: new Date().toISOString()};
  try {
    const response = await fetch(`${base}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=1`, {headers: {authorization: `Bearer ${token}`, accept: "application/json"}, signal: AbortSignal.timeout(8000)});
    const body = await response.json().catch(() => []);
    return {online: response.ok, readiness: response.ok ? "READY" : "DEGRADED", itemCount: Array.isArray(body) ? body.length : 0, error: response.ok ? null : `APIFY_HTTP_${response.status}`, checkedAt: new Date().toISOString()};
  } catch (error) { return {online: false, readiness: "DEGRADED", error: error.message, checkedAt: new Date().toISOString()}; }
}
function amazonAffiliateActorInput(input = {}) {
  const keywords = Array.isArray(input.keywords) ? input.keywords.map(item => String(item).trim()).filter(Boolean).slice(0, 25) : String(input.keywords || "").split(",").map(item => item.trim()).filter(Boolean).slice(0, 25);
  return {
    keywords: keywords.length ? keywords : ["home organization", "travel gadgets", "wellness accessories"],
    marketplace: String(input.marketplace || "www.amazon.com"),
    searchIndex: String(input.searchIndex || "All"),
    maxItemsPerKeyword: Math.min(10, Math.max(1, Number(input.maxItemsPerKeyword || 10))),
    maxPagesPerKeyword: Math.min(10, Math.max(1, Number(input.maxPagesPerKeyword || 1))),
    minPrice: Number(input.minPrice || 0),
    maxPrice: Number(input.maxPrice || 0),
    commissionRate: Number(input.commissionRate || 0.04),
    contentCostPerProduct: Number(input.contentCostPerProduct || 1.5),
    minScore: Math.min(100, Math.max(0, Number(input.minScore || 55))),
    maxRequests: Math.min(50, Math.max(1, Number(input.maxRequests || 10))),
    requestDelayMs: Math.min(5000, Math.max(100, Number(input.requestDelayMs || 300)))
  };
}
async function runAmazonAffiliateScout(input = {}) {
  const token = envValue("APIFY_API_TOKEN", "APIFY_API_KEY");
  if (!token) throw new Error("APIFY_TOKEN_MISSING");
  const actorInput = amazonAffiliateActorInput(input);
  const url = `${APIFY_BASE_URL}/acts/${encodeURIComponent(AMAZON_AFFILIATE_ACTOR_ID)}/run-sync-get-dataset-items?clean=true&format=json`;
  let response;
  try {
    response = await fetch(url, {method: "POST", headers: {authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json"}, body: JSON.stringify(actorInput), signal: AbortSignal.timeout(180000)});
  } catch (error) {
    emit("commerce_provider_error", {source: "apify_amazon_affiliate_actor", actorId: AMAZON_AFFILIATE_ACTOR_ID, message: error.message}, .8);
    throw new Error(`APIFY_ACTOR_NETWORK_ERROR:${error.message}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body?.error?.message === "string" ? body.error.message : (typeof body?.message === "string" ? body.message : `HTTP_${response.status}`);
    emit("commerce_provider_error", {source: "apify_amazon_affiliate_actor", actorId: AMAZON_AFFILIATE_ACTOR_ID, status: response.status, message: detail}, .8);
    throw new Error(`APIFY_ACTOR_RUN_${response.status}:${detail}`);
  }
  const rows = Array.isArray(body) ? body : (Array.isArray(body?.items) ? body.items : []);
  const runStatus = rows.find(item => item?.recordType === "run_status") || null;
  const discovered = rows.filter(item => item?.recordType === "product" || item?.asin).map((item, index) => normalizeFeedItem(item, "amazon", index));
  discovered.forEach(item => { item.sourceStatus = "AMAZON_CREATORS_API"; item.discoveredVia = "APIFY_ACTOR"; item.paper = true; });
  discovered.forEach(item => {
    const existing = findProduct(item.id);
    const target = existing ? Object.assign(existing, item) : item;
    if (!existing) products.push(target);
    enrichProduct(target);
  });
  const result = {actorId: AMAZON_AFFILIATE_ACTOR_ID, input: actorInput, status: runStatus?.status || (discovered.length ? "READY" : "NO_RESULTS"), summary: runStatus, discovered: discovered.length, items: discovered, mode: "PAPER", shopifyPublishAllowed: false};
  emit("commerce_amazon_affiliate_scout_completed", {actorId: result.actorId, status: result.status, discovered: result.discovered, summary: result.summary}, .8);
  persist();
  return result;
}
function findBot(id) { return commerceBots.find(item => item.id === id); }
function findProduct(id) { return products.find(item => item.id === id); }
function findWorkflow(id) { return workflows.find(item => item.id === id); }
function activeWorkflowForProduct(productId) { return workflows.find(item => item.productId === productId && !["REJECTED", "COMPLETED"].includes(item.status)); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;"); }

function syntheticCandidates(source) {
  const sourceName = source === "amazon" ? "Amazon" : "AliExpress";
  const templates = source === "amazon"
    ? [["Compact USB-C Travel Hub", 28.99, 4.9, "electronics"], ["Portable Recovery Massager", 49.99, 4.7, "wellness"]]
    : [["Rechargeable Motion Sensor Light", 19.90, 4.8, "home"], ["Magnetic Desk Organizer", 16.50, 4.6, "office"]];
  return templates.map(([name, price, rating, category], index) => ({
    id: `${source}-paper-${index + 1}`,
    source,
    sourceStatus: "PAPER_SAMPLE",
    paper: true,
    name,
    category,
    price,
    rating,
    estimatedCost: Number((price * .36).toFixed(2)),
    estimatedMargin: Number((price * .42).toFixed(2)),
    demandScore: 70 + index * 7,
    imageUrl: "",
    discoveredAt: new Date().toISOString()
  }));
}

function normalizeFeedItem(item, source, index) {
  if (source === "aliexpress") return normalizeDropshipCandidate(item, index);
  const name = item.name || item.title || item.product_title || item.productName || `${source === "amazon" ? "Amazon" : "AliExpress"} product ${index + 1}`;
  const price = Number(item.price ?? item.sale_price ?? item.currentPrice ?? 0) || 0;
  const affiliate = source === "amazon" && (item.monetizationModel === "AMAZON_AFFILIATE" || item.affiliateUrl || item.asin);
  const affiliateEconomics = item.economics && item.economics.commissionRate !== undefined ? item.economics : null;
  return {id: `${source}-${affiliate ? "affiliate" : "provider"}-${item.id || item.product_id || item.asin || index + 1}`, source, sourceStatus: item.sourceStatus || "PROVIDER_FEED", monetizationModel: affiliate ? "AMAZON_AFFILIATE" : (item.monetizationModel || "PHYSICAL_PRODUCT"), paper: true, name, title: item.title || name, category: item.category || item.category_name || "general", price, currency: item.currency || "USD", rating: Number(item.rating || item.stars || 0) || 0, asin: item.asin || null, estimatedCost: affiliate ? 0 : Number(item.cost || item.sale_price || price * .36), shippingCost: affiliate ? 0 : Number(item.shippingCost || item.shipping_cost || 0), estimatedMargin: affiliate ? 0 : Number((price * .42).toFixed(2)), demandScore: Number(item.demandScore || item.demand_score || 0) || 0, demandSignalStatus: item.demandSignalStatus || "MISSING", imageUrl: item.imageUrl || item.image_url || item.main_image || item.image || "", providerUrl: item.affiliateUrl || item.url || item.product_url || item.detailPageURL || "", affiliateUrl: item.affiliateUrl || "", detailPageURL: item.detailPageURL || item.url || "", features: Array.isArray(item.features) ? item.features : [], affiliateEconomics, discoveredAt: new Date().toISOString()};
}

function economics(product, overrides = {}) {
  const price = Number(overrides.price ?? product.price ?? 0);
  if (product.monetizationModel === "AMAZON_AFFILIATE") {
    const affiliateEconomics = product.affiliateEconomics || {};
    const commissionRate = Math.max(0, Math.min(1, Number(overrides.commissionRate ?? product.commissionRate ?? affiliateEconomics.commissionRate ?? 0.04)));
    const expectedCommission = Number((overrides.expectedCommission ?? product.expectedCommission ?? affiliateEconomics.expectedCommission ?? price * commissionRate).toFixed(2));
    const contentCost = Number((overrides.contentCost ?? product.contentCost ?? affiliateEconomics.contentCost ?? 1.5).toFixed(2));
    const contribution = Number((expectedCommission - contentCost).toFixed(2));
    const marginPct = expectedCommission > 0 ? Number((contribution / expectedCommission * 100).toFixed(1)) : 0;
    return {monetizationModel: "AMAZON_AFFILIATE", price: Number(price.toFixed(2)), currency: product.currency || "USD", inventoryCost: 0, shipping: 0, commissionRate, expectedCommission, contentCost, contribution, marginPct, breakEvenCac: Number(Math.max(0, expectedCommission).toFixed(2)), targetCac: Number(Math.max(0, expectedCommission * .65).toFixed(2)), planningOnly: true};
  }
  const cost = Number(overrides.cost ?? product.estimatedCost ?? product.cost ?? price * .36);
  const shipping = Number(overrides.shipping ?? product.shippingCost ?? 0);
  const paymentFee = Number((price * .029 + .30).toFixed(2));
  const platformFee = Number((price * .02).toFixed(2));
  const refundReserve = Number((price * .05).toFixed(2));
  const adReserve = Number(overrides.adReserve ?? price * .20);
  const contribution = Number((price - cost - shipping - paymentFee - platformFee - refundReserve - adReserve).toFixed(2));
  const breakEvenCac = Number(Math.max(0, price - cost - shipping - paymentFee - platformFee - refundReserve).toFixed(2));
  const marginPct = price > 0 ? Number((contribution / price * 100).toFixed(1)) : 0;
  return {price: Number(price.toFixed(2)), cost: Number(cost.toFixed(2)), shipping: Number(shipping.toFixed(2)), paymentFee, platformFee, refundReserve, adReserve: Number(adReserve.toFixed(2)), contribution, marginPct, breakEvenCac, targetCac: Number((breakEvenCac * .65).toFixed(2))};
}

function scoreProduct(product) {
  if (product.monetizationModel === "AMAZON_AFFILIATE") {
    const unit = economics(product);
    const score = Math.max(0, Math.min(100, Number(product.scoutScore ?? product.score ?? 0)));
    const risks = Array.isArray(product.blockers) ? [...product.blockers] : [];
    if (!product.affiliateUrl) risks.push("affiliate_url_missing");
    if (!product.imageUrl) risks.push("missing_product_image");
    if (product.demandSignalStatus !== "VERIFIED") risks.push("demand_signal_missing");
    if (unit.contribution <= 0) risks.push("negative_content_contribution");
    const uniqueRisks = [...new Set(risks)];
    const tier = score >= 75 && product.demandSignalStatus === "VERIFIED" && unit.contribution > 0 && uniqueRisks.length === 0 ? "TEST_READY" : score >= 55 ? "REVIEW" : "REJECT";
    return {score, tier, economics: unit, risks: uniqueRisks};
  }
  if (product.source === "aliexpress" && product.sourceStatus !== "PAPER_SAMPLE") {
    const scored = scoreDropshipCandidate(product, moduleConfigs["dropship-hunter"]);
    return {score: scored.score, tier: scored.tier, economics: scored.economics, risks: scored.blockers, logistics: scored.logistics};
  }
  const unit = economics(product);
  const demand = Math.max(0, Math.min(100, Number(product.demandScore || 0)));
  const rating = Math.max(0, Math.min(5, Number(product.rating || 0))) * 20;
  const margin = Math.max(0, Math.min(100, unit.marginPct * 2.5));
  const media = product.imageUrl ? 12 : 0;
  const provider = product.sourceStatus === "PROVIDER_FEED" ? 10 : 0;
  const score = Math.round(Math.min(100, demand * .35 + rating * .20 + margin * .25 + media + provider));
  const risks = [];
  if (!product.price || unit.price <= 0) risks.push("missing_price");
  if (unit.marginPct < 15) risks.push("thin_contribution_margin");
  if (!product.imageUrl) risks.push("missing_product_image");
  if (product.sourceStatus === "PAPER_SAMPLE") risks.push("synthetic_source");
  return {score, tier: score >= 75 && risks.every(risk => risk !== "thin_contribution_margin") ? "TEST_READY" : score >= 55 ? "REVIEW" : "REJECT", economics: unit, risks};
}

function enrichProduct(product) {
  const scored = scoreProduct(product);
  Object.assign(product, {economics: scored.economics, score: scored.score, tier: scored.tier, risks: scored.risks, updatedAt: new Date().toISOString()});
  return product;
}

function botReadiness(bot) {
  const hasProducts = products.some(product => ["TEST_READY", "REVIEW"].includes(product.tier));
  const latest = products.filter(product => product.tier === "TEST_READY").sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  const blockers = [];
  if (bot.id === "product-scout" && !connector("amazon")?.configured && !connector("apify")?.configured) blockers.push("amazon_provider_credentials_missing");
  if (bot.id === "dropship-hunter" && !connector("aliexpress")?.configured) blockers.push("aliexpress_connector_not_configured");
  if (["creative-factory", "store-manager"].includes(bot.id) && !hasProducts) blockers.push("no_scored_product");
  if (bot.id === "traffic" && !campaigns.length) blockers.push("campaign_draft_missing");
  if (["closer", "retention"].includes(bot.id) && !leads.length) blockers.push("crm_empty");
  if (bot.id === "allocator" && !latest) blockers.push("no_test_ready_products");
  return {ready: blockers.length === 0, blockers, nextAction: latest ? `Prioritize ${latest.name}` : "Run discovery and scoring", topProductId: latest?.id || null};
}

products.forEach(enrichProduct);
commerceBots.forEach(bot => {
  bot.readiness = botReadiness(bot);
  if (bot.active && !bot.readiness.ready) bot.status = "ATTENTION";
});

async function providerFeedCandidates(source) {
  const feedUrl = source === "amazon" ? process.env.AMAZON_PRODUCT_FEED_URL : process.env.ALIEXPRESS_API_URL;
  if (feedUrl) {
    try {
      const headers = process.env.ALIEXPRESS_API_KEY && source === "aliexpress" ? {authorization: `Bearer ${process.env.ALIEXPRESS_API_KEY}`, "x-api-key": process.env.ALIEXPRESS_API_KEY} : {};
      const response = await fetch(feedUrl, {headers, signal: AbortSignal.timeout(8000)});
      const body = await response.json();
      if (!response.ok) throw new Error(`provider ${response.status}`);
      const items = Array.isArray(body) ? body : body.items || body.products || body.data || [];
      return items.slice(0, 30).map((item, index) => normalizeFeedItem(item, source, index));
    } catch (error) { emit("commerce_provider_error", {source, message: error.message}, .7); }
  }
  const token = envValue("APIFY_API_TOKEN", "APIFY_API_KEY");
  const datasetId = process.env.APIFY_DATASET_ID;
  if (!token || !datasetId) return null;
  try {
    const base = String(process.env.APIFY_API_BASE_URL || "https://api.apify.com/v2").replace(/\/$/, "");
    const response = await fetch(`${base}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`, {headers: {authorization: `Bearer ${token}`, accept: "application/json"}, signal: AbortSignal.timeout(10000)});
    const body = await response.json().catch(() => []);
    if (!response.ok) throw new Error(`apify ${response.status}`);
    const items = Array.isArray(body) ? body : body.items || body.data || [];
    const tagged = items.filter(item => { const marker = String(item.source || item.marketplace || item.platform || "").toLowerCase(); return !marker || marker.includes(source); });
    return (tagged.length ? tagged : items).slice(0, 30).map((item, index) => normalizeFeedItem({...item, sourceStatus: "APIFY_DATASET"}, source, index));
  } catch (error) { emit("commerce_provider_error", {source: "apify", message: error.message}, .7); return null; }
}

async function runDropshipHunter(input = {}) {
  const bot = findBot("dropship-hunter");
  const connectorState = connector("aliexpress");
  if (!connectorState?.configured) {
    const result = {status: "BLOCKED", mode: "PAPER", source: "aliexpress", blockers: ["ALIEXPRESS_CONNECTOR_NOT_CONFIGURED"], message: "Configura una API o feed de AliExpress antes de usar datos operativos. No se crean candidatos sintéticos en este módulo."};
    if (bot) { bot.status = "ATTENTION"; bot.lastRunAt = new Date().toISOString(); bot.lastResult = result; bot.readiness = {ready: false, blockers: result.blockers, nextAction: "Configure ALIEXPRESS_API_URL and optional ALIEXPRESS_API_KEY"}; }
    emit("commerce_dropship_hunter_blocked", result, .8); persist(); return result;
  }
  const providerItems = await providerFeedCandidates("aliexpress");
  if (!providerItems?.length) {
    const result = {status: "DEGRADED", mode: "PAPER", source: "aliexpress", blockers: ["ALIEXPRESS_FEED_EMPTY_OR_UNAVAILABLE"], message: "El conector está configurado pero no entregó candidatos válidos."};
    if (bot) { bot.status = "ATTENTION"; bot.lastRunAt = new Date().toISOString(); bot.lastResult = result; }
    emit("commerce_dropship_hunter_degraded", result, .8); persist(); return result;
  }
  const ranked = [];
  providerItems.slice(0, Number(input.maxItems || 50)).forEach(item => {
    const existing = findProduct(item.id);
    const target = existing ? Object.assign(existing, item) : item;
    target.sourceStatus = "PROVIDER_FEED";
    target.monetizationModel = "PHYSICAL_PRODUCT";
    if (!existing) products.push(target);
    enrichProduct(target);
    ranked.push({id: target.id, name: target.name, score: target.score, tier: target.tier, risks: target.risks, economics: target.economics, logistics: target.logistics || null});
  });
  const result = {status: "READY", mode: "PAPER", source: "aliexpress", provider: connectorState.provider, discovered: ranked.length, ranked: ranked.sort((a, b) => b.score - a.score), botId: bot?.id || "dropship-hunter", parameters: moduleConfigs["dropship-hunter"]};
  if (bot) {
    const botResult = runBot(bot, {module: "dropship-hunter", parameters: moduleConfigs["dropship-hunter"], input});
    result.botResult = botResult;
  }
  emit("commerce_dropship_hunter_completed", {discovered: result.discovered, top: result.ranked[0] || null, mode: "PAPER"}, .8); persist(); return result;
}

function runDigitalBuilder(input = {}) {
  const top = products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || {};
  const opportunity = buildDigitalProductOpportunity(input, top);
  digitalProducts.unshift(opportunity);
  const bot = findBot("digital-builder");
  if (bot) { bot.lastRunAt = new Date().toISOString(); bot.status = opportunity.validation.status === "SUPPORTED" ? "READY" : "ATTENTION"; bot.lastResult = {status: "PAPER_DRAFT", opportunity, blockers: opportunity.validation.status === "SUPPORTED" ? [] : ["problem_validation_required"]}; bot.metrics = {...bot.metrics, candidates: digitalProducts.length, signals: (bot.metrics?.signals || 0) + 1, confidence: opportunity.validation.status === "SUPPORTED" ? 70 : 35}; }
  emit("commerce_digital_product_draft", {opportunityId: opportunity.id, validation: opportunity.validation, mode: "PAPER"}, .7); persist();
  return {status: opportunity.validation.status === "SUPPORTED" ? "READY_FOR_PAPER_TEST" : "REVIEW_REQUIRED", mode: "PAPER", opportunity, blockers: opportunity.validation.status === "SUPPORTED" ? [] : ["problem_validation_required"]};
}

function runOfferPricing(input = {}) {
  const product = findProduct(input.productId) || products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  if (!product) return {status: "BLOCKED", mode: "PAPER", blockers: ["NO_PRODUCT_TO_PRICE"]};
  enrichProduct(product);
  const pricing = product.monetizationModel === "AMAZON_AFFILIATE" ? {mode: "AFFILIATE_CLICKOUT", observedPrice: product.price, expectedCommission: product.economics?.expectedCommission || 0, maxCac: product.economics?.targetCac || 0, planningOnly: true} : priceOffer(product, {...moduleConfigs["offer-pricing"], ...(input.parameters || {})});
  product.pricing = pricing; product.pricingUpdatedAt = new Date().toISOString();
  const bot = findBot("offer-pricing");
  if (bot) { bot.lastRunAt = new Date().toISOString(); bot.status = pricing.mode === "AFFILIATE_CLICKOUT" || pricing.sensitivity?.some(row => row.contribution > 0) ? "READY" : "ATTENTION"; bot.lastResult = {status: "PAPER", productId: product.id, pricing}; }
  emit("commerce_offer_priced", {productId: product.id, pricing, mode: "PAPER"}, .7); persist();
  return {status: "READY", mode: "PAPER", productId: product.id, product: product.name, pricing};
}

async function runCreativeFactory(input = {}) {
  const product = findProduct(input.productId) || products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  if (!product) return {status: "BLOCKED", mode: "PAPER", blockers: ["NO_PRODUCT_FOR_CREATIVE"]};
  const channels = Array.isArray(input.channels) && input.channels.length ? input.channels.slice(0, 8) : moduleConfigs["creative-factory"].channels;
  const asset = input.generateAssets === true ? await mediaAsset(`Conversion-safe creative package for ${product.name}, category ${product.category}, channels ${channels.join(", ")}, no unsupported claims.`) : {mode: "brief", status: "NOT_REQUESTED", prompt: `Creative package for ${product.name}`};
  const landing = landingFor(product, asset); landing.createdBy = "creative-factory"; landing.channels = channels; landingPages.unshift(landing);
  const result = {status: asset.status === "DEGRADED" ? "REVIEW_REQUIRED" : "READY", mode: "PAPER", productId: product.id, channels, landingId: landing.id, assetStatus: asset.status, disclosureRequired: product.monetizationModel === "AMAZON_AFFILIATE"};
  const bot = findBot("creative-factory"); if (bot) { bot.lastRunAt = new Date().toISOString(); bot.status = result.status === "READY" ? "READY" : "ATTENTION"; bot.lastResult = result; bot.metrics = {...bot.metrics, drafts: landingPages.length, signals: (bot.metrics?.signals || 0) + 1}; }
  emit("commerce_creative_factory_completed", result, .7); persist(); return result;
}

function runStoreManager(input = {}) {
  const product = findProduct(input.productId) || products.find(item => item.monetizationModel !== "AMAZON_AFFILIATE");
  if (!product) return {status: "BLOCKED", mode: "PAPER", blockers: ["NO_PHYSICAL_PRODUCT"]};
  if (product.monetizationModel === "AMAZON_AFFILIATE") return {status: "NOT_APPLICABLE", mode: "PAPER", productId: product.id, blockers: ["AMAZON_AFFILIATE_NOT_SHOPIFY_INVENTORY"]};
  enrichProduct(product);
  const draft = {id: crypto.randomUUID(), productId: product.id, status: "DRAFT_ONLY", paper: true, connector: connector("shopify"), approvalRequired: true, product: {title: product.name, price: product.economics?.price || product.price, description: `Draft listing for ${product.name}`, imageUrl: product.imageUrl || null}, createdAt: new Date().toISOString()};
  storeDrafts.unshift(draft);
  const blockers = product.tier === "TEST_READY" ? [] : ["product_not_test_ready", ...(product.risks || [])];
  const result = {status: blockers.length ? "REVIEW_REQUIRED" : "READY_FOR_APPROVAL", mode: "PAPER", draft, blockers, publishAllowed: false};
  const bot = findBot("store-manager"); if (bot) { bot.lastRunAt = new Date().toISOString(); bot.status = blockers.length ? "ATTENTION" : "READY"; bot.lastResult = result; bot.metrics = {...bot.metrics, drafts: storeDrafts.length, signals: (bot.metrics?.signals || 0) + 1}; }
  emit("commerce_store_draft_created", {draftId: draft.id, productId: product.id, blockers, mode: "PAPER"}, .7); persist(); return result;
}

function runTraffic(input = {}) {
  const product = findProduct(input.productId) || products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  if (!product) return {status: "BLOCKED", mode: "PAPER", blockers: ["NO_PRODUCT_FOR_TRAFFIC"]};
  enrichProduct(product);
  const campaign = campaignFor(product, {...input, dailyBudget: Math.min(Number(input.dailyBudget || moduleConfigs.traffic.dailyBudgetCap), moduleConfigs.traffic.dailyBudgetCap)});
  campaign.status = "REVIEW_REQUIRED"; campaign.paper = true; campaign.spend = 0; campaigns.unshift(campaign);
  const result = {status: "REVIEW_REQUIRED", mode: "PAPER", campaign, blockers: [...new Set([...(campaign.blockers || []), "manual_activation_required"])], spendAllowed: false};
  const bot = findBot("traffic"); if (bot) { bot.lastRunAt = new Date().toISOString(); bot.status = "ATTENTION"; bot.lastResult = result; bot.metrics = {...bot.metrics, drafts: campaigns.length, signals: (bot.metrics?.signals || 0) + 1}; }
  emit("commerce_traffic_plan_created", {campaignId: campaign.id, productId: product.id, mode: "PAPER"}, .7); persist(); return result;
}

function runCloser(input = {}) {
  const hotLeadScore = moduleConfigs.closer.hotLeadScore;
  const queue = leads.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, Number(input.limit || 50)).map(lead => ({...lead, priority: Number(lead.score || 0) >= hotLeadScore ? "HOT" : "NURTURE", nextAction: Number(lead.score || 0) >= hotLeadScore ? "human_review_or_approved_sequence" : "educational_follow_up"}));
  const result = {status: queue.length ? "READY" : "REVIEW_REQUIRED", mode: "PAPER", queue, blockers: queue.length ? [] : ["CRM_EMPTY"], externalMessagingAllowed: false};
  const bot = findBot("closer"); if (bot) { bot.lastRunAt = new Date().toISOString(); bot.status = queue.length ? "READY" : "ATTENTION"; bot.lastResult = result; bot.metrics = {...bot.metrics, candidates: queue.length, signals: (bot.metrics?.signals || 0) + 1}; }
  emit("commerce_sales_queue_updated", {leads: queue.length, hot: queue.filter(lead => lead.priority === "HOT").length, mode: "PAPER"}, .6); persist(); return result;
}

function runRetention(input = {}) {
  const now = Date.now();
  const windowMs = moduleConfigs.retention.upsellWindowDays * 86400000;
  const customerOrders = new Map();
  orders.forEach(order => { const key = order.customerId || order.email || "unknown"; const list = customerOrders.get(key) || []; list.push(order); customerOrders.set(key, list); });
  const queue = [...customerOrders.entries()].filter(([, list]) => list.length >= moduleConfigs.retention.minOrderCount).map(([customerId, list]) => ({customerId, orderCount: list.length, lastOrderAt: list.map(order => new Date(order.createdAt || 0).getTime()).sort((a, b) => b - a)[0] || null, action: now - (list.map(order => new Date(order.createdAt || 0).getTime()).sort((a, b) => b - a)[0] || now) <= windowMs ? "cross_sell_or_education" : "win_back_review"})).slice(0, Number(input.limit || 100));
  const result = {status: queue.length ? "READY" : "REVIEW_REQUIRED", mode: "PAPER", queue, blockers: queue.length ? [] : ["NO_VERIFIED_ORDER_COHORT"], messagingAllowed: false};
  const bot = findBot("retention"); if (bot) { bot.lastRunAt = new Date().toISOString(); bot.status = queue.length ? "READY" : "ATTENTION"; bot.lastResult = result; bot.metrics = {...bot.metrics, candidates: queue.length, signals: (bot.metrics?.signals || 0) + 1}; }
  emit("commerce_retention_queue_updated", {customers: queue.length, mode: "PAPER"}, .6); persist(); return result;
}

function runAllocator(input = {}) {
  const budget = Math.max(0, Number(input.budget || 100));
  const eligible = products.filter(product => product.tier === "TEST_READY" && Number(product.economics?.contribution || 0) >= moduleConfigs.allocator.minContribution);
  const totalWeight = eligible.reduce((sum, product) => sum + Math.max(0, Number(product.score || 0)) * Math.max(0, Number(product.economics?.contribution || 0)), 0);
  const allocations = eligible.map(product => { const raw = totalWeight ? budget * (Number(product.score || 0) * Math.max(0, Number(product.economics?.contribution || 0)) / totalWeight) : 0; const capped = Math.min(raw, budget * moduleConfigs.allocator.maxProductAllocationPct); return {productId: product.id, name: product.name, recommendedBudget: Number(capped.toFixed(2)), maxCac: product.economics?.targetCac || 0, rationale: "score × positive contribution", paperOnly: true}; });
  const result = {status: allocations.length ? "READY_FOR_PAPER_TEST" : "REVIEW_REQUIRED", mode: "PAPER", budget, allocations, totalAllocated: Number(allocations.reduce((sum, item) => sum + item.recommendedBudget, 0).toFixed(2)), blockers: allocations.length ? [] : ["NO_TEST_READY_PRODUCTS"], spendAllowed: false};
  const bot = findBot("allocator"); if (bot) { bot.lastRunAt = new Date().toISOString(); bot.status = allocations.length ? "READY" : "ATTENTION"; bot.lastResult = result; bot.metrics = {...bot.metrics, candidates: allocations.length, signals: (bot.metrics?.signals || 0) + 1}; }
  emit("commerce_revenue_allocation_proposed", {allocations: allocations.length, budget, mode: "PAPER"}, .75); persist(); return result;
}

async function mediaAsset(prompt) {
  if (ASSET_MODE === "brief") return {mode: "brief", status: "NOT_REQUESTED", prompt};
  try {
    const response = await fetch(`${MEDIA_BRAIN_URL}/api/generate/image`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({preset: "product-launch", prompt, brain: "commerce", provider: ASSET_MODE === "remote" ? "muapi" : "mock"})});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Media Brain ${response.status}`);
    return {mode: ASSET_MODE, status: body.job?.status || "QUEUED", job: body.job || body};
  } catch (error) { return {mode: ASSET_MODE, status: "DEGRADED", error: error.message, prompt}; }
}

function landingFor(product, asset) {
  const price = Number(product.price || 0);
  const offerPrice = Number((price * 1.89).toFixed(2));
  const safeName = escapeHtml(product.name);
  const safeCategory = escapeHtml(product.category || "tu rutina");
  if (product.monetizationModel === "AMAZON_AFFILIATE") {
    const affiliateUrl = escapeHtml(product.affiliateUrl || product.providerUrl || "#");
    const priceLabel = price > 0 ? `$${price.toFixed(2)} ${escapeHtml(product.currency || "USD")}` : "ver precio actual";
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName}</title></head><body><main><section class="hero"><h1>${safeName}</h1><p>Selección editorial para ${safeCategory}, basada en datos observados de Amazon.</p><a href="${affiliateUrl}" target="_blank" rel="nofollow sponsored noopener">Ver disponibilidad y precio en Amazon · ${priceLabel}</a></section><section><h2>Por qué está en la selección</h2><ul><li>Ficha y atributos obtenidos mediante Amazon Creators API.</li><li>Precio y disponibilidad pueden cambiar; compruébalos en Amazon.</li><li>Contenido editorial separado de cualquier inventario de Shopify.</li></ul></section><section id="disclosure"><p>Como asociado de Amazon, podemos obtener ingresos por compras que cumplan los requisitos aplicables.</p></section></main></body></html>`;
    return {id: crypto.randomUUID(), productId: product.id, status: "DRAFT", createdAt: new Date().toISOString(), paper: true, monetizationModel: "AMAZON_AFFILIATE", headline: `${product.name}: selección editorial`, subheadline: `Descubre sus características y consulta el precio actual directamente en Amazon.`, offer: {observedPrice: price, currency: product.currency || "USD", affiliateUrl: product.affiliateUrl || product.providerUrl || null, planningOnly: true}, sections: ["Contexto y selección", "Características verificadas", "Precio y disponibilidad", "Disclosure de afiliación", "CTA a Amazon"], copy: ["Precio y disponibilidad sujetos a cambios.", "Consulta la ficha actual antes de comprar."], html, asset, affiliate: {status: product.affiliateUrl ? "READY_FOR_REVIEW" : "BLOCKED", disclosureRequired: true, shopify: "NOT_APPLICABLE"}, shopify: {status: "NOT_APPLICABLE", reason: "AMAZON_AFFILIATE_CONTENT_NOT_INVENTORY"}};
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName}</title></head><body><main><section class="hero"><h1>${safeName}: una mejora simple para tu día</h1><p>Diseñado para ${safeCategory}, con una oferta clara y una experiencia de compra sin fricción.</p><a href="#offer">Shop now · $${offerPrice.toFixed(2)}</a></section><section><h2>Why customers choose it</h2><ul><li>Resuelve el problema sin complicar tu rutina.</li><li>Materiales y uso explicados con claridad.</li><li>Compra segura, soporte y política de devolución visible.</li></ul></section><section id="offer"><h2>Oferta de lanzamiento</h2><strong>$${offerPrice.toFixed(2)}</strong><p>Draft generated in PAPER mode. Review before publishing.</p></section></main></body></html>`;
  return {
    id: crypto.randomUUID(), productId: product.id, status: "DRAFT", createdAt: new Date().toISOString(), paper: true,
    headline: `${product.name}: una mejora simple para tu día`,
    subheadline: `Diseñado para ${product.category || "tu rutina"}, con una oferta clara y una experiencia de compra sin fricción.`,
    offer: {price: offerPrice, compareAt: Number((offerPrice * 1.28).toFixed(2)), currency: "USD", marginBeforeAds: Number((offerPrice - Number(product.estimatedCost || price * .36)).toFixed(2))},
    sections: ["Problema y transformación", "Beneficios principales", "Prueba social y confianza", "Oferta limitada", "Preguntas frecuentes", "CTA de compra"],
    copy: ["Resuelve el problema sin complicar tu rutina.", "Materiales y uso explicados con claridad.", "Compra segura, soporte y política de devolución visible."], html,
    asset,
    shopify: {status: "NOT_PUBLISHED", connector: connector("shopify")}
  };
}

function runBot(bot, input = {}) {
  const now = new Date().toISOString();
  const available = products.length;
  const topProduct = products.filter(product => product.tier === "TEST_READY").sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || products[0];
  if (["product-scout", "dropship-hunter", "offer-pricing"].includes(bot.id)) products.forEach(enrichProduct);
  let details = {};
  if (["product-scout", "dropship-hunter"].includes(bot.id)) details = {rankedProducts: products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 5).map(product => ({id: product.id, name: product.name, score: product.score, tier: product.tier, marginPct: product.economics?.marginPct}))};
  if (bot.id === "digital-builder") details = {ideas: ["starter bundle", "digital guide", "post-purchase upsell"], basedOn: topProduct?.name || "market problem discovery"};
  if (bot.id === "offer-pricing") details = {topProduct: topProduct?.name || null, economics: topProduct?.economics || null, recommendation: topProduct?.economics?.marginPct >= 20 ? "test offer" : "review costs or price"};
  if (bot.id === "creative-factory") details = {contentBrief: topProduct ? {productId: topProduct.id, channels: ["landing", "short_video", "ugc_script", "email"], angle: "problem → transformation → proof → offer"} : null};
  if (bot.id === "store-manager") details = {shopify: connector("shopify"), nextStep: topProduct ? "prepare product draft" : "score a product first"};
  if (bot.id === "traffic") details = {channels: ["organic_search", "short_video", "creator_affiliate", "email"], budgetPolicy: "never exceed target CAC", productId: topProduct?.id || null};
  if (bot.id === "closer") details = {leads: leads.length, hotLeads: leads.filter(lead => Number(lead.score || 0) >= 70).length, nextStep: "connect checkout or CRM webhook"};
  if (bot.id === "retention") details = {orders: orders.length, repeatCustomers: new Set(orders.filter(order => order.customerId).map(order => order.customerId)).size, nextStep: "collect post-purchase events"};
  if (bot.id === "allocator") details = {recommendedBudget: topProduct ? Number(Math.max(0, (topProduct.economics?.targetCac || 0) * 10).toFixed(2)) : 0, allocationRule: "fund only TEST_READY products"};
  const readiness = botReadiness(bot);
  const confidence = PAPER_MODE ? Math.round((topProduct?.score || 52) * .85) : 0;
  bot.lastRunAt = now;
  bot.status = bot.active ? (readiness.ready ? "READY" : "ATTENTION") : "PAUSED";
  bot.readiness = readiness;
  bot.metrics = {signals: (bot.metrics?.signals || 0) + 1, candidates: available, drafts: landingPages.length, confidence, topProductScore: topProduct?.score || 0, contribution: topProduct?.economics?.contribution || 0};
  bot.lastResult = {runId: crypto.randomUUID(), mode: "PAPER", sourceStatus: "SYNTHETIC_OR_CONFIGURED_READ_ONLY", summary: `${bot.name} completó un ciclo de inteligencia sin ejecutar acciones externas.`, candidates: available, confidence, readiness, details, input, timestamp: now};
  emit("commerce_bot_scan", {botId: bot.id, result: bot.lastResult});
  return bot.lastResult;
}

async function discoverProducts(sources = ["amazon", "aliexpress"]) {
  const requested = sources.filter(source => ["amazon", "aliexpress"].includes(source));
  const providerResults = await Promise.all(requested.map(source => providerFeedCandidates(source)));
  const discovered = requested.flatMap((source, index) => providerResults[index]?.length ? providerResults[index] : syntheticCandidates(source));
  discovered.forEach(item => { const existing = findProduct(item.id); const target = existing ? Object.assign(existing, item) : item; if (!existing) products.push(target); enrichProduct(target); });
  emit("commerce_product_discovery", {sources: requested, count: discovered.length, mode: "PAPER", providerFeedUsed: providerResults.some(items => items?.length)});
  persist();
  return {items: products, providerFeedUsed: providerResults.some(items => items?.length), discovered: discovered.length};
}

function campaignFor(product, input = {}) {
  const slug = String(product.name || product.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const affiliate = product.monetizationModel === "AMAZON_AFFILIATE";
  return {id: crypto.randomUUID(), productId: product.id, monetizationModel: affiliate ? "AMAZON_AFFILIATE" : "PHYSICAL_PRODUCT", status: product.tier === "TEST_READY" ? "DRAFT" : "REVIEW_REQUIRED", paper: PAPER_MODE, createdAt: new Date().toISOString(), channels: input.channels || ["organic_search", "short_video", "creator_affiliate", "email"], objective: affiliate ? "qualified_affiliate_clicks" : "validated_sales", maxCac: product.economics?.targetCac || 0, dailyBudget: Number(input.dailyBudget || Math.max(0, (product.economics?.targetCac || 0) * 3).toFixed(2)), message: affiliate ? `${product.name}: contenido editorial transparente y clickout cualificado hacia Amazon.` : `${product.name}: problema claro, transformación visible y oferta verificable.`, utm: {source: "commerce-brain", medium: "campaign", campaign: slug}, guardrails: ["pause if CAC exceeds target", "pause if refund rate rises", "no spend without explicit activation", ...(affiliate ? ["show Amazon affiliate disclosure", "refresh price and availability before publishing"] : [])], blockers: product.tier === "TEST_READY" ? [] : ["product_not_test_ready", ...(product.risks || [])]};
}

function workflowStep(workflow, stage, status = "COMPLETED", details = {}) {
  const entry = {stage, status, at: new Date().toISOString(), details};
  workflow.stage = stage;
  workflow.stages[stage] = entry;
  workflow.history.unshift(entry);
  workflow.updatedAt = entry.at;
  emit("commerce_workflow_stage", {workflowId: workflow.id, productId: workflow.productId, stage, status, details}, .7);
  return entry;
}

function productCompliance(product) {
  const blockers = [];
  const warnings = [];
  const text = `${product.name || ""} ${product.category || ""}`.toLowerCase();
  if (product.sourceStatus === "PAPER_SAMPLE") blockers.push("provider_data_required");
  const affiliate = product.monetizationModel === "AMAZON_AFFILIATE";
  if (affiliate) {
    if (!product.affiliateUrl && !product.providerUrl) blockers.push("affiliate_url_required");
    if (product.demandSignalStatus !== "VERIFIED") warnings.push("demand_signal_required_before_promotion");
    warnings.push("amazon_affiliate_content_only_no_shopify_inventory");
  } else if (product.source === "aliexpress") {
    if (product.sourceStatus === "PAPER_SAMPLE") blockers.push("provider_data_required");
    if (!product.supplierUrl && !product.providerUrl) blockers.push("supplier_url_missing");
    if (!Number(product.supplierPrice ?? product.estimatedCost) || Number(product.supplierPrice ?? product.estimatedCost) <= 0) blockers.push("supplier_cost_missing");
    if (!Number(product.shippingDays) || Number(product.shippingDays) > Number(moduleConfigs["dropship-hunter"]?.maxShippingDays || 12)) warnings.push("shipping_window_needs_verification");
  } else if (!product.providerUrl) blockers.push("fulfillment_source_unverified");
  if (!product.name || !product.category) blockers.push("product_identity_incomplete");
  if (!Number(product.price) || Number(product.price) <= 0) blockers.push("price_required");
  if ((product.risks || []).includes("thin_contribution_margin")) blockers.push("thin_contribution_margin");
  if (/counterfeit|replica|weapon|tobacco|drug|supplement|medical claim|prescription/.test(text)) blockers.push("restricted_or_claim_risk");
  if (!product.imageUrl) warnings.push("product_image_missing");
  if (!product.shippingCost && product.sourceStatus === "PROVIDER_FEED" && !affiliate) warnings.push("shipping_cost_needs_verification");
  if (product.source === "amazon" && !affiliate) warnings.push("amazon_listing_is_market_intelligence_not_supplier_authorization");
  return {blockers: [...new Set(blockers)], warnings: [...new Set(warnings)], checkedAt: new Date().toISOString()};
}

async function runProductLaunchWorkflow(input = {}) {
  let product = findProduct(input.productId);
  if (!product) {
    const discovery = await discoverProducts(input.sources || ["amazon", "aliexpress"]);
    product = products.filter(item => item.score !== undefined).sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
    if (!product) throw new Error(`PRODUCT_NOT_FOUND_AFTER_DISCOVERY_${discovery.discovered}`);
  }
  const existing = input.idempotencyKey ? workflows.find(item => item.idempotencyKey === input.idempotencyKey) : (!input.force ? activeWorkflowForProduct(product.id) : null);
  if (existing) return existing;
  enrichProduct(product);
  const workflow = {
    id: crypto.randomUUID(), type: "PRODUCT_LAUNCH", mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", paperOnly: PAPER_MODE,
    idempotencyKey: input.idempotencyKey || `product-launch:${product.id}:${input.experimentId || "default"}`,
    productId: product.id, product: {id: product.id, name: product.name, source: product.source, sourceStatus: product.sourceStatus, monetizationModel: product.monetizationModel || "PHYSICAL_PRODUCT"},
    status: "RUNNING", stage: "DISCOVERED", stages: {}, history: [], blockers: [], warnings: [], approvals: [], artifacts: {}, metrics: {},
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  workflows.unshift(workflow);persist();
  workflowStep(workflow, "DISCOVERED", "COMPLETED", {source: product.source, sourceStatus: product.sourceStatus});
  workflowStep(workflow, "ENRICHED", "COMPLETED", {fields: ["price", "rating", "demandScore", "economics"]});
  workflow.artifacts.product = {id: product.id, name: product.name, source: product.source, sourceStatus: product.sourceStatus, monetizationModel: product.monetizationModel || "PHYSICAL_PRODUCT", providerUrl: product.providerUrl || null, affiliateUrl: product.affiliateUrl || null};
  workflowStep(workflow, "SCORED", "COMPLETED", {score: product.score, tier: product.tier, economics: product.economics});
  const compliance = productCompliance(product);
  workflow.compliance = compliance;workflow.blockers.push(...compliance.blockers);workflow.warnings.push(...compliance.warnings);
  workflowStep(workflow, "COMPLIANCE_REVIEW", compliance.blockers.length ? "REVIEW_REQUIRED" : "COMPLETED", compliance);
  workflow.artifacts.offer = {pricing: product.economics, createdAt: new Date().toISOString()};
  workflowStep(workflow, "OFFER_READY", product.economics?.contribution > 0 ? "COMPLETED" : "REVIEW_REQUIRED", {economics: product.economics});
  const shouldGenerateAssets = input.generateAssets === true || String(input.assetMode || "").toLowerCase() === "remote";
  const asset = shouldGenerateAssets ? await mediaAsset(`Hero product image for ${product.name}, category ${product.category}, premium ecommerce studio lighting, clean background, conversion-focused composition.`) : {mode: "brief", status: "NOT_REQUESTED", prompt: `Product launch asset package for ${product.name}`};
  const landing = landingFor(product, asset);landing.workflowId = workflow.id;landingPages.unshift(landing);workflow.artifacts.landingPage = {id: landing.id, status: landing.status, assetStatus: asset.status};
  if (asset.status === "DEGRADED") workflow.warnings.push("creative_provider_degraded");
  workflowStep(workflow, "CREATIVE_READY", asset.status === "DEGRADED" ? "REVIEW_REQUIRED" : "COMPLETED", {landingId: landing.id, asset});
  if (product.monetizationModel === "AMAZON_AFFILIATE") {
    workflow.artifacts.storeDraft = {status: "NOT_APPLICABLE", reason: "AMAZON_AFFILIATE_CONTENT_NOT_INVENTORY", shopify: connector("shopify")};
    workflowStep(workflow, "STORE_DRAFT_READY", "SKIPPED", {reason: "Amazon Affiliate uses editorial clickout; no Shopify inventory draft created."});
  } else {
    const storeDraft = {id: crypto.randomUUID(), workflowId: workflow.id, productId: product.id, status: "DRAFT_ONLY", paper: true, connector: connector("shopify"), product: {title: product.name, price: product.economics?.price || product.price, description: `Draft listing for ${product.name}`, imageUrl: product.imageUrl || null}, createdAt: new Date().toISOString()};
    storeDrafts.unshift(storeDraft);workflow.artifacts.storeDraft = {id: storeDraft.id, status: storeDraft.status};
    workflowStep(workflow, "STORE_DRAFT_READY", "COMPLETED", {draftId: storeDraft.id, shopify: storeDraft.connector});
  }
  const campaign = campaignFor(product, input);campaign.workflowId = workflow.id;campaigns.unshift(campaign);workflow.artifacts.campaign = {id: campaign.id, status: campaign.status, blockers: campaign.blockers};
  workflowStep(workflow, "CAMPAIGN_READY", campaign.blockers.length ? "REVIEW_REQUIRED" : "COMPLETED", {campaignId: campaign.id, blockers: campaign.blockers});
  const finalBlockers = [...new Set([...workflow.blockers, ...(product.tier === "TEST_READY" ? [] : ["product_not_test_ready"]), ...(campaign.blockers || [])])];
  workflow.blockers = finalBlockers;
  workflow.status = finalBlockers.length ? "REVIEW_REQUIRED" : "READY_FOR_PAPER_TEST";
  workflowStep(workflow, workflow.status, finalBlockers.length ? "REVIEW_REQUIRED" : "COMPLETED", {blockers: finalBlockers, paperOnly: true, publishAllowed: false, adSpendAllowed: false});
  workflow.metrics = {score: product.score, tier: product.tier, contribution: product.economics?.contribution || 0, marginPct: product.economics?.marginPct || 0};
  emit("commerce_product_launch_workflow_completed", {workflowId: workflow.id, productId: product.id, status: workflow.status, blockers: finalBlockers}, .85);
  persist();return workflow;
}

function approveWorkflow(workflow, input = {}) {
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
  if (workflow.status === "REJECTED") throw new Error("WORKFLOW_REJECTED");
  if (!PAPER_MODE) throw new Error("LIVE_WORKFLOW_APPROVAL_LOCKED");
  if (workflow.product?.sourceStatus === "PAPER_SAMPLE" && input.allowPaperSample !== true) throw new Error("PAPER_SAMPLE_APPROVAL_REQUIRED");
  const hardBlockers = workflow.blockers.filter(item => !["provider_data_required", "product_not_test_ready", "fulfillment_source_unverified"].includes(item));
  if (hardBlockers.length) throw new Error(`WORKFLOW_HARD_BLOCKERS:${hardBlockers.join(",")}`);
  workflow.approvals.unshift({id: crypto.randomUUID(), actor: input.actor || "operator", at: new Date().toISOString(), paperOnly: true});
  workflow.status = "READY_FOR_PAPER_TEST";workflow.blockers = workflow.blockers.filter(item => ["provider_data_required", "product_not_test_ready", "fulfillment_source_unverified"].includes(item));
  workflowStep(workflow, "READY_FOR_PAPER_TEST", "COMPLETED", {manualApproval: true, paperOnly: true, publishAllowed: false, adSpendAllowed: false});
  emit("commerce_product_launch_approved", {workflowId: workflow.id, productId: workflow.productId, paperOnly: true}, .8);persist();return workflow;
}

function funnelSummary() {
  const counts = funnelEvents.reduce((acc, event) => { const type = String(event.type || "unknown"); acc[type] = (acc[type] || 0) + 1; return acc; }, {});
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidOrders = orders.filter(order => order.status === "paid");
  const spend = campaigns.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0);
  return {counts, orders: orders.length, paidOrders: paidOrders.length, revenue: Number(revenue.toFixed(2)), spend: Number(spend.toFixed(2)), conversionRate: counts.checkout_started ? Number((paidOrders.length / counts.checkout_started * 100).toFixed(2)) : 0, lastEventAt: funnelEvents[0]?.createdAt || null};
}

async function runCommerceCycle(input = {}) {
  const discovery = await discoverProducts(input.sources || ["amazon", "aliexpress"]);
  const results = await Promise.all(commerceBots.filter(bot => bot.active).map(async bot => ({
    botId: bot.id,
    result: bot.id === "dropship-hunter"
      ? await runDropshipHunter({cycle: "automatic", reason: input.reason || "scheduled"})
      : runBot(bot, {cycle: "automatic", reason: input.reason || "scheduled"})
  })));
  const top = products.filter(product => product.tier === "TEST_READY").sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || null;
  const cycle = {id: crypto.randomUUID(), createdAt: new Date().toISOString(), mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", discovery: {count: discovery.discovered, providerFeedUsed: discovery.providerFeedUsed}, topProduct: top ? {id: top.id, name: top.name, score: top.score, economics: top.economics} : null, botsRun: results.length, results};
  emit("commerce_cycle_completed", cycle, .8); persist(); return cycle;
}

async function executeMasterCommand(command = {}) {
  const action = String(command.action || "");
  const moduleId = String(command.moduleId || command.botId || "");
  let result;
  if (action === "set_parameters") {
    if (!moduleConfigs[moduleId]) throw new Error("MODULE_NOT_FOUND");
    moduleConfigs[moduleId] = sanitizeModuleParameters(moduleId, {...moduleConfigs[moduleId], ...(command.parameters || {})});
    products.forEach(enrichProduct);
    result = {moduleId, parameters: moduleConfigs[moduleId], applied: true, mode: "PAPER"};
  } else if (action === "toggle_bot") {
    const bot = findBot(moduleId); if (!bot) throw new Error("BOT_NOT_FOUND");
    if (typeof command.active === "boolean") bot.active = command.active; else bot.active = !bot.active;
    bot.enabled = bot.active; bot.status = bot.active ? "STANDBY" : "PAUSED";
    result = {botId: bot.id, active: bot.active};
  } else if (action === "run_module") {
    if (moduleId === "dropship-hunter") result = await runDropshipHunter(command.input || {});
    else if (moduleId === "digital-builder") result = runDigitalBuilder(command.input || {});
    else if (moduleId === "offer-pricing") result = runOfferPricing(command.input || {});
    else if (moduleId === "creative-factory") result = await runCreativeFactory(command.input || {});
    else if (moduleId === "store-manager") result = runStoreManager(command.input || {});
    else if (moduleId === "traffic") result = runTraffic(command.input || {});
    else if (moduleId === "closer") result = runCloser(command.input || {});
    else if (moduleId === "retention") result = runRetention(command.input || {});
    else if (moduleId === "allocator") result = runAllocator(command.input || {});
    else { const bot = findBot(moduleId); if (!bot) throw new Error("BOT_NOT_FOUND"); if (!bot.active) throw new Error("BOT_PAUSED"); result = runBot(bot, {source: "brain-master", ...(command.input || {})}); }
  } else if (action === "run_workflow") {
    result = await runProductLaunchWorkflow(command.input || {});
  } else if (action === "run_cycle") {
    result = await runCommerceCycle({reason: "brain-master", ...(command.input || {})});
  } else throw new Error("MASTER_ACTION_NOT_ALLOWED");
  masterControl.lastCommandAt = new Date().toISOString();
  masterControl.lastCommand = {action, moduleId, mode: "PAPER"};
  emit("commerce_master_command_completed", {action, moduleId, result: {status: result?.status || "COMPLETED"}, mode: "PAPER"}, .85);
  persist();
  return result;
}

function commerceChatContext() {
  return {
    generatedAt: new Date().toISOString(), mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED",
    agents: agents.map(agent => ({id: agent.id, name: agent.name, strategy: agent.strategy, enabled: agent.enabled})),
    bots: commerceBots.map(bot => ({id: bot.id, name: bot.name, status: bot.status, active: bot.active, metrics: bot.metrics, readiness: bot.readiness, lastResult: bot.lastResult?.summary || null})),
    moduleParameters: moduleConfigs,
    products: products.slice(0, 20), opportunities: opportunities.slice(0, 20),
    digitalProducts: digitalProducts.slice(0, 12), landingPages: landingPages.slice(0, 12),
    storeDrafts: storeDrafts.slice(0, 12), campaigns: campaigns.slice(0, 12),
    leads: leads.slice(0, 20), orders: orders.slice(0, 20), funnel: funnelSummary(),
    connectors: connectorStatus(), latestEvents: events.slice(0, 20)
  };
}

function commerceFallback(message, context) {
  const query = message.toLowerCase();
  if (query.includes("producto") || query.includes("dropship") || query.includes("aliexpress")) return `Puedo revisar ${context.products.length} productos y el estado del Dropshipping Hunter. En este momento el modo es ${context.mode}; te indicaré qué señales son reales, qué proveedor falta y qué producto está listo para prueba.`;
  if (query.includes("precio") || query.includes("margen") || query.includes("oferta")) return "Puedo analizar precio, margen, anclaje y sensibilidad usando los productos y parámetros del Offer & Pricing Engine.";
  if (query.includes("venta") || query.includes("lead") || query.includes("crm")) return `Commerce Brain tiene ${context.leads.length} leads registrados y ${context.orders.length} pedidos en el contexto actual. Puedo revisar el embudo, priorizar conversaciones y proponer el siguiente paso en PAPER.`;
  return "Puedo revisar productos, proveedores, ofertas, creatividades, drafts de Shopify, tráfico, leads, retención y asignación de ingresos con los datos actuales de Commerce Brain.";
}

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

app.get("/health", (req, res) => res.json({name: NAME, kind: KIND, status: state.status, startedAt: state.startedAt, agentsOnline: commerceBots.filter(bot => bot.active).length, agentsTotal: commerceBots.length, processed: state.processed, mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED"}));
app.get("/api/agents", (req, res) => res.json(agents));
app.get("/api/modules", (req, res) => res.json({mode: "PAPER", master: {url: MASTER_BRAIN_URL, connected: masterControl.connected, lastCommandAt: masterControl.lastCommandAt}, modules: commerceBots.map(bot => ({...bot, parameters: moduleConfigs[bot.id], control: {actions: ["run_module", "set_parameters", "toggle_bot"], paperOnly: true}}))}));
app.get("/api/master/status", (req, res) => res.json({ok: true, mode: "PAPER", master: {url: MASTER_BRAIN_URL, connected: masterControl.connected, lastCommandAt: masterControl.lastCommandAt, lastCommand: masterControl.lastCommand}, permissions: {inspect: true, setBoundedParameters: true, runPaperActions: true, publish: false, spend: false, withdraw: false}}));
app.post("/api/master/command", async (req, res) => { try { res.json({ok: true, mode: "PAPER", result: await executeMasterCommand(req.body || {})}); } catch (error) { res.status(409).json({ok: false, mode: "PAPER", error: error.message}); } });
app.post("/api/modules/dropship-hunter/run", async (req, res) => { try { res.json({ok: true, ...(await runDropshipHunter(req.body || {}))}); } catch (error) { res.status(502).json({ok: false, error: error.message}); } });
app.post("/api/modules/digital-builder/run", (req, res) => res.json({ok: true, ...runDigitalBuilder(req.body || {})}));
app.post("/api/modules/offer-pricing/run", (req, res) => res.json({ok: true, ...runOfferPricing(req.body || {})}));
app.post("/api/modules/creative-factory/run", async (req, res) => res.json({ok: true, ...(await runCreativeFactory(req.body || {}))}));
app.post("/api/modules/store-manager/run", (req, res) => res.json({ok: true, ...runStoreManager(req.body || {})}));
app.post("/api/modules/traffic/run", (req, res) => res.json({ok: true, ...runTraffic(req.body || {})}));
app.post("/api/modules/closer/run", (req, res) => res.json({ok: true, ...runCloser(req.body || {})}));
app.post("/api/modules/retention/run", (req, res) => res.json({ok: true, ...runRetention(req.body || {})}));
app.post("/api/modules/allocator/run", (req, res) => res.json({ok: true, ...runAllocator(req.body || {})}));
app.get("/api/digital-products", (req, res) => res.json({mode: "PAPER", items: digitalProducts.slice(0, 100)}));
app.get("/api/bots", (req, res) => res.json(commerceBots));
app.get("/api/bots/:id", (req, res) => { const bot = findBot(req.params.id); if (!bot) return res.status(404).json({error: "Commerce bot not found"}); res.json(bot); });
app.post("/api/bots/:id/toggle", (req, res) => { const bot = findBot(req.params.id); if (!bot) return res.status(404).json({error: "Commerce bot not found"}); bot.active = !bot.active; bot.enabled = bot.active; bot.status = bot.active ? "STANDBY" : "PAUSED"; emit("commerce_bot_toggled", {botId: bot.id, active: bot.active}); res.json({ok: true, bot}); });
app.post("/api/bots/:id/scan", async (req, res) => { const bot = findBot(req.params.id); if (!bot) return res.status(404).json({error: "Commerce bot not found"}); if (!bot.active) return res.status(409).json({error: "Bot is paused"}); if (bot.id === "dropship-hunter") return res.json({ok: true, bot, result: await runDropshipHunter(req.body || {})}); if (bot.id === "digital-builder") return res.json({ok: true, bot, result: runDigitalBuilder(req.body || {})}); if (bot.id === "offer-pricing") return res.json({ok: true, bot, result: runOfferPricing(req.body || {})}); if (bot.id === "creative-factory") return res.json({ok: true, bot, result: await runCreativeFactory(req.body || {})}); if (bot.id === "store-manager") return res.json({ok: true, bot, result: runStoreManager(req.body || {})}); if (bot.id === "traffic") return res.json({ok: true, bot, result: runTraffic(req.body || {})}); if (bot.id === "closer") return res.json({ok: true, bot, result: runCloser(req.body || {})}); if (bot.id === "retention") return res.json({ok: true, bot, result: runRetention(req.body || {})}); if (bot.id === "allocator") return res.json({ok: true, bot, result: runAllocator(req.body || {})}); res.json({ok: true, bot, result: runBot(bot, req.body || {})}); });
app.post("/api/bots/:id/run", (req, res) => { const bot = findBot(req.params.id); if (!bot) return res.status(404).json({error: "Commerce bot not found"}); if (!bot.active) return res.status(409).json({error: "Bot is paused"}); res.json({ok: true, bot, result: runBot(bot, req.body || {})}); });

app.get("/api/connectors/status", async (req, res) => {
  const status = connectorStatus();
  const apify = status.connectors.find(item => item.id === "apify");
  if (apify?.configured && process.env.APIFY_DATASET_ID && String(process.env.APIFY_USE_LEGACY_DATASET || "false").toLowerCase() === "true") apify.legacyDatasetProbe = await probeApifyDataset();
  try { const response = await fetch(`${MEDIA_BRAIN_URL}/api/media/status`, {signal: AbortSignal.timeout(2500)}); const body = await response.json(); const media = status.connectors.find(item => item.id === "media"); if (media) { media.configured = Boolean(body.provider?.configured); media.live = body.provider?.mode === "REMOTE_API"; media.detail = `${body.provider?.provider || "unknown"} · ${body.provider?.mode || "offline"} · ${body.models || 0} models`; } } catch (error) { const media = status.connectors.find(item => item.id === "media"); if (media) { media.live = false; media.detail = `Media Brain unavailable: ${error.message}`; } }
  res.json(status);
});
app.get("/api/apify/amazon-affiliate-scout/status", (req, res) => {
  const apify = connector("apify");
  res.json({ok: true, mode: "PAPER", actor: {id: AMAZON_AFFILIATE_ACTOR_ID, configured: Boolean(apify?.configured), readiness: apify?.readiness || "BLOCKED", private: true, purpose: "Amazon Affiliate product discovery via official Creators API"}, credentials: {apifyToken: Boolean(envValue("APIFY_API_TOKEN", "APIFY_API_KEY")), amazonCreatorsCredentials: Boolean(envValue("AMAZON_CREATORS_CLIENT_ID") && envValue("AMAZON_CREATORS_CLIENT_SECRET") && envValue("AMAZON_PARTNER_TAG", "AMAZON_CREATORS_PARTNER_TAG"))}, policy: {scraping: false, shopifyInventoryImport: false, adSpend: false, affiliateClickout: true}});
});
app.post("/api/apify/amazon-affiliate-scout/run", async (req, res) => {
  try {
    const result = await runAmazonAffiliateScout(req.body || {});
    res.json({ok: true, ...result});
  } catch (error) {
    res.status(String(error.message).startsWith("APIFY_ACTOR_RUN_403") ? 503 : 502).json({ok: false, mode: "PAPER", actorId: AMAZON_AFFILIATE_ACTOR_ID, error: error.message, message: "El Actor no devolvió productos. Revisa el build/cuota de Apify y las credenciales del Amazon Creators API dentro del Actor."});
  }
});
app.get("/api/products", (req, res) => res.json({items: products, mode: "PAPER", sources: connectorStatus().connectors.filter(item => ["amazon", "aliexpress", "apify"].includes(item.id))}));
app.post("/api/products/discover", async (req, res) => {
  const requested = req.body?.source === "amazon" || req.body?.source === "aliexpress" ? [req.body.source] : ["amazon", "aliexpress"];
  if (requested.length === 1 && requested[0] === "amazon" && req.body?.useApifyActor === true) {
    try { return res.json({ok: true, ...(await runAmazonAffiliateScout(req.body || {}))}); }
    catch (error) { return res.status(502).json({ok: false, mode: "PAPER", error: error.message}); }
  }
  const result = await discoverProducts(requested);
  res.json({ok: true, mode: "PAPER", liveData: false, providerFeedUsed: result.providerFeedUsed, warning: result.providerFeedUsed ? "Feed de proveedor leído en modo PAPER; no se publicaron ni compraron productos." : "Estas son muestras PAPER hasta conectar las credenciales o feeds del proveedor.", items: result.items});
});
app.get("/api/workflows", (req, res) => {
  const productId = req.query.productId ? String(req.query.productId) : null;
  const rows = productId ? workflows.filter(item => item.productId === productId) : workflows;
  res.json({mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", workflows: rows.slice(0, 100)});
});
app.get("/api/workflows/:id", (req, res) => { const workflow = findWorkflow(req.params.id); if (!workflow) return res.status(404).json({error: "WORKFLOW_NOT_FOUND"}); res.json(workflow); });
app.post("/api/workflows/product-launch", async (req, res) => { try { const workflow = await runProductLaunchWorkflow(req.body || {}); res.status(201).json({ok: true, workflow}); } catch (error) { state.alerts = [{id: crypto.randomUUID(), code: "PRODUCT_WORKFLOW_ERROR", message: error.message, at: new Date().toISOString()}, ...state.alerts].slice(0, 20); persist(); res.status(400).json({ok: false, error: error.message}); } });
app.post("/api/workflows/:id/approve", (req, res) => { try { const workflow = approveWorkflow(findWorkflow(req.params.id), req.body || {}); res.json({ok: true, workflow}); } catch (error) { res.status(409).json({ok: false, error: error.message}); } });
app.post("/api/workflows/:id/reject", (req, res) => { const workflow = findWorkflow(req.params.id); if (!workflow) return res.status(404).json({error: "WORKFLOW_NOT_FOUND"}); workflow.status = "REJECTED";workflow.rejection = {reason: String(req.body?.reason || "operator_rejected"), actor: req.body?.actor || "operator", at: new Date().toISOString()};workflowStep(workflow, "REJECTED", "COMPLETED", workflow.rejection);emit("commerce_product_launch_rejected", {workflowId: workflow.id, productId: workflow.productId, reason: workflow.rejection.reason}, .8);persist();res.json({ok: true, workflow}); });
app.get("/api/store-drafts", (req, res) => res.json(storeDrafts.slice(0, 100)));
app.post("/api/automation/run", async (req, res) => { try { res.json({ok: true, cycle: await runCommerceCycle(req.body || {})}); } catch (error) { state.alerts = [{id: crypto.randomUUID(), code: "AUTOMATION_ERROR", message: error.message, at: new Date().toISOString()}, ...state.alerts].slice(0, 20); persist(); res.status(502).json({error: error.message}); } });
app.get("/api/automation/status", (req, res) => res.json({enabled: AUTOMATION_ENABLED, intervalMs: AUTOMATION_INTERVAL_MS, mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", lastCycle: events.find(event => event.type === "commerce_cycle_completed")?.payload || null}));
app.get("/api/operations/summary", (req, res) => {
  const readiness = commerceBots.map(bot => ({id: bot.id, name: bot.name, active: bot.active, status: bot.status, readiness: bot.readiness || botReadiness(bot), lastRunAt: bot.lastRunAt}));
  const readyProducts = products.filter(product => product.tier === "TEST_READY").sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  res.json({mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", automation: {enabled: AUTOMATION_ENABLED, intervalMs: AUTOMATION_INTERVAL_MS}, pipeline: {discovered: products.length, scored: products.filter(product => product.score !== undefined).length, testReady: readyProducts.length, landingDrafts: landingPages.length, storeDrafts: storeDrafts.length, campaignDrafts: campaigns.length, workflows: workflows.length, workflowsReadyForPaper: workflows.filter(item => item.status === "READY_FOR_PAPER_TEST").length}, readiness, topProducts: readyProducts.slice(0, 5), workflows: workflows.slice(0, 5), funnel: funnelSummary(), connectors: connectorStatus()});
});
app.post("/api/products/:id/score", (req, res) => { const product = findProduct(req.params.id); if (!product) return res.status(404).json({error: "Product not found"}); Object.assign(product, req.body || {}); enrichProduct(product); emit("commerce_product_scored", {productId: product.id, score: product.score, tier: product.tier}); res.json({ok: true, product}); });
app.post("/api/products/:id/landing", async (req, res) => {
  const product = findProduct(req.params.id); if (!product) return res.status(404).json({error: "Product not found"});
  const asset = await mediaAsset(`Hero product image for ${product.name}, category ${product.category}, premium ecommerce studio lighting, clean background, conversion-focused composition.`);
  const landing = landingFor(product, asset); landingPages.unshift(landing); emit("commerce_landing_draft", {landingId: landing.id, productId: product.id, assetMode: asset.mode});
  res.json({ok: true, landing});
});
app.get("/api/landing-pages", (req, res) => res.json(landingPages));
app.post("/api/products/:id/campaign", (req, res) => { const product = findProduct(req.params.id); if (!product) return res.status(404).json({error: "Product not found"}); enrichProduct(product); const campaign = campaignFor(product, req.body || {}); campaigns.unshift(campaign); emit("commerce_campaign_draft", {campaignId: campaign.id, productId: product.id}); res.json({ok: true, campaign, message: "Promotion plan prepared. No ad spend activated."}); });
app.get("/api/campaigns", (req, res) => res.json(campaigns));
app.post("/api/campaigns/:id/activate", (req, res) => { const campaign = campaigns.find(item => item.id === req.params.id); if (!campaign) return res.status(404).json({error: "Campaign not found"}); const enabled = String(process.env.COMMERCE_LIVE_ADS_ENABLED || "false").toLowerCase() === "true"; if (PAPER_MODE || !enabled) return res.status(409).json({ok: false, error: "LIVE_ADS_LOCKED", blockers: [PAPER_MODE ? "COMMERCE_MODE=PAPER" : null, !enabled ? "COMMERCE_LIVE_ADS_ENABLED=false" : null].filter(Boolean), campaign}); campaign.status = "ACTIVE"; campaign.activatedAt = new Date().toISOString(); emit("commerce_campaign_activated", {campaignId: campaign.id}); res.json({ok: true, campaign}); });
app.post("/api/shopify/probe", async (req, res) => {
  const shop = connector("shopify"); if (!shop.configured) return res.status(409).json({ok: false, error: "SHOPIFY_CREDENTIALS_NOT_CONFIGURED", connector: shop});
  const domain = String(process.env.SHOPIFY_STORE_DOMAIN).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const version = process.env.SHOPIFY_API_VERSION || "2025-07";
  try { const response = await fetch(`https://${domain}/admin/api/${version}/shop.json`, {headers: {"x-shopify-access-token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN, accept: "application/json"}, signal: AbortSignal.timeout(8000)}); const body = await response.json().catch(() => ({})); res.status(response.ok ? 200 : 502).json({ok: response.ok, status: response.status, shop: body.shop || null, error: response.ok ? null : body.errors || "Shopify probe failed"}); }
  catch (error) { res.status(502).json({ok: false, error: error.message}); }
});
app.post("/api/shopify/draft", (req, res) => { const product = findProduct(req.body?.productId); if (!product) return res.status(404).json({error: "Product not found"}); if (product.monetizationModel === "AMAZON_AFFILIATE") return res.status(409).json({ok: false, error: "AMAZON_AFFILIATE_NOT_SHOPIFY_INVENTORY", message: "Los productos Amazon Afiliados se publican como contenido con clickout; no se convierten en inventario de Shopify."}); enrichProduct(product); const draft = {id: crypto.randomUUID(), productId: product.id, status: "DRAFT_ONLY", paper: true, connector: connector("shopify"), product: {title: product.name, price: product.economics?.price || product.price, description: `Draft listing for ${product.name}`}, createdAt: new Date().toISOString()}; emit("commerce_shopify_draft", draft); res.json({ok: true, draft, message: "Draft prepared. No se publicó nada en Shopify."}); });
app.post("/api/shopify/publish", (req, res) => { const enabled = String(process.env.COMMERCE_LIVE_PUBLISH || "false").toLowerCase() === "true"; const shop = connector("shopify"); if (PAPER_MODE || !enabled || !shop.configured) return res.status(409).json({ok: false, error: "SHOPIFY_PUBLISH_LOCKED", blockers: [PAPER_MODE ? "COMMERCE_MODE=PAPER" : null, !enabled ? "COMMERCE_LIVE_PUBLISH=false" : null, !shop.configured ? "SHOPIFY_CREDENTIALS_NOT_CONFIGURED" : null].filter(Boolean)}); res.status(501).json({ok: false, error: "SHOPIFY_PUBLISH_ADAPTER_REQUIRES_APPROVED_PRODUCT_MUTATION", message: "Connector validated; product mutation remains an explicit implementation gate."}); });

app.post("/api/leads", (req, res) => { const lead = {id: crypto.randomUUID(), email: String(req.body?.email || "").trim().toLowerCase(), name: req.body?.name || "", source: req.body?.source || "unknown", score: Number(req.body?.score || 0), status: "new", createdAt: new Date().toISOString(), metadata: req.body?.metadata || {}}; if (!lead.email || !lead.email.includes("@")) return res.status(400).json({error: "VALID_EMAIL_REQUIRED"}); leads.unshift(lead); emit("commerce_lead_captured", {leadId: lead.id, source: lead.source}); res.status(201).json({ok: true, lead}); });
app.get("/api/leads", (req, res) => res.json(leads));
app.post("/api/funnel/event", (req, res) => { const allowed = ["landing_view", "cta_click", "checkout_started", "purchase", "refund", "email_signup", "add_to_cart"]; const type = String(req.body?.type || ""); if (!allowed.includes(type)) return res.status(400).json({error: "UNSUPPORTED_FUNNEL_EVENT", allowed}); const event = {id: crypto.randomUUID(), type, productId: req.body?.productId || null, campaignId: req.body?.campaignId || null, sessionId: req.body?.sessionId || null, value: Number(req.body?.value || 0), createdAt: new Date().toISOString(), metadata: req.body?.metadata || {}}; funnelEvents.unshift(event); emit("commerce_funnel_event", event); res.status(201).json({ok: true, event, funnel: funnelSummary()}); });
app.get("/api/funnel/summary", (req, res) => res.json(funnelSummary()));
app.post("/api/orders/webhook", (req, res) => { const configuredSecret = process.env.COMMERCE_WEBHOOK_SECRET; const suppliedSecret = req.get("x-commerce-webhook-secret"); const verified = configuredSecret ? suppliedSecret === configuredSecret : PAPER_MODE && req.body?.paper === true; if (!verified) return res.status(401).json({error: "ORDER_WEBHOOK_NOT_VERIFIED", message: "Provide the server webhook secret or an explicit paper:true event."}); const order = {id: String(req.body?.id || req.body?.orderId || crypto.randomUUID()), customerId: req.body?.customerId || req.body?.email || null, productId: req.body?.productId || null, total: Number(req.body?.total || 0), status: req.body?.status || "paid", verified: true, createdAt: req.body?.createdAt || new Date().toISOString()}; if (orders.some(item => item.id === order.id)) return res.json({ok: true, duplicate: true, order}); orders.unshift(order); if (order.status === "paid") { state.metrics.revenue += order.total; state.metrics.contribution += Number(req.body?.contribution || 0); } emit("commerce_order_received", {orderId: order.id, status: order.status, verified: order.verified, total: order.total}); res.status(201).json({ok: true, order, funnel: funnelSummary()}); });

app.get("/api/events", (req, res) => res.json(events.slice(0, 100)));
app.get("/api/summary", (req, res) => res.json({name: NAME, kind: KIND, state, mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", agents, bots: commerceBots, products, landingPages, storeDrafts, campaigns, workflows, leads: leads.length, orders: orders.length, funnel: funnelSummary(), connectors: connectorStatus(), opportunities, latestEvents: events.slice(0, 10)}));
app.post("/api/event", (req, res) => res.json({ok: true, event: emit(req.body.type || "external_event", req.body.payload || {}, Number(req.body.priority || .5))}));
app.get("/api/opportunities", (req, res) => res.json(opportunities));
app.post("/api/opportunities", (req, res) => { const opportunity = {id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "testing", score: Number(req.body.score || .5), ...req.body}; opportunities.unshift(opportunity); emit("commerce_opportunity", opportunity, opportunity.score); res.json({ok: true, opportunity}); });
app.get("/api/kpis", (req, res) => res.json({experiments: opportunities.length, active: opportunities.filter(item => item.status === "testing").length, revenue: Number(state.metrics.revenue || 0), contribution: Number(state.metrics.contribution || 0), spend: Number(state.metrics.spend || 0), products: products.length, testReady: products.filter(product => product.tier === "TEST_READY").length, landings: landingPages.length, campaigns: campaigns.length, leads: leads.length, orders: orders.length, activeBots: commerceBots.filter(bot => bot.active).length}));

let automationBusy = false;
if (AUTOMATION_ENABLED) setInterval(async () => { if (automationBusy) return; automationBusy = true; try { await runCommerceCycle({reason: "scheduled"}); } catch (error) { state.alerts = [{id: crypto.randomUUID(), code: "SCHEDULED_CYCLE_ERROR", message: error.message, at: new Date().toISOString()}, ...state.alerts].slice(0, 20); persist(); } finally { automationBusy = false; } }, AUTOMATION_INTERVAL_MS);

app.listen(PORT, () => console.log(`${NAME} listening on ${PORT} · ${PAPER_MODE ? "PAPER" : "LIVE LOCKED"} · automation ${AUTOMATION_ENABLED ? "on" : "off"}`));
