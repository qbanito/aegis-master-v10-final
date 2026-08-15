import {createHmac} from 'node:crypto';

const bool=(v,f=false)=>String(v??f).toLowerCase()==='true';
const list=v=>String(v||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);

export class BinanceTradingConnector {
  constructor(){
    this.spotBase=(process.env.BINANCE_API_BASE||process.env.BINANCE_MARKET_DATA_URL||'https://api.binance.com').replace(/\/$/,'');
    this.futuresBase=(process.env.BINANCE_FUTURES_API_BASE||process.env.BINANCE_FUTURES_URL||'https://fapi.binance.com').replace(/\/$/,'');
    this.apiKey=String(process.env.BINANCE_API_KEY||'');
    this.secret=String(process.env.BINANCE_API_SECRET||'');
    this.enabled=bool(process.env.BINANCE_LIVE_ENABLED,false);
    this.confirmation=String(process.env.BINANCE_LIVE_CONFIRM||'');
    this.allowedSymbols=list(process.env.BINANCE_ALLOWED_SYMBOLS||'');
    this.maxOrderUsd=Math.max(0,Number(process.env.BINANCE_MAX_ORDER_USD||25));
    this.recvWindow=Math.max(1000,Number(process.env.BINANCE_RECV_WINDOW||5000));
  }
  status(){return {provider:'Binance',configured:Boolean(this.apiKey&&this.secret),enabled:this.enabled,armed:this.enabled&&this.confirmation==='I_UNDERSTAND_REAL_FUNDS',credentialsStoredInApp:false,markets:['spot','futures'],allowedSymbols:this.allowedSymbols,maxOrderUsd:this.maxOrderUsd,spotBase:this.spotBase,futuresBase:this.futuresBase};}
  base(market){return String(market||'spot').toLowerCase()==='futures'?this.futuresBase:this.spotBase;}
  path(market,route){return String(market||'spot').toLowerCase()==='futures'?`/fapi${route}`:`/api${route}`;}
  async request({market='spot',route,method='GET',params={},signed=false}){
    const query=new URLSearchParams();
    for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')query.set(key,String(value));
    if(signed){
      if(!this.apiKey||!this.secret)throw new Error('BINANCE_CREDENTIALS_NOT_CONFIGURED');
      query.set('timestamp',String(Date.now()));query.set('recvWindow',String(this.recvWindow));
      query.set('signature',createHmac('sha256',this.secret).update(query.toString()).digest('hex'));
    }
    const url=`${this.base(market)}${this.path(market,route)}${query.toString()?`?${query}`:''}`;
    const headers={accept:'application/json'};if(this.apiKey)headers['X-MBX-APIKEY']=this.apiKey;
    const response=await fetch(url,{method,headers,signal:AbortSignal.timeout(10000)});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body?.msg||`BINANCE_HTTP_${response.status}`);
    return body;
  }
  async ping(market='spot'){const started=Date.now();await this.request({market,route:'/ping'});return{provider:'Binance',market,online:true,latencyMs:Date.now()-started,checkedAt:new Date().toISOString(),error:null};}
  async account(market='spot'){return this.request({market,route:market==='futures'?'/v2/account':'/v3/account',signed:true});}
  async exchangeInfo(market='spot',symbol){return this.request({market,route:'/v3/exchangeInfo',params:symbol?{symbol}:{} });}
  async order(input={}){
    const market=String(input.market||'spot').toLowerCase();
    if(!this.status().armed)throw new Error('BINANCE_LIVE_TRADING_LOCKED');
    const symbol=String(input.symbol||'').toUpperCase();
    if(!symbol)throw new Error('BINANCE_SYMBOL_REQUIRED');
    if(this.allowedSymbols.length&&!this.allowedSymbols.includes(symbol))throw new Error('BINANCE_SYMBOL_NOT_ALLOWED');
    const side=String(input.side||'').toUpperCase();if(!['BUY','SELL'].includes(side))throw new Error('BINANCE_SIDE_INVALID');
    const type=String(input.type||'MARKET').toUpperCase();if(!['MARKET','LIMIT','STOP_MARKET','TAKE_PROFIT_MARKET'].includes(type))throw new Error('BINANCE_ORDER_TYPE_INVALID');
    const params={symbol,side,type,newClientOrderId:input.newClientOrderId};
    if(input.quantity!==undefined)params.quantity=input.quantity;
    if(input.quoteOrderQty!==undefined)params.quoteOrderQty=input.quoteOrderQty;
    if(input.price!==undefined)params.price=input.price;
    if(type==='LIMIT')params.timeInForce=input.timeInForce||'GTC';
    if(market==='futures'&&input.reduceOnly!==undefined)params.reduceOnly=Boolean(input.reduceOnly);
    if(market==='futures'&&input.positionSide)params.positionSide=input.positionSide;
    const notional=Number(input.notionalUsd||input.quoteOrderQty||0);
    if(notional>this.maxOrderUsd)throw new Error('BINANCE_ORDER_LIMIT_EXCEEDED');
    const route=market==='futures'?'/v1/order':(input.test?'/v3/order/test':'/v3/order');
    return this.request({market,route,method:'POST',params,signed:true});
  }
}
export const binanceTrading=new BinanceTradingConnector();
