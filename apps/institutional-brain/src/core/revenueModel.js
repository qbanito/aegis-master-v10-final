const PERIODS_PER_YEAR = {monthly: 12, quarterly: 4, annual: 1};

// Revenue & Business Model Simulator — how the PLATFORM (not the deal) earns money. Clearly
// separate from the deal's own economics; every figure here is a simulated platform-fee
// estimate, not a real invoice.
const FEE_ASSUMPTIONS = {
  structuringFeePct: 0.75,
  setupFeeUsd: 25_000,
  administrationFeePct: 0.15,
  technologyFeePct: 0.10,
  transactionFeeBps: 5,
  monitoringFeeUsdPerMonth: 2_000,
  recurringPlatformFeeUsdPerYear: 10_000
};

export function computeRevenueModel(deal) {
  const aumUsd = deal.asset.valueUsd;
  const structuringFeeUsd = aumUsd * (FEE_ASSUMPTIONS.structuringFeePct / 100);
  const setupFeeUsd = FEE_ASSUMPTIONS.setupFeeUsd;
  const administrationFeeUsd = aumUsd * (FEE_ASSUMPTIONS.administrationFeePct / 100);
  const technologyFeeUsd = aumUsd * (FEE_ASSUMPTIONS.technologyFeePct / 100);
  const distributionsPerYear = PERIODS_PER_YEAR[deal.distribution.frequency] || 4;
  const transactionFeeUsd = distributionsPerYear * (deal.lastSimulation?.totals?.distributedCashUsd || deal.finance.annualCashflowUsd / distributionsPerYear) * (FEE_ASSUMPTIONS.transactionFeeBps / 10000);
  const monitoringFeeUsd = FEE_ASSUMPTIONS.monitoringFeeUsdPerMonth * 12;
  const recurringPlatformFeeUsd = FEE_ASSUMPTIONS.recurringPlatformFeeUsdPerYear;

  const oneTimeUsd = round2(structuringFeeUsd + setupFeeUsd);
  const annualUsd = round2(administrationFeeUsd + technologyFeeUsd + transactionFeeUsd + monitoringFeeUsd + recurringPlatformFeeUsd);

  return {
    assumptions: FEE_ASSUMPTIONS,
    breakdown: {
      structuringFeeUsd: round2(structuringFeeUsd),
      setupFeeUsd,
      administrationFeeUsd: round2(administrationFeeUsd),
      technologyFeeUsd: round2(technologyFeeUsd),
      transactionFeeUsd: round2(transactionFeeUsd),
      monitoringFeeUsd,
      recurringPlatformFeeUsd
    },
    oneTimeUsd,
    annualUsd,
    fiveYearUsd: round2(oneTimeUsd + annualUsd * 5),
    dataMode: "SIMULATED — illustrative fee assumptions, not a real pricing schedule"
  };
}

function round2(value) { return Math.round(value * 100) / 100; }
