import {z} from "zod";
import crypto from "node:crypto";
import {DEFAULT_TENANT, ROLE_DEFINITIONS} from "./config.js";

// The Financial Contract Specification: a chain-neutral description of an institutional deal.
// Every deal type is expressed through this same schema — only the labels and preset values
// differ. This is the layer the three chain adapters (EVM/Stellar/Canton) read from; nothing
// here is Solidity, Soroban, or Daml specific.
export const DealSpecSchema = z.object({
  tenant: z.string().min(1).default(DEFAULT_TENANT),
  dealType: z.enum(["real-estate-spv", "private-credit", "structured-finance", "commodity-finance", "private-fund", "escrow", "revenue-share", "tokenized-securities"]),
  status: z.enum(["Draft", "Structuring", "Compliance", "SecurityReview", "Simulation", "ReadyForTestnet", "Deployed", "Monitoring", "Closed"]).default("Draft"),
  name: z.string().min(1),
  asset: z.object({
    name: z.string().min(1),
    valueUsd: z.number().positive()
  }),
  vehicle: z.enum(["SPV", "Fund", "Trust", "Pool"]).default("SPV"),
  investors: z.object({
    count: z.number().int().positive(),
    eligibility: z.enum(["accredited", "qualified", "any"]).default("accredited"),
    maxOwnershipPct: z.number().min(0).max(100).default(25)
  }),
  lockupMonths: z.number().int().min(0).default(12),
  maturityDate: z.string().optional(),
  redemptionNoticeMonths: z.number().int().min(0).default(3),
  distribution: z.object({
    frequency: z.enum(["monthly", "quarterly", "annual"]).default("quarterly")
  }),
  transfer: z.object({
    approvalRequired: z.boolean().default(true),
    approver: z.string().default("manager")
  }),
  jurisdictions: z.array(z.string()).default(["US"]),
  custody: z.object({
    model: z.enum(["multisig", "custodian", "self"]).default("multisig"),
    multisigThreshold: z.number().int().min(1).default(2),
    multisigSigners: z.number().int().min(1).default(3)
  }),
  emergencyPause: z.boolean().default(true),
  compliance: z.object({
    kycRequired: z.boolean().default(true),
    amlRequired: z.boolean().default(true),
    sanctionsCheck: z.boolean().default(true),
    whitelistOnly: z.boolean().default(true)
  }),
  // Generic capital-stack + cashflow inputs, reused across every deal type:
  // real-estate-spv -> senior=debt, junior=equity, cashflow=NOI
  // private-credit -> senior=senior tranche, junior=first-loss tranche, cashflow=interest income
  // structured-finance -> senior/junior tranche split, cashflow=collateral pool income
  // commodity-finance -> senior=trade finance facility, junior=sponsor equity, cashflow=trade margin
  // private-fund/escrow/revenue-share/tokenized-securities reuse the same shape (see PRESETS below).
  finance: z.object({
    seniorCapitalUsd: z.number().min(0).default(0),
    juniorCapitalUsd: z.number().min(0).default(0),
    ratePct: z.number().min(0).max(100).default(6),
    termYears: z.number().positive().default(5),
    annualCashflowUsd: z.number().min(0),
    feePct: z.number().min(0).max(100).default(1.5),
    reserveTargetUsd: z.number().min(0).default(0)
  })
});

// Fictional institutional-sounding names for simulated investors — clearly synthetic, never a
// real fund, family office, or person. Cycled deterministically so results are reproducible.
const INVESTOR_NAME_POOL = [
  "Meridian Capital Partners", "Blackrose Family Office", "Harborview Institutional Fund",
  "Northgate Pension Trust", "Silverline Endowment", "Castlebridge Wealth Partners",
  "Ashford Sovereign Allocator", "Lumen Private Capital", "Redwood Family Holdings",
  "Union Peak Asset Management", "Cobalt Institutional Partners", "Wexford Endowment Fund",
  "Highfield Capital Trust", "Sablewood Family Office", "Delta Ridge Pension Fund",
  "Anchorpoint Institutional", "Greystone Sovereign Fund", "Pinnacle Endowment Partners",
  "Crownridge Capital Group", "Sterling Family Trust", "Ironwood Asset Partners",
  "Marlowe Institutional Fund", "Brightwater Family Office", "Cascade Endowment Trust",
  "Fieldstone Capital Partners"
];

