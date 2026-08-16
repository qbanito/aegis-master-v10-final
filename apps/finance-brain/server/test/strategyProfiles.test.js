import test from 'node:test';
import assert from 'node:assert/strict';
import {recordStrategyEvidence,strategyEvidenceSnapshot} from '../src/core/strategyProfiles.js';

const opportunity=(overrides={})=>({id:'op-1',strategyId:'yield',source:'DEFILLAMA_YIELDS_REAL',asset:'USDC',network:'Ethereum',synthetic:false,confidence:.8,riskScore:.2,expectedProfitUsd:4,metadata:{pool:'pool-1'},...overrides});

test('records provider-backed observational PAPER evidence without PnL mutation',()=>{
  const state={infrastructure:{strategyEvidence:[]},executions:[]};
  const evidence=recordStrategyEvidence(state,opportunity(),{simulation:{passed:true},risk:{approved:true}});
  assert.equal(evidence.status,'OBSERVED_PAPER');
  assert.equal(evidence.mutatesPnl,false);
  assert.equal(state.executions.length,0);
  assert.equal(strategyEvidenceSnapshot(state,'yield').observations,1);
  assert.equal(recordStrategyEvidence(state,opportunity()),null);
});

test('rejects synthetic, manual and execution evidence',()=>{
  const state={infrastructure:{strategyEvidence:[]}};
  assert.equal(recordStrategyEvidence(state,opportunity({id:'synthetic',synthetic:true})),null);
  assert.equal(recordStrategyEvidence(state,opportunity({id:'manual',source:'MANUAL_TEST'})),null);
  assert.equal(recordStrategyEvidence(state,opportunity({id:'trade',strategyId:'momentum',source:'BINANCE_REAL'})),null);
  assert.equal(state.infrastructure.strategyEvidence.length,0);
});

test('accepts only the registered source for each observational profile',()=>{
  const state={infrastructure:{strategyEvidence:[]}};
  const cases=[['liquidation','AAVE_V3_BORROWER_DISCOVERY'],['arbitrage','DEX_ROUTER_REAL_QUOTES'],['smart-money','ERC20_TRANSFER_LOGS_REAL'],['yield','DEFILLAMA_YIELDS_REAL']];
  for(const [strategyId,source] of cases)assert.ok(recordStrategyEvidence(state,opportunity({id:`${strategyId}-1`,strategyId,source})));
  assert.equal(state.infrastructure.strategyEvidence.length,4);
});
