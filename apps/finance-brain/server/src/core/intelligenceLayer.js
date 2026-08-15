function dirOf(s){const d=String(s?.direction||'').toUpperCase();if(d.includes('LONG')||d==='BUY'||d==='BULLISH'||d==='UP')return 'LONG';if(d.includes('SHORT')||d==='SELL'||d==='BEARISH'||d==='DOWN')return 'SHORT';if(d.includes('AVOID')||d.includes('RISK'))return 'AVOID';return 'NEUTRAL';}
const comboKey=s=>[...s].sort().join('+');
export class IntelligenceLayer{
  constructor(){this.comboStats=new Map();this.recent=[];}
  evaluate(fusion){
    const votes={LONG:0,SHORT:0,AVOID:0,NEUTRAL:0};for(const s of fusion.signals||[])votes[dirOf(s)]++;
    const directional=votes.LONG+votes.SHORT+votes.AVOID;let conviction='NEUTRAL';if(directional){const ranked=['LONG','SHORT','AVOID'].sort((a,b)=>votes[b]-votes[a]);conviction=ranked[0];if(votes[ranked[0]]===votes[ranked[1]])conviction='CONFLICT';}
    const conflict=votes.LONG>0&&votes.SHORT>0;const agreement=directional?Math.max(votes.LONG,votes.SHORT,votes.AVOID)/directional:0;
    const key=comboKey(fusion.strategies||[]),hist=this.comboStats.get(key)||{samples:0,wins:0,pnl:0};
    const historicalWinRate=hist.samples?hist.wins/hist.samples:null;
    let confidence=Number(fusion.confidence||0);confidence+=agreement*.06;if(conflict)confidence-=.12;if(historicalWinRate!=null)confidence+=(historicalWinRate-.5)*.1;confidence=Math.max(.05,Math.min(.99,confidence));
    const result={id:crypto.randomUUID(),fusionId:fusion.id,assetRoot:fusion.assetRoot,conviction,conflict,agreement:Number(agreement.toFixed(3)),votes,confidence:Number(confidence.toFixed(3)),fusionScore:fusion.fusionScore,strategies:fusion.strategies,comboKey:key,historical:{samples:hist.samples,winRate:historicalWinRate==null?null:Number(historicalWinRate.toFixed(3)),pnl:Number(hist.pnl.toFixed(2))},createdAt:new Date().toISOString()};
    this.recent.unshift(result);this.recent=this.recent.slice(0,100);return result;
  }
  recordOutcome({strategies=[],realizedProfitUsd=0}={}){const key=comboKey(strategies);if(!key)return;const x=this.comboStats.get(key)||{samples:0,wins:0,pnl:0};x.samples++;if(Number(realizedProfitUsd)>0)x.wins++;x.pnl+=Number(realizedProfitUsd||0);this.comboStats.set(key,x);}
  leaderboard(){return [...this.comboStats.entries()].map(([comboKey,v])=>({comboKey,...v,winRate:v.samples?v.wins/v.samples:0})).sort((a,b)=>b.winRate-a.winRate||b.pnl-a.pnl).slice(0,20);}
}
