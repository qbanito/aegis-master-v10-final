import {syncValidatedPaperLedger,validatedStrategyMetrics} from './validatedPaperLedger.js';

const num=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=(value,digits=2)=>Number(num(value).toFixed(digits));

// Promotion is deliberately PAPER-only. A strategy earns a larger PAPER
// envelope only with closed executions backed by a real market quote.
const DEFAULT_POLICY={
  minConfidence:.78,minBrainScore:72,maxNotionalUsd:50,maxOpenPositions:1,maxEntriesPerHour:2,
  validationSamples:25,provenSamples:100,provenProfitFactor:1.15
};
const STRATEGY_POLICY={
  'solana-radar':{minConfidence:.84,minBrainScore:80,maxNotionalUsd:25,maxOpenPositions:1,maxEntriesPerHour:2},
  'solana-meme-momentum':{minConfidence:.82,minBrainScore:78,maxNotionalUsd:25,maxOpenPositions:1,maxEntriesPerHour:2},
  'polygon-meme-momentum':{minConfidence:.82,minBrainScore:78,maxNotionalUsd:25,maxOpenPositions:1,maxEntriesPerHour:2},
  yield:{maxNotionalUsd:0}
};

function policyFor(strategyId){return {...DEFAULT_POLICY,...(STRATEGY_POLICY[strategyId]||{})};}
function qualityBlock(strategyId,state){
  if(strategyId==='yield'&&state.infrastructure?.yieldData?.online!==true)return 'YIELD_PROVIDER_UNVERIFIED';
  return null;
}

