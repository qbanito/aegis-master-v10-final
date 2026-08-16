import test from 'node:test';
import assert from 'node:assert/strict';
import {StrategyPromotionEngine} from '../src/core/strategyPromotionEngine.js';

const base=()=>({bots:[{id:'solana-radar'}],paperLedger:{openPositions:[]},infrastructure:{solanaRpc:{online:true},yieldData:{online:false}},executions:[]});
const closed=(profit,at='2026-08-16T12:00:00.000Z',id=`trade-${at}-${profit}`)=>({id,strategyId:'solana-radar',status:'CLOSED',mode:'PAPER',paperQuality:'REAL_MARKET_QUOTE',realizedProfitUsd:profit,createdAt:at,closedAt:at});

test('promotion starts Solana Radar in constrained micro-PAPER',()=>{
  const state=base(),engine=new StrategyPromotionEngine({state});
  const result=engine.apply({strategyId:'solana-radar',capitalRequiredUsd:300,expectedProfitUsd:30,confidence:.9,brain:{score:90},metadata:{paperPlan:{notionalUsd:300,expectedProfitUsd:30,maxLossUsd:24}}});
  assert.equal(result.approved,true);assert.equal(result.report.stage,'MICRO_PAPER');assert.equal(result.opportunity.capitalRequiredUsd,25);assert.equal(result.opportunity.metadata.paperPlan.maxLossUsd,2);
});

test('promotion tightens a negative-expectancy strategy after enough real quote closes',()=>{
  const state=base();state.executions=Array.from({length:20},(_,index)=>closed(index%3===0?1:-2,`2026-08-16T${String(index%10).padStart(2,'0')}:00:00.000Z`,`trade-${index}`));
  const report=new StrategyPromotionEngine({state}).evaluate('solana-radar');
  assert.equal(report.stage,'RECOVERY_MICRO_PAPER');assert.equal(report.limits.maxNotionalUsd,10);assert.ok(report.metrics.expectancyUsd<0);
});

test('promotion refuses unverified yield provider evidence',()=>{
  const state=base(),engine=new StrategyPromotionEngine({state});
  const result=engine.apply({strategyId:'yield',capitalRequiredUsd:100,confidence:.99,brain:{score:99},metadata:{}});
  assert.equal(result.approved,false);assert.ok(result.reasons.includes('YIELD_PROVIDER_UNVERIFIED'));
});
