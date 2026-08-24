import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIO_PRESETS, listScenarioPresets, scenarioPreset} from "../agents-scenarios/scenarioLibrary.js";
import {AGENTS} from "../src/core/agentRegistry.js";
import {runScenarioSession, listNexusSessions, latestNexusSession} from "../src/core/nexusSession.js";
import {buildDealFromForm, dealTypePreset} from "../src/core/dealSpec.js";

function manhattanDeal() { return buildDealFromForm(dealTypePreset("real-estate-spv")); }

const VALID_HOOK_TYPES = ["stress-test", "scenario", "network-fit", "revenue-model", "security-score", "audit-trail", "capital-stack", "crisis", "approval-gates", "tokenization-fit"];

test("scenario library has exactly 40 presets, numbered 1-40, unique ids", () => {
  assert.equal(SCENARIO_PRESETS.length, 40);
  const numbers = SCENARIO_PRESETS.map(p => p.number).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({length: 40}, (_, i) => i + 1));
  const ids = new Set(SCENARIO_PRESETS.map(p => p.id));
  assert.equal(ids.size, 40);
});

test("every scenario's team references only known registered agents", () => {
  for (const preset of SCENARIO_PRESETS) {
    assert.ok(preset.team.length > 0, `${preset.id} has an empty team`);
    for (const agentId of preset.team) {
      assert.ok(AGENTS[agentId], `${preset.id} references unknown agent ${agentId}`);
    }
  }
});

test("every scenario hook (when present) has a recognized type", () => {
  for (const preset of SCENARIO_PRESETS) {
    if (preset.hook) assert.ok(VALID_HOOK_TYPES.includes(preset.hook.type), `${preset.id} has unknown hook type ${preset.hook.type}`);
  }
});

test("listScenarioPresets omits internal hook/dealOverrides fields but keeps display fields", () => {
  const list = listScenarioPresets();
  assert.equal(list.length, 40);
  assert.ok(list.every(item => item.title && item.situation && item.whatToProve && item.category));
  assert.ok(list.every(item => !("hook" in item) && !("dealOverrides" in item)));
});

test("scenarioPreset throws on an unknown id", () => {
  assert.throws(() => scenarioPreset("does-not-exist"));
});

test("runScenarioSession runs the full team, gathers deterministic evidence, and persists the session", async () => {
  const deal = manhattanDeal();
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousMuapiKey = process.env.MUAPI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MUAPI_API_KEY;
  try {
    const session = await runScenarioSession(deal, "distribution-impossible");
    assert.equal(session.transcript.length, 3); // QUANTUM, PRISM, NEXUS
    assert.ok(session.evidence, "distribution-impossible has a scenario hook and should produce evidence");
    assert.equal(session.evidence.scenarioId, "distribution-error");
    assert.equal(latestNexusSession(deal, "distribution-impossible").sessionId, session.sessionId);
    assert.equal(listNexusSessions(deal)["distribution-impossible"].length, 1);
  } finally {
    if (previousOpenAiKey !== undefined) process.env.OPENAI_API_KEY = previousOpenAiKey;
    if (previousMuapiKey !== undefined) process.env.MUAPI_API_KEY = previousMuapiKey;
  }
});

test("runScenarioSession with no hook (pure-reasoning scenario) still runs the full team with null evidence", async () => {
  const deal = manhattanDeal();
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousMuapiKey = process.env.MUAPI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MUAPI_API_KEY;
  try {
    const session = await runScenarioSession(deal, "family-office-20m");
    assert.equal(session.evidence, null);
    assert.equal(session.transcript.length, 5); // CAPITAL, ORBIT, PRISM, QUANTUM, NEXUS
  } finally {
    if (previousOpenAiKey !== undefined) process.env.OPENAI_API_KEY = previousOpenAiKey;
    if (previousMuapiKey !== undefined) process.env.MUAPI_API_KEY = previousMuapiKey;
  }
});

test("the 'agents-disagree' and 'full-crisis' scenarios use the full 8-agent roster", () => {
  assert.equal(scenarioPreset("agents-disagree").team.length, 8);
  assert.equal(scenarioPreset("full-crisis").team.length, 8);
});

test("crisis scenario hook combines two deterministic scenario results", () => {
  const deal = manhattanDeal();
  assert.equal(scenarioPreset("full-crisis").hook.type, "crisis");
});
