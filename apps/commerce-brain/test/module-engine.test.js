import test from "node:test";
import assert from "node:assert/strict";
import {buildDigitalProductOpportunity, normalizeDropshipCandidate, priceOffer, sanitizeModuleParameters, scoreDropshipCandidate} from "../src/module-engine.js";

test("dropship scoring blocks an unverified supplier", () => {
  const result = scoreDropshipCandidate({name: "Demo", price: 30, supplierPrice: 20, shippingCost: 2, shippingDays: 30, supplierRating: 4.2}, {});
  assert.equal(result.tier, "REJECT");
  assert.ok(result.blockers.includes("supplier_url_missing"));
  assert.ok(result.blockers.includes("shipping_window_unverified_or_too_slow"));
});

test("dropship scoring produces bounded economics for a viable candidate", () => {
  const product = normalizeDropshipCandidate({id: "sku-1", title: "Demo", price: 49.99, supplierPrice: 12, shippingCost: 3, shippingDays: 7, supplierRating: 4.8, url: "https://supplier.test/sku-1", imageUrl: "https://img.test/1", inventory: 40, returnsPolicy: "30 days"});
  const result = scoreDropshipCandidate(product, {minScore: 40});
  assert.ok(result.economics.contribution > 0);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.signals.supplierUrl, true);
});

test("master parameters ignore unknown keys and clamp unsafe values", () => {
  const result = sanitizeModuleParameters("dropship-hunter", {maxShippingDays: 999, unknown: "ignored", minSupplierRating: -2});
  assert.equal(result.maxShippingDays, 90);
  assert.equal(result.minSupplierRating, 0);
  assert.equal(result.unknown, undefined);
});

test("digital builder keeps unvalidated ideas out of proven demand", () => {
  const result = buildDigitalProductOpportunity({problem: "organizar viajes", audience: "viajeros"}, {});
  assert.equal(result.validation.status, "REQUIRES_VALIDATION");
  assert.equal(result.economics.planningOnly, true);
});

test("offer pricing exposes positive and discounted scenarios", () => {
  const result = priceOffer({estimatedCost: 12, shippingCost: 3}, {targetMarginPct: 25});
  assert.ok(result.recommendedPrice > 0);
  assert.equal(result.sensitivity.length, 3);
  assert.ok(result.sensitivity.every(row => row.contribution > 0));
});
