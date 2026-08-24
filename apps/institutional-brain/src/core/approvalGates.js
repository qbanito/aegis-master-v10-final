import {computeSecurityScore} from "./securityScore.js";
import {computeComplianceScore} from "./complianceEngine.js";
import {allApproved} from "./governanceWorkflow.js";

// The 8 production-readiness gates verbatim from mg-a8-nexus.json's own `approval_gates` list —
// this is NEXUS's documented mandate for when operations may actually execute, made real:
// every gate below reads existing deal state, never a number invented for the occasion. There is
// no separate boolean for "financial spec locked" or "production deployment" anywhere in the
// data model, so those two gates use the closest real proxy available (documented in each gate's
// `basis`) rather than adding a field nothing else in the app would ever set.
const GATE_DEFINITIONS = [
  {
    id: "financial_spec_locked",
    label: "Especificación financiera bloqueada",
    basis: "deal.status ya avanzó más allá de Draft",
    evaluate: deal => ({
      passed: deal.status !== "Draft",
      detail: deal.status === "Draft"
        ? "El deal sigue en Draft — la especificación financiera todavía se puede editar libremente."
        : `El deal está en estado ${deal.status}, ya no es un borrador editable.`
    })
  },
  {
    id: "roles_mapped",
    label: "Roles y contrapartes asignados",
    basis: "todos los roles requeridos tienen assigned=true",
    evaluate: deal => {
      const roles = Object.values(deal.roles || {});
      const assigned = roles.filter(role => role.assigned).length;
      return {
        passed: roles.length > 0 && assigned === roles.length,
        detail: `${assigned}/${roles.length || 0} roles asignados.`
      };
    }
  },
  {
    id: "compliance_rules_defined",
    label: "Reglas de compliance definidas",
    basis: "computeComplianceScore(deal).score === 100",
    evaluate: deal => {
      const {score, blockedBy} = computeComplianceScore(deal);
      return {passed: score === 100, detail: blockedBy ? `Bloqueado por: ${blockedBy}` : `Compliance score: ${score}/100.`};
    }
  },
  {
    id: "security_controls_configured",
    label: "Controles de seguridad configurados",
    basis: "computeSecurityScore(deal).score >= 90",
    evaluate: deal => {
      const {score} = computeSecurityScore(deal);
      return {passed: score >= 90, detail: `Security score: ${score}/100.`};
    }
  },
  {
    id: "financial_invariants_pass",
    label: "Invariantes financieros satisfechos",
    basis: "deal.lastSimulation.invariants.every(satisfied)",
    evaluate: deal => {
      const invariants = deal.lastSimulation?.invariants;
      if (!invariants) return {passed: false, detail: "Todavía no se corrió ninguna simulación."};
      const failing = invariants.filter(item => !item.satisfied);
      return {passed: failing.length === 0, detail: failing.length ? `${failing.length} invariante(s) violado(s): ${failing.map(item => item.id).join(", ")}.` : "Los 7 invariantes financieros pasan."};
    }
  },
  {
    id: "simulation_pass",
    label: "Simulación ejecutada y aprobada",
    basis: "deal.simulationRun && invariantes satisfechos",
    evaluate: deal => ({
      passed: Boolean(deal.simulationRun) && Boolean(deal.lastSimulation?.invariants?.every(item => item.satisfied)),
      detail: deal.simulationRun ? "Simulación corrida." : "Todavía no se corrió ninguna simulación."
    })
  },
  {
    id: "human_approval",
    label: "Aprobación humana (Deployment Authority)",
    basis: "deal.governance.DeploymentAuthority.decision === APPROVED",
    evaluate: deal => {
      const stage = deal.governance?.DeploymentAuthority;
      return {
        passed: stage?.decision === "APPROVED",
        detail: stage?.decision === "APPROVED" ? `Aprobado por ${stage.actor} el ${stage.at}.` : `Estado actual: ${stage?.decision || "PENDING"}.`
      };
    }
  },
  {
    id: "testnet_before_production",
    label: "Desplegado y validado en testnet",
    basis: "deal.testnet.deployments.length > 0",
    evaluate: deal => {
      const count = deal.testnet?.deployments?.length || 0;
      return {passed: count > 0, detail: count > 0 ? `${count} despliegue(s) en testnet registrados.` : "Ningún despliegue en testnet todavía."};
    }
  }
];

// Full governance sign-off (all 6 stages, not just DeploymentAuthority) is reported alongside the
// gates as extra context — it's stricter than the human_approval gate itself and the NEXUS
// scenario library (#33 "cliente quiere lanzar a mainnet ya") expects to see it.
export function evaluateApprovalGates(deal) {
  const gates = GATE_DEFINITIONS.map(def => ({id: def.id, label: def.label, basis: def.basis, ...def.evaluate(deal)}));
  const blockingGates = gates.filter(gate => !gate.passed);
  return {
    gates,
    allPassed: blockingGates.length === 0,
    blockingCount: blockingGates.length,
    fullGovernanceApproved: allApproved(deal),
    recommendation: blockingGates.length === 0
      ? "Todos los gates de producción están en verde — el deal cumple los criterios documentados de NEXUS para pasar de testnet a producción."
      : `No ejecutar en producción todavía: ${blockingGates.length} gate(s) bloqueando (${blockingGates.map(gate => gate.id).join(", ")}).`
  };
}
