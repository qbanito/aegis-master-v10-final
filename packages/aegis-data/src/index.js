import crypto from "node:crypto";
import {createRequire} from "node:module";

let sqlClient;
let neonModule;
const stateQueues = new Map();
const warned = new Set();

function connectionString() {
  return String(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "").trim();
}

function warnOnce(key, error) {
  if (warned.has(key)) return;
  warned.add(key);
  if (process.env.AEGIS_DATA_DEBUG === "true") console.warn(`[aegis-data] ${key}: ${error?.message || error}`);
}

async function client() {
  const url = connectionString();
  if (!url) return null;
  if (!sqlClient) {
    if (!neonModule) {
      try {
        neonModule = await import("@neondatabase/serverless");
      } catch {
        const requireFromService = createRequire(`${process.cwd()}/package.json`);
        neonModule = requireFromService("@neondatabase/serverless");
      }
    }
    sqlClient = neonModule.neon(url);
  }
  return sqlClient;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function queueState(serviceKey, operation) {
  const previous = stateQueues.get(serviceKey) || Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  stateQueues.set(serviceKey, next.catch(() => {}));
  return next;
}

async function readState(serviceKey) {
  try {
    const sql = await client();
    if (!sql) return null;
    const rows = await sql`SELECT payload FROM aegis.state_snapshots WHERE service_key = ${serviceKey} LIMIT 1`;
    return rows[0]?.payload ?? null;
  } catch (error) {
    warnOnce(`read:${serviceKey}`, error);
    return null;
  }
}

function writeState(serviceKey, payload) {
  return queueState(serviceKey, async () => {
    try {
      const sql = await client();
      if (!sql) return {ok: false, skipped: true, reason: "DATABASE_URL_MISSING"};
      await sql`
        INSERT INTO aegis.state_snapshots (service_key, version, payload, updated_at)
        VALUES (${serviceKey}, 1, ${json(payload)}::jsonb, now())
        ON CONFLICT (service_key) DO UPDATE SET
          version = aegis.state_snapshots.version + 1,
          payload = EXCLUDED.payload,
          updated_at = now()
      `;
      return {ok: true};
    } catch (error) {
      warnOnce(`write:${serviceKey}`, error);
      return {ok: false, error: error.message};
    }
  });
}

function appendEvent(service, eventType, payload = {}, options = {}) {
  const id = String(options.id || payload?.id || crypto.randomUUID());
  return (async () => {
    try {
      const sql = await client();
      if (!sql) return {ok: false, skipped: true, reason: "DATABASE_URL_MISSING"};
      await sql`
        INSERT INTO aegis.events (id, service, event_type, source, correlation_id, payload, created_at)
        VALUES (${id}, ${service}, ${eventType}, ${options.source || service}, ${options.correlationId || null}, ${json(payload)}::jsonb, now())
        ON CONFLICT (id) DO NOTHING
      `;
      return {ok: true, id};
    } catch (error) {
      warnOnce(`event:${service}`, error);
      return {ok: false, error: error.message};
    }
  })();
}

function upsertRecord(brain, collection, id, payload) {
  return (async () => {
    try {
      const sql = await client();
      if (!sql) return {ok: false, skipped: true, reason: "DATABASE_URL_MISSING"};
      const key = String(id || crypto.randomUUID());
      await sql`
        INSERT INTO aegis.records (id, brain, collection, payload, created_at, updated_at)
        VALUES (${key}, ${brain}, ${collection}, ${json(payload)}::jsonb, now(), now())
        ON CONFLICT (id) DO UPDATE SET brain = EXCLUDED.brain, collection = EXCLUDED.collection, payload = EXCLUDED.payload, updated_at = now()
      `;
      return {ok: true, id: key};
    } catch (error) {
      warnOnce(`record:${brain}:${collection}`, error);
      return {ok: false, error: error.message};
    }
  })();
}

function appendScan(service, scanner, payload = {}) {
  return (async () => {
    try {
      const sql = await client();
      if (!sql) return {ok: false, skipped: true, reason: "DATABASE_URL_MISSING"};
      await sql`INSERT INTO aegis.scans (service, scanner, payload) VALUES (${service}, ${scanner}, ${json(payload)}::jsonb)`;
      return {ok: true};
    } catch (error) {
      warnOnce(`scan:${service}:${scanner}`, error);
      return {ok: false, error: error.message};
    }
  })();
}

function upsertOpportunity(opportunity = {}, brain = "finance") {
  const id = String(opportunity.id || opportunity.opportunityId || crypto.randomUUID());
  return (async () => {
    try {
      const sql = await client();
      if (!sql) return {ok: false, skipped: true, reason: "DATABASE_URL_MISSING"};
      await sql`
        INSERT INTO aegis.opportunities (id, strategy_id, brain, network, asset, status, confidence, expected_profit_usd, payload, created_at, updated_at)
        VALUES (${id}, ${opportunity.strategyId || null}, ${brain}, ${opportunity.network || null}, ${opportunity.asset || opportunity.symbol || null}, ${opportunity.status || null}, ${Number.isFinite(Number(opportunity.confidence)) ? Number(opportunity.confidence) : null}, ${Number.isFinite(Number(opportunity.expectedProfitUsd)) ? Number(opportunity.expectedProfitUsd) : null}, ${json(opportunity)}::jsonb, now(), now())
        ON CONFLICT (id) DO UPDATE SET strategy_id = EXCLUDED.strategy_id, brain = EXCLUDED.brain, network = EXCLUDED.network, asset = EXCLUDED.asset, status = EXCLUDED.status, confidence = EXCLUDED.confidence, expected_profit_usd = EXCLUDED.expected_profit_usd, payload = EXCLUDED.payload, updated_at = now()
      `;
      return {ok: true, id};
    } catch (error) {
      warnOnce(`opportunity:${brain}`, error);
      return {ok: false, error: error.message};
    }
  })();
}

function upsertExecution(execution = {}, brain = "finance") {
  const id = String(execution.id || execution.executionId || crypto.randomUUID());
  return (async () => {
    try {
      const sql = await client();
      if (!sql) return {ok: false, skipped: true, reason: "DATABASE_URL_MISSING"};
      await sql`
        INSERT INTO aegis.executions (id, strategy_id, opportunity_id, mode, status, realized_profit_usd, payload, created_at, closed_at)
        VALUES (${id}, ${execution.strategyId || null}, ${execution.opportunityId || null}, ${execution.mode || null}, ${execution.status || null}, ${Number.isFinite(Number(execution.realizedProfitUsd)) ? Number(execution.realizedProfitUsd) : null}, ${json({...execution, brain})}::jsonb, now(), ${execution.closedAt ? new Date(execution.closedAt) : null})
        ON CONFLICT (id) DO UPDATE SET strategy_id = EXCLUDED.strategy_id, opportunity_id = EXCLUDED.opportunity_id, mode = EXCLUDED.mode, status = EXCLUDED.status, realized_profit_usd = EXCLUDED.realized_profit_usd, payload = EXCLUDED.payload, closed_at = EXCLUDED.closed_at
      `;
      return {ok: true, id};
    } catch (error) {
      warnOnce(`execution:${brain}`, error);
      return {ok: false, error: error.message};
    }
  })();
}

function appendPerformance(snapshot = {}) {
  return (async () => {
    try {
      const sql = await client();
      if (!sql) return {ok: false, skipped: true, reason: "DATABASE_URL_MISSING"};
      await sql`INSERT INTO aegis.performance_snapshots (strategy_id, samples, filled, realized_profit_usd, payload) VALUES (${snapshot.strategyId || null}, ${Number.isFinite(Number(snapshot.samples)) ? Number(snapshot.samples) : null}, ${Number.isFinite(Number(snapshot.filled)) ? Number(snapshot.filled) : null}, ${Number.isFinite(Number(snapshot.realizedProfitUsd)) ? Number(snapshot.realizedProfitUsd) : null}, ${json(snapshot)}::jsonb)`;
      return {ok: true};
    } catch (error) {
      warnOnce("performance", error);
      return {ok: false, error: error.message};
    }
  })();
}

export const aegisData = {
  configured: () => Boolean(connectionString()),
  readState,
  writeState,
  appendEvent,
  upsertRecord,
  appendScan,
  upsertOpportunity,
  upsertExecution,
  appendPerformance
};
