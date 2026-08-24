import crypto from "node:crypto";
import {store, emit, persist} from "./store.js";
import {SYSTEM_DATA_MODE} from "./config.js";
import {discoverProducts} from "./discovery.js";
import {runModule} from "../modules/moduleRunner.js";

export async function runCommerceCycle(input = {}) {
  const discovery = await discoverProducts(input.sources || ["amazon", "aliexpress"]);
  const activeBots = store.commerceBots.filter(bot => bot.active);
  const results = await Promise.all(activeBots.map(async bot => {
    try {
      const {result} = await runModule(bot.id, {cycle: "automatic", reason: input.reason || "scheduled"}, {trigger: "scheduled"});
      return {botId: bot.id, result};
    } catch (error) {
      return {botId: bot.id, result: {status: "ERROR", error: error.message}};
    }
  }));
  const top = store.products.filter(product => product.tier === "TEST_READY").sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || null;
  const cycle = {id: crypto.randomUUID(), createdAt: new Date().toISOString(), mode: SYSTEM_DATA_MODE, discovery: {count: discovery.discovered, providerFeedUsed: discovery.providerFeedUsed, noSignalSources: discovery.noSignalSources}, topProduct: top ? {id: top.id, name: top.name, score: top.score, economics: top.economics} : null, botsRun: results.length, results};
  emit("commerce_cycle_completed", cycle, .8); persist(); return cycle;
}
