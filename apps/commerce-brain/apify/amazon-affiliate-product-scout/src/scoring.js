const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function scoreAffiliateProduct(product, input = {}) {
  const price = number(product.price);
  const commissionRate = Math.max(0, Math.min(1, number(input.commissionRate, 0.04)));
  const contentCost = Math.max(0, number(input.contentCostPerProduct, 1.5));
  const expectedCommission = Number((price * commissionRate).toFixed(2));
  const contribution = Number((expectedCommission - contentCost).toFixed(2));
  const signals = {
    title: Boolean(product.title),
    asin: Boolean(product.asin),
    price: price > 0,
    image: Boolean(product.imageUrl),
    affiliateUrl: Boolean(product.affiliateUrl),
    availability: Boolean(product.availability)
  };
  const signalScore = Object.values(signals).filter(Boolean).length / Object.keys(signals).length * 60;
  const priceScore = price >= number(input.minPrice, 15) && price <= number(input.maxPrice, 150) ? 20 : 0;
  const contentScore = Array.isArray(product.features) && product.features.length >= 2 ? 10 : 0;
  const dataQualityScore = product.sourceStatus === "AMAZON_CREATORS_API" ? 10 : 0;
  const scoutScore = Math.round(Math.min(100, signalScore + priceScore + contentScore + dataQualityScore));
  const blockers = [];
  if (!product.asin) blockers.push("asin_missing");
  if (!product.affiliateUrl) blockers.push("affiliate_url_missing");
  if (!(price > 0)) blockers.push("price_missing");
  if (!product.imageUrl) blockers.push("image_missing");
  if (!product.availability) blockers.push("availability_unknown");
  if (product.demandSignalStatus !== "VERIFIED") blockers.push("demand_signal_missing");
  if (contribution <= 0) blockers.push("negative_content_contribution");
  const tier = scoutScore >= number(input.minScore, 55) && blockers.length <= 2 ? "REVIEW" : "REJECT";
  return {scoutScore, tier, blockers, signals, economics: {price, commissionRate, expectedCommission, contentCost, contribution, planningOnly: true}, scoredAt: new Date().toISOString()};
}

export function normalizeAmazonItem(item, {marketplace, partnerTag, input = {}} = {}) {
  const title = item?.itemInfo?.title?.displayValue || item?.itemInfo?.title?.displayValue?.[0] || "";
  const listing = item?.offersV2?.listings?.[0] || item?.offers?.listings?.[0] || {};
  const priceObject = listing?.price?.money || listing?.price || {};
  const price = number(priceObject.amount ?? priceObject.value ?? listing?.priceAmount);
  const imageUrl = item?.images?.primary?.large?.url || item?.images?.primary?.medium?.url || item?.images?.primary?.small?.url || "";
  const features = item?.itemInfo?.features?.displayValues || [];
  const asin = String(item?.asin || "");
  const baseUrl = item?.detailPageURL || (asin ? `https://${marketplace}/dp/${asin}` : "");
  const affiliateUrl = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}tag=${encodeURIComponent(partnerTag || "")}` : "";
  const product = {
    recordType: "product",
    source: "amazon",
    sourceStatus: "AMAZON_CREATORS_API",
    monetizationModel: "AMAZON_AFFILIATE",
    marketplace,
    asin,
    parentAsin: item?.parentASIN || null,
    title,
    brand: item?.itemInfo?.byLineInfo?.contributors?.[0]?.name || item?.itemInfo?.byLineInfo?.brand?.displayValue || null,
    category: item?.itemInfo?.classifications?.bindings?.[0]?.displayValue || null,
    features: Array.isArray(features) ? features.slice(0, 8) : [],
    price,
    currency: priceObject.currency || (marketplace === "www.amazon.com" ? "USD" : null),
    availability: listing?.availability?.message || listing?.availability?.type || null,
    imageUrl,
    affiliateUrl,
    detailPageURL: baseUrl,
    demandSignalStatus: "MISSING",
    dataFreshAt: new Date().toISOString()
  };
  return {...product, ...scoreAffiliateProduct(product, input)};
}

export function marketplaceRegion(marketplace) {
  const value = String(marketplace || "www.amazon.com").toLowerCase();
  if (["www.amazon.co.uk", "www.amazon.de", "www.amazon.es", "www.amazon.fr", "www.amazon.it"].includes(value)) return "EU";
  if (["www.amazon.co.jp", "www.amazon.com.au"].includes(value)) return "FE";
  return "NA";
}
