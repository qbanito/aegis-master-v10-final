export class StrategyCircuitBreaker {
  constructor({maxConsecutiveLosses=3,maxDrawdownUsd=250,cooldownMs=15*60*1000}={}){
    this.maxConsecutiveLosses=maxConsecutiveLosses;
    this.maxDrawdownUsd=maxDrawdownUsd;
    this.cooldownMs=cooldownMs;
    this.state=new Map();
  }
  _row(id){if(!this.state.has(id))this.state.set(id,{strategyId:id,lossStreak:0,drawdownUsd:0,tripped:false,trippedAt:null,reason:null});return this.state.get(id);}
  canRun(id,now=Date.now()){
    const r=this._row(id);
    if(!r.tripped)return {allowed:true,...r};
    if(r.trippedAt && now-r.trippedAt>=this.cooldownMs){Object.assign(r,{lossStreak:0,drawdownUsd:0,tripped:false,trippedAt:null,reason:null});return {allowed:true,recovered:true,...r};}
    return {allowed:false,...r};
  }
  record(id,pnlUsd=0){
    const r=this._row(id);
    if(pnlUsd<0){r.lossStreak+=1;r.drawdownUsd+=Math.abs(pnlUsd);}else if(pnlUsd>0){r.lossStreak=0;r.drawdownUsd=Math.max(0,r.drawdownUsd-pnlUsd);}
    if(r.lossStreak>=this.maxConsecutiveLosses){r.tripped=true;r.trippedAt=Date.now();r.reason='CONSECUTIVE_LOSSES';}
    if(r.drawdownUsd>=this.maxDrawdownUsd){r.tripped=true;r.trippedAt=Date.now();r.reason='DRAWDOWN_LIMIT';}
    return {...r};
  }
  reset(id){const r=this._row(id);Object.assign(r,{lossStreak:0,drawdownUsd:0,tripped:false,trippedAt:null,reason:null});return {...r};}
  snapshot(){return [...this.state.values()].map(x=>({...x}));}
}
