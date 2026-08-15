import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {completeBrainConversation} from "../../../packages/inter-brain-protocol/src/chat.js";

try { process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env")); } catch {}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 8790);
const NAME = "AEGIS SaaS Brain";
const startedAt = new Date().toISOString();
const events = [];
const agents = [
  ["revenue-intelligence", "Revenue Intelligence"],
  ["churn-radar", "Churn & Retention Radar"],
  ["cohort-analyst", "Cohort Analyst"],
  ["billing-observer", "Billing Observer"],
  ["growth-scout", "Growth Opportunity Scout"],
  ["mrr-forecaster", "MRR Forecaster"],
  ["customer-health", "Customer Health Agent"],
  ["pricing-lab", "Pricing Experiment Lab"],
  ["stripe-adapter", "Stripe Event Adapter"],
  ["saas-allocator", "SaaS Growth Allocator"]
].map(([id, name]) => ({id, name, enabled: true}));

const stripeStatus = () => ({id: "stripe", provider: "Stripe API", configured: Boolean(process.env.STRIPE_SECRET_KEY), live: false, mode: "READ_ONLY", capabilities: ["balance-probe", "billing-events"], warning: "Los eventos deben verificarse con STRIPE_WEBHOOK_SECRET antes de afectar métricas."});
async function probeStripe() {
  const status = stripeStatus();
  if (!status.configured) return {...status, online: false, readiness: "BLOCKED", error: "STRIPE_SECRET_KEY_MISSING", checkedAt: new Date().toISOString()};
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {headers: {authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`}, signal: AbortSignal.timeout(8000)});
    const body = await response.json().catch(() => ({}));
    return {...status, online: response.ok, readiness: response.ok ? "READY" : "DEGRADED", account: response.ok ? {livemode: Boolean(body.livemode), availableCurrencies: (body.available || []).map(item => item.currency)} : null, error: response.ok ? null : body.error?.message || `STRIPE_HTTP_${response.status}`, checkedAt: new Date().toISOString()};
  } catch (error) { return {...status, online: false, readiness: "DEGRADED", error: error.message, checkedAt: new Date().toISOString()}; }
}

const subscriptions = [
  {id: "atlas", name: "Atlas Workspace", plan: "Scale", mrr: 2490, health: 92, trend: 12.4},
  {id: "orbit", name: "Orbit Analytics", plan: "Growth", mrr: 1380, health: 84, trend: 6.8},
  {id: "nova", name: "Nova Ops", plan: "Starter", mrr: 690, health: 71, trend: -3.2},
  {id: "lumen", name: "Lumen Studio", plan: "Scale", mrr: 3210, health: 96, trend: 18.1}
];

function emit(type, payload = {}, priority = 0.5) {
  const event = {
    schema: "aegis.interbrain", version: "1.0", id: crypto.randomUUID(),
    correlation_id: crypto.randomUUID(), source: "saas", target: "manager",
    type, priority, timestamp: new Date().toISOString(), payload
  };
  events.unshift(event);
  if (events.length > 200) events.pop();
  return event;
}

function revenueSummary() {
  const mrr = subscriptions.reduce((total, row) => total + row.mrr, 0);
  const healthy = subscriptions.filter(row => row.health >= 80).length;
  return {
    mrr, arr: mrr * 12, growthRate: 11.8, netRevenueRetention: 118.4,
    churnRate: 2.1, expansionMrr: 1240, contractionMrr: 190,
    newMrr: 860, churnedMrr: 240, portfolioHealth: Math.round(subscriptions.reduce((a, r) => a + r.health, 0) / subscriptions.length),
    healthyAccounts: `${healthy}/${subscriptions.length}`
  };
}

function saasChatContext() {
  return {
    generatedAt: new Date().toISOString(), mode: "READ_ONLY",
    agents, revenue: revenueSummary(), accounts: subscriptions,
    connectors: {stripe: stripeStatus()}, events: events.slice(0, 30)
  };
}

function saasFallback(message, context) {
  const query = message.toLowerCase();
  if (query.includes("mrr") || query.includes("ingreso") || query.includes("revenue")) return `El MRR actual del portfolio es $${context.revenue.mrr.toLocaleString()} y el crecimiento indicado es ${context.revenue.growthRate}%. Puedo desglosarlo por cuenta, expansión, contracción o churn.`;
  if (query.includes("churn") || query.includes("retención") || query.includes("retencion") || query.includes("cohorte")) return `La retención neta es ${context.revenue.netRevenueRetention}% y el churn registrado es ${context.revenue.churnRate}%. Puedo comparar cohortes y señalar qué cuentas necesitan atención.`;
  if (query.includes("stripe") || query.includes("billing") || query.includes("cobro")) return `Stripe está en modo ${context.connectors.stripe.configured ? "configurado para lectura" : "pendiente de credenciales"}; no se modifican cobros desde este Brain.`;
  return "Puedo analizar MRR, ARR, crecimiento, churn, cohortes, salud de clientes, pricing, billing y retención usando el estado actual de SaaS Brain.";
}

app.get("/health", (_req, res) => res.json({
  name: NAME, kind: "saas", status: "online", startedAt,
  agentsOnline: agents.length, agentsTotal: agents.length, processed: events.length
}));
app.get("/api/agents", (_req, res) => res.json(agents));
app.get("/api/events", (_req, res) => res.json(events.slice(0, 100)));
app.get("/api/revenue/summary", (_req, res) => res.json(revenueSummary()));
app.get("/api/revenue/trend", (req, res) => {
  const limit = Math.min(100, Math.max(7, Number(req.query.limit || 14)));
  const base = revenueSummary().mrr;
  res.json(Array.from({length: limit}, (_, index) => ({
    date: new Date(Date.now() - (limit - index - 1) * 86400000).toISOString().slice(0, 10),
    mrr: Math.round(base * (0.91 + index * 0.006 + (index % 3) * 0.004)),
    expansion: Math.round(70 + index * 8),
    churn: Math.round(18 + (index % 4) * 7)
  })));
});
app.get("/api/revenue/cohorts", (_req, res) => res.json([
  {cohort: "2026-Q3", customers: 12, retained: 11, revenue: 6820},
  {cohort: "2026-Q2", customers: 28, retained: 24, revenue: 14880},
  {cohort: "2026-Q1", customers: 46, retained: 39, revenue: 23740}
]));
app.get("/api/revenue/:saasId", (req, res) => {
  const account = subscriptions.find(row => row.id === req.params.saasId);
  if (!account) return res.status(404).json({error: "SAAS_ACCOUNT_NOT_FOUND"});
  res.json({...account, annualRunRate: account.mrr * 12});
});
app.get("/api/summary", (_req, res) => res.json({
  name: NAME, kind: "saas", state: {status: "online", processed: events.length},
  agents, latestEvents: events.slice(0, 10), revenue: revenueSummary(), accounts: subscriptions
}));
app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({error: "MESSAGE_REQUIRED"});
  try {
    const context = saasChatContext();
    const answer = await completeBrainConversation({
      brain: "saas", name: "SaaS Brain", message, conversation: req.body?.conversation,
      context, scope: "MRR, ARR, crecimiento, churn, cohortes, cuentas, billing, Stripe, pricing y retención",
      fallback: saasFallback
    });
    res.json({ok: true, ...answer, speak: true, brain: "saas", contextAt: context.generatedAt});
  } catch (error) { res.status(502).json({error: "SAAS_CHAT_ERROR", message: error.message}); }
});
app.get("/api/connectors/status", async (_req, res) => res.json({connectors: [await probeStripe()], checkedAt: new Date().toISOString()}));
app.post("/api/event", (req, res) => res.json({ok: true, event: emit(req.body.type || "saas_event", req.body.payload || {}, Number(req.body.priority || 0.5))}));
app.post("/api/integrations/stripe/:saasId", (req, res) => {
  const connected = Boolean(process.env.STRIPE_SECRET_KEY);
  const event = emit("stripe_billing_event", {saasId: req.params.saasId, eventType: req.body?.type || "unknown", normalized: true, source: connected ? "STRIPE_API_ADAPTER" : "PAPER_MOCK"}, 0.7);
  res.json({ok: true, mode: connected ? "PAPER_CONNECTED" : "mock", verified: false, warning: "Webhook signature verification remains required before production billing ingestion.", event});
});

app.listen(PORT, () => console.log(`${NAME} listening on ${PORT}`));
