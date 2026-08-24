import path from "node:path";
import {fileURLToPath} from "node:url";

export const NAME = "AEGIS Commerce Brain";
export const KIND = "commerce";
export const PORT = Number(process.env.PORT || 8802);

export const COMMERCE_MODE = String(process.env.COMMERCE_MODE || "PAPER").toUpperCase();
export const PAPER_MODE = COMMERCE_MODE !== "LIVE";

// systemDataMode is the deploy-time ceiling every module's per-module dataMode is clamped to.
// It is NOT settable via API — only via env at deploy time (Render dashboard / .env).
export const SYSTEM_DATA_MODE = (() => {
  const explicit = String(process.env.COMMERCE_DATA_MODE || "").toUpperCase();
  if (["DEMO", "PAPER_WITH_REAL_DATA", "LIVE"].includes(explicit)) return explicit;
  return COMMERCE_MODE === "LIVE" ? "LIVE" : "PAPER_WITH_REAL_DATA";
})();

export function serviceUrl(value, fallback) {
  const url = String(value || fallback).trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

export const MEDIA_BRAIN_URL = serviceUrl(process.env.MEDIA_BRAIN_URL, "http://localhost:8804");
export const MASTER_BRAIN_URL = serviceUrl(process.env.MANAGER_BRAIN_URL, "http://localhost:8805");
export const ASSET_MODE = String(process.env.COMMERCE_ASSET_MODE || (process.env.MUAPI_API_KEY ? "remote" : "brief")).toLowerCase();

export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data");
export const DATA_FILE = path.join(DATA_DIR, "commerce.json");

export const AUTOMATION_ENABLED = String(process.env.COMMERCE_AUTOMATION_ENABLED || "true").toLowerCase() !== "false";
export const AUTOMATION_INTERVAL_MS = Math.max(60000, Number(process.env.COMMERCE_AUTOMATION_INTERVAL_MS || 900000));

export const APIFY_BASE_URL = String(process.env.APIFY_API_BASE_URL || "https://api.apify.com/v2").replace(/\/$/, "");
export const AMAZON_AFFILIATE_ACTOR_ID = String(process.env.APIFY_AMAZON_AFFILIATE_SCOUT_ACTOR_ID || "connected_monkey~amazon-affiliate-product-scout");

export const OPERATOR_TOKEN = String(process.env.AEGIS_OPERATOR_TOKEN || "").trim();

export const AGENT_DEFINITIONS = [
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

export function envValue(...keys) { return keys.map(key => process.env[key]).find(value => Boolean(value)) || ""; }
export function configuredEnv(...keys) { return keys.every(key => Boolean(process.env[key])); }
