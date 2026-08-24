import crypto from "node:crypto";
import {store, emit} from "../core/store.js";
import {findProduct} from "../core/productCatalog.js";
import {enrichProduct} from "../core/economics.js";
import {PAPER_MODE} from "../core/config.js";

// Shared with core/workflowEngine.js (product-launch workflow) and the /api/products/:id/campaign route.
export function campaignFor(product, input = {}) {
  const slug = String(product.name || product.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const affiliate = product.monetizationModel === "AMAZON_AFFILIATE";
  return {id: crypto.randomUUID(), productId: product.id, monetizationModel: affiliate ? "AMAZON_AFFILIATE" : "PHYSICAL_PRODUCT", status: product.tier === "TEST_READY" ? "DRAFT" : "REVIEW_REQUIRED", paper: PAPER_MODE, createdAt: new Date().toISOString(), channels: input.channels || ["organic_search", "short_video", "creator_affiliate", "email"], objective: affiliate ? "qualified_affiliate_clicks" : "validated_sales", maxCac: product.economics?.targetCac || 0, dailyBudget: Number(input.dailyBudget || Math.max(0, (product.economics?.targetCac || 0) * 3).toFixed(2)), message: affiliate ? `${product.name}: contenido editorial transparente y clickout cualificado hacia Amazon.` : `${product.name}: problema claro, transformación visible y oferta verificable.`, utm: {source: "commerce-brain", medium: "campaign", campaign: slug}, guardrails: ["pause if CAC exceeds target", "pause if refund rate rises", "no spend without explicit activation", ...(affiliate ? ["show Amazon affiliate disclosure", "refresh price and availability before publishing"] : [])], blockers: product.tier === "TEST_READY" ? [] : ["product_not_test_ready", ...(product.risks || [])]};
}

export function run(input = {}) {
  const product = findProduct(input.productId) || store.products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  if (!product) return {status: "BLOCKED", mode: "PAPER", blockers: ["NO_PRODUCT_FOR_TRAFFIC"]};
  enrichProduct(product);
  const campaign = campaignFor(product, {...input, dailyBudget: Math.min(Number(input.dailyBudget || store.moduleConfigs.traffic.dailyBudgetCap), store.moduleConfigs.traffic.dailyBudgetCap)});
  campaign.status = "REVIEW_REQUIRED";
  campaign.paper = true;
  campaign.spend = 0;
  store.campaigns.unshift(campaign);
  const result = {status: "REVIEW_REQUIRED", mode: "PAPER", campaign, blockers: [...new Set([...(campaign.blockers || []), "manual_activation_required"])], spendAllowed: false};
  emit("commerce_traffic_plan_created", {campaignId: campaign.id, productId: product.id, mode: "PAPER"}, .7);
  return result;
}
