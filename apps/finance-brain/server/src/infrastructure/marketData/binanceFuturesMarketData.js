import {fetchJson} from '../httpClient.js';
import {okxDerivativesMarketData} from './okxDerivativesMarketData.js';

export class BinanceFuturesMarketData{
  constructor(baseUrl=process.env.BINANCE_FUTURES_URL||'https://fapi.binance.com'){this.baseUrl=baseUrl.replace(/\/$/,'');this.timeoutMs=Math.max(1000,Number(process.env.MARKET_DATA_TIMEOUT_MS||5000));this.fallback=okxDerivativesMarketData;this.provider='Binance USDⓈ-M Futures';this.lastProvider='Binance USDⓈ-M Futures';}
  async get(path,params={}){const u=new URL(this.baseUrl+path);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));const started=Date.now();const data=await fetchJson(u,{timeoutMs:this.timeoutMs,retries:2,headers:{accept:'application/json'},errorPrefix:'BINANCE_FUTURES_HTTP'});return {data,latencyMs:Date.now()-started};}
  fallbackEnabled(){return process.env.PERP_PROVIDER!=='binance'&&process.env.PERP_MARKET_FALLBACK!=='none';}
  async useFallback(method,args,error){
    if(!this.fallbackEnabled()||!this.fallback?.[method])throw error;
    const result=await this.fallback[method](...args);this.lastProvider='OKX public derivatives';
    return result;
  }
  async ping(){try{const {latencyMs}=await this.get('/fapi/v1/time');this.lastProvider=this.provider;return {provider:this.provider,online:true,latencyMs,checkedAt:new Date().toISOString()};}catch(error){try{return {...await this.fallback.ping(),fallbackFor:'Binance USDⓈ-M Futures'};}catch(fallbackError){throw new Error(`${error?.message||'BINANCE_FUTURES_UNAVAILABLE'}; ${fallbackError?.message||'OKX_PUBLIC_UNAVAILABLE'}`);}}}
  async premiumIndex(symbol){try{const result=(await this.get('/fapi/v1/premiumIndex',{symbol})).data;this.lastProvider=this.provider;return result;}catch(error){return this.useFallback('premiumIndex',[symbol],error);}}
  async bookTicker(symbol){try{const result=(await this.get('/fapi/v1/ticker/bookTicker',{symbol})).data;this.lastProvider=this.provider;return {provider:this.provider,symbol:String(symbol).toUpperCase(),bid:Number(result.bidPrice),ask:Number(result.askPrice),bidQty:Number(result.bidQty||0),askQty:Number(result.askQty||0),observedAt:new Date().toISOString()};}catch(error){return this.useFallback('bookTicker',[symbol],error);}}
  async depth(symbol,limit=20){try{const result=(await this.get('/fapi/v1/depth',{symbol,limit:Math.min(100,Math.max(5,limit))})).data;this.lastProvider=this.provider;return {provider:this.provider,symbol:String(symbol).toUpperCase(),bids:(result.bids||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),asks:(result.asks||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),observedAt:new Date().toISOString()};}catch(error){return this.useFallback('depth',[symbol,limit],error);}}
  async openInterest(symbol){try{const result=(await this.get('/fapi/v1/openInterest',{symbol})).data;this.lastProvider=this.provider;return result;}catch(error){return this.useFallback('openInterest',[symbol],error);}}
  async fundingHistory(symbol,limit=8){try{const result=(await this.get('/fapi/v1/fundingRate',{symbol,limit})).data;this.lastProvider=this.provider;return result;}catch(error){return this.useFallback('fundingHistory',[symbol,limit],error);}}
}
export const binanceFuturesMarketData=new BinanceFuturesMarketData();
