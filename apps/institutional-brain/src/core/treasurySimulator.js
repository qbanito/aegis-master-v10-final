import crypto from "node:crypto";

// Multisig & Treasury Simulator — every movement is checked against the deal's configured
// M-of-N threshold before it's allowed to execute; the full movement log (approved and
// rejected) is retained so Monitoring Center and the Digital Twin can replay it.
export function treasuryState(deal) {
  const movements = deal.treasury?.movements || [];
  const balanceUsd = movements.reduce((balance, m) => {
    if (m.status !== "EXECUTED") return balance;
    return m.type === "DEPOSIT" ? balance + m.amountUsd : balance - m.amountUsd;
  }, deal.finance.reserveTargetUsd);
  return {
    threshold: deal.custody.multisigThreshold,
    signers: deal.custody.multisigSigners,
    balanceUsd: Math.round(balanceUsd * 100) / 100,
    movements
  };
}

export function recordMovement(deal, {amountUsd, signatures = 1, signerNames = [], purpose = "Treasury movement", type = "WITHDRAWAL"}) {
  if (!(amountUsd > 0)) throw new Error("AMOUNT_REQUIRED");
  deal.treasury = deal.treasury || {movements: []};
  const threshold = deal.custody.multisigThreshold;
  const approved = signatures >= threshold;
  const movement = {
    id: `txn_${crypto.randomUUID()}`,
    type,
    amountUsd,
    purpose,
    signaturesProvided: signatures,
    signaturesRequired: threshold,
    signerNames,
    status: approved ? "EXECUTED" : "REJECTED",
    reason: approved ? null : `${signatures}/${threshold} signatures provided — authorization threshold not met.`,
    at: new Date().toISOString()
  };
  deal.treasury.movements.unshift(movement);
  return movement;
}
