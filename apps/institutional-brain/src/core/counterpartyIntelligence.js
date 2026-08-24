import crypto from "node:crypto";

// Entity & Counterparty Intelligence — simulated KYB/KYC/beneficial-ownership/sanctions/
// litigation/bankruptcy screening. Deterministic (hashed from the entity name) so the same
// counterparty always produces the same simulated profile. Every field is explicitly labeled
// SIMULATED — this is demo scaffolding, not a real screening provider integration.
function scoreFromString(seed, salt) {
  const hash = crypto.createHash("sha256").update(`${seed}:${salt}`).digest();
  return hash.readUInt16BE(0) % 101;
}

export function screenCounterparty({name, type}) {
  const riskScore = scoreFromString(name, "risk");
  const sanctionsHit = scoreFromString(name, "sanctions") < 3; // ~3% simulated hit rate
  return {
    id: `cp_${crypto.randomUUID()}`,
    name,
    type: type || "Counterparty",
    dataMode: "SIMULATED",
    kyb: sanctionsHit ? "FLAGGED" : "PASSED",
    kyc: sanctionsHit ? "FLAGGED" : "PASSED",
    beneficialOwnership: "DISCLOSED",
    accreditation: scoreFromString(name, "accreditation") > 20 ? "VERIFIED" : "PENDING",
    sanctionsScreening: sanctionsHit ? "HIT" : "CLEAR",
    jurisdiction: ["US", "UK", "SG", "LU", "KY"][scoreFromString(name, "jurisdiction") % 5],
    regulatoryStatus: sanctionsHit ? "UNDER REVIEW" : "IN GOOD STANDING",
    litigationScreening: scoreFromString(name, "litigation") < 8 ? "OPEN MATTER FOUND" : "CLEAR",
    bankruptcyScreening: "CLEAR",
    authorizedSignatories: 1 + (scoreFromString(name, "signatories") % 3),
    riskScore: sanctionsHit ? Math.min(riskScore, 30) : riskScore,
    addedAt: new Date().toISOString()
  };
}

export function addCounterparty(deal, {name, type}) {
  if (!name) throw new Error("COUNTERPARTY_NAME_REQUIRED");
  deal.counterparties = deal.counterparties || [];
  const profile = screenCounterparty({name, type});
  deal.counterparties.push(profile);
  return profile;
}

export function listCounterparties(deal) {
  return deal.counterparties || [];
}
