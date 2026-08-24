import {store} from "./store.js";

export function funnelSummary() {
  const counts = store.funnelEvents.reduce((acc, event) => { const type = String(event.type || "unknown"); acc[type] = (acc[type] || 0) + 1; return acc; }, {});
  const revenue = store.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidOrders = store.orders.filter(order => order.status === "paid");
  const spend = store.campaigns.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0);
  return {counts, orders: store.orders.length, paidOrders: paidOrders.length, revenue: Number(revenue.toFixed(2)), spend: Number(spend.toFixed(2)), conversionRate: counts.checkout_started ? Number((paidOrders.length / counts.checkout_started * 100).toFixed(2)) : 0, lastEventAt: store.funnelEvents[0]?.createdAt || null};
}
