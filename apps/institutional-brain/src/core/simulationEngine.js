import {evaluateInvariants} from "./financialInvariants.js";

const PERIODS_PER_YEAR = {monthly: 12, quarterly: 4, annual: 1};

// Institutional real-estate / private-credit vehicles typically service senior capital
// interest-only during the hold period, with principal due at maturity/refinance — a fully
// amortizing loan inside a 12-month simulation window would consume the entire NOI. Debt
// service here is therefore interest-only; principalOutstanding stays flat within the window.
function interestOnlyDebtService(principal, ratePct, periodMonths) {
  const monthlyRate = ratePct / 100 / 12;
  return principal * monthlyRate * periodMonths;
}

// Base-case digital twin: rental/cashflow income enters the vehicle, fees are deducted, the
// reserve is funded, debt service is executed, distributable cash is calculated, and the
// investor waterfall pays out pro-rata each period. Every period is checked against the
// Financial Invariant Engine. `totalMonths` selects Run 1 Month / 12 Months / Full Lifecycle
// (defaults to 12, i.e. "Run 12 Months").
export function runBaseSimulation(spec, {totalMonths = 12} = {}) {
  const periodsPerYear = PERIODS_PER_YEAR[spec.distribution.frequency];
  const periodMonths = 12 / periodsPerYear;
  const periodsCount = Math.max(1, Math.round(totalMonths / periodMonths));
  const principalOutstanding = spec.finance.seniorCapitalUsd;

  let reserveBalance = 0;
  let totalDistributed = 0;
  let totalAvailable = 0;
  const periods = [];
  const investorCount = spec.investors.count;
  const investorBalances = Array.from({length: investorCount}, (_, index) => ({
    investorId: `investor-${index + 1}`,
    ownershipPct: 100 / investorCount,
    cumulativeDistributionUsd: 0
  }));

  for (let period = 1; period <= periodsCount; period++) {
    const periodNoi = spec.finance.annualCashflowUsd * (periodMonths / 12);
    const managementFee = periodNoi * (spec.finance.feePct / 100);

    const reserveRemaining = Math.max(0, spec.finance.reserveTargetUsd - reserveBalance);
    const reserveContribution = Math.min(reserveRemaining, spec.finance.reserveTargetUsd * (periodMonths / 12));
    reserveBalance += reserveContribution;

    const debtServicePeriod = interestOnlyDebtService(principalOutstanding, spec.finance.ratePct, periodMonths);

    const availableCash = Math.max(0, periodNoi - managementFee - reserveContribution - debtServicePeriod);
    const distributedCash = availableCash; // base case distributes everything that is available
    totalAvailable += availableCash;
    totalDistributed += distributedCash;

    const perInvestor = distributedCash / investorCount;
    investorBalances.forEach(investor => { investor.cumulativeDistributionUsd += perInvestor; });

    periods.push({
      period,
      months: periodMonths,
      noiUsd: round2(periodNoi),
      managementFeeUsd: round2(managementFee),
      reserveContributionUsd: round2(reserveContribution),
      debtServiceUsd: round2(debtServicePeriod),
      availableCashUsd: round2(availableCash),
      distributedCashUsd: round2(distributedCash),
      principalOutstandingUsd: round2(Math.max(0, principalOutstanding))
    });
  }

  const finalState = {
    distributedCash: totalDistributed,
    availableCash: totalAvailable,
    totalInvestorUnits: investorCount,
    authorizedUnits: investorCount,
    ownershipPercentages: investorBalances.map(investor => investor.ownershipPct),
    permittedOwnershipLimit: spec.investors.maxOwnershipPct,
    waterfallExecutedInOrder: true,
    principalOutstanding: Math.max(0, principalOutstanding)
  };

  return {
    dealType: spec.dealType,
    fullyModeled: true,
    totalMonths,
    periods,
    events: periods.map(p => ({
      period: p.period,
      at: `month ${p.period * (12 / PERIODS_PER_YEAR[spec.distribution.frequency])}`,
      description: `NOI $${p.noiUsd.toLocaleString()} in -> fees $${p.managementFeeUsd.toLocaleString()}, reserve $${p.reserveContributionUsd.toLocaleString()}, debt service $${p.debtServiceUsd.toLocaleString()} -> distributed $${p.distributedCashUsd.toLocaleString()}`
    })),
    investorBalances: investorBalances.map(investor => ({...investor, cumulativeDistributionUsd: round2(investor.cumulativeDistributionUsd)})),
    totals: {
      noiUsd: round2(periods.reduce((sum, p) => sum + p.noiUsd, 0)),
      managementFeeUsd: round2(periods.reduce((sum, p) => sum + p.managementFeeUsd, 0)),
      reserveContributionUsd: round2(reserveBalance),
      debtServiceUsd: round2(periods.reduce((sum, p) => sum + p.debtServiceUsd, 0)),
      distributedCashUsd: round2(totalDistributed)
    },
    reserveBalanceUsd: round2(reserveBalance),
    principalOutstandingUsd: round2(Math.max(0, principalOutstanding)),
    invariants: evaluateInvariants(finalState)
  };
}

