import crypto from "node:crypto";
import {buildContractArchitecture} from "./contractArchitecture.js";
import {generateEvmSource} from "../adapters/evmAdapter.js";
import {generateStellarSource} from "../adapters/stellarAdapter.js";
import {generateCantonSource} from "../adapters/cantonAdapter.js";
import {buildComparisonTable} from "../adapters/comparisonTable.js";
import {networkFit} from "./networkIntelligence.js";
import {computeSecurityScore} from "./securityScore.js";
import {computeComplianceScore} from "./complianceEngine.js";
import {computeRisk} from "./riskEngine.js";
import {listRoles} from "./roleMapper.js";
import {listCounterparties} from "./counterpartyIntelligence.js";
import {listGovernance} from "./governanceWorkflow.js";
import {listAuditTrail} from "./auditTrail.js";
import {listVersions} from "./versionControl.js";

export function buildTransactionPackage(deal) {
  const architecture = buildContractArchitecture(deal);
  const versionHash = crypto.createHash("sha256").update(JSON.stringify(specOnly(deal))).digest("hex");

  return {
    dealId: deal.id,
    tenant: deal.tenant,
    generatedAt: new Date().toISOString(),
    versionHash,
    version: deal.version,
    executiveSummary: `${deal.name} — ${deal.dealType} — $${deal.asset.valueUsd.toLocaleString()} — status ${deal.status}.`,
    specification: specOnly(deal),
    roles: listRoles(deal),
    counterparties: listCounterparties(deal),
    contractArchitecture: architecture,
    generatedCode: {
      evm: generateEvmSource(deal, architecture),
      stellar: generateStellarSource(deal, architecture),
      canton: generateCantonSource(deal, architecture)
    },
    comparisonTable: buildComparisonTable(deal),
    networkFit: networkFit(deal.dealType),
    complianceAnalysis: computeComplianceScore(deal),
    securityAnalysis: computeSecurityScore(deal),
    riskAnalysis: computeRisk(deal),
    simulation: deal.lastSimulation || null,
    scenarioResults: deal.lastScenarios || {},
    governance: listGovernance(deal),
    versions: listVersions(deal),
    auditTrail: listAuditTrail(deal),
    approvalHistory: deal.approvalHistory || []
  };
}

function specOnly(deal) {
  const {lastSimulation, lastScenarios, approvalHistory, auditTrail, versions, governance, treasury, testnet, counterparties, roles, ...spec} = deal;
  return spec;
}

export function transactionPackageToMarkdown(pkg) {
  const lines = [];
  lines.push(`# Digital Transaction Package — ${pkg.specification.name}`);
  lines.push("");
  lines.push(`Deal ID: \`${pkg.dealId}\`  `);
  lines.push(`Tenant: \`${pkg.tenant}\`  `);
  lines.push(`Version: ${pkg.version} · Version hash: \`${pkg.versionHash}\`  `);
  lines.push(`Generated: ${pkg.generatedAt}`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(pkg.executiveSummary);
  lines.push("");
  lines.push("## Financial Specification");
  lines.push("```json");
  lines.push(JSON.stringify(pkg.specification, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Roles");
  pkg.roles.forEach(role => lines.push(`- **${role.name}**: ${role.assigned ? role.provider : "UNASSIGNED (risk)"}`));
  lines.push("");
  if (pkg.counterparties.length) {
    lines.push("## Counterparties (SIMULATED screening)");
    pkg.counterparties.forEach(cp => lines.push(`- **${cp.name}** (${cp.type}) — sanctions: ${cp.sanctionsScreening}, risk score: ${cp.riskScore}`));
    lines.push("");
  }
  lines.push("## Contract Architecture");
  pkg.contractArchitecture.forEach(contract => lines.push(`- **${contract.name}** — ${contract.why}`));
  lines.push("");
  lines.push("## Network Fit");
  pkg.networkFit.results.forEach(result => lines.push(`- **${result.name}**: ${result.matchPct}% match`));
  lines.push("");
  lines.push("## Comparison Table");
  lines.push("| Requirement | EVM | Stellar | Canton |");
  lines.push("| --- | --- | --- | --- |");
  pkg.comparisonTable.forEach(row => lines.push(`| ${row.requirement} | ${row.evm} | ${row.stellar} | ${row.canton} |`));
  lines.push("");
  lines.push("## Compliance Readiness");
  lines.push(`Score: ${pkg.complianceAnalysis.score}/100${pkg.complianceAnalysis.blockedBy ? ` — blocked by: ${pkg.complianceAnalysis.blockedBy}` : ""}`);
  lines.push("");
  lines.push("## Security Readiness");
  lines.push(`Score: ${pkg.securityAnalysis.score}/100 — External Audit: ${pkg.securityAnalysis.externalAudit}`);
  pkg.securityAnalysis.checklist.forEach(item => lines.push(`- [${item.satisfied ? "x" : " "}] ${item.label}`));
  lines.push(`Production deployment locked: ${pkg.securityAnalysis.productionLocked}`);
  lines.push("");
  lines.push("## Risk Analysis");
  lines.push(`Overall Deal Risk Score: ${pkg.riskAnalysis.overall}/100`);
  pkg.riskAnalysis.categories.forEach(category => lines.push(`- **${category.name}**: ${category.score}/100 — ${category.reason}`));
  lines.push("");
  if (pkg.simulation) {
    lines.push("## Simulation Results");
    lines.push("```json");
    lines.push(JSON.stringify(pkg.simulation.totals, null, 2));
    lines.push("```");
    lines.push("### Financial Invariants");
    pkg.simulation.invariants.forEach(item => lines.push(`- [${item.satisfied ? "x" : " "}] ${item.description}`));
    lines.push("");
  }
  if (Object.keys(pkg.scenarioResults).length) {
    lines.push("## Adversarial Scenarios");
    Object.values(pkg.scenarioResults).forEach(scenario => lines.push(`- **${scenario.name}**: ${scenario.result} — ${scenario.reason}`));
    lines.push("");
  }
  lines.push("## Governance Approvals");
  pkg.governance.forEach(stage => lines.push(`- **${stage.stage}**: ${stage.decision}${stage.actor ? ` by ${stage.actor}` : ""}`));
  lines.push("");
  lines.push("## Audit Trail (most recent first)");
  pkg.auditTrail.slice(0, 30).forEach(entry => lines.push(`- ${entry.at} — ${entry.action} by ${entry.actor} (v${entry.versionAfter})`));
  lines.push("");
  lines.push("## Version History");
  pkg.versions.forEach(version => lines.push(`- v${version.version} at ${version.at}${version.approvalsInvalidated?.length ? ` — invalidated: ${version.approvalsInvalidated.join(", ")}` : ""}`));
  return lines.join("\n");
}
