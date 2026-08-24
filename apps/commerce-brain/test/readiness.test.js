import test from "node:test";
import assert from "node:assert/strict";
import {store} from "../src/core/store.js";
import {moduleReadiness} from "../src/core/readiness.js";

function resetStoreForTest() {
  store.products.length = 0;
  store.runs.length = 0;
  store.landingPages.length = 0;
  store.storeDrafts.length = 0;
  store.campaigns.length = 0;
  store.leads.length = 0;
  store.orders.length = 0;
  store.digitalProducts.length = 0;
  store.workflows.length = 0;
  delete process.env.AMAZON_PRODUCT_FEED_URL;
  delete process.env.ALIEXPRESS_API_URL;
  delete process.env.ALIEXPRESS_API_KEY;
}

test("dropship-hunter readiness is BLOCKED without an AliExpress connector", () => {
  resetStoreForTest();
  const readiness = moduleReadiness("dropship-hunter");
  assert.equal(readiness.state, "BLOCKED");
  assert.ok(readiness.blockers.includes("aliexpress_connector_not_configured"));
});

test("a configured module that has never run is OBSERVE_READY, not fabricated further", () => {
  resetStoreForTest();
  process.env.ALIEXPRESS_API_URL = "https://example.test/feed";
  const readiness = moduleReadiness("dropship-hunter");
  assert.equal(readiness.state, "OBSERVE_READY");
});

test("synthetic-only samples never advance a module past OBSERVE_READY", () => {
  resetStoreForTest();
  process.env.AMAZON_PRODUCT_FEED_URL = "https://example.test/amazon-feed";
  store.products.push({id: "amazon-paper-1", source: "amazon", sourceStatus: "PAPER_SAMPLE", tier: "TEST_READY", score: 80});
  store.runs.push({id: "run_1", moduleId: "product-scout", status: "SUCCESS", finishedAt: new Date().toISOString(), trigger: "manual"});
  const readiness = moduleReadiness("product-scout");
  assert.equal(readiness.evidence.hasRealEvidence, false);
  assert.equal(readiness.state, "OBSERVE_READY");
  assert.ok(readiness.warnings.includes("synthetic_samples_only_not_promotable"));
});

test("real evidence plus a completed run reaches DRAFT_READY for a non-mutating module", () => {
  resetStoreForTest();
  process.env.AMAZON_PRODUCT_FEED_URL = "https://example.test/amazon-feed";
  store.products.push({id: "amazon-provider-1", source: "amazon", sourceStatus: "PROVIDER_FEED", tier: "TEST_READY", score: 80});
  store.runs.push({id: "run_1", moduleId: "product-scout", status: "SUCCESS", finishedAt: new Date().toISOString(), trigger: "manual"});
  const readiness = moduleReadiness("product-scout");
  assert.equal(readiness.state, "DRAFT_READY");
  assert.equal(readiness.canMutate, false, "product-scout never owns a mutating action");
});

test("a mutating module cannot exceed DRAFT_READY without an approved workflow artifact", () => {
  resetStoreForTest();
  store.landingPages.push({id: "lp-1"});
  store.runs.push({id: "run_1", moduleId: "creative-factory", status: "SUCCESS", finishedAt: new Date().toISOString(), trigger: "manual"});
  const readiness = moduleReadiness("creative-factory");
  assert.equal(readiness.state, "DRAFT_READY");
  assert.equal(readiness.canMutate, true);
});
