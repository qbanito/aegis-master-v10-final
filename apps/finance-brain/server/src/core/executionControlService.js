import {binanceTrading} from '../infrastructure/binance/binanceTrading.js';
import {strategyConfigService} from './strategyConfigService.js';
import {EXECUTION_BOT_IDS,RISK_PROFILES,presetForBot,presetsForBot,routeForBot} from './strategyPresetCatalog.js';

const now=()=>new Date().toISOString();
const normalizeMode=value=>String(value||'').toUpperCase()==='REAL'?'REAL':'PAPER';
const normalizeRisk=value=>RISK_PROFILES[String(value||'').toUpperCase()]?String(value).toUpperCase():'MEDIUM';
const publicWallet=value=>value&&typeof value==='object'?{address:String(value.address||''),scope:String(value.scope||''),ecosystem:String(value.ecosystem||'')} : null;

export class ExecutionControlService{
  constructor({state,persist,broadcast}={}){this.state=state;this.persist=persist;this.broadcast=broadcast;this.ensureState();}
  ensureState(){
    const current=this.state.infrastructure.executionControl||{};
    const bots={...(current.bots||{})};
    for(const id of EXECUTION_BOT_IDS){
      const existing=bots[id]||{},riskLevel=normalizeRisk(existing.riskLevel),defaultPreset=presetsForBot(id,riskLevel)[1]?.id||null;
      bots[id]={mode:normalizeMode(existing.mode),riskLevel,presetId:existing.presetId||defaultPreset,wallet:publicWallet(existing.wallet),updatedAt:existing.updatedAt||null};
      strategyConfigService.ensure(id,{wallet:this.state.bots?.find(bot=>bot.id===id)?.wallet||null,maxAllocationPct:10});
    }
    this.state.infrastructure.executionControl={version:1,bots,pendingWalletSignatures:Array.isArray(current.pendingWalletSignatures)?current.pendingWalletSignatures.slice(0,100):[],lastGlobalChangeAt:current.lastGlobalChangeAt||null};
    this.syncSystemMode();return this.state.infrastructure.executionControl;
  }
  syncSystemMode(){const modes=Object.values(this.state.infrastructure.executionControl?.bots||{}).map(row=>row.mode);this.state.mode=modes.some(mode=>mode==='REAL')?'REAL':'PAPER';}
  credentials(){
    const binance=binanceTrading.status();
    const okxConfigured=Boolean(process.env.OKX_API_KEY&&process.env.OKX_API_SECRET&&process.env.OKX_API_PASSPHRASE);
    return {binance:{provider:'Binance',configured:binance.configured,armed:binance.armed,markets:binance.markets,allowedSymbols:binance.allowedSymbols,maxOrderUsd:binance.maxOrderUsd,source:'SERVER_ENV'},okx:{provider:'OKX',configured:okxConfigured,armed:okxConfigured&&String(process.env.OKX_LIVE_ENABLED||'false').toLowerCase()==='true'&&process.env.OKX_LIVE_CONFIRM==='I_UNDERSTAND_REAL_FUNDS',markets:['spot','swap'],source:'SERVER_ENV'},secretsExposed:false};
  }
  routeReadiness(id,control){
    const route=routeForBot(id),credentials=this.credentials();if(!route)return{ready:false,blockers:['BOT_ROUTE_NOT_FOUND']};
    const blockers=[];let status='READY';
    if(route.executionKind==='CEX'&&!credentials.binance.armed)blockers.push(credentials.binance.configured?'BINANCE_LIVE_NOT_ARMED':'BINANCE_ENV_CREDENTIALS_MISSING');
    if(route.executionKind==='BROKER')blockers.push('BROKER_REAL_EXECUTION_NOT_ENABLED');
    if(route.executionKind==='DEX'&&!control.wallet?.address)blockers.push('METAMASK_WALLET_REQUIRED');
    if(route.executionKind==='DEX'&&String(process.env.AEGIS_LIVE_EXECUTION_ENABLED||'false').toLowerCase()!=='true')blockers.push('SERVER_LIVE_GATE_DISABLED');
    if(['liquidation','arbitrage','yield'].includes(id))blockers.push('TRANSACTION_BUILDER_NOT_AVAILABLE');
    if(id==='polygon-meme-momentum'&&!String(process.env.ZEROX_API_KEY||process.env.POLYGON_QUOTE_API_KEY||''))blockers.push('ZEROX_API_KEY_MISSING');
    if(id==='polymarket'&&String(process.env.POLYMARKET_LIVE_ENABLED||'false').toLowerCase()!=='true')blockers.push('POLYMARKET_LIVE_DISABLED');
    if(this.state.risk?.globalKillSwitch)blockers.push('GLOBAL_KILL_SWITCH');
    if(route.executionKind==='INTELLIGENCE')status='REAL_DATA_ONLY';else if(blockers.length)status='ARMED_WITH_BLOCKERS';
    return{ready:route.executionKind==='INTELLIGENCE'||blockers.length===0,status,blockers,manualSignature:route.executionKind==='DEX',autonomous:false};
  }
  bot(id){
    this.ensureState();const control=this.state.infrastructure.executionControl.bots[id],route=routeForBot(id);if(!control||!route)return null;
    const presets=presetsForBot(id,control.riskLevel);const selectedPreset=presets.find(item=>item.id===control.presetId)||presets[1]||presets[0];
    return{id,...control,route,presets,selectedPreset,readiness:this.routeReadiness(id,control),effectiveMode:control.mode};
  }
  snapshot({includePrepared=false}={}){
    this.ensureState();const rows=EXECUTION_BOT_IDS.map(id=>this.bot(id));const real=rows.filter(row=>row.mode==='REAL').length;
    const pending=this.state.infrastructure.executionControl.pendingWalletSignatures.slice(0,50).map(row=>includePrepared?row:({...row,prepared:undefined}));
    return{version:1,globalMode:real===0?'PAPER':real===rows.length?'REAL':'MIXED',realBots:real,paperBots:rows.length-real,bots:Object.fromEntries(rows.map(row=>[row.id,row])),riskProfiles:RISK_PROFILES,credentials:this.credentials(),pendingWalletSignatures:pending,updatedAt:now()};
  }
  applyPolicy(id,{riskLevel,presetId}={}){
    const control=this.state.infrastructure.executionControl.bots[id];if(!control)throw new Error('BOT_NOT_FOUND');
    const nextRisk=normalizeRisk(riskLevel||control.riskLevel);const presets=presetsForBot(id,nextRisk);const nextPresetId=presetId&&presets.some(item=>item.id===presetId)?presetId:(presets.find(item=>item.id.endsWith('-balanced'))?.id||presets[0]?.id);const preset=presetForBot(id,nextPresetId,nextRisk);if(!preset)throw new Error('PRESET_NOT_FOUND');
    control.riskLevel=nextRisk;control.presetId=nextPresetId;control.updatedAt=now();strategyConfigService.patch(id,{...preset.config,riskLevel:nextRisk,activePresetId:nextPresetId});return control;
  }
  setBot(id,changes={}){
    this.ensureState();const control=this.state.infrastructure.executionControl.bots[id];if(!control)throw new Error('BOT_NOT_FOUND');
    if('mode'in changes){const mode=normalizeMode(changes.mode);if(mode==='REAL'&&changes.confirmReal!==true)throw new Error('REAL_MODE_CONFIRMATION_REQUIRED');if(mode==='REAL'&&this.state.risk?.globalKillSwitch)throw new Error('GLOBAL_KILL_SWITCH');control.mode=mode;}
    if('wallet'in changes)control.wallet=publicWallet(changes.wallet);
    if('riskLevel'in changes||'presetId'in changes)this.applyPolicy(id,changes);
    control.updatedAt=now();this.syncSystemMode();this.persist?.();this.broadcast?.();return this.bot(id);
  }
  setGlobal(mode,{confirmReal=false,wallets={}}={}){
    const next=normalizeMode(mode);if(next==='REAL'&&confirmReal!==true)throw new Error('REAL_MODE_CONFIRMATION_REQUIRED');if(next==='REAL'&&this.state.risk?.globalKillSwitch)throw new Error('GLOBAL_KILL_SWITCH');
    this.ensureState();for(const id of EXECUTION_BOT_IDS){const control=this.state.infrastructure.executionControl.bots[id];control.mode=next;if(wallets[id])control.wallet=publicWallet(wallets[id]);control.updatedAt=now();}
    this.state.infrastructure.executionControl.lastGlobalChangeAt=now();this.syncSystemMode();this.persist?.();this.broadcast?.();return this.snapshot();
  }
  queueWalletSignature(opportunity,prepared=null){
    const id=String(opportunity.strategyId||''),control=this.bot(id);if(!control||control.route.executionKind!=='DEX')throw new Error('DEX_ROUTE_NOT_FOUND');
    const row={id:crypto.randomUUID(),strategyId:id,opportunityId:opportunity.id,asset:opportunity.asset,direction:opportunity.direction,capitalRequiredUsd:Number(opportunity.capitalRequiredUsd||0),route:control.route,wallet:control.wallet,prepared,status:prepared?'READY_FOR_WALLET':'AWAITING_TRANSACTION_BUILD',createdAt:now(),expiresAt:new Date(Date.now()+120000).toISOString()};
    this.state.infrastructure.executionControl.pendingWalletSignatures.unshift(row);this.state.infrastructure.executionControl.pendingWalletSignatures=this.state.infrastructure.executionControl.pendingWalletSignatures.slice(0,100);this.persist?.();this.broadcast?.();return row;
  }
  resolveWalletSignature(id,{status='SIGNED_AND_SENT',transactionHash=null,error=null}={}){const row=this.state.infrastructure.executionControl.pendingWalletSignatures.find(item=>item.id===id);if(!row)throw new Error('SIGNING_REQUEST_NOT_FOUND');row.status=String(status);row.transactionHash=transactionHash?String(transactionHash):null;row.error=error?String(error):null;row.resolvedAt=now();this.persist?.();this.broadcast?.();return row;}
  walletSignature(id){const row=this.state.infrastructure.executionControl.pendingWalletSignatures.find(item=>item.id===id);if(!row)throw new Error('SIGNING_REQUEST_NOT_FOUND');return row;}
}

let singleton=null;
export function configureExecutionControl(options){singleton=new ExecutionControlService(options);return singleton;}
export function getExecutionControl(){if(!singleton)throw new Error('EXECUTION_CONTROL_NOT_CONFIGURED');return singleton;}
