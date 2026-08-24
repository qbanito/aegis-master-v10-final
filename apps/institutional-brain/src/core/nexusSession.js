import crypto from "node:crypto";
import {scenarioPreset} from "../../agents-scenarios/scenarioLibrary.js";
import {runAgent} from "./agentRuntime.js";
import {escalateTier} from "../ai/modelRouter.js";
import {runStressTest, runScenario} from "./simulationEngine.js";
import {networkFit} from "./networkIntelligence.js";
import {computeRevenueModel} from "./revenueModel.js";
import {computeSecurityScore} from "./securityScore.js";
import {listAuditTrail} from "./auditTrail.js";
import {listTranches, runWaterfall} from "./capitalStack.js";
import {evaluateApprovalGates} from "./approvalGates.js";
import {evaluateTokenizationFit} from "./tokenizationEngine.js";

// Gathers real deterministic evidence for a scenario's hook (if any) by delegating to the exact
// same engines the rest of the app already uses — NEXUS sessions never compute their own numbers.
function gatherEvidence(deal, hook) {
  if (!hook) return null;
  switch (hook.type) {
    case "stress-test":
      return runStressTest(deal, {noiShockPct: hook.noiShockPct, rateShockBps: hook.rateShockBps});
    case "scenario":
      return runScenario(deal, hook.id, hook);
    case "network-fit":
      return networkFit(deal.dealType);
    case "revenue-model":
      return computeRevenueModel(deal);
    case "security-score":
      return computeSecurityScore(deal);
    case "audit-trail":
      return {entries: listAuditTrail(deal).slice(0, 20)};
    case "approval-gates":
      return evaluateApprovalGates(deal);
    case "tokenization-fit":
      return evaluateTokenizationFit(deal);
    case "capital-stack": {
      const availableCashUsd = deal.lastSimulation?.periods?.[0]?.availableCashUsd || deal.finance.annualCashflowUsd / 4;
      return {tranches: listTranches(deal), waterfall: runWaterfall(deal, availableCashUsd)};
    }
    case "crisis":
      return {
        debtDefault: runScenario(deal, "default-on-debt"),
        adminCompromise: runScenario(deal, "compromised-administrator")
      };
    default:
      return null;
  }
}

function evidenceSummary(hook, evidence) {
  if (!evidence) return "";
  try { return JSON.stringify(evidence).slice(0, 2500); } catch { return ""; }
}

function buildScenarioTask(preset, evidence, transcriptSoFar) {
  const lines = [
    `Simulación NEXUS #${preset.number}: ${preset.title}`,
    `Situación: ${preset.situation}`,
    `Lo que este ejercicio debe demostrar: ${preset.whatToProve}`
  ];
  if (preset.dealOverrides) {
    lines.push(`Contexto de escenario (hipotético, no persistido): trata esta operación como si tuviera estos parámetros distintos a los cargados: ${JSON.stringify(preset.dealOverrides)}.`);
  }
  if (evidence) {
    lines.push(`Evidencia determinística ya calculada por el motor financiero (única fuente de verdad numérica, no la contradigas): ${evidenceSummary(preset.hook, evidence)}`);
  }
  if (transcriptSoFar.length) {
    lines.push("Esto es lo que ya se dijo en la reunión antes de que tomaras la palabra (reacciona de verdad a esto en tu 'team_message' — está de acuerdo, en desacuerdo, o suma algo nuevo; no lo ignores ni lo repitas):");
    transcriptSoFar.forEach(entry => lines.push(`- ${entry.alias} dijo: "${(entry.team_message || entry.analysis_summary).slice(0, 400)}" (postura: ${entry.decision}, confianza ${entry.confidence})`));
  }
  lines.push("Responde desde el mandato de tu rol específico en esta situación.");
  return lines.join("\n");
}

