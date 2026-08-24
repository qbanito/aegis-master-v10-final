// Explicit, inspectable weighted-criteria model — not a black-box "AI recommendation".
// Each network gets a 0..1 score per criterion; each deal type weights those criteria by
// importance. matchScore = weighted dot product, surfaced alongside the weights themselves
// so the UI can show *why* a network scored the way it did.
//
// This is the Blockchain Selection Brain's comparison set (7 networks). The Multi-Language
// Smart Contract Engine only generates code for 3 of them (EVM/Stellar/Canton, exposed via
// ADAPTER_DEFINITIONS in config.js) — the other 4 are recommendation-only in this build.
const NETWORK_CRITERIA = {
  ethereum: {
    privacy: 0.45, institutionalAuth: 0.6, multiPartyWorkflow: 0.55, settlementSpeed: 0.55,
    assetIssuance: 0.8, ecosystemLiquidity: 0.98, cost: 0.3, speed: 0.5, tokenStandards: 0.95, regulatoryFit: 0.6
  },
  polygon: {
    privacy: 0.45, institutionalAuth: 0.55, multiPartyWorkflow: 0.5, settlementSpeed: 0.8,
    assetIssuance: 0.78, ecosystemLiquidity: 0.75, cost: 0.85, speed: 0.8, tokenStandards: 0.93, regulatoryFit: 0.55
  },
  stellar: {
    privacy: 0.5, institutionalAuth: 0.6, multiPartyWorkflow: 0.5, settlementSpeed: 0.95,
    assetIssuance: 0.9, ecosystemLiquidity: 0.55, cost: 0.92, speed: 0.9, tokenStandards: 0.65, regulatoryFit: 0.65
  },
  canton: {
    privacy: 0.97, institutionalAuth: 0.95, multiPartyWorkflow: 0.95, settlementSpeed: 0.7,
    assetIssuance: 0.65, ecosystemLiquidity: 0.35, cost: 0.5, speed: 0.6, tokenStandards: 0.55, regulatoryFit: 0.92
  },
  avalanche: {
    privacy: 0.55, institutionalAuth: 0.65, multiPartyWorkflow: 0.6, settlementSpeed: 0.82,
    assetIssuance: 0.75, ecosystemLiquidity: 0.6, cost: 0.7, speed: 0.85, tokenStandards: 0.85, regulatoryFit: 0.6
  },
  hedera: {
    privacy: 0.6, institutionalAuth: 0.75, multiPartyWorkflow: 0.6, settlementSpeed: 0.9,
    assetIssuance: 0.7, ecosystemLiquidity: 0.3, cost: 0.88, speed: 0.92, tokenStandards: 0.6, regulatoryFit: 0.7
  },
  solana: {
    privacy: 0.4, institutionalAuth: 0.5, multiPartyWorkflow: 0.45, settlementSpeed: 0.95,
    assetIssuance: 0.72, ecosystemLiquidity: 0.72, cost: 0.9, speed: 0.97, tokenStandards: 0.7, regulatoryFit: 0.45
  }
};

const NETWORK_LABELS = {
  ethereum: {name: "Ethereum", strengths: ["ecosystem", "Solidity", "liquidez / composabilidad institucional"]},
  polygon: {name: "Polygon", strengths: ["costo bajo", "compatibilidad EVM", "throughput"]},
  stellar: {name: "Stellar (Soroban)", strengths: ["settlement", "emision de activos", "eficiencia de distribucion / pagos"]},
  canton: {name: "Canton Network (Daml)", strengths: ["workflow de mercados privados", "privacidad granular por participante", "autorizacion institucional"]},
  avalanche: {name: "Avalanche", strengths: ["subnets institucionales", "velocidad", "compatibilidad EVM"]},
  hedera: {name: "Hedera", strengths: ["gobernanza institucional", "settlement rapido", "bajo costo"]},
  solana: {name: "Solana", strengths: ["throughput", "costo muy bajo", "liquidez de mercado"]}
};

const DEAL_TYPE_WEIGHTS = {
  "real-estate-spv": {privacy: 0.18, institutionalAuth: 0.18, multiPartyWorkflow: 0.14, settlementSpeed: 0.1, assetIssuance: 0.12, ecosystemLiquidity: 0.1, cost: 0.06, speed: 0.04, tokenStandards: 0.04, regulatoryFit: 0.04},
  "private-credit": {privacy: 0.2, institutionalAuth: 0.2, multiPartyWorkflow: 0.16, settlementSpeed: 0.08, assetIssuance: 0.08, ecosystemLiquidity: 0.08, cost: 0.06, speed: 0.04, tokenStandards: 0.04, regulatoryFit: 0.06},
  "structured-finance": {privacy: 0.16, institutionalAuth: 0.16, multiPartyWorkflow: 0.2, settlementSpeed: 0.08, assetIssuance: 0.12, ecosystemLiquidity: 0.08, cost: 0.04, speed: 0.04, tokenStandards: 0.04, regulatoryFit: 0.08},
  "commodity-finance": {privacy: 0.08, institutionalAuth: 0.12, multiPartyWorkflow: 0.12, settlementSpeed: 0.2, assetIssuance: 0.16, ecosystemLiquidity: 0.12, cost: 0.08, speed: 0.08, tokenStandards: 0.02, regulatoryFit: 0.02},
  "private-fund": {privacy: 0.18, institutionalAuth: 0.22, multiPartyWorkflow: 0.14, settlementSpeed: 0.06, assetIssuance: 0.1, ecosystemLiquidity: 0.1, cost: 0.04, speed: 0.04, tokenStandards: 0.04, regulatoryFit: 0.08},
  "escrow": {privacy: 0.12, institutionalAuth: 0.2, multiPartyWorkflow: 0.22, settlementSpeed: 0.14, assetIssuance: 0.04, ecosystemLiquidity: 0.04, cost: 0.08, speed: 0.08, tokenStandards: 0.02, regulatoryFit: 0.06},
  "revenue-share": {privacy: 0.1, institutionalAuth: 0.12, multiPartyWorkflow: 0.1, settlementSpeed: 0.2, assetIssuance: 0.12, ecosystemLiquidity: 0.14, cost: 0.1, speed: 0.08, tokenStandards: 0.02, regulatoryFit: 0.02},
  "tokenized-securities": {privacy: 0.12, institutionalAuth: 0.16, multiPartyWorkflow: 0.1, settlementSpeed: 0.1, assetIssuance: 0.2, ecosystemLiquidity: 0.14, cost: 0.04, speed: 0.04, tokenStandards: 0.08, regulatoryFit: 0.02}
};

function matchScore(dealType, networkId) {
  const weights = DEAL_TYPE_WEIGHTS[dealType] || DEAL_TYPE_WEIGHTS["real-estate-spv"];
  const criteria = NETWORK_CRITERIA[networkId];
  const weighted = Object.keys(weights).reduce((sum, key) => sum + (weights[key] || 0) * (criteria[key] || 0), 0);
  return Math.round(weighted * 100);
}

export function networkFit(dealType) {
  const weights = DEAL_TYPE_WEIGHTS[dealType] || DEAL_TYPE_WEIGHTS["real-estate-spv"];
  const results = Object.keys(NETWORK_CRITERIA).map(networkId => ({
    networkId,
    name: NETWORK_LABELS[networkId].name,
    matchPct: matchScore(dealType, networkId),
    strengths: NETWORK_LABELS[networkId].strengths,
    criteria: NETWORK_CRITERIA[networkId]
  })).sort((a, b) => b.matchPct - a.matchPct);

  return {dealType, weights, results};
}
