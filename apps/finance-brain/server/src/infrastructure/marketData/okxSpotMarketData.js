import {fetchJson} from '../httpClient.js';
const clean=value=>String(value||'').replace(/\/$/,'');
const okxData=body=>{if(body?.code&&String(body.code)!=='0')throw new Error(body.msg||`OKX_SPOT_${body.code}`);return body?.data||[];};
const barMap={
  '1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m','1h':'1H','2h':'2H','4h':'4H','6h':'6H','12h':'12H','1d':'1D'
};
export class OkxSpotMarketData{
  constructor(baseUrl=process.env.OKX_PUBLIC_MARKET_DATA_URL||'https://www.okx.com'){this.baseUrl=clean(baseUrl);this.timeoutMs=Math.max(1000,Number(process.env.MARKET_DATA_TIMEOUT_MS||5000));}
  instrument(symbol){const value=String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'');for(const quote of ['USDT','USDC','USD','BTC','ETH'])if(value.endsWith(quote))return `${value.slice(0,-quote.length)}-${quote==='USD'?'USDT':quote}`;return value;}
  async get(path,params={}){const url=new URL(this.baseUrl+path);for(const [key,value]of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));return fetchJson(url,{timeoutMs:this.timeoutMs,retries:2,headers:{accept:'application/json'},errorPrefix:'OKX_SPOT_HTTP'});}
  async ping(){const started=Date.now();okxData(await this.get('/api/v5/public/time'));return {provider:'OKX Spot fallback',online:true,latencyMs:Date.now()-started,checkedAt:new Date().toISOString(),fallbackFor:'Binance Spot'};}
  async klines(symbol,interval='1m',limit=120){const rows=okxData(await this.get('/api/v5/market/candles',{instId:this.instrument(symbol),bar:barMap[interval]||interval,limit:Math.min(300,Math.max(10,limit))}));return rows.map(row=>({openTime:Number(row[0]),open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4]),volume:Number(row[5]),closeTime:Number(row[0]),quoteVolume:Number(row[7]||0),trades:0,provider:'OKX Spot fallback'})).reverse();}
  async bookTicker(symbol){const row=okxData(await this.get('/api/v5/market/ticker',{instId:this.instrument(symbol)}))[0]||{};return {provider:'OKX Spot fallback',symbol:String(symbol).toUpperCase(),bid:Number(row.bidPx||row.last),ask:Number(row.askPx||row.last),bidQty:Number(row.bidSz||0),askQty:Number(row.askSz||0),observedAt:new Date().toISOString()};}
  async depth(symbol,limit=20){const row=okxData(await this.get('/api/v5/market/books',{instId:this.instrument(symbol),sz:Math.min(50,Math.max(5,limit))}))[0]||{};return {provider:'OKX Spot fallback',symbol:String(symbol).toUpperCase(),bids:(row.bids||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),asks:(row.asks||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),observedAt:new Date().toISOString()};}
}
export const okxSpotMarketData=new OkxSpotMarketData();
