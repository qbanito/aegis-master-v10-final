import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

// Agent Registry — loads the supplied JSON files verbatim from /agents at boot. Never mutated
// at runtime; per-deal execution state lives on the deal object (see agentRuntime.js), not here.
const AGENTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../agents");

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, file), "utf8"));
}

export const MANIFEST = loadJson("manifest-v2.json");
export const ORCHESTRATOR = loadJson("mg-orchestrator-brain-v2.json");

export const AGENTS = Object.fromEntries(MANIFEST.agents.map(entry => [entry.id, {
  id: entry.id,
  alias: entry.alias,
  reference: entry.reference,
  role: entry.role,
  definition: loadJson(entry.file)
}]));

export function listAgents() {
  return Object.values(AGENTS).map(agent => ({
    id: agent.id,
    alias: agent.alias,
    reference: agent.reference,
    role: agent.role,
    simulationNotice: agent.definition.guardrails?.simulation_notice || null
  }));
}

export function agentMeta(agentId) {
  const agent = AGENTS[agentId];
  if (!agent) throw new Error(`UNKNOWN_AGENT:${agentId}`);
  return agent;
}

export function agentDefinition(agentId) {
  return agentMeta(agentId).definition;
}
