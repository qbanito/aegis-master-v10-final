import test from 'node:test';
import assert from 'node:assert/strict';
import {syncValidatedPaperLedger,validatedPaperSnapshot,validatedStrategyMetrics} from '../src/core/validatedPaperLedger.js';

const trade=(id,pnl)=>({id:`trade-${id}`,strategyId:'momentum',status:'CLOSED',mode:'PAPER',paperQuality:'REAL_MARKET_QUOTE',realizedProfitUsd:pnl,closedAt:new Date(1700000000000+id*1000).toISOString()});

test('validated PAPER metrics remain durable when recent executions are truncated',()=>{
  const state={paperLedger:{startingEquityUsd:10000,unrealizedPnlUsd:0},executions:Array.from({length:300},(_,index)=>trade(index,index%2?2:-1))};
  assert.equal(syncValidatedPaperLedger(state),300);
  state.executions=state.executions.slice(0,250);
  assert.equal(syncValidatedPaperLedger(state),0);
  const strategy=validatedStrategyMetrics(state,'momentum'),snapshot=validatedPaperSnapshot(state);
  assert.equal(strategy.closedRealQuotePaper,300);
  assert.equal(strategy.realizedPnlUsd,150);
  assert.equal(strategy.profitFactor,2);
  assert.equal(snapshot.equityUsd,10150);
  assert.equal(snapshot.persistent,true);
});
