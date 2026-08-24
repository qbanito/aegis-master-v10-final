import {z} from "zod";
import {agentDefinition, agentMeta} from "./agentRegistry.js";
import {generateStructured} from "../ai/aiProvider.js";
import {modelForTier, reasoningEffortForTier} from "../ai/modelRouter.js";
import {createAction} from "./actionEngine.js";

// LLM proposes, deterministic engine calculates (spec section 2) — this module never computes
// financial numbers itself; it only reads what simulationEngine.js / riskEngine.js / etc. already
// produced and asks the agent to reason over it. The structured response is validated with zod
// before anything is written back to the deal (spec section 15: no free-text parsing for
// decisions).
const RequiredActionSchema = z.object({
  description: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  blocking: z.boolean().default(false)
});

const AgentResponseSchema = z.object({
  team_message: z.string().default(""),
  analysis_summary: z.string(),
  decision: z.enum(["APPROVE", "APPROVE_WITH_CONDITIONS", "REJECT", "RETURN_FOR_REWORK", "BLOCK"]),
  confidence: z.number().min(0).max(100),
  risks: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  required_actions: z.array(RequiredActionSchema).default([]),
  blocking_items: z.array(z.string()).default([]),
  recommended_next_agent: z.string().nullable().default(null)
});

// Mirrors AgentResponseSchema for OpenAI/MuAPI structured-output mode. Strict JSON Schema mode
// requires every property in `required` and additionalProperties:false at every level, so
// optional/defaulted fields are expressed as always-present (the prompt instructs the model to
// use [] / null / "MEDIUM" when nothing applies) rather than as JSON Schema optionality.
export const AGENT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    team_message: {type: "string"},
    analysis_summary: {type: "string"},
    decision: {type: "string", enum: ["APPROVE", "APPROVE_WITH_CONDITIONS", "REJECT", "RETURN_FOR_REWORK", "BLOCK"]},
    confidence: {type: "number"},
    risks: {type: "array", items: {type: "string"}},
    questions: {type: "array", items: {type: "string"}},
    required_actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: {type: "string"},
          priority: {type: "string", enum: ["LOW", "MEDIUM", "HIGH"]},
          blocking: {type: "boolean"}
        },
        required: ["description", "priority", "blocking"],
        additionalProperties: false
      }
    },
    blocking_items: {type: "array", items: {type: "string"}},
    recommended_next_agent: {type: ["string", "null"]}
  },
  required: ["team_message", "analysis_summary", "decision", "confidence", "risks", "questions", "required_actions", "blocking_items", "recommended_next_agent"],
  additionalProperties: false
};

function buildSystemPrompt(def) {
  const doNot = (def.guardrails?.do_not || []).map(rule => `- ${rule}`).join("\n");
  const questions = (def.decision_framework?.questions || []).join(" ");
  return [
    def.simulation_prompt || def.mission,
    "",
    `AVISO OBLIGATORIO: ${def.guardrails?.simulation_notice || "Agente de simulación profesional."}`,
    "",
    "Reglas que nunca debes romper:",
    doNot,
    "",
    def.guardrails?.uncertainty_rule || "",
    "",
    questions ? `Preguntas que tu análisis debe responder: ${questions}` : "",
    "",
    "Responde SOLO con el JSON estructurado solicitado, basado únicamente en los datos del deal provistos en el mensaje del usuario. Nunca inventes cifras, contrapartes o hechos que no estén en ese contexto — si falta evidencia, dilo en 'questions' o 'risks' en vez de inventar un número.",
    "",
    "El campo 'team_message' es lo único que tus colegas van a leer en vivo, como si estuvieras hablando en la reunión ahora mismo — no un reporte. Escríbelo en primera persona, en español natural y directo, con el tono de tu rol (ejecutivo, cuantitativo, legal, técnico, etc. según tu mandato), de 2 a 4 frases. Si el mensaje incluye lo que dijeron tus colegas en esta sesión, reacciona de verdad: nómbralos, di si estás de acuerdo o no y por qué, no repitas su análisis. No uses viñetas ni encabezados dentro de 'team_message' — es una intervención hablada, no un memo.",
    "'analysis_summary' sí puede ser más formal y técnico, para el registro.",
    "El aviso obligatorio de simulación de arriba ya se muestra por separado en la interfaz junto a tu nombre — no lo repitas ni lo cites dentro de 'team_message' ni de 'analysis_summary', eso rompe la conversación."
  ].filter(Boolean).join("\n");
}

