import {networkFit} from "./networkIntelligence.js";

// The 6 questions verbatim from mg-a8-nexus.json's own `tokenization_decision_engine`, each
// answered from real deal fields — never invented. NEXUS's own `credibility_rule` is "must be
// able to recommend DO NOT TOKENIZE when blockchain adds no value," so this deliberately does not
// always lean TOKENIZE: a simple 2-investor escrow answers "no" to almost every question below and
// correctly comes out TRADITIONAL_INFRASTRUCTURE.
// `privacy_compatible` is reported for context but never counted toward a TOKENIZE vote: every
// deal preset in this app defaults `compliance.whitelistOnly` to true, so it can never actually
// discriminate one deal from another — counting it would silently pad every deal's score.
const QUESTIONS = [
  {
    id: "reduces_friction",
    text: "¿La digitalización reduce fricción material?",
    countsTowardVote: true,
    evaluate: deal => deal.investors.count > 5 && deal.transfer.approvalRequired
  },
  {
    id: "needs_programmable_cashflows",
    text: "¿Existe necesidad de programación de derechos o cash flows?",
    countsTowardVote: true,
    evaluate: deal => (deal.tranches || []).length > 1
  },
  {
    id: "needs_shared_traceability",
    text: "¿Se necesita trazabilidad compartida entre múltiples participantes?",
    countsTowardVote: true,
    evaluate: deal => deal.investors.count >= 10 || deal.jurisdictions.length > 1
  },
  {
    id: "controlled_transferability_value",
    text: "¿Hay valor real en transferibilidad controlada?",
    countsTowardVote: true,
    evaluate: deal => deal.transfer.approvalRequired && deal.lockupMonths > 0 && deal.investors.count > 3
  },
  {
    id: "privacy_compatible",
    text: "¿La privacidad requerida es compatible con la red?",
    countsTowardVote: false,
    evaluate: deal => deal.compliance.whitelistOnly
  },
  {
    id: "traditional_database_sufficient",
    text: "¿Una base de datos tradicional resolvería el problema mejor y más barato?",
    countsTowardVote: false,
    evaluate: deal => deal.investors.count <= 3 && (deal.tranches || []).length <= 1
  }
];

export function evaluateTokenizationFit(deal) {
  const answers = QUESTIONS.map(question => ({id: question.id, text: question.text, yes: Boolean(question.evaluate(deal))}));
  const traditionalSufficient = answers.find(item => item.id === "traditional_database_sufficient").yes;
  const tokenizeVotes = QUESTIONS.filter(question => question.countsTowardVote && answers.find(item => item.id === question.id).yes).length;

  // NEXUS's own credibility_rule ("must be able to recommend DO NOT TOKENIZE when blockchain
  // adds no value") means "a traditional database would clearly work better and cheaper" is a
  // strong signal, not just one vote among six — it only gets overridden when every other
  // structural signal says otherwise too.
  let output;
  if (traditionalSufficient) output = tokenizeVotes >= 4 ? "TOKENIZE" : "TRADITIONAL_INFRASTRUCTURE";
  else output = tokenizeVotes >= 2 ? "TOKENIZE" : "DIGITIZE_WITHOUT_TOKEN";

  const reasoning = {
    TRADITIONAL_INFRASTRUCTURE: "Un número pequeño de partes y una sola estructura de capital hacen que blockchain no añada valor sobre una base de datos tradicional con controles de acceso.",
    DIGITIZE_WITHOUT_TOKEN: "Hay valor en digitalizar el registro y los flujos de datos, pero ninguna de las razones fuertes para un token (transferibilidad programable a múltiples partes) está presente todavía.",
    TOKENIZE: "Suficientes señales reales (múltiples inversionistas, cash flows programables, transferibilidad controlada) justifican modelar esto como un activo tokenizado."
  }[output];

  const result = {
    output,
    reasoning,
    answers,
    tokenizeVotes,
    credibilityCheck: output !== "TOKENIZE" ? "DO_NOT_TOKENIZE aplicado — blockchain no añade valor suficiente para este deal." : null
  };
  if (output === "TOKENIZE") result.recommendedNetworks = networkFit(deal.dealType);
  return result;
}
