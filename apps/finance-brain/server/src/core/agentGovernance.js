import {strategyConfigService} from './strategyConfigService.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const iso=()=>new Date().toISOString();

const RISK_LIMITS={
  maxLossPerTradeUsd:[1,250],maxDailyLossUsd:[10,1000],maxDrawdownUsd:[10,1000],
  maxStrategyExposurePct:[1,30],maxAssetExposurePct:[1,20],maxCorrelationExposurePct:[5,60],
  maxSlippageBps:[1,100],minConfidence:[.70,.99],minExpectedProfitUsd:[0,1000],
  maxOpportunityAgeMs:[1000,120000],maxDataAgeMs:[10000,300000]
};

const strategyGroup=id=>{
  if(['volatility','momentum','perpetuals','solana-radar','solana-meme-momentum','polygon-meme-momentum'].includes(id))return 'CRYPTO';
  if(['arbitrage','liquidation','smart-money','yield'].includes(id))return 'DEFI';
  if(['fx-macro-momentum'].includes(id))return 'FX';
  if(['options-defined-risk','crude-oil-regime','nyse-news-impact'].includes(id))return 'TRADFI';
  if(id==='polymarket')return 'PREDICTION';
  return 'OTHER';
};

function providerFor(opportunity,state){
  const network=String(opportunity.network||'').toLowerCase();
  const infra=state.infrastructure||{};
  if(network.includes('binance spot'))return infra.marketData;
  if(network.includes('binance futures'))return infra.futuresMarketData;
  if(network.includes('polymarket')||network==='polygon'&&String(opportunity.asset||'').startsWith('POLY:'))return infra.polymarketData;
  if(network.includes('solana'))return infra.solanaRpc;
  if(network.includes('arbitrum')||network.includes('ethereum')||network.includes('polygon')||network.includes('base')){
    const row=(infra.rpc||[]).find(item=>network.includes(String(item.network||'').toLowerCase()));
    return row||null;
  }
  if(network.includes('forex')||network.includes('fx'))return infra.marketBots?.connectors?.oanda||infra.marketBots?.connectors?.publicTradFi;
  if(network.includes('options')||network.includes('nyse')||network.includes('oil')||network.includes('energy'))return infra.marketBots?.connectors?.alpaca||infra.marketBots?.connectors?.ibkr||infra.marketBots?.connectors?.publicTradFi;
  if(network.includes('defi')||network.includes('yield'))return infra.yieldData;
  return null;
}

function checkedAtOf(provider){return provider?.checkedAt||provider?.lastCheckedAt||provider?.lastProbe||provider?.lastProbeAt||null;}

