const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value, min)));

export const MODULE_PARAMETER_DEFAULTS = {
  "product-scout": {minScore: 55, maxRequests: 10, minPrice: 15, maxPrice: 150},
  "dropship-hunter": {minScore: 60, maxRequests: 10, maxShippingDays: 12, minSupplierRating: 4.5, maxLandedCostRatio: .58, maxRefundReserve: .08},
  "digital-builder": {minIdeaScore: 60, maxIdeas: 10, validationThreshold: 3},
  "offer-pricing": {targetMarginPct: 25, maxDiscountPct: 20, adReservePct: .2, refundReservePct: .05},
  "creative-factory": {maxVariants: 3, requireDisclosure: true, channels: ["landing", "short_video", "email"]},
  "store-manager": {paperOnly: true, requireApproval: true, maxDraftsPerRun: 10},
  "traffic": {maxCacMultiplier: .65, dailyBudgetCap: 100, paperOnly: true},
  "closer": {hotLeadScore: 70, followUpHours: 24, maxDailyTouches: 50},
  "retention": {minOrderCount: 1, upsellWindowDays: 30, maxDiscountPct: 15},
  "allocator": {maxProductAllocationPct: .35, minContribution: 0, paperOnly: true}
};

const numericRules = {
  minScore: [0, 100], maxRequests: [1, 50], minPrice: [0, 100000], maxPrice: [0, 100000],
  maxShippingDays: [1, 90], minSupplierRating: [0, 5], maxLandedCostRatio: [.05, .95], maxRefundReserve: [0, .5],
  minIdeaScore: [0, 100], maxIdeas: [1, 50], validationThreshold: [1, 20], targetMarginPct: [0, 95], maxDiscountPct: [0, 80],
  adReservePct: [0, .8], refundReservePct: [0, .5], maxVariants: [1, 10], maxDraftsPerRun: [1, 100], maxCacMultiplier: [.05, 2],
  dailyBudgetCap: [0, 100000], hotLeadScore: [0, 100], followUpHours: [1, 720], maxDailyTouches: [1, 10000], minOrderCount: [1, 100],
  upsellWindowDays: [1, 365], maxProductAllocationPct: [.01, 1], minContribution: [-100000, 100000]
};

export function sanitizeModuleParameters(moduleId, incoming = {}) {
  const defaults = MODULE_PARAMETER_DEFAULTS[moduleId] || {};
  const output = {...defaults};
  for (const [key, value] of Object.entries(incoming || {})) {
    if (!(key in defaults)) continue;
    if (Array.isArray(defaults[key])) output[key] = Array.isArray(value) ? value.slice(0, 20).map(String) : defaults[key];
    else if (typeof defaults[key] === "boolean") output[key] = Boolean(value);
    else if (typeof defaults[key] === "number") {
      const [min, max] = numericRules[key] || [-Infinity, Infinity];
      output[key] = clamp(value, min, max);
    }
  }
  return output;
}

