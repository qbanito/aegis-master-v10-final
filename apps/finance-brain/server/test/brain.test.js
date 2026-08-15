import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOpportunity,brainDecision} from '../src/core/brain.js';
import {evaluateRisk} from '../src/core/riskEngine.js';

test('high quality liquidation becomes candidate',()=>{
  const o=normalizeOpportunity({strategyId:'liquidation',strategy:'Liquidation Hunter',confidence:.95,executionProbability:.96,expectedProfitUsd:180,estimatedSlippageBps:12,riskScore:.15,synthetic:false});
  assert.equal(brainDecision(o).decision,'CANDIDATE');
});

test('kill switch rejects execution',()=>{
  const o=normalizeOpportunity({strategyId:'liquidation',strategy:'Liquidation Hunter',confidence:.95,executionProbability:.96,expectedProfitUsd:180,estimatedSlippageBps:12,riskScore:.15});
  const state={mode:'PAPER',risk:{globalKillSwitch:true,minConfidence:.7,minExpectedProfitUsd:1,maxSlippageBps:100,maxOpportunityAgeMs:30000},bots:[{id:'liquidation',active:true}]};
  const r=evaluateRisk(o,state);
  assert.equal(r.approved,false); assert.ok(r.reasons.includes('GLOBAL_KILL_SWITCH'));
});
