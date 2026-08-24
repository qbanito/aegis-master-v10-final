// Investor Management — the deal's named simulated roster already lives on deal.investors.list
// (generated in dealSpec.js). This module adds the one interactive behavior the spec calls for:
// attempting a transfer between investors, auto-blocked when it violates KYC, lock-up, or the
// whitelist-only transfer restriction.
export function listInvestors(deal) {
  return deal.investors.list || [];
}

export function attemptTransfer(deal, investorId, toWallet, monthsElapsed = 0) {
  const investors = deal.investors.list || [];
  const sender = investors.find(investor => investor.id === investorId);
  if (!sender) throw new Error(`INVESTOR_NOT_FOUND:${investorId}`);

  const recipient = investors.find(investor => investor.wallet === toWallet);
  const recipientVerified = Boolean(recipient);

  if (deal.compliance.whitelistOnly && !recipientVerified) {
    return {result: "REJECTED", reason: "Recipient not present in approved investor registry.", ruleViolated: "unverifiedInvestorCannotReceiveRestrictedAsset", investorId, toWallet};
  }
  if (sender.kyc !== "PASSED") {
    return {result: "REJECTED", reason: `${sender.name} has KYC status ${sender.kyc}, not PASSED.`, ruleViolated: "kycRequired", investorId, toWallet};
  }
  if (monthsElapsed < sender.lockupExpiresMonth) {
    return {result: "REJECTED", reason: `Lock-up active until month ${sender.lockupExpiresMonth} (attempted at month ${monthsElapsed}).`, ruleViolated: "redemptionDate>=lockupExpiration", investorId, toWallet};
  }
  if (deal.transfer.approvalRequired) {
    return {result: "REJECTED", reason: `Transfer requires ${deal.transfer.approver} approval before execution.`, ruleViolated: "transferApprovalRequired", investorId, toWallet};
  }
  return {result: "APPROVED", reason: "Transfer conditions satisfied.", investorId, toWallet, recipientId: recipient.id};
}
