import test from "node:test";
import assert from "node:assert/strict";
import {evaluateInvariants} from "../src/core/financialInvariants.js";

function baseState(overrides = {}) {
  return {
    distributedCash: 100,
    availableCash: 100,
    totalInvestorUnits: 25,
    authorizedUnits: 25,
    ownershipPercentages: [4, 4, 4],
    permittedOwnershipLimit: 20,
    waterfallExecutedInOrder: true,
    principalOutstanding: 1000,
    ...overrides
  };
}

test("all invariants pass on a clean base state", () => {
  const results = evaluateInvariants(baseState());
  assert.ok(results.every(item => item.satisfied));
  assert.equal(results.length, 7);
});

test("distributedCash<=availableCash fails on overdraw", () => {
  const results = evaluateInvariants(baseState({distributedCash: 150, availableCash: 100}));
  const rule = results.find(item => item.id === "distributedCash<=availableCash");
  assert.equal(rule.satisfied, false);
});

test("totalInvestorUnits<=authorizedUnits fails when units exceed authorization", () => {
  const results = evaluateInvariants(baseState({totalInvestorUnits: 30, authorizedUnits: 25}));
  assert.equal(results.find(item => item.id === "totalInvestorUnits<=authorizedUnits").satisfied, false);
});

test("ownershipPercentage<=permittedLimit fails when an investor exceeds the cap", () => {
  const results = evaluateInvariants(baseState({ownershipPercentages: [4, 30, 4], permittedOwnershipLimit: 20}));
  assert.equal(results.find(item => item.id === "ownershipPercentage<=permittedLimit").satisfied, false);
});

test("unverifiedInvestorCannotReceiveRestrictedAsset fails on an unverified transfer attempt", () => {
  const results = evaluateInvariants(baseState({transferAttempt: {recipientVerified: false}}));
  assert.equal(results.find(item => item.id === "unverifiedInvestorCannotReceiveRestrictedAsset").satisfied, false);
});

test("redemptionDate>=lockupExpiration fails on early redemption", () => {
  const results = evaluateInvariants(baseState({redemptionMonth: 5, lockupExpirationMonth: 12}));
  assert.equal(results.find(item => item.id === "redemptionDate>=lockupExpiration").satisfied, false);
});

test("principalOutstanding>=0 fails on a negative principal", () => {
  const results = evaluateInvariants(baseState({principalOutstanding: -1}));
  assert.equal(results.find(item => item.id === "principalOutstanding>=0").satisfied, false);
});

test("payment_waterfall_order cannot be bypassed fails when flagged out of order", () => {
  const results = evaluateInvariants(baseState({waterfallExecutedInOrder: false}));
  assert.equal(results.find(item => item.id === "payment_waterfall_order cannot be bypassed").satisfied, false);
});
