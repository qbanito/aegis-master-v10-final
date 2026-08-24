import {store} from "./store.js";
import {scoreDropshipCandidate} from "../module-engine.js";

export function economics(product, overrides = {}) {
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

export function scoreProduct(product) {
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
    const scored = scoreDropshipCandidate(product, store.moduleConfigs["dropship-hunter"]);
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

export function enrichProduct(product) {
  const scored = scoreProduct(product);
  Object.assign(product, {economics: scored.economics, score: scored.score, tier: scored.tier, risks: scored.risks, updatedAt: new Date().toISOString()});
  return product;
}
