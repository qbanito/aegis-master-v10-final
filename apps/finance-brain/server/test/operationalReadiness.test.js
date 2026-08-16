import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalReadiness} from '../src/core/operationalReadiness.js';

const baseInfrastructure=()=>({production:{execution:{paper:true}},centralAgent:{policy:{paperOnly:true}},strategyEvidence:[]});

test('runtime RUNNING is independent from PAPER validation',()=>{
  const state={mode:'PAPER',risk:{globalKillSwitch:false},infrastructure:{...baseInfrastructure(),marketData:{online:true,checkedAt:new Date().toISOString()}},bots:[
    {id:'momentum',name:'Momentum',active:true,status:'SCANNING',heartbeat:new Date().toISOString(),network:'Binance Spot'},
    {id:'solana-radar',name:'Solana Radar',active:true,status:'SCANNING',heartbeat:new Date().toISOString(),network:'Solana'}
  ]};
  const result=operationalReadiness({state,promotionSnapshot:{strategies:[{strategyId:'momentum',dataQuality:{eligible:true,blocker:null},metrics:{closedRealQuotePaper:25,expectancyUsd:1.2,profitFactor:1.4}}]}});
  assert.equal(result.paperOnly,true);
  assert.equal(result.bots[0].runtime.stage,'SCANNING');
  assert.equal(result.bots[0].validation.stage,'PAPER_VALIDATED');
  assert.equal(result.bots[0].stage,'SCANNING');
  assert.equal(result.bots[1].runtime.stage,'BLOCKED');
  assert.ok(result.bots[1].blockers.includes('SOLANA_RPC_UNAVAILABLE'));
});

test('negative real-quote expectancy changes validation, not runtime',()=>{
  const state={mode:'PAPER',risk:{globalKillSwitch:false},infrastructure:{...baseInfrastructure(),solanaRpc:{online:true,checkedAt:new Date().toISOString()}},bots:[{id:'solana-radar',name:'Solana Radar',active:true,status:'SCANNING',heartbeat:new Date().toISOString(),network:'Solana'}]};
  const promotionSnapshot={strategies:[{strategyId:'solana-radar',dataQuality:{eligible:true,blocker:null},metrics:{closedRealQuotePaper:30,expectancyUsd:-1.2,profitFactor:.7}}]};
  const result=operationalReadiness({state,promotionSnapshot});
  assert.equal(result.bots[0].runtime.stage,'SCANNING');
  assert.equal(result.bots[0].validation.stage,'RECOVERY_PAPER');
  assert.equal(result.bots[0].edge.ready,false);
  assert.ok(result.bots[0].warnings.includes('NEGATIVE_OR_WEAK_EXPECTANCY'));
});

test('EVM protocol bot uses provider observations instead of 25 trades',()=>{
  const evidence=Array.from({length:10},(_,index)=>({id:`ev-${index}`,strategyId:'liquidation',providerBacked:true,observedAt:new Date(Date.now()-index*1000).toISOString()}));
  const state={mode:'PAPER',risk:{globalKillSwitch:false},infrastructure:{...baseInfrastructure(),strategyEvidence:evidence,rpc:[{network:'arbitrum',online:true,lastCheckedAt:new Date().toISOString()}]},bots:[{id:'liquidation',name:'Liquidation',active:true,status:'WAITING_BORROWERS',heartbeat:new Date().toISOString(),network:'Aave Arbitrum'}]};
  const result=operationalReadiness({state,promotionSnapshot:{strategies:[{strategyId:'liquidation',dataQuality:{eligible:true,blocker:null},metrics:{closedRealQuotePaper:0}}]}});
  assert.equal(result.bots[0].provider.ready,true);
  assert.equal(result.bots[0].runtime.stage,'SCANNING');
  assert.ok(result.bots[0].warnings.includes('WAITING_FOR_BORROWER_EVIDENCE'));
  assert.equal(result.bots[0].validation.mode,'ONCHAIN_PROTOCOL_OBSERVATIONS');
  assert.equal(result.bots[0].validation.stage,'PAPER_VALIDATED');
  assert.equal(result.bots[0].evidence.closedRealQuotePaper,0);
});

test('allocator is excluded from PAPER trade quota',()=>{
  const state={mode:'PAPER',risk:{globalKillSwitch:false},infrastructure:baseInfrastructure(),bots:[{id:'allocator',name:'Allocator',active:true,status:'ALLOCATING',heartbeat:new Date().toISOString(),network:'Internal'}]};
  const result=operationalReadiness({state,promotionSnapshot:{strategies:[]}});
  assert.equal(result.bots[0].runtime.stage,'RUNNING');
  assert.equal(result.bots[0].validation.required,false);
  assert.equal(result.bots[0].validation.stage,'NOT_REQUIRED');
  assert.equal(result.summary.validationRequired,0);
});

test('smart money validates from verified chain signals',()=>{
  const evidence=Array.from({length:10},(_,index)=>({id:`signal-${index}`,strategyId:'smart-money',providerBacked:true,observedAt:new Date(Date.now()-index*1000).toISOString()}));
  const state={mode:'PAPER',risk:{globalKillSwitch:false},infrastructure:{...baseInfrastructure(),strategyEvidence:evidence,rpc:[{network:'ethereum',online:true,lastCheckedAt:new Date().toISOString()}]},bots:[{id:'smart-money',name:'Smart Money',active:true,status:'SCANNING_REAL',heartbeat:new Date().toISOString(),network:'Ethereum'}]};
  const result=operationalReadiness({state,promotionSnapshot:{strategies:[]}});
  assert.equal(result.bots[0].validation.mode,'VERIFIED_CHAIN_SIGNALS');
  assert.equal(result.bots[0].validation.stage,'PAPER_VALIDATED');
});
