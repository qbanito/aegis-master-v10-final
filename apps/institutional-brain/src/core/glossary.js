// Plain-language explanations surfaced inline in the Deal Builder ("pulsa 'waterfall' y recibe
// una explicacion sencilla"). Kept as static data so the UI can render tooltips without a
// round-trip through an LLM.
export const GLOSSARY = {
  spv: {
    label: "SPV (Special Purpose Vehicle)",
    definition: "Entidad legal creada exclusivamente para poseer un activo y aislar su riesgo del resto del negocio."
  },
  waterfall: {
    label: "Waterfall",
    definition: "Orden en que se distribuyen los flujos de dinero entre las distintas clases de inversionistas."
  },
  lockup: {
    label: "Lock-up",
    definition: "Periodo durante el cual un inversionista no puede transferir ni redimir sus unidades."
  },
  accreditedInvestor: {
    label: "Accredited / Qualified Investor",
    definition: "Inversionista que cumple umbrales regulatorios de patrimonio o ingresos para acceder a ofertas privadas."
  },
  clawback: {
    label: "Clawback",
    definition: "Facultad del emisor de recuperar activos o fees ya distribuidos ante una condicion incumplida."
  },
  multisig: {
    label: "Multisig",
    definition: "Control de tesoreria que exige la firma de varias partes (M de N) para autorizar un movimiento."
  },
  redemption: {
    label: "Redemption",
    definition: "Proceso mediante el cual un inversionista retira o liquida su posicion en el vehiculo."
  },
  kyc: {
    label: "KYC (Know Your Customer)",
    definition: "Verificacion de identidad requerida antes de permitir que un inversionista participe."
  },
  aml: {
    label: "AML (Anti-Money Laundering)",
    definition: "Controles que previenen el uso del vehiculo para lavado de activos."
  },
  escrow: {
    label: "Escrow",
    definition: "Custodia de fondos por un tercero o contrato hasta que se cumplan condiciones definidas."
  },
  custody: {
    label: "Custody",
    definition: "Modelo bajo el cual se resguardan los activos del vehiculo (multisig, custodio o self-custody)."
  },
  emergencyPause: {
    label: "Emergency Pause",
    definition: "Interruptor que congela transferencias y distribuciones ante un incidente detectado."
  },
  reserve: {
    label: "Reserve",
    definition: "Monto retenido cada periodo antes de distribuir, para cubrir contingencias operativas."
  },
  debtService: {
    label: "Debt Service",
    definition: "Pago periodico de capital e intereses sobre la deuda senior del vehiculo."
  },
  ownershipCap: {
    label: "Ownership Cap",
    definition: "Porcentaje maximo del vehiculo que un solo inversionista puede llegar a poseer."
  },
  transferApproval: {
    label: "Transfer Approval",
    definition: "Requisito de que el manager u operador apruebe cada transferencia antes de ejecutarse."
  },
  nav: {
    label: "NAV (Net Asset Value)",
    definition: "Valor neto de los activos del vehiculo menos sus pasivos, dividido entre las unidades emitidas."
  },
  settlement: {
    label: "Settlement",
    definition: "Momento en que una transaccion se considera final e irreversible en la red utilizada."
  },
  transferAgent: {
    label: "Transfer Agent",
    definition: "Entidad responsable de mantener el registro oficial de inversionistas y sus unidades."
  },
  seniorDebt: {
    label: "Senior Debt",
    definition: "Tramo de deuda con la mayor prioridad de pago dentro del capital stack."
  },
  preferredEquity: {
    label: "Preferred Equity",
    definition: "Clase de capital con prioridad de pago sobre el common equity pero subordinada a la deuda."
  },
  collateral: {
    label: "Collateral",
    definition: "Activo entregado en garantia de una obligacion, susceptible de ejecucion ante un default."
  },
  tranche: {
    label: "Tranche",
    definition: "Segmento del capital stack con su propio nivel de riesgo, prioridad de pago y retorno."
  },
  maturity: {
    label: "Maturity",
    definition: "Fecha en la que el principal de una obligacion de deuda debe pagarse en su totalidad."
  },
  sanctions: {
    label: "Sanctions Screening",
    definition: "Verificacion de que una contraparte no aparece en listas de sanciones internacionales."
  }
};

export function glossaryList() {
  return Object.entries(GLOSSARY).map(([id, term]) => ({id, ...term}));
}
