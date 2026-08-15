import {fetchJson} from '../httpClient.js';

const clean=value=>String(value||'').replace(/\/$/,'');
const okxCode=body=>{if(body?.code&&String(body.code)!=='0')throw new Error(body.msg||`OKX_PUBLIC_${body.code}`);return body?.data||[];};

export class OkxDerivativesMarketData{
  constructor(baseUrl=process.env.OKX_PUBLIC_MARKET_DATA_URL||'https://www.okx.com'){this.baseUrl=clean(baseUrl);this.timeoutMs=Math.max(1000,Number(process.env.MARKET_DATA_TIMEOUT_MS||5000));}
  status(){return {id:'okx-public-derivatives',provider:'OKX public derivatives',mode:'READ_ONLY',configured:true,enabled:true,online:null,live:false,liveExecutionReady:false,base:this.baseUrl,capabilities:['perpetual-ticker','funding-rate','open-interest'],warning:'Solo datos públicos; no habilita órdenes.'};}
  instrument(symbol){const raw=String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const quote=raw.endsWith('USDT')?'USDT':'USD';const base=raw.slice(0,-quote.length)||'BTC';return `${base}-${quote}-SWAP`;}
  async get(path,params={}){const url=new URL(this.baseUrl+path);for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));return fetchJson(url,{timeoutMs:this.timeoutMs,retries:2,headers:{accept:'application/json'},errorPrefix:'OKX_PUBLIC_HTTP'});}
  async ping(){const started=Date.now();const body=await this.get('/api/v5/public/time');okxCode(body);return {provider:'OKX public derivatives',online:true,latencyMs:Date.now()-started,checkedAt:new Date().toISOString()};}
  async premiumIndex(symbol){
    const instId=this.instrument(symbol);const [tickerBody,fundingBody]=await Promise.all([this.get('/api/v5/market/ticker',{instId}),this.get('/api/v5/public/funding-rate',{instId})]);
    const ticker=okxCode(tickerBody)[0]||{};const funding=okxCode(fundingBody)[0]||{};const markPrice=Number(ticker.last||0);return {instId,markPrice:String(markPrice||ticker.last||''),indexPrice:String(funding.idxPx||ticker.last||''),lastFundingRate:funding.fundingRate||'',fundingRate:funding.fundingRate||'',nextFundingTime:Number(funding.nextFundingTime||0)};
  }
  async bookTicker(symbol){
    const row=okxCode(await this.get('/api/v5/market/ticker',{instId:this.instrument(symbol)}))[0]||{};
    return {provider:'OKX public derivatives',symbol:String(symbol).toUpperCase(),bid:Number(row.bidPx||row.last),ask:Number(row.askPx||row.last),bidQty:Number(row.bidSz||0),askQty:Number(row.askSz||0),observedAt:new Date().toISOString()};
  }
  async depth(symbol,limit=20){
    const row=okxCode(await this.get('/api/v5/market/books',{instId:this.instrument(symbol),sz:Math.min(50,Math.max(5,limit))}))[0]||{};
    return {provider:'OKX public derivatives',symbol:String(symbol).toUpperCase(),bids:(row.bids||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),asks:(row.asks||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),observedAt:new Date().toISOString()};
  }
  async openInterest(symbol){const body=await this.get('/api/v5/public/open-interest',{instType:'SWAP',instId:this.instrument(symbol)});const row=okxCode(body)[0]||{};return {instId:row.instId,openInterest:row.oi||row.oiCcy||'0'};}
  async fundingHistory(symbol,limit=8){const body=await this.get('/api/v5/public/funding-rate-history',{instId:this.instrument(symbol),limit:Math.min(100,Math.max(1,limit))});return okxCode(body).map(row=>({fundingRate:row.fundingRate||row.realizedRate||'',fundingTime:row.fundingTime,instId:row.instId}));}
}

export const okxDerivativesMarketData=new OkxDerivativesMarketData();
