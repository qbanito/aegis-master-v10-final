import {strategyConfigService} from './strategyConfigService.js';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function computeAllocations(state){
  const tradable=state.bots.filter(b=>b.id!=='allocator'&&b.active!==false&& !['PAUSED','PAUSED_BY_GOVERNANCE','ERROR','OFFLINE','STALE'].includes(String(b.status||'').toUpperCase()));
  const recentExec=state.executions.slice(0,200);
  const recentOpps=state.opportunities.slice(0,300);
  const rows=tradable.map(bot=>{
    const ex=recentExec.filter(x=>x.strategyId===bot.id); const fills=ex.filter(x=>x.status==='FILLED');
    const pnl=fills.reduce((a,x)=>a+Number(x.realizedProfitUsd||0),0); const hit=ex.length?fills.length/ex.length:.5;
    const opps=recentOpps.filter(x=>x.strategyId===bot.id); const avgScore=opps.length?opps.reduce((a,x)=>a+Number(x.brain?.score||0),0)/opps.length:55;
    const sample=Math.min(1,ex.length/12); const performance=clamp(.45+(Math.tanh(pnl/250)*.2)+(hit-.5)*.25+((avgScore-55)/100)*.1,0.1,0.95);
    const confidence=.5+sample*.5; const weight=(performance*confidence)+(.5*(1-confidence));
    return {strategyId:bot.id,pnl:Number(pnl.toFixed(2)),hitRate:Number(hit.toFixed(3)),avgBrainScore:Number(avgScore.toFixed(1)),samples:ex.length,rawWeight:weight};
  });
  const reservePct=clamp(Number(state.allocator?.reservePct??10),5,40); const available=100-reservePct; const sum=rows.reduce((a,r)=>a+r.rawWeight,0)||1;
  const maxPct=clamp(Number(state.risk.maxStrategyExposurePct||20),5,50);
  let alloc=rows.map(r=>{const configuredMax=strategyConfigService.get()[r.strategyId]?.maxAllocationPct;const botMax=configuredMax==null?maxPct:clamp(Number(configuredMax),0,maxPct);return {...r,maxAllocationPct:botMax,allocationPct:Math.min(botMax,(r.rawWeight/sum)*available)};});
  let assigned=alloc.reduce((a,r)=>a+r.allocationPct,0); let remainder=available-assigned;
  for(let pass=0;pass<8&&remainder>.01;pass++){
    const open=alloc.filter(r=>r.allocationPct<r.maxAllocationPct-.01); if(!open.length)break; const add=remainder/open.length;
    for(const r of open){const room=r.maxAllocationPct-r.allocationPct,delta=Math.min(room,add);r.allocationPct+=delta;remainder-=delta;}
  }
  alloc=alloc.map(r=>({...r,allocationPct:Number(r.allocationPct.toFixed(2))}));
  return {computedAt:new Date().toISOString(),reservePct,availablePct:available,strategies:alloc};
}

export function applyAllocations(state){
  const result=computeAllocations(state); const treasury=Number(state.treasury.paperBalanceUsd||0);
  const activeIds=new Set(result.strategies.map(row=>row.strategyId));
  for(const bot of state.bots){if(bot.id!=='allocator'&&!activeIds.has(bot.id)){bot.allocationPct=0;const wallet=state.wallets.find(w=>w.strategyId===bot.id);if(wallet)wallet.balanceUsd=0;}}
  for(const row of result.strategies){
    const bot=state.bots.find(b=>b.id===row.strategyId); if(bot)bot.allocationPct=row.allocationPct;
    const wallet=state.wallets.find(w=>w.strategyId===row.strategyId); if(wallet)wallet.balanceUsd=Number((treasury*row.allocationPct/100).toFixed(2));
  }
  const allocator=state.bots.find(b=>b.id==='allocator'); if(allocator){allocator.allocationPct=0;allocator.status='ALLOCATING';allocator.heartbeat=new Date().toISOString();}
  const aw=state.wallets.find(w=>w.strategyId==='allocator'); if(aw)aw.balanceUsd=0;
  state.treasury.reservedUsd=Number((treasury*result.reservePct/100).toFixed(2));
  state.allocator={...(state.allocator||{}),...result,lastRunAt:result.computedAt};
  return result;
}
