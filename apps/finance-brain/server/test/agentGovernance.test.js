import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentGovernance} from '../src/core/agentGovernance.js';

function state(){
  return {mode:'PAPER',risk:{maxLossPerTradeUsd:50,maxDailyLossUsd:250,maxDrawdownUsd:250,maxStrategyExposurePct:20,maxAssetExposurePct:10,maxCorrelationExposurePct:45,maxSlippageBps:75,minConfidence:.72,minExpectedProfitUsd:5,maxOpportunityAgeMs:30000,maxDataAgeMs:120000,globalKillSwitch:false},treasury:{paperBalanceUsd:10000},paperLedger:{startingEquityUsd:10000,equityUsd:10000,cashUsd:10000,reserveFloorUsd:1000,openPositions:[],unrealizedPnlUsd:0},executions:[],bots:[{id:'momentum',active:true,status:'SCANNING_REAL'}],infrastructure:{marketData:{online:true,checkedAt:new Date().toISOString()},centralAgent:{governance:{actions:[]}}}};
}

test('governance vetoes synthetic signals and preserves paper-only mode',()=>{
  const s=state();const governance=new AgentGovernance({state:s});
  const result=governance.evaluate({strategyId:'momentum',network:'Binance Spot',asset:'BTCUSDT',synthetic:true,capitalRequiredUsd:100});
  assert.equal(result.approved,false);assert.ok(result.reasons.includes('SYNTHETIC_SIGNAL_NOT_ELIGIBLE'));assert.equal(governance.snapshot().liveAutonomous,false);
});

test('governance clamps agent risk changes and cannot clear kill switch',()=>{
  const s=state();const governance=new AgentGovernance({state:s});
  const applied=governance.applyRiskPatch({maxDailyLossUsd:999999,minConfidence:.1},'TEST_AGENT');
  assert.equal(s.risk.maxDailyLossUsd,1000);assert.equal(s.risk.minConfidence,.7);assert.ok(applied.rejected.length>=2);
  governance.engageKillSwitch('TEST');const clear=governance.applyRiskPatch({globalKillSwitch:false},'TEST_AGENT');assert.equal(s.risk.globalKillSwitch,true);assert.ok(clear.rejected.some(item=>item.key==='globalKillSwitch'));
});

test('governance applies exposure and provider freshness gates',()=>{
  const s=state();s.paperLedger.openPositions=[{strategyId:'momentum',asset:'BTCUSDT',entryNotional:1900}];const governance=new AgentGovernance({state:s});
  const result=governance.evaluate({strategyId:'momentum',network:'Binance Spot',asset:'BTCUSDT',synthetic:false,capitalRequiredUsd:200});
  assert.equal(result.approved,false);assert.ok(result.reasons.includes('STRATEGY_EXPOSURE_LIMIT'));assert.ok(result.reasons.includes('ASSET_EXPOSURE_LIMIT'));
  s.infrastructure.marketData.checkedAt=new Date(Date.now()-200000).toISOString();const stale=governance.evaluate({strategyId:'momentum',network:'Binance Spot',asset:'ETHUSDT',synthetic:false,capitalRequiredUsd:10});assert.ok(stale.reasons.includes('DATA_PROVIDER_STALE'));
});

