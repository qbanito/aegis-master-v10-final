// Capital Stack & Waterfall Engine — models how a single dollar of distributable cash moves
// through the tranches (senior debt -> mezzanine -> preferred equity -> common equity) in
// strict priority order. Rate-bearing tranches (ratePct > 0) are paid their monthly obligation
// first, in priority order; whatever remains splits pro-rata across the zero-rate (residual
// equity) tranches.
export function listTranches(deal) {
  return [...(deal.tranches || [])].sort((a, b) => a.priority - b.priority);
}

export function runWaterfall(deal, availableCashUsd) {
  const tranches = listTranches(deal);
  let remaining = availableCashUsd;
  const payouts = [];

  const rateBearing = tranches.filter(t => t.ratePct > 0);
  const residual = tranches.filter(t => !t.ratePct);

  for (const tranche of rateBearing) {
    const dueUsd = tranche.amountUsd * (tranche.ratePct / 100 / 12);
    const paidUsd = Math.min(dueUsd, remaining);
    remaining -= paidUsd;
    payouts.push({trancheId: tranche.id, name: tranche.name, priority: tranche.priority, dueUsd: round2(dueUsd), paidUsd: round2(paidUsd), shortfallUsd: round2(dueUsd - paidUsd)});
  }

  const residualTotalUsd = tranches.reduce((sum, t) => sum + t.amountUsd, 0) || 1;
  for (const tranche of residual) {
    const shareUsd = residualTotalUsd > 0 ? remaining * (tranche.amountUsd / residualTotalUsd) : 0;
    payouts.push({trancheId: tranche.id, name: tranche.name, priority: tranche.priority, dueUsd: null, paidUsd: round2(shareUsd), shortfallUsd: 0});
  }
  if (residual.length === 1) {
    // single residual tranche absorbs 100% of what's left, not a proportional share of itself
    payouts[payouts.length - 1].paidUsd = round2(remaining);
  }

  return {
    availableCashUsd: round2(availableCashUsd),
    tranches,
    payouts,
    fullyServiced: payouts.every(p => (p.shortfallUsd || 0) <= 0.01)
  };
}

function round2(value) { return Math.round(value * 100) / 100; }
