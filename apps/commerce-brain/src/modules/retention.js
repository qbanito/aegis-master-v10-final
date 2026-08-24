import {store, emit} from "../core/store.js";

export function run(input = {}) {
  const now = Date.now();
  const windowMs = store.moduleConfigs.retention.upsellWindowDays * 86400000;
  const customerOrders = new Map();
  store.orders.forEach(order => { const key = order.customerId || order.email || "unknown"; const list = customerOrders.get(key) || []; list.push(order); customerOrders.set(key, list); });
  const queue = [...customerOrders.entries()].filter(([, list]) => list.length >= store.moduleConfigs.retention.minOrderCount).map(([customerId, list]) => ({customerId, orderCount: list.length, lastOrderAt: list.map(order => new Date(order.createdAt || 0).getTime()).sort((a, b) => b - a)[0] || null, action: now - (list.map(order => new Date(order.createdAt || 0).getTime()).sort((a, b) => b - a)[0] || now) <= windowMs ? "cross_sell_or_education" : "win_back_review"})).slice(0, Number(input.limit || 100));
  const result = {status: queue.length ? "READY" : "REVIEW_REQUIRED", mode: "PAPER", queue, blockers: queue.length ? [] : ["NO_VERIFIED_ORDER_COHORT"], messagingAllowed: false};
  emit("commerce_retention_queue_updated", {customers: queue.length, mode: "PAPER"}, .6);
  return result;
}
