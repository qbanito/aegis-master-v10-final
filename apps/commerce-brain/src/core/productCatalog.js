import {store} from "./store.js";
import {normalizeDropshipCandidate} from "../module-engine.js";

export function findBot(id) { return store.commerceBots.find(item => item.id === id); }
export function findProduct(id) { return store.products.find(item => item.id === id); }
export function findWorkflow(id) { return store.workflows.find(item => item.id === id); }
export function activeWorkflowForProduct(productId) { return store.workflows.find(item => item.productId === productId && !["REJECTED", "COMPLETED"].includes(item.status)); }
export function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;"); }

export function normalizeFeedItem(item, source, index) {
  if (source === "aliexpress") return normalizeDropshipCandidate(item, index);
  const name = item.name || item.title || item.product_title || item.productName || `${source === "amazon" ? "Amazon" : "AliExpress"} product ${index + 1}`;
  const price = Number(item.price ?? item.sale_price ?? item.currentPrice ?? 0) || 0;
  const affiliate = source === "amazon" && (item.monetizationModel === "AMAZON_AFFILIATE" || item.affiliateUrl || item.asin);
  const affiliateEconomics = item.economics && item.economics.commissionRate !== undefined ? item.economics : null;
  return {id: `${source}-${affiliate ? "affiliate" : "provider"}-${item.id || item.product_id || item.asin || index + 1}`, source, sourceStatus: item.sourceStatus || "PROVIDER_FEED", monetizationModel: affiliate ? "AMAZON_AFFILIATE" : (item.monetizationModel || "PHYSICAL_PRODUCT"), paper: true, name, title: item.title || name, category: item.category || item.category_name || "general", price, currency: item.currency || "USD", rating: Number(item.rating || item.stars || 0) || 0, asin: item.asin || null, estimatedCost: affiliate ? 0 : Number(item.cost || item.sale_price || price * .36), shippingCost: affiliate ? 0 : Number(item.shippingCost || item.shipping_cost || 0), estimatedMargin: affiliate ? 0 : Number((price * .42).toFixed(2)), demandScore: Number(item.demandScore || item.demand_score || 0) || 0, demandSignalStatus: item.demandSignalStatus || "MISSING", imageUrl: item.imageUrl || item.image_url || item.main_image || item.image || "", providerUrl: item.affiliateUrl || item.url || item.product_url || item.detailPageURL || "", affiliateUrl: item.affiliateUrl || "", detailPageURL: item.detailPageURL || item.url || "", features: Array.isArray(item.features) ? item.features : [], affiliateEconomics, discoveredAt: new Date().toISOString()};
}
