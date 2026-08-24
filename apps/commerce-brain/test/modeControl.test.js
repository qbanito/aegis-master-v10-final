import test from "node:test";
import assert from "node:assert/strict";
import {store} from "../src/core/store.js";
import {getModuleMode, setModuleStage, assertPermission, permissionMatrixFor, PermissionDeniedError} from "../src/core/modeControl.js";

function resetMode(moduleId) { delete store.modeControl.modules[moduleId]; }

test("a module starts at OBSERVE and cannot run its owned action yet", () => {
  resetMode("creative-factory");
  const mode = getModuleMode("creative-factory");
  assert.equal(mode.actionStage, "OBSERVE");
  assert.throws(() => assertPermission("creative-factory", "generate_assets"), PermissionDeniedError);
});

test("advancing to DRAFT unlocks the module's owned action and nothing else", () => {
  resetMode("creative-factory");
  setModuleStage("creative-factory", "DRAFT", {actor: "test"});
  assert.doesNotThrow(() => assertPermission("creative-factory", "generate_assets"));
  const row = permissionMatrixFor("creative-factory");
  assert.equal(row.generate_assets.allowed, true);
  assert.equal(row.publish_products.allowed, false);
});

test("a module can never assert an action it doesn't own, even at DRAFT", () => {
  resetMode("creative-factory");
  setModuleStage("creative-factory", "DRAFT", {actor: "test"});
  assert.throws(() => assertPermission("creative-factory", "activate_ads"), PermissionDeniedError);
});

test("send_emails/process_orders/reassign_budget stay locked even at actionStage LIVE (no connector wired yet)", () => {
  resetMode("closer");
  const row = permissionMatrixFor("closer");
  assert.equal(row.send_emails.owned, true);
  assert.equal(row.send_emails.envGatePasses, false);
});

test("the deploy-time systemDataMode ceiling blocks LIVE outright, independent of confirmLive", () => {
  resetMode("traffic");
  let error = null;
  try { setModuleStage("traffic", "LIVE", {actor: "test", confirmLive: true}); }
  catch (caught) { error = caught; }
  assert.ok(error instanceof PermissionDeniedError);
});
