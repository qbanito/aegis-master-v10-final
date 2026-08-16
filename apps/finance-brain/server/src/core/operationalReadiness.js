import {strategyEvidenceSnapshot,strategyProfile} from './strategyProfiles.js';

const BLOCKED=/^(WAITING_CONFIG|WAITING_RPC|WAITING_POOL_ADDRESS|NOT_CONFIGURED|SCAN_ERROR|ERROR|FAILED|BLOCKED|OFFLINE|STALE)/i;
const MARKET_BOTS=new Set(['solana-meme-momentum','polygon-meme-momentum','fx-macro-momentum','options-defined-risk','crude-oil-regime','nyse-news-impact']);
const now=()=>Date.now();
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const code=value=>String(value).replace(/([a-z])([A-Z])/g,'$1_$2').replace(/[^A-Za-z0-9]+/g,'_').toUpperCase();
const observedAt=value=>Date.parse(value?.checkedAt||value?.lastCheckedAt||value?.lastCheckAt||value?.observedAt||value?.updatedAt||value?.scannedAt||value?.evaluatedAt||value?.lastProbe?.checkedAt||value?.lastProbe?.lastCheckedAt||value?.lastProbe||value?.rpc?.checkedAt||value?.rpc?.lastCheckedAt||'');

function providerFor(state,bot){
  const infra=state?.infrastructure||{},connectors=infra.marketBots?.connectors||{};
  if(bot?.id==='yield')return {key:'yieldData',label:'DefiLlama Yields',value:infra.yieldData,maxAgeMs:900000};
  if(bot?.id==='solana-meme-momentum')return {key:'solanaDiscovery',label:'Solana discovery',value:connectors.solanaDiscovery,maxAgeMs:300000};
  if(bot?.id==='polygon-meme-momentum')return {key:'polygonDiscovery',label:'Polygon discovery',value:connectors.polygonDiscovery,maxAgeMs:300000};
  if(bot?.id==='fx-macro-momentum'){
    if(connectors.oanda?.online)return {key:'oanda',label:'OANDA Practice',value:connectors.oanda,maxAgeMs:300000};
    return {key:'publicFx',label:'Public FX reference',value:connectors.publicFx,maxAgeMs:300000,warning:'INDICATIVE_DATA_ONLY'};
  }
  if(['options-defined-risk','crude-oil-regime','nyse-news-impact'].includes(bot?.id)){
    if(connectors.alpaca?.online)return {key:'alpaca',label:'Alpaca Paper',value:connectors.alpaca,maxAgeMs:300000};
    return {key:'publicTradFi',label:'Public TradFi fallback',value:connectors.publicTradFi,maxAgeMs:300000,warning:'INDICATIVE_DATA_ONLY'};
  }
  const network=String(bot?.network||'').toLowerCase();
  if(network.includes('solana'))return {key:'solanaRpc',label:'Solana RPC',value:infra.solanaRpc,maxAgeMs:180000};
  if(network.includes('binance futures'))return {key:'futuresMarketData',label:infra.futuresMarketData?.provider||'Derivatives market data',value:infra.futuresMarketData,maxAgeMs:180000};
  if(network.includes('binance'))return {key:'marketData',label:infra.marketData?.provider||'Spot market data',value:infra.marketData,maxAgeMs:180000};
  if(network.includes('polygon'))return {key:'polymarketData',label:'Polygon / Polymarket',value:infra.polymarketData,maxAgeMs:240000};
  if(network.includes('aave')||network.includes('ethereum')||network.includes('arbitrum'))return {key:'rpc',label:'EVM RPC',value:infra.rpc,maxAgeMs:180000};
  return {key:'internal',label:'Internal / multi-source',value:{online:true,checkedAt:new Date().toISOString()},maxAgeMs:300000};
}