export function scoreDropshipCandidate(candidate, parameters = {}) {
  const p = sanitizeModuleParameters("dropship-hunter", parameters);
  const salePrice = number(candidate.price);
  const supplierCost = number(candidate.supplierPrice ?? candidate.cost ?? candidate.estimatedCost);
  const shippingCost = number(candidate.shippingCost ?? candidate.shipping_cost);
  const landedCost = supplierCost + shippingCost;
  const paymentFee = salePrice > 0 ? salePrice * .029 + .30 : 0;
  const platformFee = salePrice * .02;
  const refundReserve = salePrice * p.maxRefundReserve;
  const adReserve = salePrice * .20;
  const contribution = salePrice - landedCost - paymentFee - platformFee - refundReserve - adReserve;
  const marginPct = salePrice > 0 ? contribution / salePrice * 100 : 0;
  const shippingDays = number(candidate.shippingDays ?? candidate.deliveryDays, 0);
  const supplierRating = number(candidate.supplierRating ?? candidate.sellerRating ?? candidate.rating, 0);
  const signals = {
    supplierUrl: Boolean(candidate.supplierUrl || candidate.providerUrl || candidate.url),
    price: salePrice > 0,
    supplierCost: supplierCost > 0,
    supplierRating: supplierRating >= p.minSupplierRating,
    deliveryWindow: shippingDays > 0 && shippingDays <= p.maxShippingDays,
    image: Boolean(candidate.imageUrl),
    inventory: candidate.inventory === undefined || number(candidate.inventory, 0) > 0,
    returnsPolicy: Boolean(candidate.returnsPolicy || candidate.returnPolicy)
  };
  const qualityScore = Object.values(signals).filter(Boolean).length / Object.keys(signals).length * 55;
  const economicsScore = salePrice > 0 && landedCost / salePrice <= p.maxLandedCostRatio ? 25 : 0;
  const marginScore = Math.max(0, Math.min(20, marginPct));
  const score = Math.round(Math.min(100, qualityScore + economicsScore + marginScore));
  const blockers = [];
  if (!signals.supplierUrl) blockers.push("supplier_url_missing");
  if (!signals.supplierCost) blockers.push("supplier_cost_missing");
  if (!signals.price) blockers.push("sale_price_missing");
  if (!signals.deliveryWindow) blockers.push("shipping_window_unverified_or_too_slow");
  if (!signals.supplierRating) blockers.push("supplier_rating_below_threshold");
  if (landedCost / Math.max(salePrice, 1) > p.maxLandedCostRatio) blockers.push("landed_cost_too_high");
  if (contribution <= p.minContribution) blockers.push("non_positive_contribution");
  if (!signals.inventory) blockers.push("inventory_unavailable");
  const uniqueBlockers = [...new Set(blockers)];
  const tier = score >= p.minScore && uniqueBlockers.length === 0 ? "TEST_READY" : score >= 45 ? "REVIEW" : "REJECT";
  return {
    score, tier, blockers: uniqueBlockers, signals,
    economics: {monetizationModel: "PHYSICAL_PRODUCT", price: Number(salePrice.toFixed(2)), supplierCost: Number(supplierCost.toFixed(2)), shipping: Number(shippingCost.toFixed(2)), landedCost: Number(landedCost.toFixed(2)), paymentFee: Number(paymentFee.toFixed(2)), platformFee: Number(platformFee.toFixed(2)), refundReserve: Number(refundReserve.toFixed(2)), adReserve: Number(adReserve.toFixed(2)), contribution: Number(contribution.toFixed(2)), marginPct: Number(marginPct.toFixed(1)), breakEvenCac: Number(Math.max(0, salePrice - landedCost - paymentFee - platformFee - refundReserve).toFixed(2)), targetCac: Number(Math.max(0, (salePrice - landedCost - paymentFee - platformFee - refundReserve) * p.maxLandedCostRatio).toFixed(2))},
    logistics: {shippingDays, supplierRating, inventory: candidate.inventory ?? null}, scoredAt: new Date().toISOString()
  };
}

export function normalizeDropshipCandidate(item = {}, index = 0) {
  const supplierUrl = item.supplierUrl || item.supplier_url || item.product_url || item.url || "";
  const supplierPrice = number(item.supplierPrice ?? item.supplier_price ?? item.cost ?? item.sale_price ?? item.estimatedCost);
  return {
    source: "aliexpress", sourceStatus: item.sourceStatus || "PROVIDER_FEED", monetizationModel: "PHYSICAL_PRODUCT", paper: true,
    id: `aliexpress-provider-${item.id || item.product_id || index + 1}`, name: item.name || item.title || item.product_title || `Dropship product ${index + 1}`,
    category: item.category || item.category_name || "general", price: number(item.price ?? item.retailPrice ?? item.sale_price), currency: item.currency || "USD",
    supplierPrice, estimatedCost: supplierPrice, shippingCost: number(item.shippingCost ?? item.shipping_cost), supplierUrl, providerUrl: supplierUrl,
    shippingDays: number(item.shippingDays ?? item.deliveryDays ?? item.shipping_days), supplierRating: number(item.supplierRating ?? item.sellerRating ?? item.rating),
    inventory: item.inventory ?? item.stock ?? null, returnsPolicy: item.returnsPolicy || item.returnPolicy || "", rating: number(item.rating),
    imageUrl: item.imageUrl || item.image_url || item.main_image || item.image || "", demandScore: number(item.demandScore ?? item.demand_score), discoveredAt: new Date().toISOString()
  };
}

