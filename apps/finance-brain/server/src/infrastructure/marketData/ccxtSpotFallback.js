import ccxt from 'ccxt';
import PQueue from 'p-queue';

const enabled=String(process.env.CCXT_SPOT_FALLBACK_ENABLED||'true').toLowerCase()!=='false';
const timeout=Math.max(1000,Number(process.env.CCXT_TIMEOUT_MS||6500));
const normalize=symbol=>{const value=String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const quote=['USDT','USDC','BUSD','USD','BTC','ETH'].find(item=>value.endsWith(item));return quote?`${value.slice(0,-quote.length)}/${quote==='BUSD'?'USDT':quote}`:value;};
const intervalMap={'1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m','1h':'1h','2h':'2h','4h':'4h','1d':'1d'};

export class CcxtSpotFallback{
  constructor({exchangeIds=String(process.env.CCXT_SPOT_EXCHANGES||'okx,kraken,coinbase').split(',').map(value=>value.trim()).filter(Boolean)}={}){this.exchangeIds=exchangeIds;this.exchanges=exchangeIds.map(id=>({id,client:ccxt[id]?new ccxt[id]({enableRateLimit:true,timeout}):null})).filter(row=>row.client);this.queue=new PQueue({concurrency:2,interval:1000,intervalCap:8});this.lastError=null;this.lastAt=null;this.lastProvider=null;}
  status(){return {provider:this.lastProvider||'CCXT multi-exchange spot fallback',enabled,online:Boolean(this.lastAt),exchanges:this.exchanges.map(row=>row.id),lastError:this.lastError,lastAt:this.lastAt,mode:'READ_ONLY'};}
  async use(method){if(!enabled)throw new Error('CCXT_SPOT_FALLBACK_DISABLED');return this.queue.add(async()=>{const errors=[];for(const row of this.exchanges){try{const result=await method(row.client,row.id);this.lastAt=new Date().toISOString();this.lastProvider=`CCXT ${row.id} spot`;this.lastError=null;return result;}catch(error){errors.push(`${row.id}:${error?.message||'FAILED'}`);}}this.lastError=errors.join('; ').slice(0,500);throw new Error(this.lastError||'CCXT_SPOT_FALLBACK_UNAVAILABLE');});}
  async ping(){return this.use(async(exchange,id)=>{await exchange.loadMarkets();return {provider:`CCXT ${id} spot`,online:true,checkedAt:new Date().toISOString(),fallbackFor:'Binance Spot'};});}
  async bookTicker(symbol){return this.use(async(exchange,id)=>{const ticker=await exchange.fetchTicker(normalize(symbol));return {provider:`CCXT ${id} spot`,symbol:String(symbol).toUpperCase(),bid:Number(ticker.bid||0),ask:Number(ticker.ask||0),bidQty:0,askQty:0,observedAt:new Date().toISOString()};});}
  async depth(symbol,limit=20){return this.use(async(exchange,id)=>{const book=await exchange.fetchOrderBook(normalize(symbol),Math.min(100,Math.max(5,limit)));return {provider:`CCXT ${id} spot`,symbol:String(symbol).toUpperCase(),bids:(book.bids||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),asks:(book.asks||[]).map(([price,quantity])=>[Number(price),Number(quantity)]),observedAt:new Date().toISOString()};});}
  async klines(symbol,interval='1m',limit=120){return this.use(async(exchange,id)=>{const rows=await exchange.fetchOHLCV(normalize(symbol),intervalMap[interval]||interval,undefined,Math.min(500,Math.max(10,limit)));return rows.map(([time,open,high,low,close,volume])=>({openTime:Number(time),open:Number(open),high:Number(high),low:Number(low),close:Number(close),volume:Number(volume),closeTime:Number(time),quoteVolume:0,trades:0,provider:`CCXT ${id} spot`}));});}
}
export const ccxtSpotFallback=new CcxtSpotFallback();
