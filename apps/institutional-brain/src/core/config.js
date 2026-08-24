import path from "node:path";
import {fileURLToPath} from "node:url";

export const NAME = "AEGIS Institutional Brain";
export const KIND = "institutional";
export const PORT = Number(process.env.PORT || 8820);

export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data");
export const DATA_FILE = path.join(DATA_DIR, "institutional.json");

export const DEFAULT_TENANT = "manhattan-group";

// The DEAL_TYPE registry drives the Deal Builder presets and which vertical gets the
// fully-modeled base-case waterfall simulation vs. the lighter single-period preset.
export const DEAL_TYPE_DEFINITIONS = [
  {
    id: "real-estate-spv",
    name: "Real Estate SPV",
    category: "Real Assets",
    description: "Special purpose vehicle holding a single institutional real-estate asset for a defined investor pool.",
    fullyModeled: true
  },
  {
    id: "private-credit",
    name: "Private Credit",
    category: "Private Debt",
    description: "Senior/junior tranche loan pool distributing coupon income to lenders under a lock-up and redemption schedule.",
    fullyModeled: false
  },
  {
    id: "structured-finance",
    name: "Structured Finance",
    category: "Structured Products",
    description: "Multi-tranche structured vehicle allocating cashflow across capital stack tiers with defined subordination.",
    fullyModeled: false
  },
  {
    id: "commodity-finance",
    name: "Commodity Finance",
    category: "Trade & Commodities",
    description: "Financing vehicle for commodity trade flows distributing margin income across participating capital.",
    fullyModeled: false
  },
  {
    id: "private-fund",
    name: "Private Fund",
    category: "Fund Structures",
    description: "Closed-end fund vehicle pooling committed capital across a portfolio of underlying investments.",
    fullyModeled: false
  },
  {
    id: "escrow",
    name: "Escrow",
    category: "Custody & Settlement",
    description: "Conditional-release vehicle holding capital until predefined milestone or closing conditions are met.",
    fullyModeled: false
  },
  {
    id: "revenue-share",
    name: "Revenue Share",
    category: "Revenue-Linked Finance",
    description: "Vehicle distributing a share of underlying revenue to capital providers instead of fixed debt service.",
    fullyModeled: false
  },
  {
    id: "tokenized-securities",
    name: "Tokenized Securities",
    category: "Digital Assets",
    description: "Digitally native security representing fractional economic and governance rights over an issuer.",
    fullyModeled: false
  }
];

export const ADAPTER_DEFINITIONS = [
  {id: "evm", name: "EVM Adapter", language: "Solidity", network: "Ethereum / Polygon", accent: "#9c7bff"},
  {id: "stellar", name: "Stellar Adapter", language: "Soroban (Rust)", network: "Stellar", accent: "#28e6f6"},
  {id: "canton", name: "Canton Adapter", language: "Daml", network: "Canton Network", accent: "#ffb545"}
];

// The 13 canonical institutional roles from the master spec. Manhattan is deliberately NOT
// pre-assigned to every role — some start unassigned so Role Mapper can surface them as risks.
export const ROLE_DEFINITIONS = [
  {id: "issuer", name: "Issuer", defaultProvider: "Manhattan Group"},
  {id: "sponsor", name: "Sponsor", defaultProvider: "Manhattan Group"},
  {id: "structuring-advisor", name: "Structuring Advisor", defaultProvider: null},
  {id: "investment-manager", name: "Investment Manager", defaultProvider: "Manhattan Group"},
  {id: "custodian", name: "Custodian", defaultProvider: null},
  {id: "bank", name: "Bank", defaultProvider: null},
  {id: "broker-dealer", name: "Broker-Dealer", defaultProvider: null},
  {id: "transfer-agent", name: "Transfer Agent", defaultProvider: null},
  {id: "administrator", name: "Administrator", defaultProvider: null},
  {id: "kyc-aml-provider", name: "KYC/AML Provider", defaultProvider: null},
  {id: "legal-counsel", name: "Legal Counsel", defaultProvider: null},
  {id: "technology-provider", name: "Technology Provider", defaultProvider: "AEGIS Institutional Brain"},
  {id: "compliance-officer", name: "Compliance Officer", defaultProvider: null}
];

// Deal lifecycle used by the Financial Brain state machine (dealState.js).
export const DEAL_STATUSES = ["Draft", "Structuring", "Compliance", "SecurityReview", "Simulation", "ReadyForTestnet", "Deployed", "Monitoring", "Closed"];

// Multi-tenant registry (section 34) — static branding/policy stub, not real tenant isolation.
export const TENANT_DEFINITIONS = [
  {id: "manhattan-group", name: "Manhattan Group", kind: "Real Estate Sponsor", accent: "#5ce1ff"},
  {id: "family-office-a", name: "Family Office A", kind: "Family Office", accent: "#7c5cff"},
  {id: "asset-manager-b", name: "Asset Manager B", kind: "Asset Manager", accent: "#4ee8d2"},
  {id: "real-estate-sponsor-c", name: "Real Estate Sponsor C", kind: "Real Estate Sponsor", accent: "#ffb86b"},
  {id: "structured-finance-firm-d", name: "Structured Finance Firm D", kind: "Structured Finance Firm", accent: "#ff789b"}
];

export function dealTypeDefinition(dealTypeId) {
  return DEAL_TYPE_DEFINITIONS.find(item => item.id === dealTypeId) || DEAL_TYPE_DEFINITIONS[0];
}

export function adapterDefinition(adapterId) {
  return ADAPTER_DEFINITIONS.find(item => item.id === adapterId);
}

export function tenantDefinition(tenantId) {
  return TENANT_DEFINITIONS.find(item => item.id === tenantId) || TENANT_DEFINITIONS[0];
}