// Computed after every single agent turn (not just once at the end) so a live caller can watch the
// group's verdict actually form — who agrees, who's the holdout, whether the room is still split —
// instead of the synthesis materializing as one static block after everyone has already spoken.
function computeSynthesis(transcript, teamSize) {
  const decisions = transcript.map(entry => entry.decision);
  const uniqueDecisions = [...new Set(decisions)];
  const allIn = transcript.length === teamSize;
  const unanimousSoFar = uniqueDecisions.length === 1;
  // Only collapse into the single "el equipo coincide" line once EVERYONE has actually spoken and
  // agreed — while the team is still short a response, always show the running per-agent list
  // (even if the first one or two happen to agree so far), otherwise the very first agent's real
  // decision would silently vanish from the panel until the whole team finished, undermining the
  // point of streaming this live in the first place.
  const agreements = allIn && unanimousSoFar ? [`El equipo coincide en: ${uniqueDecisions[0]}.`] : [];
  const disagreements = allIn && unanimousSoFar ? [] : transcript.map(entry => `${entry.alias}: ${entry.decision} · confianza ${entry.confidence}`);
  const criticalRisks = transcript.flatMap(entry => entry.risks.map(risk => ({agentId: entry.agentId, alias: entry.alias, risk})));
  const nextActions = transcript.flatMap(entry => entry.required_actions.map(action => action.description));
  return {
    agreements, disagreements, criticalRisks, nextActions,
    tally: transcript.map(entry => ({agentId: entry.agentId, alias: entry.alias, decision: entry.decision})),
    respondedCount: transcript.length, teamSize, settled: allIn
  };
}

// Runs a scenario's full team sequentially, each agent reading the transcript so far — this is
// the "team communication" simulation: agents genuinely react to teammates within the same
// session, not just to the global blackboard. Deterministic evidence (when the scenario has a
// hook) is computed once up front and handed to every agent as ground truth.
//
// `onEvent` (optional) is called in real time as the session actually progresses — evidence
// gathered, each agent starting to "think," each agent's real result landing — so a caller
// streaming this to a client can render it as a live conversation instead of a single blocking
// response after the whole team has run.
export async function runScenarioSession(deal, scenarioId, {actor = "demo-user", onEvent} = {}) {
  const emit = onEvent || (() => {});
  const preset = scenarioPreset(scenarioId);
  emit({type: "session_started", scenarioId, team: preset.team});
  const evidence = gatherEvidence(deal, preset.hook);
  if (evidence) emit({type: "evidence", evidence});
  const transcript = [];
  const startedAt = new Date().toISOString();
  let tier = "standard";

  for (const agentId of preset.team) {
    emit({type: "agent_start", agentId});
    const task = buildScenarioTask(preset, evidence, transcript);
    const result = await runAgent(deal, agentId, {task, tier, actor});
    transcript.push(result);
    emit({type: "agent_result", entry: {
      agentId: result.agentId, alias: result.alias, reference: result.reference,
      team_message: result.team_message, analysis_summary: result.analysis_summary, decision: result.decision, confidence: result.confidence,
      risks: result.risks, questions: result.questions, required_actions: result.required_actions,
      blocking_items: result.blocking_items, model: result.model, provider: result.provider, usedFallback: result.usedFallback
    }});
    tier = escalateTier(tier, {confidence: result.confidence, decision: result.decision});
    emit({type: "synthesis_update", synthesis: computeSynthesis(transcript, preset.team.length)});
  }

  const synthesis = computeSynthesis(transcript, preset.team.length);

  const session = {
    sessionId: `session_${crypto.randomUUID()}`,
    scenarioId,
    scenarioNumber: preset.number,
    title: preset.title,
    category: preset.category,
    situation: preset.situation,
    whatToProve: preset.whatToProve,
    evidence,
    transcript: transcript.map(entry => ({
      agentId: entry.agentId, alias: entry.alias, reference: entry.reference,
      team_message: entry.team_message, analysis_summary: entry.analysis_summary, decision: entry.decision, confidence: entry.confidence,
      risks: entry.risks, questions: entry.questions, required_actions: entry.required_actions,
      blocking_items: entry.blocking_items, model: entry.model, provider: entry.provider, usedFallback: entry.usedFallback
    })),
    synthesis,
    actor,
    startedAt,
    completedAt: new Date().toISOString()
  };

  deal.nexusSessions = deal.nexusSessions || {};
  deal.nexusSessions[scenarioId] = [session, ...(deal.nexusSessions[scenarioId] || [])].slice(0, 10);

  emit({type: "session_complete", session});
  return session;
}

export function listNexusSessions(deal) {
  return deal.nexusSessions || {};
}

export function latestNexusSession(deal, scenarioId) {
  return deal.nexusSessions?.[scenarioId]?.[0] || null;
}
