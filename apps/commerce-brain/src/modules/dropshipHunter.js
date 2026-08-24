import {store, emit} from "../core/store.js";
import {connector} from "../connectors/connectorRegistry.js";
import {providerFeedCandidates} from "../connectors/feedConnector.js";
import {findProduct} from "../core/productCatalog.js";
import {enrichProduct} from "../core/economics.js";

export async function run(input = {}) {
  const connectorState = connector("aliexpress");
  if (!connectorState?.configured) {
    const result = {status: "BLOCKED", mode: "PAPER", source: "aliexpress", blockers: ["ALIEXPRESS_CONNECTOR_NOT_CONFIGURED"], message: "Configura una API o feed de AliExpress antes de usar datos operativos. No se crean candidatos sintéticos en este módulo."};
    emit("commerce_dropship_hunter_blocked", result, .8);
    return result;
  }
  const providerItems = await providerFeedCandidates("aliexpress");
  if (!providerItems?.length) {
    const result = {status: "DEGRADED", mode: "PAPER", source: "aliexpress", blockers: ["ALIEXPRESS_FEED_EMPTY_OR_UNAVAILABLE"], message: "El conector está configurado pero no entregó candidatos válidos."};
    emit("commerce_dropship_hunter_degraded", result, .8);
    return result;
  }
  const ranked = [];
  providerItems.slice(0, Number(input.maxItems || 50)).forEach(item => {
    const existing = findProduct(item.id);
    const target = existing ? Object.assign(existing, item) : item;
    target.sourceStatus = "PROVIDER_FEED";
    target.monetizationModel = "PHYSICAL_PRODUCT";
    if (!existing) store.products.push(target);
    enrichProduct(target);
    ranked.push({id: target.id, name: target.name, score: target.score, tier: target.tier, risks: target.risks, economics: target.economics, logistics: target.logistics || null});
  });
  const result = {status: "READY", mode: "PAPER", source: "aliexpress", provider: connectorState.provider, discovered: ranked.length, ranked: ranked.sort((a, b) => b.score - a.score), parameters: store.moduleConfigs["dropship-hunter"]};
  emit("commerce_dropship_hunter_completed", {discovered: result.discovered, top: result.ranked[0] || null, mode: "PAPER"}, .8);
  return result;
}