function providerReady(state,bot){
  const provider=providerFor(state,bot);
  if(provider.key==='rpc'){
    const rows=Array.isArray(provider.value)?provider.value:[],online=rows.filter(row=>row?.online===true),fresh=online.some(row=>{const at=observedAt(row);return Number.isFinite(at)&&now()-at<=provider.maxAgeMs;});
    return {ready:fresh,label:provider.label,warning:provider.warning||null,ageMs:null,blocker:fresh?null:(online.length?'EVM_RPC_STALE':'EVM_RPC_UNAVAILABLE')};
  }
  const online=provider.value?.online===true,at=observedAt(provider.value),hasTimestamp=Number.isFinite(at),ageMs=hasTimestamp?Math.max(0,now()-at):null,fresh=online&&hasTimestamp&&ageMs<=provider.maxAgeMs;
  return {ready:fresh,label:provider.label,warning:provider.warning||null,ageMs,blocker:fresh?null:online?`${code(provider.key)}_STALE`:`${code(provider.key)}_UNAVAILABLE`};
}

const promotionFor=(snapshot,id)=>snapshot?.strategies?.find(row=>row.strategyId===id)||null;
function validationFor(state,bot,promotion){
  const profile=strategyProfile(bot.id);
  if(profile.kind==='ALLOCATOR')return {required:false,ready:true,stage:'NOT_REQUIRED',mode:profile.validationMode,label:profile.label,evidence:0,target:0,nextAction:'Trade validation does not apply to the allocator'};
  if(profile.kind!=='EXECUTION'){
    const snapshot=strategyEvidenceSnapshot(state,bot.id),evidence=snapshot.observations,ready=evidence>=profile.target;
    const stage=ready?'PAPER_VALIDATED':profile.kind==='PROTOCOL'?'VALIDATING_PROTOCOL':profile.kind==='YIELD'?'VALIDATING_PROVIDER':'VALIDATING_SIGNALS';
    return {required:true,ready,stage,mode:profile.validationMode,label:profile.label,evidence,target:profile.target,lastEvidenceAt:snapshot.lastObservedAt,nextAction:ready?'Continue collecting provider-backed evidence':`Need ${Math.max(0,profile.target-evidence)} more ${profile.label.toLowerCase()}`};
  }
  const metrics=promotion?.metrics||{},evidence=finite(metrics.closedRealQuotePaper),target=profile.target,expectancy=finite(metrics.expectancyUsd),profitFactor=finite(metrics.profitFactor),recovery=evidence>=20&&(expectancy<=0||profitFactor<1.15),ready=evidence>=target&&expectancy>0&&profitFactor>=1.15;
  return {required:true,ready,stage:recovery?'RECOVERY_PAPER':ready?'PAPER_VALIDATED':'VALIDATING_TRADES',mode:profile.validationMode,label:profile.label,evidence,target,expectancyUsd:expectancy,profitFactor,minimumProfitFactor:1.15,nextAction:recovery?'Restore positive expectancy and profit factor ≥ 1.15':ready?'Continue shadow validation and drawdown monitoring':`Need ${Math.max(0,target-evidence)} more closed real-quote PAPER trades`};
}

