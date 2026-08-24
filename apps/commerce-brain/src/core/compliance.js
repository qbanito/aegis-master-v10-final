import {store} from "./store.js";

export function productCompliance(product) {
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
    if (!Number(product.shippingDays) || Number(product.shippingDays) > Number(store.moduleConfigs["dropship-hunter"]?.maxShippingDays || 12)) warnings.push("shipping_window_needs_verification");
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
