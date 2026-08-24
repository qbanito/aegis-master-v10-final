import fs from "node:fs";
import {DATA_DIR, DATA_FILE} from "./config.js";

function loadPersistence() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}

const persisted = loadPersistence();
const deals = Array.isArray(persisted.deals) ? persisted.deals : [];

export const store = {deals};

// Tests import this module directly and mutate `store` with fixtures — persistence must be a
// no-op in that context so a test run never overwrites the real institutional.json on disk.
const TEST_MODE = process.env.NODE_ENV === "test";

let persistTimer = null;
let persistScheduled = false;

function writeSnapshotNow() {
  if (TEST_MODE) return;
  try {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(DATA_FILE, JSON.stringify({deals: store.deals}, null, 2));
  } catch {
    // best-effort local persistence; the in-memory store remains the source of truth for the process
  }
}

export function persist() {
  if (TEST_MODE) return;
  persistScheduled = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!persistScheduled) return;
    persistScheduled = false;
    writeSnapshotNow();
  }, 250);
  if (typeof persistTimer.unref === "function") persistTimer.unref();
}

export function findDeal(id) {
  return store.deals.find(deal => deal.id === id);
}

export function upsertDeal(deal) {
  const index = store.deals.findIndex(item => item.id === deal.id);
  if (index === -1) store.deals.unshift(deal);
  else store.deals[index] = deal;
  persist();
  return deal;
}
