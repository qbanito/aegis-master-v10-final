import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BOT_DEFINITIONS} from './config.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'../../data/strategy-config.json');
const numeric=(value,min,max,label,{nullable=false}={})=>{if(nullable&&(value===null||value===''))return null;const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)throw new Error(`${label}_OUT_OF_RANGE`);return number;};
export const defaultStrategyConfig=bot=>({enabled:true,maxAllocationPct:20,minConfidence:null,maxRiskScore:.65,minExpectedProfitUsd:5,maxSlippageBps:75,notes:'',wallet:bot?.wallet||null,activePresetId:null,updatedAt:null});
const defaults=()=>Object.fromEntries(BOT_DEFINITIONS.map(bot=>[bot.id,defaultStrategyConfig(bot)]));
export class StrategyConfigService{
  constructor({storageFile=file}={}){this.storageFile=storageFile;this.config=this.load();}
  load(){try{const loaded=JSON.parse(fs.readFileSync(this.storageFile,'utf8'));return Object.fromEntries(Object.entries({...defaults(),...loaded}).map(([id,row])=>[id,{...defaultStrategyConfig({wallet:row?.wallet}),...row}]));}catch{return defaults();}}
  save(){fs.mkdirSync(path.dirname(this.storageFile),{recursive:true});fs.writeFileSync(this.storageFile,JSON.stringify(this.config,null,2));}
  get(){return this.config;}
  ensure(id,{wallet=null,maxAllocationPct=10}={}){if(!this.config[id])this.config[id]={...defaultStrategyConfig({wallet}),maxAllocationPct};return this.config[id];}
  patch(id,changes={}){
    if(!this.config[id])throw new Error('STRATEGY_NOT_FOUND');const next={...this.config[id]};
    if('enabled'in changes){if(typeof changes.enabled!=='boolean')throw new Error('ENABLED_MUST_BE_BOOLEAN');next.enabled=changes.enabled;}
    if('maxAllocationPct'in changes)next.maxAllocationPct=numeric(changes.maxAllocationPct,0,50,'MAX_ALLOCATION_PCT');
    if('minConfidence'in changes)next.minConfidence=numeric(changes.minConfidence,.5,.99,'MIN_CONFIDENCE',{nullable:true});
    if('maxRiskScore'in changes)next.maxRiskScore=numeric(changes.maxRiskScore,.05,.9,'MAX_RISK_SCORE');
    if('minExpectedProfitUsd'in changes)next.minExpectedProfitUsd=numeric(changes.minExpectedProfitUsd,0,1000000,'MIN_EXPECTED_PROFIT_USD');
    if('maxSlippageBps'in changes)next.maxSlippageBps=numeric(changes.maxSlippageBps,1,500,'MAX_SLIPPAGE_BPS');
    if('notes'in changes)next.notes=String(changes.notes||'').slice(0,2000);
    if('activePresetId'in changes)next.activePresetId=changes.activePresetId?String(changes.activePresetId):null;
    next.updatedAt=new Date().toISOString();this.config[id]=next;this.save();return next;
  }
  evaluate(id,opportunity={}){
    const config=this.config[id];if(!config)return {approved:false,reasons:['STRATEGY_CONFIG_MISSING'],config:null};const reasons=[];
    if(config.enabled===false)reasons.push('STRATEGY_DISABLED');
    if(config.minConfidence!=null&&Number(opportunity.confidence||0)<config.minConfidence)reasons.push('BELOW_STRATEGY_MIN_CONFIDENCE');
    if(config.maxRiskScore!=null&&Number(opportunity.riskScore||0)>config.maxRiskScore)reasons.push('ABOVE_STRATEGY_MAX_RISK_SCORE');
    if(config.minExpectedProfitUsd!=null&&Number(opportunity.expectedProfitUsd||0)<config.minExpectedProfitUsd)reasons.push('BELOW_STRATEGY_MIN_EXPECTED_PROFIT');
    if(config.maxSlippageBps!=null&&Number(opportunity.estimatedSlippageBps||0)>config.maxSlippageBps)reasons.push('ABOVE_STRATEGY_MAX_SLIPPAGE');
    return {approved:reasons.length===0,reasons,config};
  }
}
export const strategyConfigService=new StrategyConfigService();
