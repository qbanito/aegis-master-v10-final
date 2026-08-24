import crypto from "node:crypto";
import {store, recordRun} from "./store.js";

function buildIdempotencyKey(moduleId, trigger) {
  if (trigger === "manual") return `${moduleId}:manual:${crypto.randomUUID()}`;
  // Hour-bucketed key for scheduled/workflow/master-command triggers so a re-fire within the same
  // bucket dedupes instead of double-counting evidence; a new hour always gets a fresh attempt.
  const bucket = new Date().toISOString().slice(0, 13);
  return `${moduleId}:${trigger}:${bucket}`;
}

export function findRecentSuccessByKey(idempotencyKey, freshMs) {
  return store.runs.find(run => run.idempotencyKey === idempotencyKey && run.status === "SUCCESS" && run.finishedAt && Date.now() - new Date(run.finishedAt).getTime() < freshMs) || null;
}

export function createRun({moduleId, trigger = "manual", actionStage = "OBSERVE", dataMode = "PAPER_WITH_REAL_DATA", input = {}, freshMs = 15 * 60 * 1000}) {
  const idempotencyKey = buildIdempotencyKey(moduleId, trigger);
  if (trigger !== "manual") {
    const existing = findRecentSuccessByKey(idempotencyKey, freshMs);
    if (existing) return {run: existing, deduped: true};
  }
  const run = {
    id: `run_${crypto.randomUUID()}`, moduleId, trigger, actionStage, dataMode,
    idempotencyKey, startedAt: new Date().toISOString(), finishedAt: null, durationMs: null,
    status: "RUNNING", newSignal: false, evidence: [], blockers: [], warnings: [], costUsd: null, error: null,
    requestInput: input, summary: null
  };
  return {run, deduped: false};
}

export function completeRun(run, {status, newSignal = false, evidence = [], blockers = [], warnings = [], summary = "", error = null, costUsd = null}) {
  run.finishedAt = new Date().toISOString();
  run.durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  run.status = status;
  run.newSignal = newSignal;
  run.evidence = evidence;
  run.blockers = blockers;
  run.warnings = warnings;
  run.summary = summary;
  run.error = error;
  run.costUsd = costUsd;
  recordRun(run);
  return run;
}

export function listRuns(moduleId, {limit = 20, status} = {}) {
  let rows = store.runs.filter(run => run.moduleId === moduleId);
  if (status) rows = rows.filter(run => run.status === status);
  return rows.slice(0, Math.min(100, Math.max(1, Number(limit) || 20)));
}
