function clamp(n,min=0,max=1){return Math.max(min,Math.min(max,n));}
const nowIso=()=>new Date().toISOString();

export function classifyHealthFactor(hf){
  if(!Number.isFinite(hf)) return 'UNKNOWN';
  if(hf<1) return 'LIQUIDATABLE';
  if(hf<1.015) return 'CRITICAL';
  if(hf<1.035) return 'NEAR';
  if(hf<1.08) return 'WATCH';
  return 'SAFE';
}

export class LiquidationStrategyLab{
  constructor(){
    this.rows=new Map();
    this.maxCandidates=Math.max(50,Number(process.env.LIQ_LAB_MAX_CANDIDATES||1000));
    this.closeFactorPct=clamp(Number(process.env.LIQ_LAB_CLOSE_FACTOR_PCT||0.5),0.01,1);
    this.liquidationBonusBps=Math.max(0,Number(process.env.LIQ_LAB_BONUS_BPS||500));
    this.protocolFeeBps=Math.max(0,Number(process.env.LIQ_LAB_PROTOCOL_FEE_BPS||0));
    this.gasUsd=Math.max(0,Number(process.env.LIQ_LAB_GAS_USD||3));
    this.swapCostBps=Math.max(0,Number(process.env.LIQ_LAB_SWAP_COST_BPS||25));
  }
  ingest(scan){
    if(!scan?.address||!Number.isFinite(Number(scan.healthFactor))) return null;
    const healthFactor=Number(scan.healthFactor),debt=Math.max(0,Number(scan.totalDebtUsd||0));
    const band=classifyHealthFactor(healthFactor);
    const repayableUsd=debt*this.closeFactorPct;
    const grossBonusUsd=repayableUsd*(this.liquidationBonusBps/10000);
    const protocolFeeUsd=grossBonusUsd*(this.protocolFeeBps/10000);
    const swapCostUsd=repayableUsd*(this.swapCostBps/10000);
    const estNetUsd=Math.max(0,grossBonusUsd-protocolFeeUsd-swapCostUsd-this.gasUsd);
    const proximity=clamp((1.08-healthFactor)/0.08);
    const urgency=band==='LIQUIDATABLE'?1:band==='CRITICAL'?.92:band==='NEAR'?.78:band==='WATCH'?.58:.1;
    const economicScore=clamp(Math.log10(1+estNetUsd)/4);
    const score=Number((urgency*.62+economicScore*.28+proximity*.10).toFixed(4));
    const row={...scan,band,repayableUsd:Number(repayableUsd.toFixed(2)),grossBonusUsd:Number(grossBonusUsd.toFixed(2)),gasUsd:this.gasUsd,swapCostUsd:Number(swapCostUsd.toFixed(2)),estimatedNetUsd:Number(estNetUsd.toFixed(2)),priorityScore:score,updatedAt:nowIso()};
    this.rows.set(scan.address.toLowerCase(),row);
    if(this.rows.size>this.maxCandidates){const sorted=[...this.rows.values()].sort((a,b)=>b.priorityScore-a.priorityScore).slice(0,this.maxCandidates);this.rows=new Map(sorted.map(x=>[x.address.toLowerCase(),x]));}
    return row;
  }
  leaderboard(limit=50){return [...this.rows.values()].sort((a,b)=>b.priorityScore-a.priorityScore||a.healthFactor-b.healthFactor).slice(0,limit);}
  stats(){const rows=[...this.rows.values()];const bands={};for(const r of rows)bands[r.band]=(bands[r.band]||0)+1;return{candidates:rows.length,bands,top:this.leaderboard(20),updatedAt:nowIso(),model:{closeFactorPct:this.closeFactorPct,liquidationBonusBps:this.liquidationBonusBps,gasUsd:this.gasUsd,swapCostBps:this.swapCostBps}};}
  recommendedIntervalMs(){const top=this.leaderboard(20);if(top.some(x=>x.band==='LIQUIDATABLE'))return 2500;if(top.some(x=>x.band==='CRITICAL'))return 4000;if(top.some(x=>x.band==='NEAR'))return 7000;return Math.max(10000,Number(process.env.LIQUIDATION_SCAN_MS||12000));}
}
