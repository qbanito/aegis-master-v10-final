const num=value=>Number.isFinite(Number(value))?Number(value):0;
const round=(value,digits=4)=>Number(num(value).toFixed(digits));
const blankTotals=()=>({closedRealQuotePaper:0,wins:0,losses:0,realizedPnlUsd:0,grossProfitUsd:0,grossLossUsd:0,cumulativePnlUsd:0,peakCumulativePnlUsd:0,maxDrawdownUsd:0,currentLossStreak:0,maxConsecutiveLosses:0});

function metrics(totals={}){
  const row={...blankTotals(),...totals},sample=num(row.closedRealQuotePaper),grossLoss=num(row.grossLossUsd),grossProfit=num(row.grossProfitUsd);
  return {closedRealQuotePaper:sample,wins:num(row.wins),losses:num(row.losses),realizedPnlUsd:round(row.realizedPnlUsd),grossProfitUsd:round(grossProfit),grossLossUsd:round(grossLoss),cumulativePnlUsd:round(row.cumulativePnlUsd),peakCumulativePnlUsd:round(row.peakCumulativePnlUsd),maxDrawdownUsd:round(row.maxDrawdownUsd),currentLossStreak:num(row.currentLossStreak),maxConsecutiveLosses:num(row.maxConsecutiveLosses),winRate:sample?round(num(row.wins)/sample*100,1):0,expectancyUsd:sample?round(num(row.realizedPnlUsd)/sample):0,profitFactor:grossLoss?round(grossProfit/grossLoss,3):grossProfit?null:0};
}

export function ensureValidatedPaperLedger(state){
  state.paperLedger??={};
  const existing=state.paperLedger.validated||{};
  state.paperLedger.version=Math.max(3,num(state.paperLedger.version));
  state.paperLedger.validated={version:1,startingEquityUsd:num(existing.startingEquityUsd||state.paperLedger.startingEquityUsd||10000),...blankTotals(),...existing,strategies:{...(existing.strategies||{})},executionIds:Array.isArray(existing.executionIds)?existing.executionIds:[]};
  return state.paperLedger.validated;
}

function apply(totals,pnl){
  totals.closedRealQuotePaper=num(totals.closedRealQuotePaper)+1;
  totals.realizedPnlUsd=round(num(totals.realizedPnlUsd)+pnl);
  totals.cumulativePnlUsd=round(num(totals.cumulativePnlUsd)+pnl);
  if(pnl>0){totals.wins=num(totals.wins)+1;totals.grossProfitUsd=round(num(totals.grossProfitUsd)+pnl);totals.currentLossStreak=0;}
  else if(pnl<0){totals.losses=num(totals.losses)+1;totals.grossLossUsd=round(num(totals.grossLossUsd)+Math.abs(pnl));totals.currentLossStreak=num(totals.currentLossStreak)+1;totals.maxConsecutiveLosses=Math.max(num(totals.maxConsecutiveLosses),totals.currentLossStreak);}
  totals.peakCumulativePnlUsd=Math.max(num(totals.peakCumulativePnlUsd),num(totals.cumulativePnlUsd));
  totals.maxDrawdownUsd=round(Math.max(num(totals.maxDrawdownUsd),num(totals.peakCumulativePnlUsd)-num(totals.cumulativePnlUsd)));
}

export function recordValidatedPaperExecution(state,execution){
  if(execution?.status!=='CLOSED'||execution?.mode!=='PAPER'||execution?.paperQuality!=='REAL_MARKET_QUOTE'||!execution?.id)return false;
  const ledger=ensureValidatedPaperLedger(state);
  if(ledger.executionIds.includes(execution.id))return false;
  const pnl=round(execution.realizedProfitUsd),strategyId=String(execution.strategyId||'unassigned');
  apply(ledger,pnl);
  ledger.strategies[strategyId]={...blankTotals(),...(ledger.strategies[strategyId]||{})};
  apply(ledger.strategies[strategyId],pnl);
  ledger.executionIds=[...ledger.executionIds,execution.id].slice(-20000);
  ledger.updatedAt=execution.closedAt||execution.createdAt||new Date().toISOString();
  return true;
}

export function syncValidatedPaperLedger(state){
  ensureValidatedPaperLedger(state);
  const rows=(state.executions||[]).filter(row=>row?.status==='CLOSED'&&row?.mode==='PAPER'&&row?.paperQuality==='REAL_MARKET_QUOTE').sort((a,b)=>Date.parse(a.closedAt||a.createdAt||0)-Date.parse(b.closedAt||b.createdAt||0));
  let added=0;for(const row of rows)if(recordValidatedPaperExecution(state,row))added++;
  return added;
}

export function validatedPaperSnapshot(state){
  const ledger=ensureValidatedPaperLedger(state),summary=metrics(ledger),unrealized=num(state.paperLedger?.unrealizedPnlUsd);
  return {version:1,...summary,startingEquityUsd:num(ledger.startingEquityUsd),equityUsd:round(num(ledger.startingEquityUsd)+num(summary.realizedPnlUsd)+unrealized,2),realizedPnlUsd:round(summary.realizedPnlUsd,2),unrealizedPnlUsd:round(unrealized,2),closedRealQuoteTrades:summary.closedRealQuotePaper,persistent:true,updatedAt:ledger.updatedAt||new Date().toISOString()};
}

export function validatedStrategyMetrics(state,strategyId){
  const ledger=ensureValidatedPaperLedger(state);
  return metrics(ledger.strategies?.[strategyId]||blankTotals());
}
