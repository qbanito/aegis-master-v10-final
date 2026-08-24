import test from "node:test";
import assert from "node:assert/strict";
import {store} from "../src/core/store.js";
import {createRun, completeRun, listRuns} from "../src/core/runRegistry.js";

test("a scheduled run dedupes within the same idempotency bucket", () => {
  store.runs.length = 0;
  const {run: run1, deduped: deduped1} = createRun({moduleId: "closer", trigger: "scheduled", input: {}});
  assert.equal(deduped1, false);
  completeRun(run1, {status: "SUCCESS", newSignal: true, evidence: [{type: "result", summary: "1 item"}]});
  const {run: run2, deduped: deduped2} = createRun({moduleId: "closer", trigger: "scheduled", input: {}});
  assert.equal(deduped2, true);
  assert.equal(run2.id, run1.id);
});

test("a manual trigger always forces a fresh run and never dedupes", () => {
  store.runs.length = 0;
  const {run: run1} = createRun({moduleId: "closer", trigger: "manual", input: {}});
  completeRun(run1, {status: "SUCCESS", newSignal: true});
  const {run: run2, deduped} = createRun({moduleId: "closer", trigger: "manual", input: {}});
  assert.equal(deduped, false);
  assert.notEqual(run2.id, run1.id);
});

test("a BLOCKED/DEGRADED run never marks newSignal, so signals cannot inflate on empty scans", () => {
  store.runs.length = 0;
  const {run} = createRun({moduleId: "dropship-hunter", trigger: "scheduled"});
  completeRun(run, {status: "BLOCKED", newSignal: false, evidence: [], blockers: ["ALIEXPRESS_CONNECTOR_NOT_CONFIGURED"]});
  assert.equal(run.newSignal, false);
  assert.equal(run.status, "BLOCKED");
});

test("listRuns filters by module and status, newest first", () => {
  store.runs.length = 0;
  const {run: a} = createRun({moduleId: "closer", trigger: "manual"});
  completeRun(a, {status: "SUCCESS"});
  const {run: b} = createRun({moduleId: "closer", trigger: "manual"});
  completeRun(b, {status: "BLOCKED"});
  const rows = listRuns("closer", {status: "BLOCKED"});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, b.id);
});
