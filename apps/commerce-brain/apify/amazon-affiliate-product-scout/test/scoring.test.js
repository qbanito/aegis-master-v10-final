import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAmazonItem, scoreAffiliateProduct} from "../src/scoring.js";

test("affiliate scoring never invents demand", () => {
  const product = normalizeAmazonItem({
    asin: "BTEST123",
    detailPageURL: "https://www.amazon.com/dp/BTEST123",
    images: {primary: {large: {url: "https://images.example/product.jpg"}}},
    itemInfo: {title: {displayValue: "Test product"}, features: {displayValues: ["Feature one", "Feature two"]}},
    offersV2: {listings: [{price: {money: {amount: 49.99, currency: "USD"}}, availability: {message: "In Stock"}}]}
  }, {marketplace: "www.amazon.com", partnerTag: "demo-20", input: {commissionRate: .04}});
  assert.equal(product.monetizationModel, "AMAZON_AFFILIATE");
  assert.equal(product.demandSignalStatus, "MISSING");
  assert.ok(product.blockers.includes("demand_signal_missing"));
  assert.match(product.affiliateUrl, /tag=demo-20/);
});

test("invalid product is rejected by deterministic gates", () => {
  const result = scoreAffiliateProduct({title: "", asin: "", price: 0, imageUrl: "", affiliateUrl: "", availability: null, demandSignalStatus: "MISSING"});
  assert.equal(result.tier, "REJECT");
  assert.ok(result.blockers.includes("price_missing"));
});
