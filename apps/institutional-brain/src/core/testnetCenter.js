import crypto from "node:crypto";
import {adapterDefinition} from "./config.js";

// Testnet Deployment Center — Simulation / Testnet / Production are kept strictly separate.
// Production Mode is permanently locked in this build. "Testnet" deployment here produces a
// deterministic, clearly-labeled SIMULATED record — no compiler/toolchain runs and no real
// chain transaction is ever sent. Never uses real funds.
export function testnetState(deal) {
  return {
    mode: deal.testnet?.mode || "SIMULATION",
    productionLocked: true,
    deployments: deal.testnet?.deployments || []
  };
}

export function deploySimulated(deal, adapterId) {
  const adapter = adapterDefinition(adapterId);
  if (!adapter) throw new Error(`UNKNOWN_ADAPTER:${adapterId}`);
  if (!deal.simulationRun) throw new Error("SIMULATION_REQUIRED_BEFORE_TESTNET");

  const contractAddress = `0xSIM${crypto.randomBytes(16).toString("hex")}`.slice(0, 42);
  const txHash = `0xSIMTX${crypto.randomBytes(16).toString("hex")}`;
  const record = {
    id: `deploy_${crypto.randomUUID()}`,
    adapterId,
    network: adapter.network,
    language: adapter.language,
    contractAddress,
    txHash,
    contractVersion: deal.version,
    deployedAt: new Date().toISOString(),
    dataMode: "SIMULATED — no real chain call, no real funds"
  };
  deal.testnet = deal.testnet || {mode: "SIMULATION", deployments: []};
  deal.testnet.mode = "TESTNET";
  deal.testnet.deployments.unshift(record);
  return record;
}
