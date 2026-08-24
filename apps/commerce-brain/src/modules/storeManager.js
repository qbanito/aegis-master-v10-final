import crypto from "node:crypto";
import {store, emit} from "../core/store.js";
import {findProduct} from "../core/productCatalog.js";
import {enrichProduct} from "../core/economics.js";
import {connector} from "../connectors/connectorRegistry.js";

export function run(input = {}) {
  const product = findProduct(input.productId) || store.products.find(item => item.monetizationModel !== "AMAZON_AFFILIATE");
  if (!product) return {status: "BLOCKED", mode: "PAPER", blockers: ["NO_PHYSICAL_PRODUCT"]};
  if (product.monetizationModel === "AMAZON_AFFILIATE") return {status: "NOT_APPLICABLE", mode: "PAPER", productId: product.id, blockers: ["AMAZON_AFFILIATE_NOT_SHOPIFY_INVENTORY"]};
  enrichProduct(product);
  const draft = {id: crypto.randomUUID(), productId: product.id, status: "DRAFT_ONLY", paper: true, connector: connector("shopify"), approvalRequired: true, product: {title: product.name, price: product.economics?.price || product.price, description: `Draft listing for ${product.name}`, imageUrl: product.imageUrl || null}, createdAt: new Date().toISOString()};
  store.storeDrafts.unshift(draft);
  const blockers = product.tier === "TEST_READY" ? [] : ["product_not_test_ready", ...(product.risks || [])];
  const result = {status: blockers.length ? "REVIEW_REQUIRED" : "READY_FOR_APPROVAL", mode: "PAPER", draft, blockers, publishAllowed: false};
  emit("commerce_store_draft_created", {draftId: draft.id, productId: product.id, blockers, mode: "PAPER"}, .7);
  return result;
}