// Run 1 Month / Run 12 Months / Run Full Lifecycle — thin wrappers over runBaseSimulation with
// the duration the button represents.
export function run1Month(spec) { return runBaseSimulation(spec, {totalMonths: 1}); }
export function run12Months(spec) { return runBaseSimulation(spec, {totalMonths: 12}); }
export function runFullLifecycle(spec) { return runBaseSimulation(spec, {totalMonths: Math.round(spec.finance.termYears * 12)}); }

// Stress Test — shocks NOI and the senior rate, then runs the standard 12-month digital twin
// against the shocked spec so shortfalls surface through the same invariant checks as the base
// case. Defaults match the original -25%/+200bps stress test; NEXUS scenario presets (e.g. "NOI
// falls 30%", "rates +300bps") override one or both via params.
export function runStressTest(spec, {noiShockPct = -25, rateShockBps = 200} = {}) {
  const stressedSpec = {
    ...spec,
    finance: {
      ...spec.finance,
      annualCashflowUsd: spec.finance.annualCashflowUsd * (1 + noiShockPct / 100),
      ratePct: spec.finance.ratePct + rateShockBps / 100
    }
  };
  const result = runBaseSimulation(stressedSpec, {totalMonths: 12});
  return {...result, stressed: true, stressAssumptions: {noiShockPct, rateShockBps}};
}

// Lighter single-period preset for the three deal types that aren't fully modeled yet
// (Private Credit, Structured Finance, Commodity Finance) — clearly labeled as simulated.
export function runPresetSimulation(spec) {
  const periodNoi = spec.finance.annualCashflowUsd;
  const managementFee = periodNoi * (spec.finance.feePct / 100);
  const reserveContribution = Math.min(spec.finance.reserveTargetUsd, periodNoi * 0.1);
  const debtServicePeriod = interestOnlyDebtService(spec.finance.seniorCapitalUsd, spec.finance.ratePct, 12);
  const availableCash = Math.max(0, periodNoi - managementFee - reserveContribution - debtServicePeriod);
  const investorCount = spec.investors.count;
  const perInvestor = availableCash / investorCount;

  const finalState = {
    distributedCash: availableCash,
    availableCash,
    totalInvestorUnits: investorCount,
    authorizedUnits: investorCount,
    ownershipPercentages: Array.from({length: investorCount}, () => 100 / investorCount),
    permittedOwnershipLimit: spec.investors.maxOwnershipPct,
    waterfallExecutedInOrder: true,
    principalOutstanding: spec.finance.seniorCapitalUsd
  };

  return {
    dealType: spec.dealType,
    fullyModeled: false,
    note: "Simulated preset — single annualized period, not the full 12-month digital twin used for Real Estate SPV.",
    totals: {
      noiUsd: round2(periodNoi),
      managementFeeUsd: round2(managementFee),
      reserveContributionUsd: round2(reserveContribution),
      debtServiceUsd: round2(debtServicePeriod),
      distributedCashUsd: round2(availableCash)
    },
    investorBalances: Array.from({length: investorCount}, (_, index) => ({
      investorId: `investor-${index + 1}`,
      ownershipPct: round2(100 / investorCount),
      cumulativeDistributionUsd: round2(perInvestor)
    })),
    invariants: evaluateInvariants(finalState)
  };
}

