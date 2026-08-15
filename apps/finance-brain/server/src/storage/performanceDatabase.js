import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
// The previous database contained model-only PAPER PnL. Keep it intact for
// audit, but start a clean ledger for real-market PAPER executions.
const file=path.resolve(here,'../../data/performance-db-v2.json');
const blank=()=>({version:1,updatedAt:null,strategies:{},recent:[]});
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
    this.data.strategies[id]=s;
    this.data.recent.unshift({executionId:execution.id,opportunityId:opportunity.id,strategyId:id,status:execution.status,expectedProfitUsd:execution.expectedProfitUsd,simulatedNetProfitUsd:simulation?.estimatedNetProfitUsd||0,realizedProfitUsd:execution.realizedProfitUsd,brainScore:opportunity.brain?.score||0,createdAt:execution.createdAt});
    this.data.recent=this.data.recent.slice(0,500);this.save();return s;
  }
  snapshot(){return{updatedAt:this.data.updatedAt,strategies:Object.values(this.data.strategies).sort((a,b)=>b.totalRealizedProfitUsd-a.totalRealizedProfitUsd),recent:this.data.recent.slice(0,100)};}
}
export const performanceDb=new StrategyPerformanceDatabase();
