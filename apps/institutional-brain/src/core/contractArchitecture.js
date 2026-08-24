// Derives the required contract set from a Financial Contract Specification. This is the layer
// the adapters (EVM/Stellar/Canton) read from — the architecture is chain-neutral, only the
// generated source text differs per adapter.
export function buildContractArchitecture(spec) {
  const contracts = [
    {
      id: "investor-registry",
      name: "Investor Registry",
      why: "Registra cada inversionista aprobado, su elegibilidad y su porcentaje de participacion."
    },
    {
      id: "spv-ownership",
      name: `${spec.vehicle} Ownership`,
      why: `Emite y contabiliza las unidades de propiedad del ${spec.vehicle} entre los ${spec.investors.count} inversionistas.`
    }
  ];

  if (spec.transfer.approvalRequired || spec.investors.eligibility !== "any" || spec.compliance.whitelistOnly) {
    contracts.push({
      id: "compliance-transfer-controller",
      name: "Compliance & Transfer Controller",
      why: "Aplica KYC/AML, elegibilidad, lock-up y aprobacion del manager antes de permitir cualquier transferencia."
    });
  }

  contracts.push({
    id: "distribution-contract",
    name: "Distribution Contract",
    why: `Ejecuta el waterfall de distribucion ${spec.distribution.frequency} hacia los inversionistas registrados.`
  });

  if (spec.custody.model !== "self") {
    contracts.push({
      id: "escrow-contract",
      name: "Escrow Contract",
      why: "Retiene el capital captado y las reservas hasta que se cumplan las condiciones de despliegue o distribucion."
    });
  }

  if (spec.finance.seniorCapitalUsd > 0 || spec.custody.model === "multisig") {
    contracts.push({
      id: "treasury-controller",
      name: "Treasury Controller",
      why: spec.finance.seniorCapitalUsd > 0
        ? "Coordina el servicio de deuda senior y el flujo de caja disponible antes de cada distribucion."
        : `Exige ${spec.custody.multisigThreshold} de ${spec.custody.multisigSigners} firmas para mover fondos de tesoreria.`
    });
  }

  if (spec.finance.seniorCapitalUsd > 0) {
    contracts.push({
      id: "debt-contract",
      name: "Debt Contract",
      why: `Registra el principal de $${Math.round(spec.finance.seniorCapitalUsd).toLocaleString()}, la tasa de ${spec.finance.ratePct}% y el calendario de servicio de deuda senior.`
    });
  }

  if ((spec.tranches || []).length > 1) {
    contracts.push({
      id: "waterfall-contract",
      name: "Waterfall Contract",
      why: `Aplica el orden de prioridad de pago entre los ${spec.tranches.length} tramos del capital stack antes de distribuir a equity.`
    });
  }

  if (spec.lockupMonths > 0 || spec.redemptionNoticeMonths > 0) {
    contracts.push({
      id: "redemption-contract",
      name: "Redemption Contract",
      why: `Procesa solicitudes de redencion respetando el lock-up de ${spec.lockupMonths} meses y un aviso previo de ${spec.redemptionNoticeMonths || 0} meses.`
    });
  }

  contracts.push({
    id: "governance-contract",
    name: "Governance Contract",
    why: "Registra las aprobaciones por etapa (compliance, legal, security, investment committee) requeridas antes de avanzar el estado del deal."
  });

  if (spec.emergencyPause) {
    contracts.push({
      id: "emergency-controls",
      name: "Emergency Controls",
      why: "Permite pausar transferencias y distribuciones ante un incidente de seguridad o cumplimiento."
    });
  }

  return contracts;
}