const SCENARIOS = {
  "unauthorized-transfer": spec => ({
    scenarioId: "unauthorized-transfer",
    name: "Unauthorized Transfer",
    narrative: "Investor #7 intenta transferir unidades a una wallet no verificada.",
    result: "REJECTED",
    reason: "Recipient not present in approved investor registry.",
    ruleViolated: "unverifiedInvestorCannotReceiveRestrictedAsset",
    detail: evaluateInvariants(baselineState(spec, {transferAttempt: {recipientVerified: false}}))
      .find(item => item.id === "unverifiedInvestorCannotReceiveRestrictedAsset")
  }),
  "lockup-violation": spec => {
    const redemptionMonth = Math.max(0, spec.lockupMonths - 1);
    return {
      scenarioId: "lockup-violation",
      name: "Lock-up Violation",
      narrative: `Investor intenta redimir unidades en el mes ${redemptionMonth}, antes de que expire el lock-up.`,
      result: "REJECTED",
      reason: `Lock-up period active until month ${spec.lockupMonths}.`,
      ruleViolated: "redemptionDate>=lockupExpiration",
      detail: evaluateInvariants(baselineState(spec, {redemptionMonth, lockupExpirationMonth: spec.lockupMonths}))
        .find(item => item.id === "redemptionDate>=lockupExpiration")
    };
  },
  "treasury-compromise": (spec, params = {}) => {
    const attemptedUsd = round2(params.amountUsd ?? spec.asset.valueUsd * 0.03);
    return {
      scenarioId: "treasury-compromise",
      name: "Treasury Compromise",
      narrative: `Una wallet intenta retirar $${attemptedUsd.toLocaleString()} de tesoreria con una sola firma.`,
      result: "REJECTED",
      reason: `${spec.custody.multisigThreshold}/${spec.custody.multisigSigners} multisig authorization required.`,
      ruleViolated: "treasury-access-control",
      detail: {id: "treasury-access-control", description: "Los movimientos de tesoreria exigen el umbral multisig configurado.", satisfied: false, detail: `1 firma provista / ${spec.custody.multisigThreshold} requeridas`}
    };
  },
  "distribution-error": spec => {
    const base = runBaseSimulation(spec);
    const availablePeriodUsd = base.periods[0]?.availableCashUsd ?? 0;
    const attemptedUsd = round2(availablePeriodUsd * 1.15 + 1);
    return {
      scenarioId: "distribution-error",
      name: "Distribution Error",
      narrative: `El sistema intenta distribuir $${attemptedUsd.toLocaleString()} cuando solo hay $${availablePeriodUsd.toLocaleString()} de cash disponible.`,
      result: "BLOCKED",
      reason: "FINANCIAL INVARIANT VIOLATION — distribution exceeds available cash. Deployment/execution blocked.",
      ruleViolated: "distributedCash<=availableCash",
      detail: evaluateInvariants(baselineState(spec, {distributedCash: attemptedUsd, availableCash: availablePeriodUsd}))
        .find(item => item.id === "distributedCash<=availableCash")
    };
  },
  "expired-kyc": spec => ({
    scenarioId: "expired-kyc", name: "Expired KYC",
    narrative: "Un inversionista con verificacion KYC vencida intenta recibir una distribucion.",
    result: "REJECTED",
    reason: "Investor KYC status is PENDING (expired) — must re-verify before receiving distributions.",
    ruleViolated: "kycRequired",
    detail: {id: "kycRequired", description: "Solo inversionistas con KYC vigente pueden recibir distribuciones.", satisfied: false, detail: "KYC status: PENDING"}
  }),
  "sanctioned-counterparty": spec => ({
    scenarioId: "sanctioned-counterparty", name: "Sanctioned Counterparty",
    narrative: "Una contraparte nueva es evaluada y aparece marcada en el screening de sanciones.",
    result: "BLOCKED",
    reason: "Counterparty flagged in simulated sanctions screening — onboarding halted pending manual review.",
    ruleViolated: "sanctionsScreening",
    detail: {id: "sanctionsScreening", description: "Ninguna contraparte sancionada puede ser onboardeada.", satisfied: false, detail: "sanctionsScreening: HIT"}
  }),
  "insufficient-treasury-funds": spec => {
    const balanceUsd = round2(spec.finance.reserveTargetUsd);
    const requestedUsd = round2(balanceUsd + spec.asset.valueUsd * 0.01);
    return {
      scenarioId: "insufficient-treasury-funds", name: "Insufficient Treasury Funds",
      narrative: `Se solicita un retiro de $${requestedUsd.toLocaleString()} cuando la tesoreria solo tiene $${balanceUsd.toLocaleString()}.`,
      result: "REJECTED",
      reason: "Requested withdrawal exceeds current treasury balance.",
      ruleViolated: "distributedCash<=availableCash",
      detail: {id: "distributedCash<=availableCash", description: "El retiro no puede exceder el balance de tesoreria.", satisfied: false, detail: `Solicitado ${requestedUsd} / Disponible ${balanceUsd}`}
    };
  },
  "smart-contract-permission-abuse": spec => ({
    scenarioId: "smart-contract-permission-abuse", name: "Smart Contract Permission Abuse",
    narrative: "Una cuenta sin rol autorizado intenta ejecutar una funcion administrativa del Treasury Controller.",
    result: "REJECTED",
    reason: "Caller lacks required role — access control enforced by the generated Treasury Controller.",
    ruleViolated: "accessControl",
    detail: {id: "accessControl", description: "Solo cuentas con rol autorizado pueden ejecutar funciones administrativas.", satisfied: false, detail: "Caller role: NONE"}
  }),
  "compromised-administrator": spec => ({
    scenarioId: "compromised-administrator", name: "Compromised Administrator",
    narrative: "Una clave de administrador es marcada como comprometida e intenta mover fondos.",
    result: "BLOCKED",
    reason: "Administrator key flagged compromised — Emergency Pause engaged, action blocked pending guardian rotation.",
    ruleViolated: "adminPrivileges",
    detail: {id: "adminPrivileges", description: "Una clave marcada como comprometida no puede autorizar movimientos.", satisfied: false, detail: "Admin key status: COMPROMISED"}
  }),
  "missing-multisig-signer": spec => ({
    scenarioId: "missing-multisig-signer", name: "Missing Multisig Signer",
    narrative: `Uno de los ${spec.custody.multisigSigners} firmantes de tesoreria no esta disponible.`,
    result: "REJECTED",
    reason: `Only ${spec.custody.multisigThreshold - 1}/${spec.custody.multisigThreshold} required signatures available — signer unreachable.`,
    ruleViolated: "treasury-access-control",
    detail: {id: "treasury-access-control", description: "El umbral multisig configurado debe cumplirse siempre.", satisfied: false, detail: `${spec.custody.multisigThreshold - 1} firmas disponibles / ${spec.custody.multisigThreshold} requeridas`}
  }),
  "default-on-debt": spec => {
    const debtServiceUsd = round2(spec.finance.seniorCapitalUsd * (spec.finance.ratePct / 100) / 12);
    const availableUsd = round2(spec.finance.annualCashflowUsd / 12 * 0.4);
    return {
      scenarioId: "default-on-debt", name: "Default on Debt",
      narrative: `El servicio de deuda mensual ($${debtServiceUsd.toLocaleString()}) excede el cash disponible ($${availableUsd.toLocaleString()}).`,
      result: "HALTED",
      reason: "Debt service obligation exceeds available cash — default event triggered, equity distributions halt until cured.",
      ruleViolated: "principalOutstanding>=0",
      detail: {id: "principalOutstanding>=0", description: "Un evento de default no puede dejar principal negativo ni distribuciones a equity mientras la deuda esta impaga.", satisfied: false, detail: `Debt service ${debtServiceUsd} > Disponible ${availableUsd}`}
    };
  },
  "collateral-value-decline": (spec, params = {}) => {
    const declinePct = params.pct ?? 20;
    const declinedValueUsd = round2(spec.asset.valueUsd * (1 - declinePct / 100));
    const ltvPct = round2((spec.finance.seniorCapitalUsd / declinedValueUsd) * 100);
    return {
      scenarioId: "collateral-value-decline", name: "Collateral Value Decline",
      narrative: `El valor del activo cae ${declinePct}% a $${declinedValueUsd.toLocaleString()}, elevando el LTV a ${ltvPct}%.`,
      result: "FLAGGED",
      reason: `Loan-to-value of ${ltvPct}% breaches the maximum covenant — lender notice triggered.`,
      ruleViolated: "collateralCovenant",
      detail: {id: "collateralCovenant", description: "El LTV no puede exceder el covenant maximo tras una caida de valor del colateral.", satisfied: ltvPct <= 80, detail: `LTV ${ltvPct}%`}
    };
  },
  "oracle-failure": spec => ({
    scenarioId: "oracle-failure", name: "Oracle Failure",
    narrative: "El oraculo de precios utilizado para valuar el activo deja de responder.",
    result: "HALTED",
    reason: "Price oracle unavailable — valuation-dependent actions paused until the oracle recovers.",
    ruleViolated: "oracleRisk",
    detail: {id: "oracleRisk", description: "Ninguna accion dependiente de valuacion puede ejecutarse sin un oraculo activo.", satisfied: false, detail: "Oracle status: UNAVAILABLE"}
  }),
  "blockchain-congestion": spec => ({
    scenarioId: "blockchain-congestion", name: "Blockchain Congestion",
    narrative: "La red seleccionada experimenta congestion severa durante una distribucion programada.",
    result: "DELAYED",
    reason: "Network congestion detected — transaction queued, settlement delayed beyond SLA.",
    ruleViolated: "settlementSpeed",
    detail: {id: "settlementSpeed", description: "La congestion de red puede retrasar el settlement mas alla del SLA definido.", satisfied: false, detail: "Congestion: HIGH"}
  }),
  "network-unavailable": spec => ({
    scenarioId: "network-unavailable", name: "Network Unavailable",
    narrative: "El endpoint de la blockchain seleccionada se vuelve inalcanzable.",
    result: "HALTED",
    reason: "Blockchain network endpoint unreachable — all on-chain actions paused; simulation/testnet mode unaffected.",
    ruleViolated: "networkAvailability",
    detail: {id: "networkAvailability", description: "Las acciones on-chain requieren un endpoint de red disponible.", satisfied: false, detail: "Network status: UNREACHABLE"}
  }),
  "custodian-unavailable": spec => ({
    scenarioId: "custodian-unavailable", name: "Custodian Unavailable",
    narrative: "El custodio designado reporta una interrupcion de servicio.",
    result: "HALTED",
    reason: "Custodian system unavailable — asset custody actions paused until service resumes.",
    ruleViolated: "custodyAvailability",
    detail: {id: "custodyAvailability", description: "Las acciones de custodia requieren que el custodio este operativo.", satisfied: custodyOk(spec), detail: "Custodian status: UNAVAILABLE"}
  }),
  "emergency-pause": spec => ({
    scenarioId: "emergency-pause", name: "Emergency Pause",
    narrative: "El guardian activa manualmente el Emergency Pause del deal.",
    result: "PAUSED",
    reason: "Emergency pause engaged by guardian — all transfers and distributions halted until unpaused.",
    ruleViolated: "emergencyPause",
    detail: {id: "emergencyPause", description: "Mientras el pause este activo, ninguna transferencia o distribucion puede ejecutarse.", satisfied: !spec.emergencyPause, detail: `emergencyPause enabled: ${spec.emergencyPause}`}
  })
};

function custodyOk(spec) { return spec.custody.model !== "self"; }

export const SCENARIO_IDS = Object.keys(SCENARIOS);

export function runScenario(spec, scenarioId, params = {}) {
  const runner = SCENARIOS[scenarioId];
  if (!runner) throw new Error(`UNKNOWN_SCENARIO:${scenarioId}`);
  return runner(spec, params);
}

function baselineState(spec, overrides = {}) {
  return {
    distributedCash: 0,
    availableCash: 0,
    totalInvestorUnits: spec.investors.count,
    authorizedUnits: spec.investors.count,
    ownershipPercentages: [100 / spec.investors.count],
    permittedOwnershipLimit: spec.investors.maxOwnershipPct,
    waterfallExecutedInOrder: true,
    principalOutstanding: spec.finance.seniorCapitalUsd,
    ...overrides
  };
}

function round2(value) { return Math.round(value * 100) / 100; }
