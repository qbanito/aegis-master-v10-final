const BASE=process.env.BINANCE_MARKET_DATA_URL||'https://api.binance.com';
const timeoutMs=Math.max(1000,Number(process.env.MARKET_DATA_TIMEOUT_MS||5000));
import {fetchJson} from '../httpClient.js';
import {ccxtSpotFallback} from './ccxtSpotFallback.js';

export class BinanceMarketData {
  constructor(){this.base=BASE.replace(/\/$/,'');}
  async ping(){const t=Date.now(); await fetchJson(`${this.base}/api/v3/ping`,{timeoutMs,retries:2,errorPrefix:'BINANCE_SPOT'}); return {provider:'Binance Spot',online:true,latencyMs:Date.now()-t,checkedAt:new Date().toISOString()};}
  async klines(symbol,interval='1m',limit=120){
    const url=`${this.base}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${Math.min(1000,Math.max(10,limit))}`;
    const rows=await fetchJson(url,{timeoutMs,retries:2,errorPrefix:'BINANCE_SPOT'});
    return rows.map(r=>({openTime:Number(r[0]),open:Number(r[1]),high:Number(r[2]),low:Number(r[3]),close:Number(r[4]),volume:Number(r[5]),closeTime:Number(r[6]),quoteVolume:Number(r[7]),trades:Number(r[8])}));
  }
  async bookTicker(symbol){
    try{const url=`${this.base}/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`;const row=await fetchJson(url,{timeoutMs,retries:2,errorPrefix:'BINANCE_SPOT_BOOK'});return {provider:'Binance Spot',symbol:String(symbol).toUpperCase(),bid:Number(row.bidPrice),ask:Number(row.askPrice),bidQty:Number(row.bidQty||0),askQty:Number(row.askQty||0),observedAt:new Date().toISOString()};}
    catch(error){try{return await ccxtSpotFallback.bookTicker(symbol);}catch{throw error;}}
  }
  async depth(symbol,limit=20){
    const url=`${this.base}/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${Math.min(100,Math.max(5,limit))}`;
    const row=await fetchJson(url,{timeoutMs,retries:2,errorPrefix:'BINANCE_SPOT_DEPTH'});
    return {provider:'Binance Spot',symbol:String(symbol).toUpperCase(),bids:(row.bids||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),asks:(row.asks||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),observedAt:new Date().toISOString()};
  }
}
export const binanceMarketData=new BinanceMarketData();