function buildUserPrompt(deal, task) {
  const context = {
    dealId: deal.id,
    name: deal.name,
    dealType: deal.dealType,
    status: deal.status,
    asset: deal.asset,
    finance: deal.finance,
    tranches: deal.tranches,
    investors: {
      count: deal.investors.count,
      eligibility: deal.investors.eligibility,
      kycPending: (deal.investors.list || []).filter(investor => investor.kyc !== "PASSED").length
    },
    roles: deal.roles,
    compliance: deal.compliance,
    custody: deal.custody,
    lastSimulationTotals: deal.lastSimulation?.totals || null,
    blackboard: deal.blackboard || null
  };
  return `Tarea: ${task || "Analiza el estado actual del deal y produce tu recomendación desde el mandato de tu rol."}\n\nContexto del deal (única fuente de verdad, no inventes nada fuera de esto):\n${JSON.stringify(context).slice(0, 8000)}`;
}

// Never contacts an AI provider; deterministic degradation matching the pattern already used in
// apps/commerce-brain/src/copilot/providerAdapter.js's localFallback.
function localFallback(agentMetaInfo, errorMessage) {
  return {
    team_message: `No pude conectarme a mi proveedor de IA (${errorMessage}), así que no tengo un análisis real que aportar todavía — necesito que alguien revise la configuración antes de que pueda opinar.`,
    analysis_summary: `[Fallback determinista — proveedor de IA no disponible: ${errorMessage}] ${agentMetaInfo.alias} no pudo completar su análisis en este momento.`,
    decision: "RETURN_FOR_REWORK",
    confidence: 0,
    risks: ["No se pudo contactar a ningún proveedor de IA configurado."],
    questions: [],
    required_actions: [{description: "Configurar OPENAI_API_KEY o MUAPI_API_KEY para obtener el análisis real de este agente.", priority: "HIGH", blocking: true}],
    blocking_items: ["AI_PROVIDER_UNAVAILABLE"],
    recommended_next_agent: null
  };
}

export async function runAgent(deal, agentId, {task, tier = "standard", actor = "demo-user"} = {}) {
  const meta = agentMeta(agentId);
  const def = meta.definition;
  const model = modelForTier(tier);
  const reasoningEffort = reasoningEffortForTier(tier);
  const system = buildSystemPrompt(def);
  const input = buildUserPrompt(deal, task);

  let response;
  let provider = null;
  let usedFallback = false;
  let errorMessage = null;
  try {
    const result = await generateStructured({system, input, model, reasoningEffort, schemaName: "agent_response", jsonSchema: AGENT_RESPONSE_JSON_SCHEMA});
    response = AgentResponseSchema.parse(result.json);
    provider = result.provider;
  } catch (error) {
    errorMessage = error.message;
    response = AgentResponseSchema.parse(localFallback(meta, errorMessage));
    usedFallback = true;
  }

  deal.agents = deal.agents || {};
  deal.agents[agentId] = {
    status: response.decision,
    lastRun: new Date().toISOString(),
    lastTask: task || null,
    lastResponse: response,
    confidence: response.confidence,
    model, provider, usedFallback
  };

  deal.blackboard = deal.blackboard || {facts: [], assumptions: [], openQuestions: [], risks: [], decisions: [], opinions: []};
  const now = new Date().toISOString();
  response.risks.forEach(risk => deal.blackboard.risks.push({by: agentId, text: risk, at: now}));
  response.questions.forEach(question => deal.blackboard.openQuestions.push({by: agentId, text: question, at: now}));
  deal.blackboard.opinions.push({by: agentId, decision: response.decision, confidence: response.confidence, summary: response.analysis_summary, at: now});

  const createdActions = response.required_actions.map(item => createAction(deal, {
    createdBy: agentId, type: "AGENT_RECOMMENDATION", priority: item.priority, description: item.description, blocking: item.blocking
  }));

  return {agentId, alias: meta.alias, reference: meta.reference, ...response, model, provider, usedFallback, errorMessage, createdActions, actor};
}
