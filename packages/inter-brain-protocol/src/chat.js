const clean = value => String(value || "").trim();

const labels = {
  ceo: "CEO",
  manager: "Manager",
  finance: "Finance",
  commerce: "Commerce",
  saas: "SaaS",
  media: "Media",
  services: "Services",
  banking: "Banking",
  account: "Account"
};

export function brainGreeting(brain = "ceo") {
  return `Hola Neiver soy tu ${labels[String(brain).toLowerCase()] || String(brain)} asistente.`;
}

export function normalizeBrainReply(brain, value) {
  const greeting = brainGreeting(brain);
  const body = clean(value).replace(/^hola\s+neiver,?\s*soy\s+tu\s+[^.!?]+[.!?]\s*/i, "").trim();
  return body ? `${greeting} ${body}` : greeting;
}

export function conversationTurns(value, limit = 10) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(turn => ["user", "assistant"].includes(turn?.role) && clean(turn?.content))
    .slice(-limit)
    .map(turn => ({role: turn.role, content: clean(turn.content).slice(0, 1800)}));
}

function extractText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output || [])
    .flatMap(item => item?.content || [])
    .map(item => item?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function modelName() {
  return process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || "gpt-5";
}

function aiTimeoutMs() {
  return Math.max(1500, Number(process.env.AEGIS_AI_TIMEOUT_MS || 7000));
}

export async function completeBrainConversation({brain, name, message, conversation, context, scope, fallback}) {
  const current = clean(message);
  const turns = conversationTurns(conversation);
  const history = turns.length
    ? `\nConversación reciente:\n${turns.map(turn => `${turn.role === "user" ? "Neiver" : name}: ${turn.content}`).join("\n")}`
    : "";
  const system = `Eres ${name}, un asistente conversacional especializado dentro de AEGIS. Habla en español natural, cálido, directo y ágil, como un asistente moderno. Responde primero a la pregunta y después añade solo los datos útiles. Mantén respuestas de 2 a 6 frases, sin encabezados ni listas largas salvo que Neiver las pida. Usa los datos vivos del contexto entregado y no inventes métricas, clientes, ventas, precios, operaciones ni conexiones. Si algo no está disponible, dilo claramente y explica qué API o conector debe activarse. Puedes conversar sobre cualquier tema dentro de tu campo: cada respuesta debe reconocer el contexto anterior y pedir una aclaración breve cuando falte información. Mantén el sistema en PAPER/READ_ONLY: no afirmes que ejecutaste dinero real, publicaste campañas, enviaste mensajes o cambiaste datos si no existe una acción explícita y confirmada. Área de responsabilidad: ${scope}. Contexto vivo de tus herramientas: ${JSON.stringify(context).slice(0, 26000)}${history}`;
  if ((process.env.AEGIS_AI_PROVIDER || "openai").toLowerCase() === "openai" && process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {"content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}`},
        body: JSON.stringify({model: modelName(), instructions: system, input: current, max_output_tokens: 700}),
        signal: AbortSignal.timeout(aiTimeoutMs())
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || `OPENAI_HTTP_${response.status}`);
      return {reply: normalizeBrainReply(brain, extractText(payload)), provider: "openai", model: modelName(), conversation: turns};
    } catch (error) {
      return {reply: normalizeBrainReply(brain, fallback(current, context)), provider: "local-fallback-timeout", model: `${modelName()} · fallback`, conversation: turns, warning: error?.name === "TimeoutError" ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_UNAVAILABLE"};
    }
  }
  return {reply: normalizeBrainReply(brain, fallback(current, context)), provider: "local-fallback", model: "AEGIS local fallback", conversation: turns};
}
