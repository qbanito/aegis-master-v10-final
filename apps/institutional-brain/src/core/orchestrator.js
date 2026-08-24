import {ORCHESTRATOR} from "./agentRegistry.js";
import {runAgent} from "./agentRuntime.js";
import {escalateTier} from "../ai/modelRouter.js";

export function availableFlows() {
  return Object.keys(ORCHESTRATOR.routing);
}

// Runs a flow's agent sequence one at a time (not parallel — later agents legitimately need
// earlier agents' findings, matching the JSON's own interaction_rules). Tier escalates
// deterministically as the sequence progresses (spec section 11), it is never the model deciding
// to escalate itself.
export async function runFlow(deal, flowName, {task} = {}) {
  const sequence = ORCHESTRATOR.routing[flowName];
  if (!sequence) throw new Error(`UNKNOWN_FLOW:${flowName}`);
  const results = [];
  let tier = "standard";
  for (const agentId of sequence) {
    const lines = [task || `Comité: flujo "${flowName}". Analiza el estado actual del deal y produce tu recomendación desde el mandato de tu rol.`];
    if (results.length) {
      lines.push("Esto es lo que ya se dijo en el comité antes de que tomaras la palabra (reacciona de verdad a esto en tu 'team_message' — de acuerdo, en desacuerdo, o suma algo nuevo; no lo repitas):");
      results.forEach(entry => lines.push(`- ${entry.alias} dijo: "${(entry.team_message || entry.analysis_summary).slice(0, 400)}" (postura: ${entry.decision}, confianza ${entry.confidence})`));
    }
    const result = await runAgent(deal, agentId, {task: lines.join("\n"), tier});
    results.push(result);
    tier = escalateTier(tier, {confidence: result.confidence, decision: result.decision});
  }
  return results;
}

// Committee Mode (spec section 44) — never hides disagreement (section 43). Agreement is only
// declared when every agent in the flow reached the same decision; otherwise every agent's
// decision is listed individually so the split is visible.
export async function conveneCommittee(deal, flowName = "new_deal", {task} = {}) {
  const results = await runFlow(deal, flowName, {task});
  const decisions = results.map(result => result.decision);
  const uniqueDecisions = [...new Set(decisions)];

  const agreements = uniqueDecisions.length === 1
    ? [`Los ${results.length} agentes de este flujo coinciden en: ${uniqueDecisions[0]}.`]
    : [];
  const disagreements = uniqueDecisions.length === 1
    ? []
    : results.map(result => `${result.alias} (${result.agentId}): ${result.decision} · confianza ${result.confidence}`);

  const criticalRisks = results.flatMap(result => result.risks.map(risk => ({agentId: result.agentId, alias: result.alias, risk})));
  const blockingItems = results.flatMap(result => result.blocking_items.map(item => ({agentId: result.agentId, alias: result.alias, item})));
  const atlas = results.find(result => result.agentId === "MG-A1-ATLAS");
  const nexus = results.find(result => result.agentId === "MG-A8-NEXUS");

  return {
    flow: flowName,
    dealId: deal.id,
    dealSummary: `${deal.name} — ${deal.dealType} — $${deal.asset.valueUsd.toLocaleString()}`,
    roleByRoleDecisions: results.map(result => ({agentId: result.agentId, alias: result.alias, reference: result.reference, decision: result.decision, confidence: result.confidence, team_message: result.team_message, summary: result.analysis_summary})),
    agreements,
    disagreements,
    criticalRisks,
    blockingItems,
    nexusDigitalArchitecture: nexus?.analysis_summary || null,
    atlasExecutiveDecision: atlas?.decision || null,
    nextActions: results.flatMap(result => result.required_actions.map(action => action.description))
  };
}