export class AgentGovernance{
  constructor({state,persist,broadcast}={}){
    this.state=state;this.persist=persist;this.broadcast=broadcast;
    const central=state.infrastructure.centralAgent??{};
    central.governance??={version:1,actions:[],lastDecisionAt:null,lastActionAt:null,killSwitchReason:null};
    this.state.infrastructure.centralAgent=central;
  }
  record(action){
    const governance=this.state.infrastructure.centralAgent.governance;
    governance.lastActionAt=iso();governance.actions=[{...action,at:governance.lastActionAt},...(governance.actions||[])].slice(0,100);
    this.persist?.();this.broadcast?.();return action;
  }
  dailyRisk(){
    const ledger=this.state.paperLedger||{};const today=new Date().toISOString().slice(0,10);
    const dailyRealized=(this.state.executions||[]).filter(item=>item.status==='CLOSED'&&String(item.closedAt||'').slice(0,10)===today).reduce((sum,item)=>sum+num(item.realizedProfitUsd),0);
    const unrealized=num(ledger.unrealizedPnlUsd);const net=dailyRealized+unrealized;
    const equity=num(ledger.equityUsd||this.state.treasury?.paperBalanceUsd);const highWater=Math.max(num(ledger.highWaterMarkUsd||ledger.startingEquityUsd),equity);
    ledger.highWaterMarkUsd=highWater;
    return {dailyRealizedUsd:Number(dailyRealized.toFixed(2)),unrealizedUsd:Number(unrealized.toFixed(2)),netUsd:Number(net.toFixed(2)),lossUsd:Number(Math.max(0,-net).toFixed(2)),equityUsd:Number(equity.toFixed(2)),highWaterMarkUsd:Number(highWater.toFixed(2)),drawdownUsd:Number(Math.max(0,highWater-equity).toFixed(2)),openPositions:(ledger.openPositions||[]).length};
  }
  exposure(){
    const positions=this.state.paperLedger?.openPositions||{};const rows=Array.isArray(positions)?positions:[];const byStrategy={},byAsset={},byGroup={};
    for(const position of rows){const notional=num(position.entryNotional);const strategy=position.strategyId||'unknown';const asset=position.asset||'unknown';const group=strategyGroup(strategy);byStrategy[strategy]=(byStrategy[strategy]||0)+notional;byAsset[asset]=(byAsset[asset]||0)+notional;byGroup[group]=(byGroup[group]||0)+notional;}
    return {byStrategy,byAsset,byGroup,totalUsd:Object.values(byStrategy).reduce((a,b)=>a+b,0)};
  }
  snapshot(){
    const risk=this.state.risk||{};const daily=this.dailyRisk();const exposure=this.exposure();const equity=daily.equityUsd||num(this.state.treasury?.paperBalanceUsd)||10000;
    const breaches=[];if(risk.globalKillSwitch)breaches.push('GLOBAL_KILL_SWITCH');if(daily.lossUsd>=num(risk.maxDailyLossUsd||250))breaches.push('DAILY_LOSS_LIMIT');if(daily.drawdownUsd>=num(risk.maxDrawdownUsd||risk.maxDailyLossUsd||250))breaches.push('DRAWDOWN_LIMIT');
    const governance=this.state.infrastructure.centralAgent.governance;
    return {mode:this.state.mode,paperOnly:this.state.mode==='PAPER',liveAutonomous:false,risk:{...risk},daily,exposure,equityUsd:equity,breaches,healthy:breaches.length===0,killSwitchReason:governance.killSwitchReason||null,lastDecisionAt:governance.lastDecisionAt||null,lastActionAt:governance.lastActionAt||null,recentActions:(governance.actions||[]).slice(0,20)};
  }
  evaluate(opportunity){
    const reasons=[];const risk=this.state.risk||{};const snapshot=this.snapshot();const requested=Math.max(0,num(opportunity?.capitalRequiredUsd));
    if(opportunity?.synthetic!==false)reasons.push('SYNTHETIC_SIGNAL_NOT_ELIGIBLE');
    if(risk.globalKillSwitch)reasons.push('GLOBAL_KILL_SWITCH');
    if(snapshot.daily.lossUsd>=num(risk.maxDailyLossUsd||250))reasons.push('DAILY_LOSS_LIMIT');
    if(snapshot.daily.drawdownUsd>=num(risk.maxDrawdownUsd||risk.maxDailyLossUsd||250))reasons.push('DRAWDOWN_LIMIT');
    const provider=providerFor(opportunity||{},this.state);const checkedAt=checkedAtOf(provider);const age=checkedAt?Date.now()-Date.parse(checkedAt):Infinity;
    if(!provider||provider.online===false)reasons.push('DATA_PROVIDER_OFFLINE');
    else if(!Number.isFinite(age)||age>num(risk.maxDataAgeMs||120000))reasons.push('DATA_PROVIDER_STALE');
    const strategy=opportunity?.strategyId||'unknown';const asset=opportunity?.asset||'unknown';const group=strategyGroup(strategy);const maxExposure=snapshot.equityUsd*num(risk.maxStrategyExposurePct||20)/100;
    if(snapshot.exposure.byStrategy[strategy]+requested>maxExposure+1e-8)reasons.push('STRATEGY_EXPOSURE_LIMIT');
    const maxAsset=snapshot.equityUsd*num(risk.maxAssetExposurePct||10)/100;if(snapshot.exposure.byAsset[asset]+requested>maxAsset+1e-8)reasons.push('ASSET_EXPOSURE_LIMIT');
    const maxGroup=snapshot.equityUsd*num(risk.maxCorrelationExposurePct||45)/100;if(snapshot.exposure.byGroup[group]+requested>maxGroup+1e-8)reasons.push('CORRELATED_EXPOSURE_LIMIT');
    const configuredLoss=opportunity?.metadata?.maxLossUsd??opportunity?.metadata?.stopLossUsd;
    if(configuredLoss!=null&&num(configuredLoss)>num(risk.maxLossPerTradeUsd||50))reasons.push('MAX_LOSS_PER_TRADE');
    const governance=this.state.infrastructure.centralAgent.governance;governance.lastDecisionAt=iso();
    return {approved:reasons.length===0,reasons,evaluatedAt:governance.lastDecisionAt,provider:{online:provider?.online??false,checkedAt:checkedAt||null,ageMs:Number.isFinite(age)?age:null},riskSnapshot:{daily:snapshot.daily,exposure:snapshot.exposure}};
  }
  applyRiskPatch(changes={},actor='CENTRAL_FINANCE_BRAIN'){
    const applied={},rejected=[];for(const [key,range] of Object.entries(RISK_LIMITS)){if(!(key in changes))continue;const value=Number(changes[key]);if(!Number.isFinite(value)){rejected.push({key,reason:'INVALID_NUMBER'});continue;}const next=clamp(value,range[0],range[1]);this.state.risk[key]=next;applied[key]=next;if(next!==value)rejected.push({key,reason:'CLAMPED_TO_HARD_BOUND',value:next});}
    if('globalKillSwitch' in changes){if(Boolean(changes.globalKillSwitch))this.engageKillSwitch(String(changes.reason||'RISK_POLICY_REQUEST'),actor);else rejected.push({key:'globalKillSwitch',reason:'CLEAR_REQUIRES_MANUAL_CONTROL'});}
    const result={ok:true,actor,applied,rejected,snapshot:this.snapshot()};this.record({type:'RISK_POLICY_UPDATE',actor,applied,rejected});return result;
  }
  pauseStrategy(strategyId,reason='CENTRAL_FINANCE_BRAIN'){
    const bot=this.state.bots.find(item=>item.id===strategyId);if(!bot)throw new Error('STRATEGY_NOT_FOUND');bot.active=false;bot.status='PAUSED_BY_GOVERNANCE';
    let config=null;try{config=strategyConfigService.patch(strategyId,{enabled:false,notes:`Paused by Finance Brain: ${reason}`});}catch{}
    const result={ok:true,strategyId,reason,config};this.record({type:'PAUSE_STRATEGY',actor:'CENTRAL_FINANCE_BRAIN',strategyId,reason});return result;
  }
  engageKillSwitch(reason='CENTRAL_FINANCE_BRAIN',actor='CENTRAL_FINANCE_BRAIN'){
    this.state.risk.globalKillSwitch=true;this.state.infrastructure.centralAgent.governance.killSwitchReason=reason;const result={ok:true,globalKillSwitch:true,reason,actor};this.record({type:'GLOBAL_KILL_SWITCH',actor,reason});return result;
  }
}