export class StrategyPromotionEngine{
  constructor({state}={}){this.state=state;}
  executions(strategyId){return (this.state?.executions||[]).filter(row=>row.strategyId===strategyId);}
  evaluate(strategyId){
    syncValidatedPaperLedger(this.state);
    const policy=policyFor(strategyId);
    const all=this.executions(strategyId);
    const durable=validatedStrategyMetrics(this.state,strategyId);
    const sample=num(durable.closedRealQuotePaper),realized=num(durable.realizedPnlUsd),expectancy=num(durable.expectancyUsd),profitFactor=durable.profitFactor==null&&num(durable.grossProfitUsd)>0?Infinity:num(durable.profitFactor);
    const open=(this.state?.paperLedger?.openPositions||[]).filter(row=>row.strategyId===strategyId).length;
    const since=Date.now()-3600000;
    const recentEntries=all.filter(row=>Date.parse(row.createdAt||'')>=since&&['OPEN','CLOSED','FILLED'].includes(row.status)).length;
    const dataQualityBlock=qualityBlock(strategyId,this.state);
    let stage='MICRO_PAPER',limits={...policy};
    if(dataQualityBlock){stage='DATA_QUALITY_HOLD';limits={...limits,maxNotionalUsd:0};}
    else if(sample>=20&&expectancy<=0){stage='RECOVERY_MICRO_PAPER';limits={...limits,maxNotionalUsd:10,minConfidence:Math.max(policy.minConfidence,.88),minBrainScore:Math.max(policy.minBrainScore,85),maxEntriesPerHour:1};}
    else if(sample>=policy.provenSamples&&realized>0&&profitFactor>=policy.provenProfitFactor){stage='PAPER_PROVEN';limits={...limits,maxNotionalUsd:Math.max(policy.maxNotionalUsd,100),maxOpenPositions:2};}
    else if(sample>=policy.validationSamples&&expectancy>0&&profitFactor>1){stage='PAPER_VALIDATION';limits={...limits,maxNotionalUsd:Math.max(policy.maxNotionalUsd,50)};}
    const nextGate=stage==='PAPER_PROVEN'?'Manual review only — LIVE remains locked':stage==='PAPER_VALIDATION'?`Need ${policy.provenSamples-sample} more closed real-quote PAPER trades with profit factor ≥ ${policy.provenProfitFactor}`:stage==='RECOVERY_MICRO_PAPER'?`Recovery gate: restore positive expectancy and profit factor ≥ ${policy.provenProfitFactor} with real-quote PAPER fills`:`Need ${Math.max(0,policy.validationSamples-sample)} closed real-quote PAPER trades with positive expectancy`;
    return {
      strategyId,stage,paperOnly:true,liveAutonomous:false,dataQuality:{eligible:!dataQualityBlock,blocker:dataQualityBlock},
      metrics:{closedRealQuotePaper:sample,wins:num(durable.wins),losses:num(durable.losses),winRate:num(durable.winRate),realizedPnlUsd:round(realized),expectancyUsd:round(expectancy,4),grossProfitUsd:round(durable.grossProfitUsd),grossLossUsd:round(durable.grossLossUsd),profitFactor:Number.isFinite(profitFactor)?round(profitFactor,3):null,maxDrawdownUsd:round(durable.maxDrawdownUsd),maxConsecutiveLosses:num(durable.maxConsecutiveLosses),openPositions:open,recentEntries},
      limits:{maxNotionalUsd:limits.maxNotionalUsd,maxOpenPositions:limits.maxOpenPositions,maxEntriesPerHour:limits.maxEntriesPerHour,minConfidence:limits.minConfidence,minBrainScore:limits.minBrainScore},nextGate,evaluatedAt:new Date().toISOString()
    };
  }
  apply(opportunity){
    const report=this.evaluate(opportunity.strategyId),reasons=[];
    const {limits,metrics}=report;
    if(!report.dataQuality.eligible)reasons.push(report.dataQuality.blocker);
    if(num(opportunity.confidence)<limits.minConfidence)reasons.push('PROMOTION_MIN_CONFIDENCE');
    if(num(opportunity.brain?.score)<limits.minBrainScore)reasons.push('PROMOTION_BRAIN_SCORE');
    if(metrics.openPositions>=limits.maxOpenPositions)reasons.push('PROMOTION_OPEN_POSITION_LIMIT');
    if(metrics.recentEntries>=limits.maxEntriesPerHour)reasons.push('PROMOTION_RATE_LIMIT');
    if(limits.maxNotionalUsd<=0)reasons.push('PROMOTION_NO_CAPITAL');
    const requested=Math.max(0,num(opportunity.capitalRequiredUsd));
    const allowed=Math.min(requested,limits.maxNotionalUsd);
    const scale=requested>0?allowed/requested:1;
    const metadata={...(opportunity.metadata||{})};
    const sourceMaxLoss=num(metadata.maxLossUsd??metadata.paperPlan?.maxLossUsd??allowed*.1);
    const scaledMaxLoss=round(Math.min(sourceMaxLoss*scale,allowed*.1));
    if(metadata.paperPlan){
      metadata.paperPlan={...metadata.paperPlan,notionalUsd:round(Math.min(num(metadata.paperPlan.notionalUsd||requested),allowed)),expectedProfitUsd:round(num(metadata.paperPlan.expectedProfitUsd)*scale),maxLossUsd:scaledMaxLoss};
    }
    metadata.maxLossUsd=scaledMaxLoss;
    metadata.promotion={stage:report.stage,requestedNotionalUsd:requested,allowedNotionalUsd:allowed,clamped:allowed<requested,reasons};
    const next={...opportunity,capitalRequiredUsd:round(allowed),expectedProfitUsd:round(num(opportunity.expectedProfitUsd)*scale),metadata};
    return {approved:reasons.length===0,hardBlocked:reasons.length>0,reasons,report,opportunity:next};
  }
  snapshot(){
    const ids=new Set([...(this.state?.bots||[]).map(bot=>bot.id),...(this.state?.executions||[]).map(row=>row.strategyId).filter(Boolean)]);
    return {version:1,paperOnly:true,liveAutonomous:false,updatedAt:new Date().toISOString(),strategies:[...ids].map(id=>this.evaluate(id)).sort((a,b)=>a.strategyId.localeCompare(b.strategyId))};
  }
}
