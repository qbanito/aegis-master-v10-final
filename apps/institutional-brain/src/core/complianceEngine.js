// Compliance Readiness Score — a deterministic checklist over the deal's compliance
// configuration and investor roster, plus a plain-language reason for whatever blocks it.
export function computeComplianceScore(deal) {
  const investors = deal.investors.list || [];
  const kycPassRate = investors.length ? investors.filter(i => i.kyc === "PASSED").length / investors.length : 1;
  const checklist = [
    {id: "kycConfigured", label: "KYC Required", satisfied: deal.compliance.kycRequired === true},
    {id: "amlConfigured", label: "AML Required", satisfied: deal.compliance.amlRequired === true},
    {id: "sanctionsConfigured", label: "Sanctions Screening", satisfied: deal.compliance.sanctionsCheck === true},
    {id: "whitelistConfigured", label: "Whitelist-Only Transfers", satisfied: deal.compliance.whitelistOnly === true},
    {id: "eligibilityDefined", label: "Investor Eligibility Defined", satisfied: deal.investors.eligibility !== "any"},
    {id: "jurisdictionsDefined", label: "Jurisdictions Defined", satisfied: (deal.jurisdictions || []).length > 0},
    {id: "lockupConfigured", label: "Lock-up Period Configured", satisfied: deal.lockupMonths > 0},
    {id: "allInvestorsKyc", label: "All Investors KYC Passed", satisfied: kycPassRate === 1}
  ];
  const satisfiedCount = checklist.filter(item => item.satisfied).length;
  const score = Math.round((satisfiedCount / checklist.length) * 100);
  const blockingItem = checklist.find(item => !item.satisfied);
  return {
    score,
    checklist,
    kycPassRate: Math.round(kycPassRate * 100),
    blockedBy: blockingItem ? blockingItem.label : null
  };
}
