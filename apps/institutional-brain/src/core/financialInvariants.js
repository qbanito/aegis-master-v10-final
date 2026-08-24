// Financial truths that must never break, independent of which chain executes the deal.
// Each invariant is a pure predicate over a simulation state snapshot: {id, description, satisfied, detail}.
const EPSILON = 0.01;

export function evaluateInvariants(state) {
  const results = [];

  results.push({
    id: "distributedCash<=availableCash",
    description: "El efectivo distribuido nunca puede exceder el efectivo disponible.",
    satisfied: state.distributedCash <= state.availableCash + EPSILON,
    detail: `Distribuido ${state.distributedCash.toFixed(2)} / Disponible ${state.availableCash.toFixed(2)}`
  });

  results.push({
    id: "totalInvestorUnits<=authorizedUnits",
    description: "Las unidades totales de inversionistas nunca pueden exceder las unidades autorizadas.",
    satisfied: state.totalInvestorUnits <= state.authorizedUnits + EPSILON,
    detail: `Emitidas ${state.totalInvestorUnits} / Autorizadas ${state.authorizedUnits}`
  });

  const maxOwnershipPct = Math.max(0, ...(state.ownershipPercentages || [0]));
  results.push({
    id: "ownershipPercentage<=permittedLimit",
    description: "Ningun inversionista puede superar el limite de propiedad permitido.",
    satisfied: maxOwnershipPct <= state.permittedOwnershipLimit + EPSILON,
    detail: `Maxima participacion ${maxOwnershipPct.toFixed(2)}% / Limite ${state.permittedOwnershipLimit}%`
  });

  results.push({
    id: "payment_waterfall_order cannot be bypassed",
    description: "El orden del waterfall de pagos (fees, reserva, deuda, distribucion) no puede saltarse.",
    satisfied: state.waterfallExecutedInOrder !== false,
    detail: state.waterfallExecutedInOrder === false ? "Se detecto una etapa del waterfall fuera de orden." : "Fees, reserva, deuda y distribucion se ejecutaron en orden."
  });

  results.push({
    id: "unverifiedInvestorCannotReceiveRestrictedAsset",
    description: "Un inversionista no verificado no puede recibir un activo restringido.",
    satisfied: !(state.transferAttempt && state.transferAttempt.recipientVerified === false),
    detail: state.transferAttempt
      ? `Destinatario verificado: ${state.transferAttempt.recipientVerified}`
      : "Sin intento de transferencia evaluado."
  });

  results.push({
    id: "redemptionDate>=lockupExpiration",
    description: "Una redencion no puede ocurrir antes de que expire el lock-up.",
    satisfied: state.redemptionMonth === undefined || state.redemptionMonth >= state.lockupExpirationMonth,
    detail: state.redemptionMonth === undefined
      ? "Sin intento de redencion evaluado."
      : `Redencion mes ${state.redemptionMonth} / Lock-up expira mes ${state.lockupExpirationMonth}`
  });

  results.push({
    id: "principalOutstanding>=0",
    description: "El principal de deuda pendiente nunca puede ser negativo.",
    satisfied: state.principalOutstanding >= -EPSILON,
    detail: `Principal pendiente ${state.principalOutstanding.toFixed(2)}`
  });

  return results;
}
