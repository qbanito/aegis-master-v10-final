import {store, emit} from "../core/store.js";
import {priceOffer} from "../module-engine.js";
import {findProduct} from "../core/productCatalog.js";
import {enrichProduct} from "../core/economics.js";

export function run(input = {}) {
  const product = findProduct(input.productId) || store.products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  if (!product) return {status: "BLOCKED", mode: "PAPER", blockers: ["NO_PRODUCT_TO_PRICE"]};
  enrichProduct(product);
  const pricing = product.monetizationModel === "AMAZON_AFFILIATE"
    ? {mode: "AFFILIATE_CLICKOUT", observedPrice: product.price, expectedCommission: product.economics?.expectedCommission || 0, maxCac: product.economics?.targetCac || 0, planningOnly: true}
    : priceOffer(product, {...store.moduleConfigs["offer-pricing"], ...(input.parameters || {})});
  product.pricing = pricing;
  product.pricingUpdatedAt = new Date().toISOString();
  emit("commerce_offer_priced", {productId: product.id, pricing, mode: "PAPER"}, .7);
  return {status: "READY", mode: "PAPER", productId: product.id, product: product.name, pricing};
}
