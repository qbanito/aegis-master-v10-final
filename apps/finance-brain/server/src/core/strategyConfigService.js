import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BOT_DEFINITIONS} from './config.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'../../data/strategy-config.json');
const defaults=()=>Object.fromEntries(BOT_DEFINITIONS.map(b=>[b.id,{enabled:true,maxAllocationPct:20,minConfidence:null,notes:'',wallet:b.wallet}]));
export class StrategyConfigService{
  constructor(){this.config=this.load();}
  load(){try{return {...defaults(),...JSON.parse(fs.readFileSync(file,'utf8'))};}catch{return defaults();}}
  save(){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(this.config,null,2));}
  get(){return this.config;}
  patch(id,changes={}){if(!this.config[id])throw new Error('STRATEGY_NOT_FOUND');const allowed=['enabled','maxAllocationPct','minConfidence','notes'];for(const k of allowed)if(k in changes)this.config[id][k]=changes[k];this.save();return this.config[id];}
}
export const strategyConfigService=new StrategyConfigService();