function walletFor(index) {
  return `0xSIM${String(index + 1).padStart(4, "0")}${"0".repeat(32)}`.slice(0, 42);
}

// Deterministically generates a named simulated investor roster. Deals with more investors
// than the name pool append a numeric suffix. One in every 7 investors starts with KYC pending
// (not passed) so Investor Management / transfer-blocking has something real to demonstrate.
export function generateInvestors(spec) {
  const count = spec.investors.count;
  const juniorCapital = spec.finance.juniorCapitalUsd || spec.finance.annualCashflowUsd * 4;
  const perInvestorUsd = juniorCapital / count;
  return Array.from({length: count}, (_, index) => {
    const baseName = INVESTOR_NAME_POOL[index % INVESTOR_NAME_POOL.length];
    const name = index < INVESTOR_NAME_POOL.length ? baseName : `${baseName} ${Math.floor(index / INVESTOR_NAME_POOL.length) + 1}`;
    const kycPassed = index % 7 !== 6;
    return {
      id: `investor-${index + 1}`,
      name,
      committedUsd: Math.round(perInvestorUsd),
      fundedUsd: Math.round(perInvestorUsd),
      ownershipPct: Math.round((100 / count) * 100) / 100,
      kyc: kycPassed ? "PASSED" : "PENDING",
      accredited: spec.investors.eligibility !== "any",
      jurisdiction: spec.jurisdictions[index % spec.jurisdictions.length] || "US",
      lockupExpiresMonth: spec.lockupMonths,
      wallet: walletFor(index),
      distributionsReceivedUsd: 0,
      eligible: kycPassed && spec.investors.eligibility !== "any"
    };
  });
}

export function defaultRoles(spec) {
  return Object.fromEntries(ROLE_DEFINITIONS.map(role => [role.id, {
    assigned: Boolean(role.defaultProvider),
    provider: role.defaultProvider
  }]));
}

// Derives an initial capital stack from the generic senior/junior finance fields. Real Estate
// SPV gets a 2-tranche stack (Senior Debt + Common Equity); other deal types get a single
// tranche until the user configures more in Capital Stack & Cash Flow.
export function defaultTranches(spec) {
  const tranches = [];
  if (spec.finance.seniorCapitalUsd > 0) {
    tranches.push({id: "senior-debt", name: "Senior Debt", amountUsd: spec.finance.seniorCapitalUsd, ratePct: spec.finance.ratePct, priority: 1});
  }
  if (spec.finance.juniorCapitalUsd > 0) {
    tranches.push({id: "common-equity", name: "Common Equity", amountUsd: spec.finance.juniorCapitalUsd, ratePct: 0, priority: tranches.length + 1});
  }
  return tranches;
}

export function buildDealFromForm(input) {
  const parsed = DealSpecSchema.parse(input);
  const now = new Date().toISOString();
  const deal = {
    id: `deal_${crypto.randomUUID()}`,
    ...parsed,
    createdAt: now,
    updatedAt: now,
    version: 1,
    simulationRun: false,
    approvalHistory: []
  };
  deal.investors.list = generateInvestors(deal);
  deal.roles = input.roles || defaultRoles(deal);
  deal.tranches = input.tranches || defaultTranches(deal);
  deal.counterparties = [];
  deal.auditTrail = [];
  deal.versions = [{version: 1, at: now, snapshot: JSON.parse(JSON.stringify(parsed)), approvalsInvalidated: []}];
  deal.governance = {};
  deal.treasury = {movements: []};
  deal.testnet = {mode: "SIMULATION", deployments: []};
  deal.agents = {};
  deal.actions = [];
  deal.blackboard = {facts: [], assumptions: [], openQuestions: [], risks: [], decisions: [], opinions: []};
  deal.nexusSessions = {};
  return deal;
}

