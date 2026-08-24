import {store, emit} from "../core/store.js";

export function run(input = {}) {
  const hotLeadScore = store.moduleConfigs.closer.hotLeadScore;
  const queue = store.leads.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, Number(input.limit || 50)).map(lead => ({...lead, priority: Number(lead.score || 0) >= hotLeadScore ? "HOT" : "NURTURE", nextAction: Number(lead.score || 0) >= hotLeadScore ? "human_review_or_approved_sequence" : "educational_follow_up"}));
  const result = {status: queue.length ? "READY" : "REVIEW_REQUIRED", mode: "PAPER", queue, blockers: queue.length ? [] : ["CRM_EMPTY"], externalMessagingAllowed: false};
  emit("commerce_sales_queue_updated", {leads: queue.length, hot: queue.filter(lead => lead.priority === "HOT").length, mode: "PAPER"}, .6);
  return result;
}
