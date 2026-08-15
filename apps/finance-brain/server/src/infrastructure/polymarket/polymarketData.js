import {fetchJson} from '../httpClient.js';

function parseMaybeJson(value,fallback=[]){if(Array.isArray(value))return value;if(typeof value!=='string')return fallback;try{return JSON.parse(value);}catch{return fallback;}}
export class PolymarketData{
  constructor(){this.gamma=process.env.POLYMARKET_GAMMA_URL||'https://gamma-api.polymarket.com';this.clob=process.env.POLYMARKET_CLOB_URL||'https://clob.polymarket.com';}
  async json(url,timeout=9000){return fetchJson(url,{timeoutMs:timeout,retries:2,headers:{accept:'application/json','user-agent':'AEGIS-V11-readonly'},errorPrefix:'POLYMARKET_HTTP'});}
  async ping(){const t=performance.now();try{const data=await this.json(`${this.gamma}/markets?active=true&closed=false&limit=1`);return{provider:'Polymarket Gamma + CLOB',online:Array.isArray(data),latencyMs:Math.round(performance.now()-t),checkedAt:new Date().toISOString(),error:null};}catch(e){return{provider:'Polymarket Gamma + CLOB',online:false,latencyMs:Math.round(performance.now()-t),checkedAt:new Date().toISOString(),error:e?.message||'POLYMARKET_ERROR'};}}
  async activeMarkets(limit=25){const data=await this.json(`${this.gamma}/markets?active=true&closed=false&limit=${Math.max(1,Math.min(100,limit))}`);return (Array.isArray(data)?data:[]).map(m=>({...m,clobTokenIds:parseMaybeJson(m.clobTokenIds),outcomes:parseMaybeJson(m.outcomes),outcomePrices:parseMaybeJson(m.outcomePrices)}));}
  async book(tokenId){return this.json(`${this.clob}/book?token_id=${encodeURIComponent(tokenId)}`);}
}
export const polymarketData=new PolymarketData();
