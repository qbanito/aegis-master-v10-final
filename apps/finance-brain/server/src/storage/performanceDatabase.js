import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
// The previous database contained model-only PAPER PnL. Keep it intact for
// audit, but start a clean ledger for real-market PAPER executions.
const file=path.resolve(here,'../../data/performance-db-v2.json');
const blank=()=>({version:1,updatedAt:null,strategies:{},recent:[]});
function quoteMetrics(series=[]){
  const pnl=series.map(value=>Number(value)||0);
  const wins=pnl.filter(value=>value>0),losses=pnl.filter(value=>value<0);
  const grossProfit=wins.reduce((sum,value)=>sum+value,0),grossLoss=Math.abs(losses.reduce((sum,value)=>sum+value,0));
  let cumulative=0,peak=0,maxDrawdown=0,lossStreak=0,maxLossStreak=0;
  for(const value of pnl){
    cumulative+=value; peak=Math.max(peak,cumulative); maxDrawdown=Math.max(maxDrawdown,peak-cumulative);
    lossStreak=value<0?lossStreak+1:0; maxLossStreak=Math.max(maxLossStreak,lossStreak);
  }
  return {
    closedRealQuoteTrades:pnl.length,
    winRate:pnl.length?Number((wins.length/pnl.length).toFixed(4)):0,
    avgWinUsd:wins.length?Number((grossProfit/wins.length).toFixed(4)):0,
    avgLossUsd:losses.length?Number((grossLoss/losses.length).toFixed(4)):0,
    expectancyUsd:pnl.length?Number((pnl.reduce((sum,value)=>sum+value,0)/pnl.length).toFixed(4)):0,
    profitFactor:grossLoss?Number((grossProfit/grossLoss).toFixed(4)):grossProfit?null:0,
    maxDrawdownUsd:Number(maxDrawdown.toFixed(4)),
    maxConsecutiveLosses:maxLossStreak,
    pnlSeries:pnl.slice(-500)
  };
}
export class StrategyPerformanceDatabase{
  constructor(){this.data=this.load();}
  load(){try{return {...blank(),...JSON.parse(fs.readFileSync(file,'utf8'))};}catch{return blank();}}
  save(){fs.mkdirSync(path.dirname(file),{recursive:true});this.data.updatedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(this.data,null,2));}
  record({opportunity,simulation,execution}){
    const id=opportunity.strategyId;const s=this.data.strategies[id]||{strategyId:id,samples:0,filled:0,missed:0,totalExpectedProfitUsd:0,totalRealizedProfitUsd:0,totalSimulatedNetUsd:0,avgBrainScore:0,avgConfidence:0,lastExecutionAt:null};
    s.samples++; if(['FILLED','CLOSED'].includes(execution.status))s.filled++;else s.missed++;
    s.totalExpectedProfitUsd=+(s.totalExpectedProfitUsd+Number(execution.expectedProfitUsd||0)).toFixed(2);
    s.totalRealizedProfitUsd=+(s.totalRealizedProfitUsd+Number(execution.realizedProfitUsd||0)).toFixed(2);
    s.totalSimulatedNetUsd=+(s.totalSimulatedNetUsd+Number(simulation?.estimatedNetProfitUsd||0)).toFixed(2);
    s.avgBrainScore=+(((s.avgBrainScore*(s.samples-1))+Number(opportunity.brain?.score||0))/s.samples).toFixed(4);
    s.avgConfidence=+(((s.avgConfidence*(s.samples-1))+Number(opportunity.confidence||0))/s.samples).toFixed(4);
    s.fillRate=+(s.filled/s.samples).toFixed(4);s.realizedVsExpected=s.totalExpectedProfitUsd?+(s.totalRealizedProfitUsd/s.totalExpectedProfitUsd).toFixed(4):0;s.lastExecutionAt=execution.createdAt;
    if(execution.status==='CLOSED'&&execution.paperQuality==='REAL_MARKET_QUOTE'){
      const metrics=quoteMetrics([...(Array.isArray(s.realizedPnlSeries)?s.realizedPnlSeries:[]),Number(execution.realizedProfitUsd||0)]);
      s.realizedPnlSeries=metrics.pnlSeries;
      Object.assign(s,metrics);
      delete s.pnlSeries;
    }
    this.data.strategies[id]=s;
    this.data.recent.unshift({executionId:execution.id,opportunityId:opportunity.id,strategyId:id,status:execution.status,expectedProfitUsd:execution.expectedProfitUsd,simulatedNetProfitUsd:simulation?.estimatedNetProfitUsd||0,realizedProfitUsd:execution.realizedProfitUsd,brainScore:opportunity.brain?.score||0,createdAt:execution.createdAt});
    this.data.recent=this.data.recent.slice(0,500);this.save();return s;
  }
  snapshot(){return{updatedAt:this.data.updatedAt,strategies:Object.values(this.data.strategies).sort((a,b)=>b.totalRealizedProfitUsd-a.totalRealizedProfitUsd),recent:this.data.recent.slice(0,100)};}
}
export const performanceDb=new StrategyPerformanceDatabase();
