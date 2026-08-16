import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {completeBrainConversation} from "../../../packages/inter-brain-protocol/src/chat.js";
import {aegisData} from "../../../packages/aegis-data/src/index.js";

try { process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env")); } catch {}

const app = express();
const API_TOKEN = String(process.env.SERVICES_API_TOKEN || "");
const ALLOWED_ORIGINS = String(process.env.SERVICES_ALLOWED_ORIGINS || "http://localhost:8815,http://localhost:8810").split(",").map(value => value.trim()).filter(Boolean);
app.use(cors({origin(origin, callback) { if (!origin || !ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) return callback(null, true); return callback(new Error("ORIGIN_NOT_ALLOWED")); }}));
app.use(express.json({limit: "1mb"}));

const NAME = "AEGIS Services Brain";
const KIND = "services";
const PORT = Number(process.env.PORT || 8808);
const VERSION = "1.0.0";
const PAPER_MODE = String(process.env.SERVICES_MODE || "PAPER").toUpperCase() !== "LIVE";
const serviceUrl = (value, fallback) => { const url = String(value || fallback).trim().replace(/\/$/, ""); return /^https?:\/\//i.test(url) ? url : `http://${url}`; };
const COMMERCE_URL = serviceUrl(process.env.COMMERCE_BRAIN_URL,"http://localhost:8802");
const MEDIA_URL = serviceUrl(process.env.MEDIA_BRAIN_URL,"http://localhost:8804");
const SAAS_URL = serviceUrl(process.env.SAAS_BRAIN_URL,"http://localhost:8790");
const FINANCE_URL = serviceUrl(process.env.FINANCE_BRAIN_URL,"http://localhost:8787");
const MANAGER_URL = serviceUrl(process.env.MANAGER_BRAIN_URL,"http://localhost:8805");
const CEO_URL = serviceUrl(process.env.CEO_BRAIN_URL,"http://localhost:8806");
const APP_URL = serviceUrl(process.env.APP_URL,"http://localhost:8815");
const SERVICES_PUBLIC_URL = String(process.env.SERVICES_PUBLIC_URL || APP_URL).replace(/\/$/, "");
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "");
const RESEND_WEBHOOK_SECRET = String(process.env.RESEND_WEBHOOK_SECRET || "");
const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || "");
const SOCIAL_CONNECTORS = {linkedin: Boolean(process.env.LINKEDIN_ACCESS_TOKEN), instagram: Boolean(process.env.META_ACCESS_TOKEN), tiktok: Boolean(process.env.TIKTOK_ACCESS_TOKEN)};
const RESEND_FROM_EMAIL = String(process.env.RESEND_FROM_EMAIL || "hello@boostifymusic.site");
const RESEND_FROM_NAME = String(process.env.RESEND_FROM_NAME || "BoostifyDev Services");
const RESEND_REPLY_TO_EMAIL = String(process.env.RESEND_REPLY_TO_EMAIL || RESEND_FROM_EMAIL);
const RESEND_OUTREACH_POOL = String(process.env.RESEND_OUTREACH_POOL || "").split(",").map(value => value.trim()).filter(Boolean);
const SERVICES_AUTOMATION_ENABLED = String(process.env.SERVICES_AUTOMATION_ENABLED || "false").toLowerCase() === "true";
const SERVICES_REQUIRE_APPROVAL = String(process.env.SERVICES_REQUIRE_APPROVAL || "true").toLowerCase() !== "false";
const SERVICES_MAX_OUTREACH_PER_DAY = Math.max(1, Number(process.env.SERVICES_MAX_OUTREACH_PER_DAY || 40));
const SERVICES_RATE_LIMIT_PER_MINUTE = Math.max(30, Number(process.env.SERVICES_RATE_LIMIT_PER_MINUTE || 120));
const UNSUBSCRIBE_SECRET = String(process.env.SERVICES_UNSUBSCRIBE_SECRET || process.env.RESEND_WEBHOOK_SECRET || "services-paper-secret");
const RESEND_DOMAIN = String(process.env.RESEND_FROM_DOMAIN || RESEND_FROM_EMAIL.split("@")[1] || "boostifymusic.site");
const MUAPI_CONFIGURED = Boolean(process.env.MUAPI_API_KEY);
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const DATA_FILE = path.join(DATA_DIR, "services.json");

const servicePlaybooks = {
  "web-design": {offer: "Convierte visitas en clientes con una presencia web que vende.", idealFor: "negocios, profesionales y marcas que necesitan presencia o conversiones", hook: "Tu web debe explicar, convencer y capturar la oportunidad en segundos.", questions: ["¿Qué quieres vender?", "¿Qué acción debe tomar el visitante?", "¿Tienes marca, copy y assets?"], tools: ["SaaS Brain", "Media Brain", "Commerce Brain"]},
  "seo-growth": {offer: "Construye demanda orgánica que siga trabajando después de publicar.", idealFor: "negocios con producto validado y crecimiento orgánico como prioridad", hook: "Menos dependencia de anuncios: más intención de búsqueda convertida en pipeline.", questions: ["¿Cuál es tu mercado?", "¿Qué keywords o competidores importan?", "¿Qué contenido ya existe?"], tools: ["Media Brain", "Commerce Brain"]},
  "corporate-video": {offer: "Haz que tu empresa se entienda y se recuerde con video profesional.", idealFor: "empresas, equipos comerciales y marcas que necesitan autoridad", hook: "Una pieza clara puede hacer el trabajo de una docena de explicaciones.", questions: ["¿Quién debe ver el video?", "¿Dónde se publicará?", "¿Tienes locación, portavoz o material?"], tools: ["Media Brain"]},
  "music-video": {offer: "Lleva tu canción a una experiencia visual con dirección y narrativa.", idealFor: "artistas, sellos y equipos de música", hook: "No solo grabamos un video: construimos el mundo visual de tu canción.", questions: ["¿Cuál es el concepto?", "¿Qué referencias visuales tienes?", "¿Qué formatos necesitas para lanzamiento?"], tools: ["Media Brain"]},
  "short-form": {offer: "Convierte una idea o grabación en una máquina constante de contenido corto.", idealFor: "creadores, marcas y negocios que necesitan publicar con ritmo", hook: "Más piezas, mejores hooks y un sistema que aprende qué retiene.", questions: ["¿En qué plataformas publicas?", "¿Cuántas piezas al mes?", "¿Qué oferta queremos empujar?"], tools: ["Media Brain", "Commerce Brain"]},
  "brand-identity": {offer: "Haz que tu negocio se vea tan valioso como realmente es.", idealFor: "marcas nuevas, rebrandings y negocios que subieron de nivel", hook: "La confianza empieza antes de que el cliente lea una palabra.", questions: ["¿Qué debe transmitir la marca?", "¿Quién es tu cliente ideal?", "¿Qué referencias no quieres parecer?"], tools: ["Media Brain", "SaaS Brain"]},
  "ecommerce-build": {offer: "Lanza una tienda y una oferta conectadas con adquisición y operaciones.", idealFor: "marcas de producto, e-commerce y operaciones dropshipping", hook: "Producto, oferta, contenido y tracking trabajando en la misma dirección.", questions: ["¿Qué productos tienes?", "¿Cuál es tu margen?", "¿Qué canal trae demanda hoy?"], tools: ["Commerce Brain", "Media Brain", "SaaS Brain"]},
  "saas-automation": {offer: "Elimina trabajo manual y convierte procesos repetidos en sistemas.", idealFor: "equipos que pierden tiempo entre hojas, chats y herramientas desconectadas", hook: "Tu operación no debe depender de recordar veinte pasos cada día.", questions: ["¿Qué proceso se repite?", "¿Dónde se pierde información?", "¿Qué herramientas ya usas?"], tools: ["SaaS Brain", "Manager Brain", "AI Agents"]},
  "paid-growth": {offer: "Construye un sistema de adquisición con creatividad, funnel y control de CAC.", idealFor: "negocios listos para probar crecimiento pagado con disciplina", hook: "No se trata de gastar más: se trata de saber qué experimento merece presupuesto.", questions: ["¿Cuál es tu oferta?", "¿Cuál es tu CAC objetivo?", "¿Qué audiencias ya probaste?"], tools: ["Commerce Brain", "Media Brain", "Finance Brain"]},
  "ai-agents": {offer: "Diseña agentes que respondan, ejecuten y conecten la operación de tu negocio.", idealFor: "empresas que quieren automatizar atención, ventas, análisis o delivery", hook: "La IA debe tener contexto, límites y una acción clara después de cada conversación.", questions: ["¿Qué decisión o tarea quieres delegar?", "¿Qué datos puede consultar?", "¿Qué aprobación humana requiere?"], tools: ["SaaS Brain", "Manager Brain", "Media Brain"]},
  "content-system": {offer: "Pasa de publicar cuando puedes a operar un sistema editorial que genera demanda.", idealFor: "marcas que necesitan autoridad, comunidad y flujo de oportunidades", hook: "El contenido funciona mejor cuando cada pieza tiene un trabajo comercial.", questions: ["¿Cuál es tu oferta principal?", "¿Qué audiencia quieres mover?", "¿Qué formatos puedes sostener?"], tools: ["Media Brain", "Commerce Brain"]},
  maintenance: {offer: "Mantén tus activos digitales rápidos, seguros y mejorando cada mes.", idealFor: "negocios con web, tienda o automatizaciones que no pueden quedarse quietos", hook: "La optimización continua evita que el crecimiento se frene por pequeños problemas.", questions: ["¿Qué activo necesita atención?", "¿Qué errores o cuellos de botella conoces?", "¿Qué métrica quieres mejorar?"], tools: ["SaaS Brain", "Media Brain", "Commerce Brain"]}
};

const services = [
  {id: "web-design", name: "Páginas web & landing pages", category: "WEB", description: "Diseño y desarrollo de sitios, landings y páginas de conversión.", deliverables: ["arquitectura", "diseño responsive", "implementación", "analytics"], startingFrom: 900, model: "PROJECT", delivery: "7–14 días", team: ["Web", "CRO"]},
  {id: "seo-growth", name: "SEO & posicionamiento", category: "SEO", description: "Sistema de posicionamiento técnico, contenidos y autoridad orgánica.", deliverables: ["auditoría", "keyword map", "on-page", "roadmap mensual"], startingFrom: 650, model: "MONTHLY", delivery: "30 días iniciales", team: ["SEO", "Content"]},
  {id: "corporate-video", name: "Videos corporativos", category: "VIDEO", description: "Piezas audiovisuales para vender, presentar y elevar la marca.", deliverables: ["concepto", "guion", "edición", "master social"], startingFrom: 1200, model: "PROJECT", delivery: "10–21 días", team: ["Media", "Creative"]},
  {id: "music-video", name: "Music videos", category: "VIDEO", description: "Videoclips con dirección creativa, narrativa visual y entrega multiplataforma.", deliverables: ["dirección", "rodaje", "color", "formatos verticales"], startingFrom: 1800, model: "PROJECT", delivery: "14–30 días", team: ["Media", "Production"]},
  {id: "short-form", name: "Short-form, Reels & TikTok", category: "CONTENT", description: "Contenido corto recurrente diseñado para alcance, retención y conversión.", deliverables: ["ideas", "edición", "subtítulos", "variantes"], startingFrom: 450, model: "BUNDLE", delivery: "5–10 días", team: ["Media", "Growth"]},
  {id: "brand-identity", name: "Branding & identidad visual", category: "BRAND", description: "Una identidad clara para que el negocio se vea reconocible y confiable.", deliverables: ["dirección visual", "logo system", "paleta", "brand kit"], startingFrom: 750, model: "PROJECT", delivery: "7–14 días", team: ["Brand", "Design"]},
  {id: "ecommerce-build", name: "E-commerce & dropshipping", category: "COMMERCE", description: "Tiendas, catálogos y ofertas conectadas al Commerce Brain.", deliverables: ["setup de tienda", "catálogo", "oferta", "tracking"], startingFrom: 1400, model: "PROJECT", delivery: "10–21 días", team: ["Commerce", "Web"]},
  {id: "saas-automation", name: "SaaS & automatizaciones", category: "AUTOMATION", description: "Flujos, dashboards y operaciones digitales para ahorrar tiempo.", deliverables: ["discovery", "workflow", "integraciones", "handoff"], startingFrom: 1800, model: "PROJECT", delivery: "14–30 días", team: ["SaaS", "Automation"]},
  {id: "paid-growth", name: "Ads, funnels & CAC", category: "GROWTH", description: "Arquitectura de adquisición, embudos y experimentos de crecimiento.", deliverables: ["audiencias", "funnel", "creative brief", "experimentos"], startingFrom: 700, model: "MONTHLY", delivery: "30 días iniciales", team: ["Growth", "Commerce"]},
  {id: "ai-agents", name: "AI agents & integrations", category: "AI", description: "Agentes especializados y conexiones entre herramientas de negocio.", deliverables: ["mapa de procesos", "agent design", "API wiring", "guardrails"], startingFrom: 1600, model: "PROJECT", delivery: "14–28 días", team: ["AI", "Engineering"]},
  {id: "content-system", name: "Content system & social", category: "CONTENT", description: "Sistema editorial y piezas constantes para construir audiencia.", deliverables: ["content pillars", "calendar", "briefs", "reporting"], startingFrom: 600, model: "MONTHLY", delivery: "30 días iniciales", team: ["Content", "Media"]},
  {id: "maintenance", name: "Mantenimiento & optimization", category: "SUPPORT", description: "Mejoras, soporte y optimización continua de activos digitales.", deliverables: ["backlog", "fixes", "performance", "monthly review"], startingFrom: 250, model: "RETAINER", delivery: "Continuo", team: ["Web", "Operations"]}
].map(item => ({...item, currency: "USD", status: "available", signals: 0, sales: servicePlaybooks[item.id] || {offer: item.description, idealFor: "negocios y marcas en crecimiento", hook: item.description, questions: [], tools: item.team}}));

