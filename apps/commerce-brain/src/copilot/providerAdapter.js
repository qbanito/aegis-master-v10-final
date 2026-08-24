import {z} from "zod";

const ResponseSchema = z.object({
  reply: z.string(),
  findings: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  proposals: z.array(z.object({id: z.string(), title: z.string(), detail: z.string(), action: z.string().optional()})).default([])
});

// Never fabricates numbers — only echoes what's already in `context` (real readiness/runs/policy).
function localFallback(message, context) {
  const moduleId = context?.moduleId || "module";
  const readiness = context?.readiness;
  const findings = [];
  const recommendations = [];
  if (readiness?.blockers?.length) findings.push(`Bloqueado por: ${readiness.blockers.join(", ")}`);
  if (readiness?.state) findings.push(`Estado actual: ${readiness.state}`);
  if (context?.lastRun) findings.push(`Última corrida: ${context.lastRun.status} (${context.lastRun.finishedAt || "en curso"})`);
  else findings.push("Este módulo todavía no tiene ninguna corrida registrada.");
  if (readiness?.state === "OBSERVE_READY") recommendations.push("Ejecuta una corrida manual para generar evidencia real antes de avanzar de etapa.");
  if (readiness?.blockers?.length) recommendations.push(`Resuelve primero: ${readiness.blockers[0]}`);
  if (!recommendations.length) recommendations.push("Revisa la pestaña Scanner para ver el historial de corridas recientes.");
  return {
    reply: `[Fallback determinista — sin OPENAI_API_KEY configurada o el proveedor falló] Para ${moduleId}: ${findings.join(". ")}.`,
    findings, recommendations, proposals: [],
    provider: "local_fallback", model: "deterministic-v1"
  };
}

async function callOpenAI(message, context, conversation) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const systemPrompt = `Eres el copiloto del módulo "${context.moduleId}" dentro de AEGIS Commerce Brain. Responde SOLO con JSON válido {"reply":string,"findings":string[],"recommendations":string[],"proposals":[{"id":string,"title":string,"detail":string,"action":string}]}. Basa tu respuesta únicamente en el contexto real provisto (readiness, runs recientes, política activa); nunca inventes métricas ni resultados que no estén en el contexto. Si falta evidencia, dilo explícitamente en vez de sugerir un número.`;
  const userPrompt = `Contexto:\n${JSON.stringify(context).slice(0, 6000)}\n\nPregunta del operador: ${message}`;
  const messages = [{role: "system", content: systemPrompt}, ...(Array.isArray(conversation) ? conversation.slice(-8) : []), {role: "user", content: userPrompt}];
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {authorization: `Bearer ${apiKey}`, "content-type": "application/json"},
      body: JSON.stringify({model: process.env.OPENAI_COPILOT_MODEL || "gpt-4o-mini", messages, temperature: 0.3, response_format: {type: "json_object"}}),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) return null;
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (!content) return null;
    const validated = ResponseSchema.parse(JSON.parse(content));
    return {...validated, provider: "openai", model: body.model || "gpt-4o-mini"};
  } catch {
    return null;
  }
}

export async function completeCopilotChat(message, context, conversation) {
  const viaOpenAI = await callOpenAI(message, context, conversation);
  if (viaOpenAI) return viaOpenAI;
  return localFallback(message, context);
}
