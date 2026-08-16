import ccxt from 'ccxt';
import PQueue from 'p-queue';

const enabled=String(process.env.CCXT_SPOT_FALLBACK_ENABLED||'false').toLowerCase()==='true';
const timeout=Math.max(1000,Number(process.env.CCXT_TIMEOUT_MS||6500));
const normalize=symbol=>{const value=String(symbol||'').toUpperCase();const quote=['USDT','USDC','BUSD','USD','BTC','ETH'].find(item=>value.endsWith(item));return quote?`${value.slice(0,-quote.length)}/${quote}`:value;};

// REST fallback only.  Streaming is deliberately isolated for a later CCXT Pro
// deployment; a failed public feed must never block a scanner or create orders.
export class CcxtSpotFallback {
  constructor(){this.exchange=new ccxt.binance({enableRateLimit:true,timeout});this.queue=new PQueue({concurrency:2,interval:1000,intervalCap:8});this.lastError=null;this.lastAt=null;}
  status(){return {provider:'CCXT Binance REST fallback',enabled,online:Boolean(this.lastAt),lastError:this.lastError,lastAt:this.lastAt,mode:'READ_ONLY'};}
  async bookTicker(symbol){
    if(!enabled)throw new Error('CCXT_SPOT_FALLBACK_DISABLED');
    return this.queue.add(async()=>{
      try{const ticker=await this.exchange.fetchTicker(normalize(symbol));this.lastAt=new Date().toISOString();this.lastError=null;return {provider:'CCXT Binance REST fallback',symbol:String(symbol).toUpperCase(),bid:Number(ticker.bid||0),ask:Number(ticker.ask||0),bidQty:0,askQty:0,observedAt:this.lastAt};}
      catch(error){this.lastError=error?.message||'CCXT_TICKER_FAILED';throw error;}
    });
  }
}

export const ccxtSpotFallback=new CcxtSpotFallback();
