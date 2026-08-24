// NEXUS Session — 40-scenario library. Pure data: title/situation/team/whatToProve as supplied,
// plus an optional deterministic `hook` telling nexusSession.js which existing engine to run for
// real evidence before the agent team reacts to it. Scenarios without a hook are pure-reasoning
// (situation + team only) — accurate to what was actually specified for those rows.
const ATLAS = "MG-A1-ATLAS", ORBIT = "MG-A2-ORBIT", PRISM = "MG-A3-PRISM", FORGE = "MG-A4-FORGE",
  QUANTUM = "MG-A5-QUANTUM", VOYAGER = "MG-A6-VOYAGER", CAPITAL = "MG-A7-CAPITAL", NEXUS = "MG-A8-NEXUS";
const ALL_AGENTS = [ATLAS, ORBIT, PRISM, FORGE, QUANTUM, VOYAGER, CAPITAL, NEXUS];

export const SCENARIO_CATEGORIES = [
  "Deal Origination", "Financial Stress", "Compliance", "Security", "Architecture",
  "Commodity", "Operations", "Business", "Governance", "Corporate Events"
];

export const SCENARIO_PRESETS = [
  {number: 1, id: "new-real-estate-150m", title: "Nuevo deal inmobiliario $150M", category: "Deal Origination",
    situation: "Sponsor necesita equity + deuda para un activo inmobiliario de $150M.", team: [ORBIT, QUANTUM, PRISM, CAPITAL, NEXUS, ATLAS],
    whatToProve: "Del deal inicial hasta decisión ejecutiva.", hook: null, dealOverrides: {asset: {valueUsd: 150_000_000}}},
  {number: 2, id: "tokenize-or-not", title: "Tokenizar o no tokenizar", category: "Deal Origination",
    situation: "Cliente pregunta si conviene tokenizar un activo.", team: [PRISM, QUANTUM, NEXUS, ATLAS],
    whatToProve: "Comparar blockchain vs infraestructura tradicional.", hook: {type: "tokenization-fit"}, dealOverrides: null},
  {number: 3, id: "family-office-20m", title: "Family office quiere invertir $20M", category: "Deal Origination",
    situation: "Nuevo inversionista solicita condiciones especiales para comprometer $20M.", team: [CAPITAL, ORBIT, PRISM, QUANTUM, NEXUS],
    whatToProve: "Investor fit + impacto económico.", hook: null, dealOverrides: null},
  {number: 4, id: "preferred-return-negotiation", title: "Negociación de preferred return", category: "Deal Origination",
    situation: "Inversionista exige 10% de preferred return antes de comprometer capital.", team: [CAPITAL, QUANTUM, PRISM, ORBIT],
    whatToProve: "Recalcular waterfall y negociar.", hook: {type: "capital-stack"}, dealOverrides: null},
  {number: 5, id: "early-redemption-36m", title: "Inversionista exige salida anticipada", category: "Deal Origination",
    situation: "Un inversionista quiere redemption a 36 meses, antes de lo pactado.", team: [CAPITAL, PRISM, QUANTUM, NEXUS],
    whatToProve: "Liquidez + contratos + impacto en otros inversores.", hook: null, dealOverrides: null},

  {number: 6, id: "noi-drop-30", title: "NOI cae 30%", category: "Financial Stress",
    situation: "El real estate del deal entra en estrés operativo.", team: [QUANTUM, PRISM, CAPITAL, ATLAS, NEXUS],
    whatToProve: "Cash flow, debt service y distribuciones.", hook: {type: "stress-test", noiShockPct: -30}, dealOverrides: null},
  {number: 7, id: "rates-plus-300bps", title: "Tasas +300 bps", category: "Financial Stress",
    situation: "Aumenta el costo de financiación de la deuda senior.", team: [QUANTUM, PRISM, ORBIT],
    whatToProve: "Sensibilidad financiera.", hook: {type: "stress-test", rateShockBps: 300}, dealOverrides: null},
  {number: 8, id: "borrower-default", title: "Borrower default", category: "Financial Stress",
    situation: "El deudor deja de pagar el servicio de deuda.", team: [PRISM, QUANTUM, ATLAS, NEXUS],
    whatToProve: "Default waterfall + collateral + acciones.", hook: {type: "scenario", id: "default-on-debt"}, dealOverrides: null},
  {number: 9, id: "collateral-drop-40", title: "Collateral cae 40%", category: "Financial Stress",
    situation: "Se deteriora la cobertura de colateral del deal.", team: [PRISM, QUANTUM, ORBIT],
    whatToProve: "Covenants y medidas correctivas.", hook: {type: "scenario", id: "collateral-value-decline", pct: 40}, dealOverrides: null},
  {number: 10, id: "distribution-impossible", title: "Distribución imposible", category: "Financial Stress",
    situation: "El smart contract intenta distribuir más cash del disponible.", team: [QUANTUM, PRISM, NEXUS],
    whatToProve: "Financial invariants bloqueando ejecución.", hook: {type: "scenario", id: "distribution-error"}, dealOverrides: null},

  {number: 11, id: "kyc-expires", title: "KYC expira", category: "Compliance",
    situation: "Un inversionista deja de ser elegible porque su KYC expiró.", team: [PRISM, NEXUS, ORBIT],
    whatToProve: "Compliance → bloqueo automático.", hook: {type: "scenario", id: "expired-kyc"}, dealOverrides: null},
  {number: 12, id: "forbidden-transfer", title: "Transferencia prohibida", category: "Compliance",
    situation: "Un investor intenta transferir unidades a un tercero no aprobado.", team: [PRISM, NEXUS],
    whatToProve: "Transfer Controller.", hook: {type: "scenario", id: "unauthorized-transfer"}, dealOverrides: null},
  {number: 13, id: "jurisdiction-change", title: "Cambio de jurisdicción", category: "Compliance",
    situation: "Entra un inversionista de otra jurisdicción no contemplada en la estructura.", team: [CAPITAL, PRISM, NEXUS],
    whatToProve: "Reglas regulatorias y arquitectura.", hook: null, dealOverrides: null},

  {number: 14, id: "admin-wallet-compromised", title: "Admin wallet comprometida", category: "Security",
    situation: "Un atacante obtiene acceso a una clave administrativa.", team: [NEXUS, PRISM, ATLAS],
    whatToProve: "Multisig + emergency controls.", hook: {type: "scenario", id: "compromised-administrator"}, dealOverrides: null},
  {number: 15, id: "treasury-attack-5m", title: "Treasury attack $5M", category: "Security",
    situation: "Se intenta un retiro no autorizado de $5M de la tesorería.", team: [NEXUS, ATLAS],
    whatToProve: "Seguridad financiera.", hook: {type: "scenario", id: "treasury-compromise", amountUsd: 5_000_000}, dealOverrides: null},
  {number: 16, id: "smart-contract-vulnerable", title: "Smart contract vulnerable", category: "Security",
    situation: "Se descubre una vulnerabilidad antes del deployment.", team: [NEXUS, PRISM],
    whatToProve: "Pause → investigation → remediation.", hook: {type: "scenario", id: "smart-contract-permission-abuse"}, dealOverrides: null},
  {number: 17, id: "multisig-signer-missing", title: "Signer de multisig desaparece", category: "Security",
    situation: "Una firma crítica de tesorería no está disponible.", team: [NEXUS, ATLAS],
    whatToProve: "Business continuity.", hook: {type: "scenario", id: "missing-multisig-signer"}, dealOverrides: null},
  {number: 18, id: "blockchain-outage", title: "Blockchain outage", category: "Security",
    situation: "La red seleccionada deja de funcionar.", team: [NEXUS, VOYAGER, PRISM],
    whatToProve: "Contingency y recovery.", hook: {type: "scenario", id: "network-unavailable"}, dealOverrides: null},

  {number: 19, id: "canton-vs-stellar-vs-evm", title: "Canton vs Stellar vs EVM", category: "Architecture",
    situation: "Se evalúa el mismo deal sobre tres infraestructuras distintas.", team: [NEXUS, PRISM, QUANTUM],
    whatToProve: "Network-selection reasoning.", hook: {type: "network-fit"}, dealOverrides: null},
  {number: 20, id: "blockchain-unnecessary", title: "¿Blockchain innecesaria?", category: "Architecture",
    situation: "El deal podría resolverse mejor con infraestructura tradicional.", team: [NEXUS, ATLAS],
    whatToProve: "DO NOT TOKENIZE.", hook: {type: "tokenization-fit"}, dealOverrides: null},

  {number: 21, id: "commodity-40m", title: "Commodity deal $40M", category: "Commodity",
    situation: "Compra/venta internacional de un commodity por $40M.", team: [FORGE, VOYAGER, PRISM, ORBIT, NEXUS],
    whatToProve: "Trade finance completo.", hook: null, dealOverrides: {dealType: "commodity-finance", asset: {valueUsd: 40_000_000}}},
  {number: 22, id: "fake-inspection-certificate", title: "Inspection certificate falso", category: "Commodity",
    situation: "Aparece un documento de inspección sospechoso.", team: [FORGE, VOYAGER, NEXUS],
    whatToProve: "Document verification + bloqueo.", hook: null, dealOverrides: null},
  {number: 23, id: "buyer-does-not-pay", title: "Buyer no paga", category: "Commodity",
    situation: "El commodity fue entregado pero el pago falla.", team: [FORGE, PRISM, VOYAGER],
    whatToProve: "Settlement/default.", hook: null, dealOverrides: null},
  {number: 24, id: "seller-does-not-deliver", title: "Seller no entrega", category: "Commodity",
    situation: "El capital está comprometido pero la mercancía no llega.", team: [FORGE, VOYAGER, PRISM],
    whatToProve: "Escrow + milestone controls.", hook: null, dealOverrides: null},
  {number: 25, id: "double-financing", title: "Doble financiación", category: "Commodity",
    situation: "El mismo commodity se usa como colateral dos veces.", team: [FORGE, PRISM, NEXUS],
    whatToProve: "Fraud detection.", hook: null, dealOverrides: null},
  {number: 26, id: "bank-settlement-delay", title: "Banco retrasa settlement", category: "Commodity",
    situation: "Una dependencia bancaria crítica falla.", team: [VOYAGER, PRISM, NEXUS],
    whatToProve: "Exception handling.", hook: null, dealOverrides: null},
  {number: 27, id: "custodian-outage", title: "Custodian outage", category: "Operations",
    situation: "El custodio institucional no responde.", team: [NEXUS, PRISM, VOYAGER],
    whatToProve: "Operational resilience.", hook: {type: "scenario", id: "custodian-unavailable"}, dealOverrides: null},

  {number: 28, id: "family-office-rejects-blockchain", title: "Family office rechaza blockchain", category: "Business",
    situation: "Un inversionista tradicional no quiere wallets ni tokens.", team: [CAPITAL, ORBIT, NEXUS],
    whatToProve: "UX y arquitectura híbrida.", hook: null, dealOverrides: null},
  {number: 29, id: "client-wants-liquidity", title: "Cliente pide liquidez", category: "Business",
    situation: "El sponsor quiere habilitar secondary transfers.", team: [ORBIT, CAPITAL, PRISM, NEXUS],
    whatToProve: "Liquidity vs compliance.", hook: null, dealOverrides: null},
  {number: 30, id: "atlas-asks-roi", title: "Timothy pregunta por ROI", category: "Business",
    situation: "El CEO quiere justificar la inversión tecnológica.", team: [ATLAS, ORBIT, QUANTUM, NEXUS],
    whatToProve: "Business case.", hook: {type: "revenue-model"}, dealOverrides: null},
  {number: 31, id: "manhattan-fee-model", title: "Fee model de Manhattan", category: "Business",
    situation: "Hay que definir cómo monetizar la tokenización.", team: [ATLAS, ORBIT, QUANTUM, NEXUS],
    whatToProve: "Setup + recurring + servicing revenue.", hook: {type: "revenue-model"}, dealOverrides: null},
  {number: 32, id: "cheaper-competitor", title: "Competidor ofrece tokenización más barata", category: "Business",
    situation: "Manhattan debe defender su propuesta frente a un competidor.", team: [ATLAS, ORBIT, NEXUS],
    whatToProve: "Diferenciación.", hook: null, dealOverrides: null},

  {number: 33, id: "client-wants-mainnet-now", title: "Cliente quiere lanzar demasiado rápido", category: "Governance",
    situation: "El cliente quiere ir a mainnet de inmediato.", team: [NEXUS, PRISM, ATLAS],
    whatToProve: "Governance y capacidad de decir NO.", hook: {type: "approval-gates"}, dealOverrides: null},
  {number: 34, id: "auditor-requests-evidence", title: "Auditor pide evidencia", category: "Governance",
    situation: "Hay que reconstruir una decisión de hace seis meses.", team: [QUANTUM, PRISM, NEXUS],
    whatToProve: "Audit trail.", hook: {type: "audit-trail"}, dealOverrides: null},
  {number: 35, id: "regulator-challenges-structure", title: "Regulador/counsel cuestiona estructura", category: "Governance",
    situation: "Aparece una nueva restricción regulatoria.", team: [PRISM, NEXUS, ATLAS],
    whatToProve: "Human-in-the-loop.", hook: null, dealOverrides: null},
  {number: 36, id: "agents-disagree", title: "Agentes no están de acuerdo", category: "Governance",
    situation: "David aprueba, Xan rechaza, Kirit condiciona la misma operación.", team: ALL_AGENTS,
    whatToProve: "Disagreement Engine.", hook: null, dealOverrides: null},

  {number: 37, id: "acquisition-offer", title: "Oferta de adquisición", category: "Corporate Events",
    situation: "El cliente recibe una propuesta de compra (M&A).", team: [ORBIT, QUANTUM, ATLAS, CAPITAL],
    whatToProve: "M&A decision simulation.", hook: null, dealOverrides: null},
  {number: 38, id: "insufficient-capital", title: "Capital insuficiente", category: "Corporate Events",
    situation: "Solo se consigue el 60% del equity necesario.", team: [CAPITAL, ORBIT, QUANTUM, PRISM],
    whatToProve: "Reestructurar deal.", hook: null, dealOverrides: null},
  {number: 39, id: "dominant-investor", title: "Inversionista dominante", category: "Corporate Events",
    situation: "Un family office ofrece todo el capital pero exige control.", team: [CAPITAL, ATLAS, PRISM, ORBIT],
    whatToProve: "Negociación + governance.", hook: null, dealOverrides: null},
  {number: 40, id: "full-crisis", title: "Crisis completa", category: "Corporate Events",
    situation: "El mercado cae, el borrower entra en default y una clave administrativa se compromete, todo a la vez.", team: ALL_AGENTS,
    whatToProve: "War-room institucional.", hook: {type: "crisis"}, dealOverrides: null}
];

export function listScenarioPresets() {
  return SCENARIO_PRESETS.map(({number, id, title, category, situation, team, whatToProve}) => ({number, id, title, category, situation, team, whatToProve}));
}

export function scenarioPreset(id) {
  const preset = SCENARIO_PRESETS.find(item => item.id === id);
  if (!preset) throw new Error(`UNKNOWN_SCENARIO_PRESET:${id}`);
  return preset;
}
