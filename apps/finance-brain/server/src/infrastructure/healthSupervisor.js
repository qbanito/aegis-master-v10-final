export class HealthSupervisor{
  constructor({state,onRecover,staleMs=90000,intervalMs=15000}={}){this.state=state;this.onRecover=onRecover;this.staleMs=staleMs;this.intervalMs=intervalMs;this.timer=null;this.recoveries=0;this.lastCheckAt=null;}
  check(){
    const now=Date.now();this.lastCheckAt=new Date(now).toISOString();
    const stale=[];
    for(const bot of this.state.bots){if(!bot.active)continue;const marketBot=bot.marketBotId?this.state.infrastructure.marketBots?.bots?.[bot.marketBotId]:null;const heartbeat=bot.heartbeat||marketBot?.lastScanAt;const allowedStale=bot.marketBotId?Math.max(this.staleMs,Number(process.env.MARKET_BOTS_SCAN_MS||120000)*3):this.staleMs;const age=heartbeat?now-Date.parse(heartbeat):Infinity;if(age>allowedStale){stale.push({id:bot.id,ageMs:Number.isFinite(age)?age:null,allowedStaleMs:allowedStale});bot.status='STALE';}}
    if(stale.length&&this.onRecover){for(const s of stale){try{this.onRecover(s.id);this.recoveries++;}catch{}}}
    return {lastCheckAt:this.lastCheckAt,stale,recoveries:this.recoveries,status:stale.length?'DEGRADED':'HEALTHY'};
  }
  start(){if(this.timer)return;this.timer=setInterval(()=>this.check(),this.intervalMs);this.timer.unref?.();}
}
