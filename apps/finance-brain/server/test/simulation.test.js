import test from 'node:test';
import assert from 'node:assert/strict';
import {UniversalSimulationEngine} from '../src/core/simulationEngine.js';
test('universal simulator produces deterministic gate fields',()=>{const e=new UniversalSimulationEngine();const x=e.simulate({id:'x',strategyId:'arbitrage',expectedProfitUsd:100,estimatedSlippageBps:20,executionProbability:.9,createdAt:new Date().toISOString()},{routeLatencyMs:40});assert.equal(x.engine,'AEGIS_UNIVERSAL_SIM_V1');assert.ok(x.estimatedNetProfitUsd>0);assert.ok(x.successProbability>0&&x.successProbability<=1);assert.equal(typeof x.passed,'boolean');});
