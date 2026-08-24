import {store} from "../core/store.js";
import {PAPER_MODE} from "../core/config.js";
import {connectorStatus} from "../connectors/connectorRegistry.js";
import {funnelSummary} from "../core/funnel.js";

// The existing whole-brain /api/chat — distinct from the new per-module copilot in moduleCopilotService.js.
export function commerceChatContext() {
  return {
    generatedAt: new Date().toISOString(), mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED",
    agents: store.agents.map(agent => ({id: agent.id, name: agent.name, strategy: agent.strategy, enabled: agent.enabled})),
    bots: store.commerceBots.map(bot => ({id: bot.id, name: bot.name, status: bot.status, active: bot.active, metrics: bot.metrics, readiness: bot.readiness, lastResult: bot.lastResult?.summary || null})),
    moduleParameters: store.moduleConfigs,
    products: store.products.slice(0, 20), opportunities: store.opportunities.slice(0, 20),
    digitalProducts: store.digitalProducts.slice(0, 12), landingPages: store.landingPages.slice(0, 12),
    storeDrafts: store.storeDrafts.slice(0, 12), campaigns: store.campaigns.slice(0, 12),
    leads: store.leads.slice(0, 20), orders: store.orders.slice(0, 20), funnel: funnelSummary(),
    connectors: connectorStatus(), latestEvents: store.events.slice(0, 20)
  };
}

export function commerceFallback(message, context) {
  const query = message.toLowerCase();
  if (query.includes("producto") || query.includes("dropship") || query.includes("aliexpress")) return `Puedo revisar ${context.products.length} productos y el estado del Dropshipping Hunter. En este momento el modo es ${context.mode}; te indicaré qué señales son reales, qué proveedor falta y qué producto está listo para prueba.`;
  if (query.includes("precio") || query.includes("margen") || query.includes("oferta")) return "Puedo analizar precio, margen, anclaje y sensibilidad usando los productos y parámetros del Offer & Pricing Engine.";
  if (query.includes("venta") || query.includes("lead") || query.includes("crm")) return `Commerce Brain tiene ${context.leads.length} leads registrados y ${context.orders.length} pedidos en el contexto actual. Puedo revisar el embudo, priorizar conversaciones y proponer el siguiente paso en PAPER.`;
  return "Puedo revisar productos, proveedores, ofertas, creatividades, drafts de Shopify, tráfico, leads, retención y asignación de ingresos con los datos actuales de Commerce Brain.";
}