const agents = [
  ["service-sales", "Service Sales Agent", "Detecta intención, recomienda servicios y prepara el siguiente paso."],
  ["service-qualifier", "Client Qualifier", "Ordena objetivos, presupuesto, urgencia y alcance del cliente."],
  ["service-quoting", "Quote & Proposal Engine", "Construye cotizaciones PAPER con alcance, precio y entregables."],
  ["service-web", "Web Delivery Agent", "Coordina páginas, landings, CRO y activos web."],
  ["service-video", "Video Production Agent", "Organiza videos, music videos, reels y entregas audiovisuales."],
  ["service-seo", "SEO Growth Agent", "Convierte oportunidades orgánicas en planes de posicionamiento."],
  ["service-brand", "Brand Studio Agent", "Gestiona branding, identidad y dirección creativa."],
  ["service-automation", "Automation Architect", "Diseña SaaS, automatizaciones e integraciones."],
  ["service-delivery", "Delivery Coordinator", "Pasa una venta aprobada a intake, milestones y proyecto."],
  ["service-success", "Client Success Agent", "Cuida la relación, recompra, upsell y continuidad del servicio."]
].map(([id, name, description], index) => ({id, name, description, order: index + 1, status: "online", enabled: true}));

function loadPersistence() { try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; } }
const persisted = (await aegisData.readState("services")) || loadPersistence();
const events = Array.isArray(persisted.events) ? persisted.events : [];
const leads = Array.isArray(persisted.leads) ? persisted.leads : [];
const proposals = Array.isArray(persisted.proposals) ? persisted.proposals : [];
const projects = Array.isArray(persisted.projects) ? persisted.projects : [];
const activities = Array.isArray(persisted.activities) ? persisted.activities : [];
const emailLog = Array.isArray(persisted.emailLog) ? persisted.emailLog : [];
const suppressionList = Array.isArray(persisted.suppressionList) ? persisted.suppressionList : [];
const promotions = Array.isArray(persisted.promotions) ? persisted.promotions : [];
const campaigns = Array.isArray(persisted.campaigns) ? persisted.campaigns : [];
const publications = Array.isArray(persisted.publications) ? persisted.publications : [];
const assets = Array.isArray(persisted.assets) ? persisted.assets : [];
const researchRuns = Array.isArray(persisted.researchRuns) ? persisted.researchRuns : [];
const touchpoints = Array.isArray(persisted.touchpoints) ? persisted.touchpoints : [];
const approvals = Array.isArray(persisted.approvals) ? persisted.approvals : [];
const jobRuns = Array.isArray(persisted.jobRuns) ? persisted.jobRuns : [];
const clientHealth = Array.isArray(persisted.clientHealth) ? persisted.clientHealth : [];
const state = {status: "online", startedAt: new Date().toISOString(), processed: Number(persisted.state?.processed || 0)};