export function buildDigitalProductOpportunity(input = {}, context = {}) {
  const problem = String(input.problem || context.problem || context.name || "un problema recurrente del cliente").trim().slice(0, 240);
  const audience = String(input.audience || context.category || "audiencia de nicho").trim().slice(0, 120);
  const format = String(input.format || "guide_plus_templates").trim().slice(0, 60);
  const price = clamp(input.price ?? 29, 5, 999);
  const fulfillmentCost = clamp(input.fulfillmentCost ?? 1.5, 0, 100);
  const platformFee = price * .03 + .30;
  const contribution = price - fulfillmentCost - platformFee;
  const evidence = Array.isArray(input.evidence) ? input.evidence.slice(0, 10) : [];
  const validation = {status: evidence.length >= 3 ? "SUPPORTED" : "REQUIRES_VALIDATION", evidenceCount: evidence.length, nextTest: evidence.length >= 3 ? "paper_offer_test" : "collect_3_independent_problem_signals"};
  return {id: `digital-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, source: "commerce_problem_signal", monetizationModel: "DIGITAL_PRODUCT", status: "PAPER_DRAFT", name: `${audience}: ${format.replaceAll("_", " ")}`, problem, audience, format, price: Number(price.toFixed(2)), economics: {price: Number(price.toFixed(2)), fulfillmentCost: Number(fulfillmentCost.toFixed(2)), platformFee: Number(platformFee.toFixed(2)), contribution: Number(contribution.toFixed(2)), marginPct: Number((contribution / price * 100).toFixed(1)), planningOnly: true}, validation, createdAt: new Date().toISOString()};
}

export function priceOffer(product = {}, input = {}) {
  const cost = Math.max(0, number(input.cost ?? product.estimatedCost ?? product.supplierPrice ?? 0));
  const shipping = Math.max(0, number(input.shipping ?? product.shippingCost ?? 0));
  const paymentFeeFixed = .30;
  const paymentRate = .029;
  const platformRate = clamp(input.platformRate ?? .02, 0, .3);
  const refundRate = clamp(input.refundReservePct ?? .05, 0, .5);
  const adRate = clamp(input.adReservePct ?? .2, 0, .8);
  const targetMargin = clamp(input.targetMarginPct ?? 25, 0, 95);
  const base = cost + shipping + paymentFeeFixed;
  const targetPrice = base / Math.max(.01, 1 - paymentRate - platformRate - refundRate - adRate - targetMargin / 100);
  const prices = [0, .1, .2].map(discount => {
    const price = targetPrice * (1 - discount);
    const fees = price * (paymentRate + platformRate + refundRate + adRate) + paymentFeeFixed;
    const contribution = price - cost - shipping - fees;
    return {discountPct: discount * 100, price: Number(price.toFixed(2)), contribution: Number(contribution.toFixed(2)), marginPct: Number((contribution / Math.max(price, .01) * 100).toFixed(1))};
  });
  return {recommendedPrice: Number(targetPrice.toFixed(2)), targetMarginPct: targetMargin, inputs: {cost, shipping, paymentRate, platformRate, refundRate, adRate}, sensitivity: prices, guardrails: {maxDiscountPct: Number(input.maxDiscountPct ?? 20), noNegativeContribution: true, planningOnly: true}};
}