function botReadiness(state,bot,promotionSnapshot){
  const status=String(bot?.status||(bot?.active?'STARTING':'PAUSED')).toUpperCase(),heartbeatAt=Date.parse(bot?.heartbeat||''),heartbeatAgeMs=Number.isFinite(heartbeatAt)?Math.max(0,now()-heartbeatAt):null,marketBot=MARKET_BOTS.has(bot.id)||Boolean(bot.marketBotId),heartbeatMaxAgeMs=marketBot?Math.max(180000,finite(process.env.MARKET_BOTS_SCAN_MS||120000)*3):180000,heartbeatReady=bot?.active===false||(heartbeatAgeMs!=null&&heartbeatAgeMs<=heartbeatMaxAgeMs),provider=providerReady(state,bot),promotion=promotionFor(promotionSnapshot,bot.id),validation=validationFor(state,bot,promotion),blockers=[],warnings=[];
  if(!bot?.active)blockers.push('BOT_PAUSED');
  if(BLOCKED.test(status))blockers.push(status);
  if(bot?.active&&!heartbeatReady)blockers.push(heartbeatAgeMs==null?'HEARTBEAT_MISSING':'HEARTBEAT_STALE');
  if(!provider.ready)blockers.push(provider.blocker);
  if(promotion?.dataQuality?.blocker)blockers.push(promotion.dataQuality.blocker);
  if(provider.warning)warnings.push(provider.warning);
  if(status==='DEGRADED')warnings.push('DEGRADED_SOURCE');
  if(status==='WAITING_BORROWERS')warnings.push('WAITING_FOR_BORROWER_EVIDENCE');
  if(validation.required&&!validation.ready)warnings.push(validation.stage==='RECOVERY_PAPER'?'NEGATIVE_OR_WEAK_EXPECTANCY':`INSUFFICIENT_${validation.mode}`);
  const runtimeStage=!bot?.active?'PAUSED':blockers.length?'BLOCKED':status.includes('START')?'STARTING':status.includes('SCAN')||status==='WAITING_BORROWERS'?'SCANNING':'RUNNING',runtimeReady=['RUNNING','SCANNING'].includes(runtimeStage);
  const runtimeScore=Math.round(((bot?.active?25:0)+(heartbeatReady?25:0)+(provider.ready?35:0)+(blockers.length===0?15:0))*10)/10;
  const validationRatio=validation.target?Math.min(1,validation.evidence/validation.target):1,score=Math.round((runtimeScore*.72+(validation.ready?28:validationRatio*18))*10)/10;
  return {id:bot.id,name:bot.name,kind:strategyProfile(bot.id).kind,stage:runtimeStage,runtime:{stage:runtimeStage,ready:runtimeReady,status,score:runtimeScore},validation,score,status,heartbeatAgeMs,heartbeatMaxAgeMs,provider:{name:provider.label,ready:provider.ready,ageMs:provider.ageMs},edge:{ready:validation.ready,expectancyUsd:validation.expectancyUsd||0,profitFactor:validation.profitFactor||0,minimumProfitFactor:validation.minimumProfitFactor||null},evidence:{closedRealQuotePaper:strategyProfile(bot.id).kind==='EXECUTION'?validation.evidence:0,observations:validation.evidence,target:validation.target,mode:validation.mode},blockers:[...new Set(blockers)],warnings:[...new Set(warnings)],nextAction:blockers[0]||validation.nextAction};
}

export function operationalReadiness({state,promotionSnapshot}={}){
  const bots=(state?.bots||[]).map(bot=>botReadiness(state,bot,promotionSnapshot)),total=Math.max(1,bots.length),active=bots.filter(bot=>bot.runtime.stage!=='PAUSED').length,running=bots.filter(bot=>bot.runtime.ready).length,scanning=bots.filter(bot=>bot.runtime.stage==='SCANNING').length,blocked=bots.filter(bot=>bot.runtime.stage==='BLOCKED').length,validationRequired=bots.filter(bot=>bot.validation.required),validationReady=validationRequired.filter(bot=>bot.validation.ready).length,recovery=bots.filter(bot=>bot.validation.stage==='RECOVERY_PAPER').length,paper=state?.mode==='PAPER'&&state?.infrastructure?.production?.execution?.paper===true,safety=paper&&state?.risk?.globalKillSwitch!==true&&state?.infrastructure?.centralAgent?.policy?.paperOnly!==false,runtimeRatio=running/total,providerRatio=bots.filter(bot=>bot.provider.ready).length/total,validationRatio=validationRequired.length?validationRequired.reduce((sum,bot)=>sum+(bot.validation.target?Math.min(1,bot.validation.evidence/bot.validation.target):1),0)/validationRequired.length:1,score=Math.round(((safety?25:0)+(runtimeRatio*40)+(providerRatio*20)+(validationRatio*15))*10)/10,averageBotScore=Math.round(bots.reduce((sum,bot)=>sum+bot.score,0)/total*10)/10;
  return {version:3,score,label:blocked?'DEGRADED':running===active?'RUNNING':'STARTING',paperOnly:true,liveAutonomous:false,safety:{paperMode:paper,policyLocked:safety,liveExecutionLocked:true},summary:{bots:bots.length,active,running,scanning,blocked,validationRequired:validationRequired.length,validationReady,paperReady:validationReady,recovery,averageBotScore},bots,evaluatedAt:new Date().toISOString()};
}