// Manhattan Real Estate SPV example from the brief: $100M asset, $35M equity / $65M debt,
// 25 investors, 12-month lock-up, quarterly distribution, $8M annual NOI, 1.5% management fee.
const PRESETS = {
  "real-estate-spv": {
    dealType: "real-estate-spv",
    name: "Manhattan Real Estate SPV",
    asset: {name: "Manhattan Class-A Office Tower", valueUsd: 100_000_000},
    vehicle: "SPV",
    investors: {count: 25, eligibility: "accredited", maxOwnershipPct: 20},
    lockupMonths: 12,
    distribution: {frequency: "quarterly"},
    transfer: {approvalRequired: true, approver: "manager"},
    jurisdictions: ["US"],
    custody: {model: "multisig", multisigThreshold: 2, multisigSigners: 3},
    emergencyPause: true,
    compliance: {kycRequired: true, amlRequired: true, sanctionsCheck: true, whitelistOnly: true},
    finance: {
      seniorCapitalUsd: 65_000_000,
      juniorCapitalUsd: 35_000_000,
      ratePct: 6,
      termYears: 10,
      annualCashflowUsd: 8_000_000,
      feePct: 1.5,
      reserveTargetUsd: 500_000
    }
  },
  "private-credit": {
    dealType: "private-credit",
    name: "Diversified Private Credit Pool I",
    asset: {name: "Middle-Market Senior Loan Pool", valueUsd: 50_000_000},
    vehicle: "Fund",
    investors: {count: 18, eligibility: "qualified", maxOwnershipPct: 25},
    lockupMonths: 24,
    distribution: {frequency: "quarterly"},
    transfer: {approvalRequired: true, approver: "manager"},
    jurisdictions: ["US"],
    custody: {model: "multisig", multisigThreshold: 2, multisigSigners: 3},
    emergencyPause: true,
    compliance: {kycRequired: true, amlRequired: true, sanctionsCheck: true, whitelistOnly: true},
    finance: {
      seniorCapitalUsd: 35_000_000,
      juniorCapitalUsd: 15_000_000,
      ratePct: 9.5,
      termYears: 4,
      annualCashflowUsd: 4_750_000,
      feePct: 1,
      reserveTargetUsd: 250_000
    }
  },
  "structured-finance": {
    dealType: "structured-finance",
    name: "Structured Receivables Vehicle II",
    asset: {name: "Trade Receivables Collateral Pool", valueUsd: 75_000_000},
    vehicle: "Trust",
    investors: {count: 12, eligibility: "qualified", maxOwnershipPct: 30},
    lockupMonths: 18,
    distribution: {frequency: "monthly"},
    transfer: {approvalRequired: true, approver: "manager"},
    jurisdictions: ["US", "EU"],
    custody: {model: "multisig", multisigThreshold: 3, multisigSigners: 5},
    emergencyPause: true,
    compliance: {kycRequired: true, amlRequired: true, sanctionsCheck: true, whitelistOnly: true},
    finance: {
      seniorCapitalUsd: 55_000_000,
      juniorCapitalUsd: 20_000_000,
      ratePct: 7.25,
      termYears: 3,
      annualCashflowUsd: 6_200_000,
      feePct: 1.25,
      reserveTargetUsd: 1_000_000
    }
  },
  "commodity-finance": {
    dealType: "commodity-finance",
    name: "Cross-Border Commodity Trade Facility",
    asset: {name: "Agricultural Export Trade Flow", valueUsd: 30_000_000},
    vehicle: "Pool",
    investors: {count: 9, eligibility: "qualified", maxOwnershipPct: 35},
    lockupMonths: 6,
    distribution: {frequency: "monthly"},
    transfer: {approvalRequired: true, approver: "manager"},
    jurisdictions: ["US", "SG"],
    custody: {model: "multisig", multisigThreshold: 2, multisigSigners: 3},
    emergencyPause: true,
    compliance: {kycRequired: true, amlRequired: true, sanctionsCheck: true, whitelistOnly: true},
    finance: {
      seniorCapitalUsd: 20_000_000,
      juniorCapitalUsd: 10_000_000,
      ratePct: 8,
      termYears: 1,
      annualCashflowUsd: 2_400_000,
      feePct: 1,
      reserveTargetUsd: 150_000
    }
  },
  "private-fund": {
    dealType: "private-fund",
    name: "Manhattan Growth Fund II",
    asset: {name: "Diversified Growth Equity Portfolio", valueUsd: 120_000_000},
    vehicle: "Fund",
    investors: {count: 30, eligibility: "qualified", maxOwnershipPct: 15},
    lockupMonths: 36,
    distribution: {frequency: "annual"},
    transfer: {approvalRequired: true, approver: "manager"},
    jurisdictions: ["US"],
    custody: {model: "custodian", multisigThreshold: 2, multisigSigners: 3},
    emergencyPause: true,
    compliance: {kycRequired: true, amlRequired: true, sanctionsCheck: true, whitelistOnly: true},
    finance: {
      seniorCapitalUsd: 0,
      juniorCapitalUsd: 120_000_000,
      ratePct: 0,
      termYears: 8,
      annualCashflowUsd: 9_600_000,
      feePct: 2,
      reserveTargetUsd: 2_000_000
    }
  },
  "escrow": {
    dealType: "escrow",
    name: "Manhattan Acquisition Escrow",
    asset: {name: "Signing-to-Closing Purchase Price Escrow", valueUsd: 18_000_000},
    vehicle: "Trust",
    investors: {count: 2, eligibility: "any", maxOwnershipPct: 100},
    lockupMonths: 3,
    distribution: {frequency: "monthly"},
    transfer: {approvalRequired: true, approver: "manager"},
    jurisdictions: ["US"],
    custody: {model: "multisig", multisigThreshold: 2, multisigSigners: 2},
    emergencyPause: true,
    compliance: {kycRequired: true, amlRequired: true, sanctionsCheck: true, whitelistOnly: true},
    finance: {
      seniorCapitalUsd: 0,
      juniorCapitalUsd: 18_000_000,
      ratePct: 0,
      termYears: 1,
      annualCashflowUsd: 0,
      feePct: 0.25,
      reserveTargetUsd: 0
    }
  },
  "revenue-share": {
    dealType: "revenue-share",
    name: "Manhattan Retail Revenue Share",
    asset: {name: "Ground-Floor Retail Revenue Stream", valueUsd: 12_000_000},
    vehicle: "SPV",
    investors: {count: 15, eligibility: "accredited", maxOwnershipPct: 20},
    lockupMonths: 9,
    distribution: {frequency: "monthly"},
    transfer: {approvalRequired: true, approver: "manager"},
    jurisdictions: ["US"],
    custody: {model: "multisig", multisigThreshold: 2, multisigSigners: 3},
    emergencyPause: true,
    compliance: {kycRequired: true, amlRequired: true, sanctionsCheck: true, whitelistOnly: true},
    finance: {
      seniorCapitalUsd: 0,
      juniorCapitalUsd: 12_000_000,
      ratePct: 0,
      termYears: 3,
      annualCashflowUsd: 2_100_000,
      feePct: 1,
      reserveTargetUsd: 100_000
    }
  },
  "tokenized-securities": {
    dealType: "tokenized-securities",
    name: "Manhattan Tokenized Preferred Shares",
    asset: {name: "Series A Preferred Share Class", valueUsd: 40_000_000},
    vehicle: "SPV",
    investors: {count: 40, eligibility: "accredited", maxOwnershipPct: 10},
    lockupMonths: 12,
    distribution: {frequency: "quarterly"},
    transfer: {approvalRequired: true, approver: "manager"},
    jurisdictions: ["US"],
    custody: {model: "multisig", multisigThreshold: 2, multisigSigners: 3},
    emergencyPause: true,
    compliance: {kycRequired: true, amlRequired: true, sanctionsCheck: true, whitelistOnly: true},
    finance: {
      seniorCapitalUsd: 0,
      juniorCapitalUsd: 40_000_000,
      ratePct: 7,
      termYears: 5,
      annualCashflowUsd: 2_800_000,
      feePct: 1,
      reserveTargetUsd: 400_000
    }
  }
};

export function dealTypePreset(dealTypeId) {
  const preset = PRESETS[dealTypeId];
  if (!preset) throw new Error(`UNKNOWN_DEAL_TYPE:${dealTypeId}`);
  return preset;
}
