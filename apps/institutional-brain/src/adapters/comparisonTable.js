// The "financial requirement -> per-adapter implementation" table shown in the UI so the same
// three technologies can be explained without turning the user into a language professor.
export function buildComparisonTable(spec) {
  return [
    {
      requirement: "Ownership",
      evm: `ERC-style ${spec.vehicle} ownership contract`,
      stellar: "Stellar Asset / Soroban ownership contract",
      canton: "Daml ownership template"
    },
    {
      requirement: "Permissions",
      evm: "Solidity role-based access control",
      stellar: "Soroban auth (require_auth)",
      canton: "Daml parties / choices"
    },
    {
      requirement: "Investor privacy",
      evm: "Requires additional architecture (off-chain / L2 privacy layer)",
      stellar: "Application-level design choice",
      canton: "Protocol-native sub-transaction privacy"
    },
    {
      requirement: "Transfers",
      evm: "Contract-enforced transfer rules",
      stellar: "Asset controls + Soroban contract rules",
      canton: "Rights / workflow-based transfer choices"
    },
    {
      requirement: "Distribution",
      evm: `Solidity distribution contract (${spec.distribution.frequency})`,
      stellar: `Soroban distribution contract (${spec.distribution.frequency})`,
      canton: `Daml distribution workflow (${spec.distribution.frequency})`
    },
    {
      requirement: "Settlement",
      evm: "EVM transaction finality",
      stellar: "Stellar ledger settlement",
      canton: "Canton multi-party transaction"
    }
  ];
}