function persist() {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  const snapshot = {schemaVersion: 3, state, events: events.slice(0, 300), leads: leads.slice(0, 500), proposals: proposals.slice(0, 500), projects: projects.slice(0, 500), activities: activities.slice(0, 1000), emailLog: emailLog.slice(0, 500), suppressionList: suppressionList.slice(0, 500), promotions: promotions.slice(0, 300), campaigns: campaigns.slice(0, 300), publications: publications.slice(0, 500), assets: assets.slice(0, 300), researchRuns: researchRuns.slice(0, 200), touchpoints: touchpoints.slice(0, 1000), approvals: approvals.slice(0, 500), jobRuns: jobRuns.slice(0, 500), clientHealth: clientHealth.slice(0, 500)};
  const temporary = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(snapshot, null, 2));
  fs.renameSync(temporary, DATA_FILE);
  void aegisData.writeState("services", snapshot);
}
let legacyLeadMigration = false;
leads.forEach(lead => { if (!lead.tier || !lead.nextAction) { Object.assign(lead, scoreLead(lead)); legacyLeadMigration = true; } });
touchpoints.forEach(item => { if (!item.scheduledAt && item.createdAt) { item.scheduledAt = new Date((Date.parse(item.createdAt) || Date.now()) + Number(item.day || 0) * 86400000).toISOString(); legacyLeadMigration = true; } });
if (legacyLeadMigration) persist();
const rateBuckets = new Map();
function requestRateLimit(req, res, next) {
  if (!req.path.startsWith("/api") || req.path === "/health" || req.path === "/api/webhooks/resend") return next();
  const key = req.ip || req.socket.remoteAddress || "local";
  const now = Date.now();
  const bucket = rateBuckets.get(key) || {startedAt: now, count: 0};
  if (now - bucket.startedAt >= 60000) { bucket.startedAt = now; bucket.count = 0; }
  bucket.count += 1; rateBuckets.set(key, bucket);
  if (bucket.count > SERVICES_RATE_LIMIT_PER_MINUTE) return res.status(429).json({error: "SERVICES_RATE_LIMITED", retryAfterSeconds: Math.ceil((60000 - (now - bucket.startedAt)) / 1000)});
  return next();
}
app.use(requestRateLimit);
app.use((req, res, next) => {
  if (!API_TOKEN || !req.path.startsWith("/api") || req.path === "/api/webhooks/resend") return next();
  if (req.get("authorization") === `Bearer ${API_TOKEN}` || req.get("x-services-token") === API_TOKEN) return next();
  return res.status(401).json({error: "SERVICES_API_AUTH_REQUIRED"});
});
function emit(type, payload = {}, priority = .5) {
  const event = {schema: "aegis.interbrain", version: "1.0", id: crypto.randomUUID(), correlation_id: crypto.randomUUID(), source: KIND, target: "manager", type, priority, timestamp: new Date().toISOString(), payload};
  events.unshift(event); state.processed++; persist(); return event;
}
function findService(id) { return services.find(service => service.id === id); }
function findLead(id) { return leads.find(lead => lead.id === id); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function addActivity(type, payload = {}, leadId = null) {
  const activity = {id: crypto.randomUUID(), type, leadId, payload, createdAt: new Date().toISOString()};
  activities.unshift(activity); if (activities.length > 1000) activities.pop(); persist(); return activity;
}
function scoreLead(input = {}) {
  const text = `${input.goal || ""} ${input.notes || ""} ${input.signal || ""} ${input.industry || ""}`.toLowerCase();
  const scoreBreakdown = {};
  let score = Number(input.baseScore || 0);
  const add = (label, points, condition) => { if (condition) { score += points; scoreBreakdown[label] = points; } };
  add("email", 15, input.email);
  add("company", 10, input.company);
  add("website", 10, input.website || input.domain);
  add("phone", 5, input.phone);
  add("budget", 15, input.budget);
  add("business_goal", 15, input.goal || input.pain || input.signal);
  add("external_source", 5, input.source && !["services-brain", "manual"].includes(String(input.source).toLowerCase()));
  add("urgency", 15, /urgente|esta semana|este mes|cotiz|presupuesto|contratar|necesito|launch|lanzar|asap/.test(text));
  add("commercial_fit", 5, /empresa|agencia|ecommerce|e-commerce|saas|artista|marca|clinic|real estate|inmobili/.test(text));
  add("decision_signal", 5, /agenda|reuni[oó]n|llamada|propuesta|precio|demo|contrato/.test(text));
  score = Math.max(0, Math.min(100, Math.round(score)));
  const missing = [!input.email && !input.phone && "canal de contacto", !input.company && !input.website && "empresa o sitio web", !input.goal && !input.pain && "problema objetivo", !input.budget && "presupuesto orientativo", !input.decisionMaker && "persona decisora"].filter(Boolean);
  const tier = score >= 75 ? "HOT" : score >= 45 ? "WARM" : "COLD";
  return {score, tier, scoreBreakdown, qualification: {complete: missing.length === 0, missing}, nextAction: tier === "HOT" ? "CONTACT_WITHIN_1H" : tier === "WARM" ? "QUALIFY_TODAY" : "NURTURE"};
}
function recommendService(input = {}) {
  if (input.serviceId && findService(input.serviceId)) return findService(input.serviceId);
  const text = `${input.service || ""} ${input.goal || ""} ${input.notes || ""} ${input.industry || ""}`.toLowerCase();
  const rules = [[/(seo|google|ranking|org[aá]nico|keyword)/, "seo-growth"], [/(music video|videoclip|canci[oó]n|artista|video musical)/, "music-video"], [/(video|corporativo|comercial|film)/, "corporate-video"], [/(reel|tiktok|short|social|instagram)/, "short-form"], [/(logo|branding|marca|identidad)/, "brand-identity"], [/(tienda|shopify|ecommerce|dropship)/, "ecommerce-build"], [/(automat|workflow|zapier|proceso)/, "saas-automation"], [/(ai|ia|agente|chatbot)/, "ai-agents"], [/(ads|anuncio|cac|funnel|publicidad)/, "paid-growth"], [/(contenido|content|blog|publicar)/, "content-system"], [/(mantenimiento|soporte|optimiza)/, "maintenance"]];
  const match = rules.find(([pattern]) => pattern.test(text));
  return findService(match?.[1] || "web-design");
}
function createLead(input = {}) {
  const normalized = normalizedEmail(input.email);
  const existing = normalized ? leads.find(item => normalizedEmail(item.email) === normalized) : null;
  if (existing) { Object.assign(existing, {name: input.name || existing.name, company: input.company || existing.company, phone: input.phone || existing.phone, website: input.website || existing.website, industry: input.industry || existing.industry, city: input.city || existing.city, serviceId: input.serviceId || existing.serviceId, goal: input.goal || existing.goal, pain: input.pain || existing.pain, signal: input.signal || existing.signal, notes: input.notes || existing.notes, budget: input.budget || existing.budget, decisionMaker: input.decisionMaker || existing.decisionMaker, consent: input.consent !== false, consentSource: input.consentSource || existing.consentSource, updatedAt: new Date().toISOString()}); Object.assign(existing, scoreLead(existing)); existing.service = findService(existing.serviceId)?.name || existing.service; persist(); addActivity("lead_updated", {reason: "dedupe", source: input.source || "services-brain"}, existing.id); return existing; }
  const service = recommendService(input);
  const leadScore = scoreLead(input);
  const lead = {id: crypto.randomUUID(), name: String(input.name || input.company || "New service lead").trim(), email: String(input.email || "").trim().toLowerCase(), company: String(input.company || "").trim(), phone: String(input.phone || "").trim(), website: String(input.website || input.domain || "").trim(), industry: String(input.industry || "").trim(), city: String(input.city || "").trim(), decisionMaker: String(input.decisionMaker || "").trim(), publicContact: input.publicContact !== false, source: String(input.source || "services-brain"), sourceUrl: String(input.sourceUrl || "").trim(), serviceId: service?.id || input.serviceId || null, service: service?.name || String(input.service || ""), status: String(input.status || "NEW").toUpperCase(), score: leadScore.score, tier: leadScore.tier, scoreBreakdown: leadScore.scoreBreakdown, qualification: leadScore.qualification, nextAction: leadScore.nextAction, nextActionAt: null, budget: String(input.budget || ""), goal: String(input.goal || "").trim(), pain: String(input.pain || "").trim(), signal: String(input.signal || "").trim(), notes: String(input.notes || "").trim(), tags: Array.isArray(input.tags) ? input.tags.slice(0, 20) : [], consent: input.consent !== false, consentSource: String(input.consentSource || (input.consent === false ? "not_provided" : "manual_or_public_source")), lastContactAt: null, owner: String(input.owner || "services-brain"), attribution: {campaignId: input.campaignId || null, promotionId: input.promotionId || null, channel: input.channel || null}, enrichmentStatus: "PENDING", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
  leads.unshift(lead); emit("service_lead_created", {leadId: lead.id, serviceId: lead.serviceId, source: lead.source}, .7); addActivity("lead_created", {name: lead.name, service: lead.service, source: lead.source}, lead.id); return lead;
}
async function mediaRequest(endpoint, options = {}) {
  const response = await fetch(`${MEDIA_URL}${endpoint}`, {method: options.method || "GET", headers: {accept: "application/json", "content-type": "application/json", ...(options.headers || {})}, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: AbortSignal.timeout(options.timeoutMs || 30000)});
  const body = await response.json().catch(() => ({}));
  return {ok: response.ok, status: response.status, body};
}
async function refreshAsset(asset) {
  if (!asset?.mediaJobId || !["PROCESSING", "QUEUED"].includes(String(asset.status || "").toUpperCase())) return asset;
  const result = await mediaRequest(`/api/generations/${asset.mediaJobId}`).catch(() => ({ok: false}));
  const job = result.body || {};
  if (result.ok && job.status) { asset.status = String(job.status).toUpperCase(); asset.outputUrl = job.outputUrl || asset.outputUrl || null; asset.requestId = job.requestId || asset.requestId || null; asset.error = job.error || null; }
  return asset;
}
function promotionFor(service, input = {}) {
  const price = Number(input.price || service.startingFrom || 0);
  const discount = Number(input.discount || 0);
  const offer = discount > 0 ? `${discount}% de descuento para los primeros ${Number(input.slots || 3)} proyectos` : `Diagnóstico inicial sin coste para los primeros ${Number(input.slots || 3)} negocios`;
  return {id: crypto.randomUUID(), serviceId: service.id, service: service.name, name: String(input.name || `${service.name} · Growth Offer`), audience: String(input.audience || service.sales.idealFor), headline: String(input.headline || service.sales.hook), promise: service.sales.offer, offer, objectionHandler: "Primero aclaramos objetivo, alcance y métrica; después decides si avanzar.", deliverables: service.deliverables.slice(0, 4), price, discount, cta: String(input.cta || "Agenda una llamada de diagnóstico"), channels: Array.isArray(input.channels) && input.channels.length ? input.channels : ["email", "linkedin", "instagram", "website"], status: "DRAFT", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
}
function campaignFor(input = {}) {
  const service = recommendService(input);
  const promotion = input.promotionId ? promotions.find(item => item.id === input.promotionId) : null;
  return {id: crypto.randomUUID(), name: String(input.name || `${service.name} · lead generation campaign`), serviceId: service.id, service: service.name, promotionId: promotion?.id || null, objective: String(input.objective || "captar leads cualificados"), audience: String(input.audience || service.sales.idealFor), message: service.sales.hook, promise: service.sales.offer, objectionHandler: "Sin promesas infladas: primero diagnóstico, luego alcance y presupuesto claros.", cta: String(input.cta || "Agenda un diagnóstico"), contentPillars: ["problema y coste de no actuar", "mecanismo de solución", "invitación a diagnóstico"], channels: Array.isArray(input.channels) && input.channels.length ? input.channels : ["email", "linkedin", "instagram", "website"], status: "DRAFT", mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", budget: Number(input.budget || 0), assets: [], publications: [], leads: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
}
function servicePackagesFor(service) {
  const base = Number(service?.startingFrom || 0);
  const monthly = ["MONTHLY", "RETAINER"].includes(service?.model);
  return [
    {id: `${service.id}-starter`, name: "Starter", price: base, currency: service.currency || "USD", billing: monthly ? "monthly" : "one_time", scope: service.deliverables.slice(0, 2), bestFor: "validar la oportunidad con un alcance controlado"},
    {id: `${service.id}-growth`, name: "Growth", price: Math.round(base * 1.8), currency: service.currency || "USD", billing: monthly ? "monthly" : "one_time", scope: service.deliverables.slice(0, 4), bestFor: "crear un sistema completo orientado a conversión"},
    {id: `${service.id}-premium`, name: "Premium", price: Math.round(base * 3), currency: service.currency || "USD", billing: monthly ? "monthly" : "one_time", scope: [...service.deliverables, "reporting y optimización"], bestFor: "equipos que necesitan estrategia, ejecución y continuidad"}
  ];
}
const LEAD_STATUSES = ["NEW", "CONTACTED", "RESPONDED", "QUALIFIED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "UNSUBSCRIBED"];
const LEAD_TRANSITIONS = {NEW: ["CONTACTED", "LOST", "UNSUBSCRIBED"], CONTACTED: ["RESPONDED", "QUALIFIED", "LOST", "UNSUBSCRIBED"], RESPONDED: ["QUALIFIED", "MEETING", "LOST", "UNSUBSCRIBED"], QUALIFIED: ["MEETING", "PROPOSAL", "LOST", "UNSUBSCRIBED"], MEETING: ["PROPOSAL", "QUALIFIED", "LOST"], PROPOSAL: ["NEGOTIATION", "WON", "LOST"], NEGOTIATION: ["WON", "LOST"], WON: [], LOST: ["NEW"], UNSUBSCRIBED: []};
function pipelineStageFor(status) { return LEAD_STATUSES.includes(String(status || "").toUpperCase()) ? String(status).toUpperCase() : "NEW"; }
function canTransitionLead(from, to) { return from === to || (LEAD_TRANSITIONS[from] || []).includes(to); }
function createApproval(type, targetId, payload = {}) {
  const approval = {id: crypto.randomUUID(), type, targetId, status: "PENDING", payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
  approvals.unshift(approval); addActivity("approval_requested", {approvalId: approval.id, type, targetId}, null); persist(); return approval;
}
function leadPipeline() {
  const counts = Object.fromEntries(LEAD_STATUSES.map(status => [status, 0]));
  leads.forEach(lead => { const status = pipelineStageFor(lead.status); counts[status] = (counts[status] || 0) + 1; });
  return {stages: counts, conversion: {contactedToResponded: rate(counts.RESPONDED, counts.CONTACTED + counts.RESPONDED), qualifiedToProposal: rate(proposals.filter(item => ["SENT", "APPROVED", "WON"].includes(item.status)).length, Math.max(1, counts.QUALIFIED + counts.PROPOSAL + counts.NEGOTIATION + counts.WON)), proposalToWon: rate(counts.WON, counts.PROPOSAL + counts.NEGOTIATION + counts.WON)}};
}
function rate(numerator, denominator) { return denominator ? Math.round((Number(numerator || 0) / Number(denominator || 1)) * 100) : 0; }
function followupDueForLead(lead) { return touchpoints.filter(item => item.leadId === lead.id && ["DUE", "QUEUED"].includes(item.status)).sort((a, b) => Date.parse(a.scheduledAt || 0) - Date.parse(b.scheduledAt || 0))[0] || null; }
function dailyOutboundCount() {
  const today = new Date().toISOString().slice(0, 10);
  return emailLog.filter(item => item.createdAt?.slice(0, 10) === today && ["SENT", "DELIVERED", "MOCK"].includes(item.status)).length;
}
function assetModel(kind, requested) { if (requested) return requested; return ({image: "nano-banana", video: "seedance-lite-t2v", image_to_video: "seedance-lite-i2v", audio: "suno-create-music", lipsync: "kling-v2-avatar-pro"}[kind] || undefined); }
async function generateServiceAsset(input = {}) {
  const service = recommendService(input);
  const kind = String(input.kind || (service.category === "VIDEO" ? "video" : service.category === "CONTENT" ? "image" : "image")).toLowerCase();
  const prompt = String(input.prompt || `Create a premium sales asset for ${service.name}. Audience: ${input.audience || service.sales.idealFor}. Offer: ${service.sales.offer}. Hook: ${service.sales.hook}. Include a clear but tasteful CTA: ${input.cta || "Book a discovery call with BoostifyDev"}. Brand: dark futuristic AEGIS command center, warm human, credible, conversion focused.`);
  const result = await mediaRequest(`/api/generate/${kind}`, {method: "POST", body: {model: assetModel(kind, input.model), prompt, variables: {service: service.name, audience: input.audience || service.sales.idealFor}, negativePrompt: "generic stock look, unreadable text, fake testimonials, exaggerated claims"}});
  const job = result.body?.job || {};
  const asset = {id: crypto.randomUUID(), serviceId: service.id, service: service.name, campaignId: input.campaignId || null, kind, model: job.model || input.model || null, prompt, mediaJobId: job.id || null, requestId: job.requestId || null, status: result.ok ? String(job.status || "queued").toUpperCase() : "FAILED", outputUrl: job.outputUrl || null, provider: job.provider || (MUAPI_CONFIGURED ? "muapi" : "paper"), createdAt: new Date().toISOString(), error: result.ok ? null : result.body?.error || `MEDIA_HTTP_${result.status}`};
  assets.unshift(asset); addActivity("service_asset_generated", {assetId: asset.id, kind, status: asset.status}, null); emit("service_asset_requested", {assetId: asset.id, serviceId: service.id, kind, mediaJobId: asset.mediaJobId}, .6); persist(); return {asset, media: result.body};
}
async function createPublication(input = {}) {
  const service = recommendService(input);
  const publication = {id: crypto.randomUUID(), serviceId: service.id, service: service.name, campaignId: input.campaignId || null, assetId: input.assetId || null, channel: String(input.channel || "linkedin"), title: String(input.title || `${service.name} · ${service.sales.hook}`), copy: String(input.copy || `${service.sales.hook} ${service.sales.offer} ${input.cta || "Agenda un diagnóstico"}. Audiencia: ${input.audience || service.sales.idealFor}. Siguiente paso: responde y te enviamos una recomendación inicial.`), status: "DRAFT", scheduledFor: input.scheduledFor || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
  const media = await mediaRequest("/api/content", {method: "POST", body: {title: publication.title, body: publication.copy, copy: publication.copy, channel: publication.channel, serviceId: service.id, campaignId: publication.campaignId, assetId: publication.assetId, status: "draft", source: "services-brain", score: .8}}).catch(error => ({ok: false, body: {error: error.message}}));
  publication.mediaContentId = media.body?.content?.id || null; publication.mediaStatus = media.ok ? "DRAFT_CREATED" : "MEDIA_UNAVAILABLE"; publications.unshift(publication); addActivity("publication_drafted", {publicationId: publication.id, channel: publication.channel}, null); persist(); return publication;
}
async function executeCommercialCommand(command, input = {}) {
  const text = String(command || "").trim();
  const query = text.toLowerCase();
  const wantsAction = /(crea|crear|genera|generar|prepara|preparar|haz|hacer|lanza|construye|ejecuta|ordena)/.test(query);
  if (!wantsAction) return null;
  const service = recommendService({...input, goal: `${input.goal || ""} ${text}`});
  const workflow = {};
  if (/(promoc|oferta|promotion)/.test(query)) {
    const promotion = promotionFor(service, {...input, name: input.name || `${service.name} · Conversión`, audience: input.audience || service.sales.idealFor, headline: input.headline || service.sales.hook});
    promotions.unshift(promotion); emit("service_promotion_created", {promotionId: promotion.id, serviceId: service.id, source: "brain-command"}, .7); workflow.promotion = promotion;
  }
  if (/(campañ|campan|campaign)/.test(query)) {
    const campaign = campaignFor({...input, serviceId: service.id, promotionId: workflow.promotion?.id || input.promotionId, name: input.name || `${service.name} · Brain campaign`, objective: input.objective || "captar y convertir leads cualificados"});
    campaigns.unshift(campaign); emit("service_campaign_created", {campaignId: campaign.id, serviceId: service.id, source: "brain-command"}, .7); workflow.campaign = campaign;
  }
  if (/(muapi|asset|creativ|imagen|video|audio|visual)/.test(query)) {
    const kind = input.kind || (/video/.test(query) ? "video" : /audio|voz/.test(query) ? "audio" : "image");
    workflow.asset = await generateServiceAsset({...input, serviceId: service.id, campaignId: workflow.campaign?.id || input.campaignId, kind, audience: input.audience || service.sales.idealFor, prompt: input.prompt || `Asset de venta para ${service.name}. ${service.sales.hook}. Oferta: ${service.sales.offer}. CTA: ${input.cta || "Agenda un diagnóstico"}.`});
  }
  if (/(publica|publicación|publicacion|post|linkedin|instagram|tiktok)/.test(query)) {
    workflow.publication = await createPublication({...input, serviceId: service.id, campaignId: workflow.campaign?.id || input.campaignId, assetId: workflow.asset?.asset?.id || input.assetId, channel: input.channel || (query.includes("instagram") ? "instagram" : query.includes("tiktok") ? "tiktok" : "linkedin")});
  }
  if (!Object.keys(workflow).length) return null;
  persist();
  const parts = [workflow.promotion && "promoción", workflow.campaign && "campaña", workflow.asset && "asset MuAPI", workflow.publication && "publicación"].filter(Boolean);
  return {action: "commercial_workflow_executed", result: workflow, reply: `Services Brain ejecutó: ${parts.join(" + ")}. Todo quedó registrado y los pasos de publicación/envío permanecen sujetos a aprobación.`};
}
async function resendRequest(endpoint, options = {}) {
  if (!RESEND_API_KEY) return {configured: false, status: 0, body: {error: "RESEND_API_KEY_NOT_CONFIGURED"}};
  const response = await fetch(`https://api.resend.com${endpoint}`, {method: options.method || "GET", headers: {accept: "application/json", authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json", ...(options.headers || {})}, body: options.body ? JSON.stringify(options.body) : undefined, signal: AbortSignal.timeout(options.timeoutMs || 12000)});
  const body = await response.json().catch(() => ({}));
  return {configured: true, status: response.status, ok: response.ok, body};
}
async function stripeRequest(endpoint, body = {}) {
  if (!STRIPE_SECRET_KEY) return {configured: false, status: 0, body: {error: "STRIPE_SECRET_KEY_NOT_CONFIGURED"}};
  const encoded = new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value)]));
  const response = await fetch(`https://api.stripe.com${endpoint}`, {method: "POST", headers: {authorization: `Bearer ${STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded"}, body: encoded, signal: AbortSignal.timeout(15000)});
  const result = await response.json().catch(() => ({})); return {configured: true, status: response.status, ok: response.ok, body: result};
}
function normalizedEmail(value) { return String(value || "").trim().toLowerCase(); }
function unsubscribeToken(email) { return crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(normalizedEmail(email)).digest("hex"); }
function unsubscribeUrl(email) { return `${SERVICES_PUBLIC_URL}/api/crm/unsubscribe?email=${encodeURIComponent(normalizedEmail(email))}&token=${unsubscribeToken(email)}`; }
function senderFor(tags = []) {
  if (!RESEND_OUTREACH_POOL.length) return `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`;
  const index = Math.abs([...tags.join(":"), ...new Date().toISOString().slice(0, 10)].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % RESEND_OUTREACH_POOL.length;
  const [email, name] = RESEND_OUTREACH_POOL[index].split("|").map(value => value.trim());
  return name ? `${name} <${email}>` : email;
}
function complianceFooter(email) {
  const url = unsubscribeUrl(email);
  return {html: `<hr style="border:0;border-top:1px solid #edf0f4;margin:24px 0 14px"><p style="font-size:11px;color:#7a8597">Si no quieres recibir más mensajes, <a href="${url}">darte de baja</a>.</p>`, text: `\n\nNo quieres recibir más mensajes? Cancela aquí: ${url}`, headers: {"List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}};
}
async function sendEmail({to, subject, html, text, leadId = null, replyTo = RESEND_REPLY_TO_EMAIL, idempotencyKey = crypto.randomUUID(), tags = []}) {
  if (dailyOutboundCount() >= SERVICES_MAX_OUTREACH_PER_DAY) throw new Error("OUTREACH_DAILY_LIMIT_REACHED");
  const duplicate = emailLog.find(item => item.idempotencyKey === idempotencyKey || (leadId && item.leadId === leadId && item.subject === String(subject || "BoostifyDev Services") && Date.now() - Date.parse(item.createdAt || 0) < 3600000));
  if (duplicate) return {record: duplicate, provider: duplicate.mode === "RESEND" ? "resend" : "paper", deduplicated: true};
  const recipients = (Array.isArray(to) ? to : [to]).map(normalizedEmail).filter(value => /\S+@\S+\.\S+/.test(value) && !suppressionList.some(item => item.email === value && item.status === "ACTIVE"));
  if (!recipients.length) throw new Error("EMAIL_RECIPIENT_REQUIRED");
  const footer = complianceFooter(recipients[0]);
  const payload = {from: senderFor(tags), to: recipients, reply_to: replyTo, subject: String(subject || "BoostifyDev Services"), html: `${String(html || "")}${footer.html}`, text: `${String(text || "")}${footer.text}`, headers: footer.headers, ...(tags.length ? {tags: tags.map(tag => typeof tag === "string" ? {name: "campaign", value: tag} : tag)} : {})};
  const result = await resendRequest("/emails", {method: "POST", body: payload, headers: {"Idempotency-Key": idempotencyKey}});
  const record = {id: crypto.randomUUID(), resendId: result.body?.id || null, to: recipients, subject: payload.subject, status: result.ok ? "SENT" : result.configured ? "FAILED" : "MOCK", mode: result.configured ? "RESEND" : "PAPER", error: result.ok ? null : result.body?.message || result.body?.error || null, leadId, idempotencyKey, tags, createdAt: new Date().toISOString()};
  emailLog.unshift(record); addActivity("email_sent", {emailId: record.id, status: record.status, subject: record.subject}, leadId); persist();
  if (result.configured && !result.ok) throw new Error(record.error || `RESEND_HTTP_${result.status}`);
  return {record, provider: result.configured ? "resend" : "paper"};
}
function salesEmailHtml({firstName, serviceName, company, price, deliverables, hook, offer, cta}) {
  return `<div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e3e8f0;border-radius:14px;overflow:hidden"><div style="background:#081421;padding:24px 28px;color:#fff"><div style="font-size:11px;letter-spacing:2px;color:#ff9d76">BOOSTIFYDEV SERVICES</div><h1 style="font-size:24px;line-height:1.2;margin:14px 0 0">Una ruta concreta para producir negocio</h1></div><div style="padding:28px"><p style="font-size:16px;margin-top:0">Hola ${escapeHtml(firstName)},</p><p>Te escribo sobre <strong>${escapeHtml(serviceName)}</strong>${escapeHtml(company)}.</p><p>${escapeHtml(hook || "La ejecución debe estar conectada con una oportunidad comercial real.")}</p><div style="background:#f6f8fb;border-left:4px solid #ff8b5b;padding:15px 16px;margin:22px 0"><strong>Enfoque:</strong><br/>${escapeHtml(offer || "Convertir tu objetivo en un alcance claro, ejecutable y medible.")}<br/><span style="color:#657086;font-size:13px">${escapeHtml(price)} · ${escapeHtml(deliverables || "Estrategia · ejecución · medición")}</span></div><p>Para darte una recomendación útil, solo necesito tres datos: qué quieres vender, quién debe comprarlo y qué fecha tienes en mente.</p><a href="mailto:${escapeHtml(RESEND_REPLY_TO_EMAIL)}?subject=${encodeURIComponent(`Re: ${serviceName}`)}" style="display:inline-block;background:#ff8b5b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">${escapeHtml(cta)}</a><p style="font-size:13px;color:#68758a;margin-bottom:0">Si ahora no es prioridad, responde “más adelante” y respetamos tu espacio.</p></div><div style="padding:16px 28px;border-top:1px solid #edf0f4;color:#7a8597;font-size:12px">${escapeHtml(RESEND_FROM_NAME)} · ${escapeHtml(RESEND_FROM_EMAIL)}</div></div></div>`;
}
function salesEmailFor(lead, service, stage = "initial") {
  const firstName = String(lead?.name || "").trim().split(/\s+/)[0] || "Hola";
  const serviceName = service?.name || "tu proyecto digital";
  const playbook = service?.sales || {};
  const company = lead?.company ? ` para ${lead.company}` : "";
  const price = service?.startingFrom ? `Desde ${service.startingFrom.toLocaleString("en-US")} USD` : "Alcance a medida";
  const deliverables = (service?.deliverables || []).slice(0, 3).join(" · ");
  if (stage === "follow_up_value") return {subject: `${firstName}, te dejo una ruta concreta para avanzar`, text: `Hola ${firstName}. Te escribo con algo útil sobre ${serviceName}${company}: 1) definir la oferta y la acción principal, 2) construir una experiencia clara y 3) medir qué convierte. El punto de partida es ${price} e incluye ${deliverables || "estrategia, ejecución y medición"}. Si me respondes con tu objetivo y fecha, te devuelvo una recomendación concreta. Si ahora no es prioridad, dime “más adelante” y cierro el seguimiento.`, html: salesEmailHtml({firstName, serviceName, company, price, deliverables, hook: playbook.hook, offer: playbook.offer, cta: "Responder con objetivo y fecha"})};
  if (stage === "case_study_or_scope") return {subject: `La decisión clave antes de invertir en ${serviceName.toLowerCase()}`, text: `Hola ${firstName}. Antes de invertir en ${serviceName}, conviene resolver qué resultado debe producir y cómo lo mediremos. En una llamada breve puedo ordenar alcance, prioridades y próximos pasos. Responde “diagnóstico” y te envío las preguntas exactas.`, html: salesEmailHtml({firstName, serviceName, company, price, deliverables, hook: "La claridad de alcance protege el presupuesto y acelera la decisión.", offer: "Diagnóstico comercial y técnico orientado a una recomendación accionable.", cta: "Responder: diagnóstico"})};
  if (stage === "close_loop_or_referral") return {subject: `${firstName}, cierro este hilo por ahora`, text: `Hola ${firstName}. Cierro este hilo para no llenarte la bandeja. Si ${serviceName} vuelve a ser prioridad, responde a este correo y retomamos desde aquí. También puedes decirme quién lleva este tema y le escribo una sola vez con el contexto correcto.`, html: salesEmailHtml({firstName, serviceName, company, price, deliverables, hook: "Un buen seguimiento también sabe cuándo dejar espacio.", offer: "Retomamos cuando exista una prioridad y un resultado claro.", cta: "Retomar conversación"})};
  return {subject: `${firstName}, una propuesta concreta para ${serviceName.toLowerCase()}`, text: `Hola ${firstName}. Vi tu interés en ${serviceName}${company}. La oportunidad no es hacer una pieza aislada: es conectar ${serviceName.toLowerCase()} con una oferta, una acción clara y una forma de medir si genera oportunidades. ${playbook.hook || "Podemos convertir tu objetivo en un siguiente paso concreto."} El punto de partida es ${price}, con ${deliverables || "alcance, ejecución y medición"}. ¿Me respondes con 1) qué quieres vender, 2) a quién y 3) cuándo te gustaría verlo funcionando? Con eso te envío una recomendación inicial, sin rodeos.`, html: salesEmailHtml({firstName, serviceName, company, price, deliverables, hook: playbook.hook, offer: playbook.offer, cta: "Responder con objetivo, audiencia y fecha"})};
}
async function processDueTouchpoints() {
  const run = {id: crypto.randomUUID(), type: "touchpoint_worker", status: "RUNNING", startedAt: new Date().toISOString(), sent: 0}; jobRuns.unshift(run);
  if (!SERVICES_AUTOMATION_ENABLED) { run.status = "APPROVAL_ONLY"; run.finishedAt = new Date().toISOString(); persist(); return {enabled: false, sent: 0}; }
  const now = Date.now(); let sent = 0;
  for (const touchpoint of touchpoints.filter(item => ["DUE", "QUEUED"].includes(item.status))) {
    if (dailyOutboundCount() >= SERVICES_MAX_OUTREACH_PER_DAY) break;
    const scheduled = Date.parse(touchpoint.scheduledAt || touchpoint.createdAt || "") || now;
    if (scheduled > now) continue;
    const lead = findLead(touchpoint.leadId); if (!lead || !lead.email || lead.consent === false || ["WON", "LOST", "UNSUBSCRIBED"].includes(lead.status) || lead.status === "RESPONDED") { touchpoint.status = "SKIPPED"; continue; }
    touchpoint.status = "PROCESSING";
    try { const template = salesEmailFor(lead, findService(lead.serviceId), touchpoint.action); await sendEmail({to: lead.email, subject: template.subject, html: template.html, text: template.text, leadId: lead.id, tags: ["services-sequence", touchpoint.action]}); touchpoint.status = "SENT"; touchpoint.sentAt = new Date().toISOString(); lead.updatedAt = new Date().toISOString(); sent++; addActivity("sequence_email_sent", {touchpointId: touchpoint.id, step: touchpoint.step}, lead.id); }
    catch (error) { touchpoint.status = "ERROR"; touchpoint.error = error.message; addActivity("sequence_email_error", {touchpointId: touchpoint.id, error: error.message}, lead.id); }
  }
  run.sent = sent; run.status = "COMPLETED"; run.finishedAt = new Date().toISOString(); if (sent) persist(); else persist(); return {enabled: true, sent};
}
async function connector(url, name) {
  try {
    const response = await fetch(`${url}/health`, {signal: AbortSignal.timeout(1800)});
    return {id: name, url, status: response.ok ? "online" : "degraded", health: response.ok ? await response.json().catch(() => ({})) : null};
  } catch (error) { return {id: name, url, status: "offline", error: error.message}; }
}
async function systemConnectors() {
  const definitions = [["finance", FINANCE_URL], ["commerce", COMMERCE_URL], ["saas", SAAS_URL], ["media", MEDIA_URL], ["manager", MANAGER_URL], ["ceo", CEO_URL]];
  const values = await Promise.all(definitions.map(([name, url]) => connector(url, name)));
  return Object.fromEntries(values.map(value => [value.id, value]));
}
async function context() {
  const connectors = await systemConnectors();
  return {generatedAt: new Date().toISOString(), mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", automation: {enabled: SERVICES_AUTOMATION_ENABLED, approvalRequired: SERVICES_REQUIRE_APPROVAL || !SERVICES_AUTOMATION_ENABLED, intervalSeconds: 30}, services, agents, leads: leads.slice(0, 30), proposals: proposals.slice(0, 30), projects: projects.slice(0, 30), promotions: promotions.slice(0, 20), campaigns: campaigns.slice(0, 20), publications: publications.slice(0, 20), assets: assets.slice(0, 20), connectors, pipeline: pipelineSummary(), pendingApprovals: approvals.filter(item => item.status === "PENDING").slice(0, 20), tooling: Object.fromEntries([...Object.entries(connectors).map(([id, item]) => [id, item.status]), ["resend", RESEND_API_KEY ? "configured" : "paper"], ["muapi", MUAPI_CONFIGURED ? "configured" : "paper"], ["stripe", STRIPE_SECRET_KEY ? "configured" : "paper"]]), kpis: kpis()};
}
function kpis() {
  return {serviceCount: services.length, availableServices: services.filter(item => item.status === "available").length, leads: leads.length, hotLeads: leads.filter(item => item.tier === "HOT" || Number(item.score) >= 75).length, warmLeads: leads.filter(item => item.tier === "WARM" || (Number(item.score) >= 45 && Number(item.score) < 75)).length, proposals: proposals.length, proposalsSent: proposals.filter(item => ["SENT", "APPROVED", "WON"].includes(item.status)).length, won: leads.filter(item => ["WON", "CLIENT"].includes(item.status)).length, activeProjects: projects.filter(item => !["DONE", "CANCELLED"].includes(item.status)).length, pipeline: proposals.filter(item => !["CANCELLED", "LOST"].includes(item.status)).reduce((total, item) => total + Number(item.amount || 0), 0), contacts: leads.length, activities: activities.length, emailsSent: emailLog.filter(item => ["SENT", "MOCK", "DELIVERED"].includes(item.status)).length, suppressed: suppressionList.filter(item => item.status === "ACTIVE").length, promotions: promotions.length, campaigns: campaigns.length, publications: publications.length, assets: assets.length, followupsDue: touchpoints.filter(item => item.status === "DUE").length, followupsQueued: touchpoints.filter(item => ["DUE", "QUEUED"].includes(item.status)).length, muapiJobs: assets.filter(item => item.mediaJobId).length, pendingApprovals: approvals.filter(item => item.status === "PENDING").length, dailyOutbound: dailyOutboundCount(), automationEnabled: SERVICES_AUTOMATION_ENABLED, approvalRequired: SERVICES_REQUIRE_APPROVAL};
}
async function emailStatus() {
  const result = await resendRequest("/domains");
  const domains = Array.isArray(result.body?.data) ? result.body.data.map(domain => ({id: domain.id, name: domain.name, status: domain.status, region: domain.region})) : [];
  const match = domains.find(domain => domain.name === RESEND_DOMAIN);
  return {provider: "resend", configured: Boolean(RESEND_API_KEY), from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`, domain: RESEND_DOMAIN, domainStatus: match?.status || "NOT_FOUND", verified: match?.status === "verified", domains, error: result.ok === false ? result.body?.message || result.body?.error || `RESEND_HTTP_${result.status}` : null};
}
function pipelineSummary() {
  const byStatus = leads.reduce((acc, lead) => { const key = lead.status || "NEW"; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
  return {...leadPipeline(), stages: byStatus, newLeads: leads.filter(lead => lead.status === "NEW").length, qualified: leads.filter(lead => ["QUALIFIED", "PROPOSAL"].includes(lead.status)).length, won: leads.filter(lead => ["WON", "CLIENT"].includes(lead.status)).length, lost: leads.filter(lead => lead.status === "LOST").length, pipeline: kpis().pipeline};
}
function fallback(message) {
  const query = message.toLowerCase();
  if (query.includes("web") || query.includes("pagina") || query.includes("landing")) return "Puedo venderte Páginas web & landing pages desde $900 USD, con arquitectura, diseño responsive, implementación y analytics. Para cotizar bien necesito objetivo, tipo de negocio y fecha deseada.";
  if (query.includes("video") || query.includes("music") || query.includes("musical") || query.includes("reel")) return "Tenemos Videos corporativos, Music videos y paquetes de Reels/TikTok. Puedo preparar una propuesta PAPER con alcance, entregables, presupuesto y calendario.";
  if (query.includes("seo") || query.includes("posicionamiento")) return "SEO & posicionamiento empieza desde $650 USD al mes e incluye auditoría, mapa de keywords, on-page y roadmap mensual.";
  if (query.includes("precio") || query.includes("cotiza") || query.includes("presupuesto")) return `Tengo ${services.length} servicios listos para cotizar. Las propuestas se crean en modo PAPER y el pipeline actual suma $${kpis().pipeline.toLocaleString("en-US")} USD.`;
  if (query.includes("lead") || query.includes("cliente") || query.includes("captaci")) return `Services Brain tiene ${leads.length} leads, ${kpis().hotLeads} calientes y ${kpis().warmLeads} tibios. Puedo importar contactos públicos, puntuarlos, recomendar servicio y preparar el siguiente contacto.`;
  if (query.includes("promoc") || query.includes("oferta")) return `Hay ${promotions.length} promociones en el sistema. Puedo crear una oferta por servicio con audiencia, CTA, canales y assets en draft.`;
  if (query.includes("public") || query.includes("campaña") || query.includes("campana")) return `Hay ${campaigns.length} campañas y ${publications.length} publicaciones draft. La distribución queda en cola de aprobación para evitar envíos o publicaciones no autorizadas.`;
  if (query.includes("asset") || query.includes("muapi") || query.includes("imagen")) return `Media Brain está conectado como generador. Hay ${assets.length} assets registrados y ${MUAPI_CONFIGURED ? "MuAPI configurado" : "MuAPI pendiente de credencial"}.`;
  if (query.includes("proyecto")) return `El sistema tiene ${leads.length} leads, ${proposals.length} propuestas y ${kpis().activeProjects} proyectos activos. Puedo convertir una oportunidad en propuesta y después en proyecto.`;
  return "Services Brain vende y coordina páginas web, SEO, videos, music videos, contenido, branding, e-commerce, SaaS, ads, agentes de IA y soporte. Dime qué quieres vender, crear o cotizar y te llevo al siguiente paso.";
}

app.get("/health", (req, res) => res.json({name: NAME, kind: KIND, version: VERSION, status: "online", mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", automation: {enabled: SERVICES_AUTOMATION_ENABLED, approvalRequired: SERVICES_REQUIRE_APPROVAL || !SERVICES_AUTOMATION_ENABLED, intervalSeconds: 30}, agentsOnline: agents.length, agentsTotal: agents.length, serviceCount: services.length, processed: state.processed, security: {apiTokenConfigured: Boolean(API_TOKEN), allowedOrigins: ALLOWED_ORIGINS, rateLimitPerMinute: SERVICES_RATE_LIMIT_PER_MINUTE}, outbound: {dailyCount: dailyOutboundCount(), dailyLimit: SERVICES_MAX_OUTREACH_PER_DAY}}));
app.get("/api/agents", (req, res) => res.json(agents));
app.get("/api/events", (req, res) => res.json(events.slice(0, 100)));
app.get("/api/services", (req, res) => res.json(services));
app.get("/api/services/:id", (req, res) => { const service = findService(req.params.id); return service ? res.json(service) : res.status(404).json({error: "SERVICE_NOT_FOUND"}); });
app.get("/api/services/:id/packages", (req, res) => { const service = findService(req.params.id); return service ? res.json({ok: true, service: service.name, packages: servicePackagesFor(service)}) : res.status(404).json({error: "SERVICE_NOT_FOUND"}); });
app.get("/api/service-packages", (req, res) => res.json({ok: true, packages: services.flatMap(service => servicePackagesFor(service).map(item => ({...item, serviceId: service.id, service: service.name})))}));
app.get("/api/leads", (req, res) => res.json(leads));
app.get("/api/leads/queue", (req, res) => {
  const status = String(req.query.status || "").toUpperCase();
  const tier = String(req.query.tier || "").toUpperCase();
  const items = leads.filter(lead => (!status || lead.status === status) && (!tier || lead.tier === tier)).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  res.json({ok: true, items, total: items.length});
});
app.get("/api/proposals", (req, res) => res.json(proposals));
app.get("/api/projects", (req, res) => res.json(projects));
app.get("/api/promotions", (req, res) => res.json(promotions));
app.get("/api/campaigns", (req, res) => res.json(campaigns));
app.get("/api/publications", (req, res) => res.json(publications));
app.get("/api/assets", async (req, res) => { const before = assets.slice(0, 50).map(item => `${item.id}:${item.status}:${item.outputUrl || ""}:${item.error || ""}`); await Promise.all(assets.slice(0, 50).map(refreshAsset)); const after = assets.slice(0, 50).map(item => `${item.id}:${item.status}:${item.outputUrl || ""}:${item.error || ""}`); if (before.join("|") !== after.join("|")) persist(); res.json(assets); });
app.get("/api/research-runs", (req, res) => res.json(researchRuns));
app.get("/api/touchpoints", (req, res) => res.json(touchpoints));
app.get("/api/approvals", (req, res) => { const status = String(req.query.status || "").toUpperCase(); res.json(approvals.filter(item => !status || item.status === status).slice(0, 100)); });
app.get("/api/automation/status", (req, res) => res.json({ok: true, enabled: SERVICES_AUTOMATION_ENABLED, approvalRequired: SERVICES_REQUIRE_APPROVAL || !SERVICES_AUTOMATION_ENABLED, intervalSeconds: 30, dailyOutbound: dailyOutboundCount(), dailyLimit: SERVICES_MAX_OUTREACH_PER_DAY, dueTouchpoints: touchpoints.filter(item => item.status === "DUE").length, queuedTouchpoints: touchpoints.filter(item => item.status === "QUEUED").length, lastRuns: jobRuns.slice(0, 20)}));
app.get("/api/revenue-formulas", (req, res) => res.json([
  {id: "diagnostic-to-project", name: "Diagnóstico → proyecto", formula: "lead cualificado × tasa de cierre × ticket medio", inputs: ["hotLeads", "closeRate", "averageTicket"], status: "READY"},
  {id: "content-retainer", name: "Contenido recurrente", formula: "clientes de contenido × retainer mensual × retención", inputs: ["contentClients", "monthlyRetainer", "retention"], status: "READY"},
  {id: "web-to-growth", name: "Web → growth retainer", formula: "proyectos web × attach rate SEO/ads × MRR", inputs: ["webProjects", "attachRate", "monthlyRetainer"], status: "READY"}
]));
app.get("/api/kpis", (req, res) => res.json(kpis()));
app.get("/api/summary", async (req, res) => res.json({...await context(), state}));
app.get("/api/connectors/status", async (req, res) => res.json((await context()).connectors));
app.get("/api/integrations/status", async (req, res) => res.json({brains: (await context()).connectors, email: await emailStatus(), muapi: {configured: MUAPI_CONFIGURED, provider: "MuAPI", mode: MUAPI_CONFIGURED ? "REMOTE_API" : "PAPER"}, stripe: {configured: Boolean(STRIPE_SECRET_KEY), mode: STRIPE_SECRET_KEY ? "CHECKOUT_READY" : "PAPER"}, social: Object.fromEntries(Object.entries(SOCIAL_CONNECTORS).map(([id, configured]) => [id, {configured, mode: configured ? "DRAFT_READY" : "CREDENTIALS_NEEDED"}]))}));
app.get("/api/analytics/funnel", (req, res) => {
  const stageCounts = leads.reduce((acc, lead) => { const stage = lead.status || "NEW"; acc[stage] = (acc[stage] || 0) + 1; return acc; }, {});
  const servicePerformance = services.map(service => { const serviceLeads = leads.filter(lead => lead.serviceId === service.id); const serviceProposals = proposals.filter(item => item.serviceId === service.id); return {serviceId: service.id, service: service.name, leads: serviceLeads.length, proposals: serviceProposals.length, won: serviceLeads.filter(item => ["WON", "CLIENT"].includes(item.status)).length, pipeline: serviceProposals.reduce((sum, item) => sum + Number(item.amount || 0), 0)}; }).filter(item => item.leads || item.proposals);
  res.json({ok: true, generatedAt: new Date().toISOString(), stages: stageCounts, servicePerformance, campaigns: campaigns.map(item => ({id: item.id, name: item.name, status: item.status, channels: item.channels, publications: item.publications?.length || 0})), emails: {sent: emailLog.filter(item => ["SENT", "DELIVERED"].includes(item.status)).length, bounced: emailLog.filter(item => item.status === "BOUNCED").length, complaints: emailLog.filter(item => item.status === "COMPLAINT").length, suppressed: suppressionList.filter(item => item.status === "ACTIVE").length}});
});
app.get("/api/analytics/attribution", (req, res) => {
  const sources = new Map();
  leads.forEach(lead => { const key = lead.attribution?.channel || lead.source || "unknown"; const item = sources.get(key) || {source: key, leads: 0, qualified: 0, won: 0, proposals: 0, pipeline: 0}; item.leads += 1; if (["QUALIFIED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"].includes(lead.status)) item.qualified += 1; if (["WON", "CLIENT"].includes(lead.status)) item.won += 1; const leadProposals = proposals.filter(proposal => proposal.leadId === lead.id || proposal.email === lead.email); item.proposals += leadProposals.length; item.pipeline += leadProposals.reduce((sum, proposal) => sum + Number(proposal.amount || 0), 0); sources.set(key, item); });
  res.json({ok: true, generatedAt: new Date().toISOString(), sources: [...sources.values()].sort((a, b) => b.pipeline - a.pipeline), campaigns: campaigns.map(item => ({id: item.id, name: item.name, status: item.status, leads: item.leads?.length || 0, channel: item.channels}))});
});
app.get("/api/analytics/retention", (req, res) => {
  const active = projects.filter(item => !["DONE", "CANCELLED"].includes(item.status));
  const opportunities = leads.filter(item => ["WON", "CLIENT"].includes(item.status)).map(lead => ({leadId: lead.id, client: lead.company || lead.name, currentService: lead.service, nextBestOffers: services.filter(service => service.id !== lead.serviceId).slice(0, 3).map(service => ({serviceId: service.id, service: service.name, reason: "cross-sell basado en el servicio actual"}))}));
  res.json({ok: true, activeProjects: active.length, clientHealth: clientHealth.slice(0, 100), opportunities});
});
app.get("/api/analytics/unit-economics", (req, res) => {
  const rows = services.map(service => { const serviceLeads = leads.filter(item => item.serviceId === service.id); const serviceProposals = proposals.filter(item => item.serviceId === service.id); const won = serviceLeads.filter(item => ["WON", "CLIENT"].includes(item.status)).length; const revenue = serviceProposals.filter(item => ["APPROVED", "WON"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0); return {serviceId: service.id, service: service.name, model: service.model, startingFrom: service.startingFrom, leads: serviceLeads.length, proposals: serviceProposals.length, won, pipeline: serviceProposals.reduce((sum, item) => sum + Number(item.amount || 0), 0), bookedRevenue: revenue, closeRate: rate(won, serviceProposals.length), averageTicket: serviceProposals.length ? Math.round(serviceProposals.reduce((sum, item) => sum + Number(item.amount || 0), 0) / serviceProposals.length) : service.startingFrom}; }).sort((a, b) => b.pipeline - a.pipeline);
  res.json({ok: true, generatedAt: new Date().toISOString(), rows});
});
app.get("/api/analytics/forecast", (req, res) => {
  const leadsInput = Math.max(0, Number(req.query.leads || kpis().hotLeads + kpis().warmLeads)); const closeRate = Math.max(0, Math.min(1, Number(req.query.closeRate || .2))); const averageTicket = Math.max(0, Number(req.query.averageTicket || (proposals.length ? kpis().pipeline / proposals.length : 1000))); const monthlyRetainers = Math.max(0, Number(req.query.monthlyRetainers || 0)); const retentionMonths = Math.max(1, Number(req.query.retentionMonths || 3)); const expectedClients = Math.round(leadsInput * closeRate * 100) / 100; const oneTimeRevenue = expectedClients * averageTicket; const recurringRevenue = monthlyRetainers * averageTicket * retentionMonths; res.json({ok: true, assumptions: {leads: leadsInput, closeRate, averageTicket, monthlyRetainers, retentionMonths}, forecast: {expectedClients, oneTimeRevenue: Math.round(oneTimeRevenue), recurringRevenue: Math.round(recurringRevenue), totalExpectedRevenue: Math.round(oneTimeRevenue + recurringRevenue)}});
});
app.get("/api/operations/queue", (req, res) => {
  const now = Date.now(); const due = touchpoints.filter(item => ["DUE", "QUEUED"].includes(item.status)).map(item => ({...item, overdue: (Date.parse(item.scheduledAt || 0) || now) <= now, lead: findLead(item.leadId)})); const projectsDue = projects.filter(item => !["DONE", "CANCELLED"].includes(item.status)).map(item => ({projectId: item.id, clientName: item.clientName, nextAction: item.nextAction, health: item.health || "ONBOARDING"})); res.json({ok: true, generatedAt: new Date().toISOString(), dueTouchpoints: due, projects: projectsDue, approvals: approvals.filter(item => item.status === "PENDING")});
});
app.get("/api/payments/status", (req, res) => res.json({configured: Boolean(STRIPE_SECRET_KEY), provider: "stripe", mode: STRIPE_SECRET_KEY ? "CHECKOUT_READY" : "PAPER"}));
app.get("/api/crm/dashboard", async (req, res) => {
  const [brainContext, email] = await Promise.all([context(), emailStatus()]);
  res.json({ok: true, generatedAt: new Date().toISOString(), kpis: kpis(), pipeline: pipelineSummary(), email, tooling: brainContext.tooling, approvals: approvals.filter(item => item.status === "PENDING").slice(0, 12), recentLeads: leads.slice(0, 12), recentActivities: activities.slice(0, 20), recentEmails: emailLog.slice(0, 12), promotions: promotions.slice(0, 8), campaigns: campaigns.slice(0, 8), publications: publications.slice(0, 8), assets: assets.slice(0, 8), projects: projects.slice(0, 8), services: services.map(service => ({id: service.id, name: service.name, category: service.category, offer: service.sales.offer, tools: service.sales.tools, packages: servicePackagesFor(service)}))});
});
app.get("/api/crm/contacts", (req, res) => res.json(leads));
app.get("/api/crm/pipeline", (req, res) => res.json({ok: true, generatedAt: new Date().toISOString(), pipeline: pipelineSummary(), items: leads.map(lead => ({...lead, nextTouchpoint: followupDueForLead(lead)})).sort((a, b) => Number(b.score || 0) - Number(a.score || 0))}));
app.post("/api/crm/contacts", async (req, res) => {
  if (!String(req.body?.email || "").trim() && !String(req.body?.phone || "").trim()) return res.status(400).json({error: "CONTACT_CHANNEL_REQUIRED"});
  const lead = createLead({...req.body, source: req.body?.source || "crm"});
  let welcome = null;
  if (req.body?.sendWelcome === true && lead.email) {
    const service = findService(lead.serviceId);
    try { welcome = await sendEmail({to: lead.email, leadId: lead.id, subject: `Recibimos tu interés${service ? ` en ${service.name}` : ""}`, html: `<h1>Hola ${escapeHtml(lead.name)}</h1><p>Gracias por escribir a ${escapeHtml(RESEND_FROM_NAME)}. Revisaremos tu objetivo y te responderemos con el siguiente paso.</p>${service ? `<p>Servicio de interés: <strong>${escapeHtml(service.name)}</strong></p>` : ""}`, text: `Hola ${lead.name}. Recibimos tu interés${service ? ` en ${service.name}` : ""}. Te responderemos con el siguiente paso.`}); } catch (error) { welcome = {error: error.message}; }
  }
  res.status(201).json({ok: true, contact: lead, welcome});
});
app.patch("/api/crm/contacts/:id", (req, res) => {
  const lead = findLead(req.params.id); if (!lead) return res.status(404).json({error: "CONTACT_NOT_FOUND"});
  const allowed = ["name", "email", "company", "phone", "website", "industry", "city", "decisionMaker", "serviceId", "status", "score", "budget", "goal", "pain", "signal", "notes", "consent"];
  allowed.forEach(key => { if (req.body?.[key] !== undefined) lead[key] = key === "status" ? String(req.body[key]).toUpperCase() : req.body[key]; });
  if (["website", "industry", "budget", "goal", "pain", "signal", "notes", "serviceId"].some(key => req.body?.[key] !== undefined)) Object.assign(lead, scoreLead(lead), {serviceId: recommendService(lead)?.id || lead.serviceId, service: findService(recommendService(lead)?.id || lead.serviceId)?.name || lead.service});
  lead.updatedAt = new Date().toISOString(); addActivity("contact_updated", {status: lead.status}, lead.id); res.json({ok: true, contact: lead});
});
app.post("/api/crm/contacts/:id/qualify", (req, res) => {
  const lead = findLead(req.params.id); if (!lead) return res.status(404).json({error: "CONTACT_NOT_FOUND"});
  Object.assign(lead, req.body || {}, {updatedAt: new Date().toISOString()});
  Object.assign(lead, scoreLead(lead));
  if (req.body?.status) lead.status = pipelineStageFor(req.body.status);
  if (lead.status === "NEW" && lead.score >= 45) lead.status = "QUALIFIED";
  lead.serviceId = recommendService(lead)?.id || lead.serviceId; lead.service = findService(lead.serviceId)?.name || lead.service;
  addActivity("lead_qualified", {score: lead.score, tier: lead.tier, missing: lead.qualification?.missing || []}, lead.id); persist();
  res.json({ok: true, lead, recommendation: {service: findService(lead.serviceId), nextAction: lead.nextAction, missing: lead.qualification?.missing || []}});
});
app.post("/api/crm/contacts/:id/status", (req, res) => {
  const lead = findLead(req.params.id); if (!lead) return res.status(404).json({error: "CONTACT_NOT_FOUND"});
  const next = pipelineStageFor(req.body?.status); const current = pipelineStageFor(lead.status);
  if (!canTransitionLead(current, next)) return res.status(409).json({error: "LEAD_TRANSITION_NOT_ALLOWED", current, next, allowed: LEAD_TRANSITIONS[current] || []});
  lead.status = next; lead.updatedAt = new Date().toISOString(); if (["CONTACTED", "RESPONDED", "MEETING", "PROPOSAL", "NEGOTIATION"].includes(next)) lead.lastContactAt = new Date().toISOString();
  if (next === "WON") lead.clientSince = lead.clientSince || new Date().toISOString();
  addActivity("lead_status_changed", {from: current, to: next}, lead.id); emit("service_lead_status_changed", {leadId: lead.id, from: current, to: next}, next === "WON" ? .95 : .6); persist(); res.json({ok: true, lead});
});
app.post("/api/crm/contacts/:id/next-action", (req, res) => {
  const lead = findLead(req.params.id); if (!lead) return res.status(404).json({error: "CONTACT_NOT_FOUND"});
  lead.nextAction = String(req.body?.nextAction || "FOLLOW_UP").toUpperCase(); lead.nextActionAt = req.body?.nextActionAt || new Date(Date.now() + 86400000).toISOString(); lead.updatedAt = new Date().toISOString(); addActivity("lead_next_action_set", {nextAction: lead.nextAction, nextActionAt: lead.nextActionAt}, lead.id); persist(); res.json({ok: true, lead});
});
app.get("/api/crm/activities", (req, res) => res.json(activities));
app.post("/api/crm/activities", (req, res) => { const activity = addActivity(String(req.body?.type || "note"), req.body?.payload || {text: String(req.body?.text || "")}, req.body?.leadId || null); res.status(201).json({ok: true, activity}); });
app.get("/api/crm/email/status", async (req, res) => res.json(await emailStatus()));
app.get("/api/crm/email/log", (req, res) => res.json(emailLog));
app.get("/api/crm/suppression", (req, res) => res.json(suppressionList.map(item => ({email: item.email, status: item.status, reason: item.reason, createdAt: item.createdAt}))));
app.all("/api/crm/unsubscribe", (req, res) => {
  const email = normalizedEmail(req.body?.email || req.query?.email); const token = String(req.body?.token || req.query?.token || "");
  if (!email || token !== unsubscribeToken(email)) return res.status(403).json({error: "UNSUBSCRIBE_TOKEN_INVALID"});
  const existing = suppressionList.find(item => item.email === email); if (existing) Object.assign(existing, {status: "ACTIVE", reason: String(req.body?.reason || req.query?.reason || "user_request"), updatedAt: new Date().toISOString()}); else suppressionList.unshift({email, status: "ACTIVE", reason: String(req.body?.reason || req.query?.reason || "user_request"), createdAt: new Date().toISOString()});
  const lead = leads.find(item => normalizedEmail(item.email) === email); if (lead) { lead.status = "UNSUBSCRIBED"; lead.consent = false; lead.updatedAt = new Date().toISOString(); }
  addActivity("email_unsubscribed", {email}, lead?.id || null); persist(); res.json({ok: true, unsubscribed: email});
});
app.post("/api/crm/send-email", async (req, res) => {
  try {
    const result = await sendEmail({to: req.body?.to, subject: req.body?.subject, html: req.body?.html, text: req.body?.text, leadId: req.body?.leadId || null, idempotencyKey: req.body?.idempotencyKey, tags: req.body?.tags || []});
    res.json({ok: true, ...result});
  } catch (error) { res.status(502).json({ok: false, error: "EMAIL_SEND_FAILED", message: error.message}); }
});
app.post("/api/webhooks/resend", (req, res) => {
  if (RESEND_WEBHOOK_SECRET && req.get("x-resend-webhook-secret") !== RESEND_WEBHOOK_SECRET) return res.status(401).json({error: "RESEND_WEBHOOK_UNAUTHORIZED"});
  const event = req.body || {}; const resendId = event.data?.email_id || event.data?.id || event.email_id; const record = emailLog.find(item => item.resendId === resendId);
  if (record) { const type = String(event.type || "").toLowerCase(); record.status = type.includes("delivered") ? "DELIVERED" : type.includes("bounced") ? "BOUNCED" : type.includes("complained") ? "COMPLAINT" : record.status; record.providerEvent = type; record.updatedAt = new Date().toISOString(); persist(); }
  res.json({ok: true, matched: Boolean(record)});
});
app.get("/api/crm/contacts/:id/outreach/preview", (req, res) => {
  const lead = findLead(req.params.id); if (!lead) return res.status(404).json({error: "CONTACT_NOT_FOUND"});
  const service = findService(lead.serviceId); const template = salesEmailFor(lead, service, String(req.query.stage || "initial"));
  res.json({ok: true, from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`, replyTo: RESEND_REPLY_TO_EMAIL, to: lead.email, service: service?.name || null, ...template});
});
app.post("/api/crm/contacts/:id/outreach", async (req, res) => {
  const lead = findLead(req.params.id); if (!lead) return res.status(404).json({error: "CONTACT_NOT_FOUND"}); if (!lead.email) return res.status(400).json({error: "CONTACT_EMAIL_REQUIRED"});
  const service = findService(lead.serviceId); const template = salesEmailFor(lead, service, String(req.body?.stage || "initial"));
  const subject = String(req.body?.subject || template.subject); const message = String(req.body?.message || template.text); const html = req.body?.message ? `<div style="font-family:Arial,sans-serif;max-width:620px"><p>Hola ${escapeHtml(lead.name)}</p><p>${escapeHtml(message)}</p><p>Responde a este correo y coordinamos el siguiente paso.</p></div>` : template.html;
  try { const result = await sendEmail({to: lead.email, subject, leadId: lead.id, replyTo: req.body?.replyTo || RESEND_REPLY_TO_EMAIL, html, text: message, tags: ["services-sales", service?.id || "general", String(req.body?.stage || "initial")]}); lead.status = lead.status === "NEW" ? "CONTACTED" : lead.status; lead.updatedAt = new Date().toISOString(); persist(); res.json({ok: true, lead, salesTemplate: !req.body?.message, ...result}); } catch (error) { res.status(502).json({ok: false, error: "OUTREACH_FAILED", message: error.message}); }
});
app.post("/api/sales/brief", (req, res) => {
  const service = findService(req.body?.serviceId); if (!service) return res.status(400).json({error: "SERVICE_REQUIRED"});
  const audience = String(req.body?.audience || service.sales.idealFor); const goal = String(req.body?.goal || "generar más clientes y claridad comercial");
  res.json({ok: true, brief: {serviceId: service.id, service: service.name, audience, goal, offer: service.sales.offer, hook: service.sales.hook, qualificationQuestions: service.sales.questions, connectedTools: service.sales.tools, suggestedNextStep: "Crear contacto → calificar → generar propuesta → enviar outreach desde CRM"}});
});
app.post("/api/brain/command", async (req, res) => {
  const command = String(req.body?.command || req.body?.message || "").trim(); if (!command) return res.status(400).json({error: "COMMAND_REQUIRED"});
  try { const result = await executeCommercialCommand(command, req.body || {}); if (!result) return res.status(422).json({ok: false, error: "COMMAND_NOT_ACTIONABLE", message: "Indica una acción: crear promoción, crear campaña, generar asset con MuAPI o preparar publicación."}); res.status(202).json({ok: true, brain: KIND, ...result, executedAt: new Date().toISOString()}); }
  catch (error) { res.status(502).json({ok: false, error: "BRAIN_COMMAND_FAILED", message: error.message}); }
});
app.post("/api/brain/plan", (req, res) => {
  const command = String(req.body?.command || req.body?.message || "").trim(); if (!command) return res.status(400).json({error: "COMMAND_REQUIRED"});
  const query = command.toLowerCase(); const service = recommendService({goal: command});
  const actions = [];
  if (/(lead|cliente|captaci|prospect)/.test(query)) actions.push({id: "research", title: "Preparar investigación de leads", endpoint: "/api/leads/research", approval: false});
  if (/(oferta|promoc)/.test(query)) actions.push({id: "promotion", title: "Crear oferta comercial", endpoint: "/api/promotions", approval: false});
  if (/(campañ|campaign)/.test(query)) actions.push({id: "campaign", title: "Construir campaña multicanal", endpoint: "/api/campaigns", approval: false});
  if (/(asset|muapi|creativ|imagen|video)/.test(query)) actions.push({id: "asset", title: "Generar asset con Media/MuAPI", endpoint: "/api/assets/generate", approval: true, reason: "puede consumir créditos del proveedor"});
  if (/(email|correo|secuencia|contacta|outreach)/.test(query)) actions.push({id: "outreach", title: "Preparar secuencia de correo", endpoint: "/api/leads/:id/sequence", approval: true, reason: "acción externa y reputación de dominio"});
  if (/(publica|publicación|post|linkedin|instagram|tiktok)/.test(query)) actions.push({id: "publication", title: "Preparar publicación", endpoint: "/api/publications", approval: true, reason: "publicación externa"});
  if (/(cobra|pago|checkout|factura)/.test(query)) actions.push({id: "payment", title: "Preparar checkout", endpoint: "/api/proposals/:id/checkout", approval: true, reason: "acción financiera"});
  res.json({ok: true, command, service: {id: service.id, name: service.name}, mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", approvalRequired: SERVICES_REQUIRE_APPROVAL, actions, nextStep: actions.length ? "Revisa las acciones y ejecuta cada una desde el panel." : "Indica qué quieres crear, vender, publicar o medir."});
});
app.post("/api/approvals", (req, res) => {
  const type = String(req.body?.type || "workflow"); const targetId = String(req.body?.targetId || ""); if (!targetId) return res.status(400).json({error: "APPROVAL_TARGET_REQUIRED"});
  res.status(201).json({ok: true, approval: createApproval(type, targetId, req.body?.payload || {})});
});
app.post("/api/approvals/:id/resolve", (req, res) => {
  const approval = approvals.find(item => item.id === req.params.id); if (!approval) return res.status(404).json({error: "APPROVAL_NOT_FOUND"});
  const status = String(req.body?.status || "").toUpperCase(); if (!["APPROVED", "REJECTED"].includes(status)) return res.status(400).json({error: "APPROVAL_STATUS_NOT_ALLOWED"});
  approval.status = status; approval.resolvedBy = String(req.body?.resolvedBy || "operator"); approval.updatedAt = new Date().toISOString(); addActivity("approval_resolved", {approvalId: approval.id, status}, null); persist(); res.json({ok: true, approval});
});

app.post("/api/leads", (req, res) => {
  const lead = createLead(req.body); res.status(201).json({ok: true, lead});
});
app.post("/api/leads/import", (req, res) => {
  const rows = Array.isArray(req.body?.leads) ? req.body.leads : Array.isArray(req.body) ? req.body : [];
  if (!rows.length) return res.status(400).json({error: "LEADS_ARRAY_REQUIRED", message: "Envía leads públicos en el campo leads."});
  const created = [], skipped = [];
  rows.slice(0, 500).forEach(row => {
    const email = String(row.email || "").trim().toLowerCase();
    const domain = String(row.domain || row.website || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const duplicate = leads.find(item => (email && item.email === email) || (domain && String(item.website || "").toLowerCase().includes(domain)));
    if (duplicate) { skipped.push({row, reason: "DUPLICATE", leadId: duplicate.id}); return; }
    const lead = createLead({...row, source: row.source || "public-lead-import"}); created.push(lead);
  });
  res.status(201).json({ok: true, created, skipped, message: "Leads importados y puntuados; no se envió outreach automáticamente."});
});
app.post("/api/leads/research", (req, res) => {
  const run = {id: crypto.randomUUID(), query: String(req.body?.query || ""), industry: String(req.body?.industry || ""), city: String(req.body?.city || ""), sources: Array.isArray(req.body?.sources) ? req.body.sources : ["public_business_directories", "inbound_forms", "referrals"], status: "READY_FOR_SOURCE", policy: "public_business_contacts_only", note: "Conecta una fuente autorizada o importa un CSV/API de contactos públicos para crear leads reales. No se fabrican candidatos ni se envía spam.", createdAt: new Date().toISOString()};
  researchRuns.unshift(run); addActivity("lead_research_requested", {runId: run.id, query: run.query}, null); persist(); res.status(201).json({ok: true, run});
});
app.post("/api/leads/:id/score", (req, res) => {
  const lead = findLead(req.params.id); if (!lead) return res.status(404).json({error: "LEAD_NOT_FOUND"});
  Object.assign(lead, scoreLead({...lead, ...req.body}), {updatedAt: new Date().toISOString()}); persist(); res.json({ok: true, lead});
});
app.post("/api/leads/:id/sequence", (req, res) => {
  const lead = findLead(req.params.id); if (!lead) return res.status(404).json({error: "LEAD_NOT_FOUND"});
  const steps = Array.isArray(req.body?.steps) && req.body.steps.length ? req.body.steps : [{day: 0, channel: "email", action: "personalized_outreach"}, {day: 3, channel: "email", action: "case_study"}, {day: 7, channel: "email", action: "breakup_or_referral"}];
  const createdAt = new Date();
  const created = steps.slice(0, 8).map((step, index) => { const day = Number(step.day ?? index * 3); return {id: crypto.randomUUID(), leadId: lead.id, step: index + 1, day, channel: String(step.channel || "email"), action: String(step.action || "follow_up"), status: day === 0 ? "DUE" : "QUEUED", scheduledAt: new Date(createdAt.getTime() + day * 86400000).toISOString(), createdAt: createdAt.toISOString()}; });
  touchpoints.unshift(...created); addActivity("lead_sequence_prepared", {steps: created.length}, lead.id); persist(); res.status(201).json({ok: true, lead, touchpoints: created, message: "Secuencia preparada. El envío masivo requiere aprobación explícita."});
});
app.post("/api/promotions", (req, res) => {
  const service = recommendService(req.body || {}); if (!service) return res.status(400).json({error: "SERVICE_REQUIRED"});
  const promotion = promotionFor(service, req.body); promotions.unshift(promotion); emit("service_promotion_created", {promotionId: promotion.id, serviceId: service.id}, .6); res.status(201).json({ok: true, promotion});
});
app.post("/api/campaigns", (req, res) => { const campaign = campaignFor(req.body || {}); campaigns.unshift(campaign); emit("service_campaign_created", {campaignId: campaign.id, serviceId: campaign.serviceId}, .6); res.status(201).json({ok: true, campaign}); });
app.post("/api/campaigns/:id/launch", async (req, res) => {
  const campaign = campaigns.find(item => item.id === req.params.id); if (!campaign) return res.status(404).json({error: "CAMPAIGN_NOT_FOUND"});
  const channels = Array.isArray(req.body?.channels) && req.body.channels.length ? req.body.channels : campaign.channels;
  const drafts = [];
  const promotion = campaign.promotionId ? promotions.find(item => item.id === campaign.promotionId) : null;
  const service = findService(campaign.serviceId);
  for (const channel of channels.slice(0, 8)) drafts.push(await createPublication({campaignId: campaign.id, serviceId: campaign.serviceId, channel, audience: campaign.audience, title: `${campaign.name} · ${channel}`, copy: `${campaign.message || service?.sales?.hook || campaign.objective}. ${campaign.promise || service?.sales?.offer || "Alcance claro y medible."} ${promotion?.offer || "Diagnóstico inicial para definir alcance y oportunidad."} ${campaign.objectionHandler || "Primero aclaramos el alcance; después decides."} ${campaign.cta || "Agenda un diagnóstico"}.` }));
  campaign.status = "READY_FOR_APPROVAL"; campaign.publications = drafts.map(item => item.id); campaign.updatedAt = new Date().toISOString(); persist(); res.json({ok: true, campaign, publications: drafts, message: "Campaña preparada como drafts. No se publicó ni envió automáticamente."});
});
app.post("/api/promotions/:id/generate-assets", async (req, res) => {
  const promotion = promotions.find(item => item.id === req.params.id); if (!promotion) return res.status(404).json({error: "PROMOTION_NOT_FOUND"});
  try { const result = await generateServiceAsset({...req.body, serviceId: promotion.serviceId, campaignId: req.body?.campaignId || null, audience: promotion.audience, prompt: req.body?.prompt || `${promotion.headline}. Offer: ${promotion.offer}. CTA: ${promotion.cta}`}); promotion.assetIds = [...(promotion.assetIds || []), result.asset.id]; promotion.updatedAt = new Date().toISOString(); persist(); res.status(202).json({ok: true, promotion, ...result}); } catch (error) { res.status(502).json({ok: false, error: "ASSET_GENERATION_FAILED", message: error.message}); }
});
app.post("/api/assets/generate", async (req, res) => { try { res.status(202).json({ok: true, ...(await generateServiceAsset(req.body || {}))}); } catch (error) { res.status(502).json({ok: false, error: "ASSET_GENERATION_FAILED", message: error.message}); } });
app.post("/api/publications", async (req, res) => { try { res.status(201).json({ok: true, publication: await createPublication(req.body || {})}); } catch (error) { res.status(502).json({ok: false, error: "PUBLICATION_DRAFT_FAILED", message: error.message}); } });
app.post("/api/publications/:id/status", async (req, res) => {
  const publication = publications.find(item => item.id === req.params.id); if (!publication) return res.status(404).json({error: "PUBLICATION_NOT_FOUND"});
  const next = String(req.body?.status || "").toUpperCase(); if (!["DRAFT", "READY_FOR_APPROVAL", "SCHEDULED", "PUBLISHED", "CANCELLED"].includes(next)) return res.status(400).json({error: "PUBLICATION_STATUS_NOT_ALLOWED"});
  publication.status = next; publication.updatedAt = new Date().toISOString();
  if (publication.mediaContentId) await mediaRequest(`/api/content/${publication.mediaContentId}/status`, {method: "POST", body: {status: next === "SCHEDULED" ? "scheduled" : next === "PUBLISHED" ? "published" : next === "CANCELLED" ? "cancelled" : "draft"}});
  persist(); res.json({ok: true, publication});
});
app.post("/api/proposals", (req, res) => {
  const service = findService(req.body?.serviceId); if (!service) return res.status(400).json({error: "SERVICE_REQUIRED"});
  const packageId = String(req.body?.packageId || `${service.id}-starter`); const packageOffer = servicePackagesFor(service).find(item => item.id === packageId) || servicePackagesFor(service)[0];
  const proposal = {id: crypto.randomUUID(), serviceId: service.id, service: service.name, packageId: packageOffer.id, package: packageOffer.name, clientName: String(req.body?.clientName || "New client"), email: String(req.body?.email || ""), leadId: req.body?.leadId || null, status: "DRAFT", amount: Number(req.body?.amount || packageOffer.price), currency: service.currency, billing: packageOffer.billing, scope: Array.isArray(req.body?.scope) ? req.body.scope : packageOffer.scope, assumptions: Array.isArray(req.body?.assumptions) ? req.body.assumptions : ["El cliente entrega accesos y materiales a tiempo", "El alcance se mantiene dentro de los entregables aprobados"], milestones: service.deliverables.map((name, index) => ({id: crypto.randomUUID(), name, order: index + 1, paymentPct: index === 0 ? 50 : Math.round(50 / Math.max(1, service.deliverables.length - 1))})), validUntil: new Date(Date.now() + 14 * 86400000).toISOString(), notes: String(req.body?.notes || ""), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
  if (proposal.leadId) { const lead = findLead(proposal.leadId); if (lead && ["QUALIFIED", "MEETING"].includes(lead.status)) lead.status = "PROPOSAL"; }
  proposals.unshift(proposal); emit("service_proposal_created", {proposalId: proposal.id, serviceId: service.id, amount: proposal.amount}, .7); res.status(201).json({ok: true, proposal});
});
app.get("/api/proposals/:id", (req, res) => { const proposal = proposals.find(item => item.id === req.params.id); return proposal ? res.json({ok: true, proposal}) : res.status(404).json({error: "PROPOSAL_NOT_FOUND"}); });
app.post("/api/proposals/:id/status", (req, res) => {
  const proposal = proposals.find(item => item.id === req.params.id); if (!proposal) return res.status(404).json({error: "PROPOSAL_NOT_FOUND"});
  const allowed = ["DRAFT", "SENT", "VIEWED", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "WON"]; const status = String(req.body?.status || "").toUpperCase(); if (!allowed.includes(status)) return res.status(400).json({error: "PROPOSAL_STATUS_NOT_ALLOWED"});
  proposal.status = status; proposal.updatedAt = new Date().toISOString(); if (status === "APPROVED") createApproval("proposal_payment", proposal.id, {amount: proposal.amount, currency: proposal.currency}); const lead = proposal.leadId ? findLead(proposal.leadId) : leads.find(item => item.email && item.email === proposal.email); if (lead && status === "APPROVED") lead.status = "NEGOTIATION"; addActivity("proposal_status_changed", {proposalId: proposal.id, status}, lead?.id || null); persist(); res.json({ok: true, proposal});
});
app.post("/api/proposals/:id/send", async (req, res) => {
  const proposal = proposals.find(item => item.id === req.params.id); if (!proposal) return res.status(404).json({error: "PROPOSAL_NOT_FOUND"});
  const to = req.body?.to || proposal.email; if (!to) return res.status(400).json({error: "PROPOSAL_EMAIL_REQUIRED"});
  try { const result = await sendEmail({to, subject: req.body?.subject || `Propuesta de ${proposal.service}`, leadId: req.body?.leadId || null, html: `<h1>Propuesta: ${escapeHtml(proposal.service)}</h1><p>Hola ${escapeHtml(proposal.clientName)}, preparamos una propuesta inicial para tu proyecto.</p><p><strong>Inversión estimada:</strong> ${escapeHtml(proposal.currency)} ${Number(proposal.amount || 0).toLocaleString("en-US")}</p><p>${escapeHtml(proposal.notes || "Podemos ajustar el alcance después de revisar tus objetivos.")}</p>`, text: `Propuesta: ${proposal.service}. Inversión estimada: ${proposal.currency} ${proposal.amount}. ${proposal.notes || "Podemos ajustar el alcance después de revisar tus objetivos."}`}); proposal.status = "SENT"; proposal.sentAt = new Date().toISOString(); proposal.email = String(to); persist(); res.json({ok: true, proposal, ...result}); } catch (error) { res.status(502).json({ok: false, error: "PROPOSAL_EMAIL_FAILED", message: error.message}); }
});
app.post("/api/proposals/:id/checkout", async (req, res) => {
  const proposal = proposals.find(item => item.id === req.params.id); if (!proposal) return res.status(404).json({error: "PROPOSAL_NOT_FOUND"}); if (!proposal.email && !req.body?.email) return res.status(400).json({error: "PROPOSAL_EMAIL_REQUIRED"});
  if (SERVICES_REQUIRE_APPROVAL && proposal.status !== "APPROVED" && req.body?.confirm !== true) return res.status(409).json({ok: false, error: "PROPOSAL_APPROVAL_REQUIRED", message: "Marca la propuesta como APPROVED o confirma explícitamente el checkout."});
  const origin = String(req.body?.successUrl || `${SERVICES_PUBLIC_URL}?payment=success`).trim();
  const result = await stripeRequest("/v1/checkout/sessions", {"mode": "payment", "success_url": origin, "cancel_url": String(req.body?.cancelUrl || `${SERVICES_PUBLIC_URL}?payment=cancelled`), "customer_email": String(req.body?.email || proposal.email), "line_items[0][price_data][currency]": String(proposal.currency || "USD").toLowerCase(), "line_items[0][price_data][product_data][name]": proposal.service, "line_items[0][price_data][product_data][description]": proposal.notes || `Services Brain · ${proposal.service}`, "line_items[0][price_data][unit_amount]": Math.round(Number(proposal.amount || 0) * 100), "line_items[0][quantity]": 1, "metadata[proposal_id]": proposal.id, "metadata[service_id]": proposal.serviceId});
  if (!result.configured) return res.status(409).json({ok: false, error: "STRIPE_NOT_CONFIGURED", message: "Añade STRIPE_SECRET_KEY al .env para activar checkout."});
  if (!result.ok) return res.status(502).json({ok: false, error: "STRIPE_CHECKOUT_FAILED", message: result.body?.error?.message || `STRIPE_HTTP_${result.status}`});
  proposal.paymentStatus = "CHECKOUT_CREATED"; proposal.checkoutSessionId = result.body.id; proposal.checkoutUrl = result.body.url; proposal.updatedAt = new Date().toISOString(); persist(); res.status(201).json({ok: true, proposal, checkout: {id: result.body.id, url: result.body.url}});
});
app.post("/api/projects", (req, res) => {
  const service = findService(req.body?.serviceId); if (!service) return res.status(400).json({error: "SERVICE_REQUIRED"});
  const project = {id: crypto.randomUUID(), serviceId: service.id, service: service.name, clientName: String(req.body?.clientName || "New client"), email: String(req.body?.email || ""), leadId: req.body?.leadId || null, proposalId: req.body?.proposalId || null, status: "INTAKE", amount: Number(req.body?.amount || service.startingFrom), milestones: service.deliverables.map((name, index) => ({id: crypto.randomUUID(), name, order: index + 1, status: "PENDING", dueAt: null, approvalRequired: true})), intake: {objective: String(req.body?.objective || ""), accessChecklist: ["brand assets", "analytics", "hosting or platform access", "primary contact"], status: "PENDING"}, nextAction: "client_intake", health: "ONBOARDING", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
  const lead = project.leadId ? findLead(project.leadId) : null; if (lead) { lead.status = "WON"; lead.clientSince = lead.clientSince || new Date().toISOString(); }
  projects.unshift(project); emit("service_project_started", {projectId: project.id, serviceId: service.id}, .8); res.status(201).json({ok: true, project});
});
app.patch("/api/projects/:id", (req, res) => { const project = projects.find(item => item.id === req.params.id); if (!project) return res.status(404).json({error: "PROJECT_NOT_FOUND"}); if (req.body?.status) project.status = String(req.body.status).toUpperCase(); if (req.body?.nextAction !== undefined) project.nextAction = String(req.body.nextAction); if (req.body?.health) project.health = String(req.body.health).toUpperCase(); if (req.body?.intake) project.intake = {...project.intake, ...req.body.intake, status: "RECEIVED"}; if (req.body?.milestoneId) { const milestone = project.milestones?.find(item => item.id === req.body.milestoneId); if (milestone) { milestone.status = String(req.body.milestoneStatus || "DONE").toUpperCase(); milestone.updatedAt = new Date().toISOString(); } } project.updatedAt = new Date().toISOString(); addActivity("project_updated", {status: project.status, health: project.health, nextAction: project.nextAction}, project.leadId || null); res.json({ok: true, project}); });
app.get("/api/projects/:id/health", (req, res) => { const project = projects.find(item => item.id === req.params.id); if (!project) return res.status(404).json({error: "PROJECT_NOT_FOUND"}); const done = (project.milestones || []).filter(item => item.status === "DONE").length; const health = {projectId: project.id, status: project.status, health: project.health || (done ? "ON_TRACK" : "ONBOARDING"), completion: rate(done, project.milestones?.length || 1), blockers: project.blockers || [], nextAction: project.nextAction, updatedAt: project.updatedAt}; res.json({ok: true, health}); });
app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim(); if (!message) return res.status(400).json({error: "MESSAGE_REQUIRED"});
  try {
    const command = await executeCommercialCommand(message, req.body || {});
    if (command) return res.json({ok: true, reply: command.reply, action: command.action, result: command.result, speak: true, brain: KIND, contextAt: new Date().toISOString()});
    const brainContext = await context();
    const answer = await completeBrainConversation({brain: KIND, name: "Services Brain", message, conversation: req.body?.conversation, context: brainContext, scope: "venta consultiva, catálogo de servicios, cotizaciones, leads, proyectos, delivery y coordinación con Commerce y Media", fallback});
    res.json({ok: true, ...answer, speak: true, brain: KIND, contextAt: brainContext.generatedAt});
  } catch (error) { res.status(502).json({error: "SERVICES_CHAT_ERROR", message: error.message}); }
});

setInterval(() => processDueTouchpoints().catch(error => console.error("Services sequence worker:", error.message)), 30000);
app.listen(PORT, () => console.log(`${NAME} listening on ${PORT} · automation ${SERVICES_AUTOMATION_ENABLED ? "enabled" : "approval-only"}`));
