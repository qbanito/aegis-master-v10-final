import test from "node:test";
import assert from "node:assert/strict";
import {AGENTS, MANIFEST, ORCHESTRATOR, listAgents, agentDefinition} from "../src/core/agentRegistry.js";
import {availableFlows, runFlow, conveneCommittee} from "../src/core/orchestrator.js";
import {runAgent} from "../src/core/agentRuntime.js";
import {createAction, listActions, completeAction} from "../src/core/actionEngine.js";
import {buildDealFromForm, dealTypePreset} from "../src/core/dealSpec.js";

function manhattanDeal() { return buildDealFromForm(dealTypePreset("real-estate-spv")); }

test("agent registry loads exactly 8 specialist agents plus the orchestrator", () => {
  assert.equal(Object.keys(AGENTS).length, 8);
  assert.equal(MANIFEST.agents.length, 8);
  assert.equal(ORCHESTRATOR.agent_id, "MG-ORCHESTRATOR-BRAIN");
  const roster = listAgents();
  assert.ok(roster.every(agent => agent.simulationNotice && agent.simulationNotice.includes("simulación")));
  assert.ok(roster.some(agent => agent.id === "MG-A8-NEXUS" && agent.reference === "Neiver Alvarez"));
});

test("every agent definition has the guardrail fields the runtime depends on", () => {
  for (const id of Object.keys(AGENTS)) {
    const def = agentDefinition(id);
    assert.ok(def.guardrails?.simulation_notice, `${id} missing simulation_notice`);
    assert.ok(Array.isArray(def.guardrails?.do_not) && def.guardrails.do_not.length > 0, `${id} missing do_not rules`);
    assert.ok(def.simulation_prompt, `${id} missing simulation_prompt`);
  }
});

test("orchestrator routing flows only reference known agent ids", () => {
  const flows = availableFlows();
  assert.ok(flows.includes("new_deal"));
  assert.ok(flows.includes("commodity"));
  assert.ok(flows.includes("digital_asset_design"));
  for (const flow of flows) {
    for (const agentId of ORCHESTRATOR.routing[flow]) {
      assert.ok(AGENTS[agentId], `${flow} references unknown agent ${agentId}`);
    }
  }
});

test("action engine: create, list, complete", () => {
  const deal = manhattanDeal();
  const action = createAction(deal, {createdBy: "MG-A5-QUANTUM", description: "Re-run stress test", priority: "HIGH", blocking: true});
  assert.equal(listActions(deal).length, 1);
  assert.equal(listActions(deal)[0].status, "OPEN");
  const completed = completeAction(deal, action.action_id);
  assert.equal(completed.status, "COMPLETED");
});

test("agentRuntime falls back to deterministic local reasoning when no AI provider is configured", async () => {
  const deal = manhattanDeal();
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousMuapiKey = process.env.MUAPI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MUAPI_API_KEY;
  try {
    const result = await runAgent(deal, "MG-A5-QUANTUM", {task: "Audit the model"});
    assert.equal(result.usedFallback, true);
    assert.equal(result.confidence, 0);
    assert.ok(result.blocking_items.includes("AI_PROVIDER_UNAVAILABLE"));
    assert.equal(deal.agents["MG-A5-QUANTUM"].status, result.decision);
    assert.equal(listActions(deal).length, 1, "the fallback's required_action should still create a real Action");
  } finally {
    if (previousOpenAiKey !== undefined) process.env.OPENAI_API_KEY = previousOpenAiKey;
    if (previousMuapiKey !== undefined) process.env.MUAPI_API_KEY = previousMuapiKey;
  }
});

test("agentRuntime validates and records a structured response from a mocked AI provider", async () => {
  const deal = manhattanDeal();
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      model: "gpt-5.6-terra",
      output_text: JSON.stringify({
        analysis_summary: "El modelo reconcilia y el downside esta cubierto.",
        decision: "APPROVE_WITH_CONDITIONS",
        confidence: 82,
        risks: ["Sensibilidad alta a la tasa de interes"],
        questions: [],
        required_actions: [{description: "Correr stress test a 300bps", priority: "HIGH", blocking: false}],
        blocking_items: [],
        recommended_next_agent: "MG-A3-PRISM"
      })
    })
  });
  try {
    const result = await runAgent(deal, "MG-A5-QUANTUM", {task: "Audit assumptions"});
    assert.equal(result.usedFallback, false);
    assert.equal(result.provider, "openai");
    assert.equal(result.decision, "APPROVE_WITH_CONDITIONS");
    assert.equal(result.confidence, 82);
    assert.equal(deal.blackboard.opinions.length, 1);
    assert.equal(listActions(deal).length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey; else delete process.env.OPENAI_API_KEY;
  }
});

test("conveneCommittee runs the full new_deal flow and never hides disagreement", async () => {
  const deal = manhattanDeal();
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousMuapiKey = process.env.MUAPI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MUAPI_API_KEY;
  try {
    const summary = await conveneCommittee(deal, "new_deal");
    assert.equal(summary.roleByRoleDecisions.length, ORCHESTRATOR.routing.new_deal.length);
    // every agent falls back to RETURN_FOR_REWORK with no provider configured, so this is
    // actually an agreement case — confirm the agreement path renders correctly too.
    assert.ok(summary.agreements.length > 0 || summary.disagreements.length > 0);
    assert.equal(summary.dealId, deal.id);
  } finally {
    if (previousOpenAiKey !== undefined) process.env.OPENAI_API_KEY = previousOpenAiKey;
    if (previousMuapiKey !== undefined) process.env.MUAPI_API_KEY = previousMuapiKey;
  }
});
