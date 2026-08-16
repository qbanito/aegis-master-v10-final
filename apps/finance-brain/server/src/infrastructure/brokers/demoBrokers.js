import {fetchJson} from '../httpClient.js';

const isoNow=()=>new Date().toISOString();
const cleanBase=value=>String(value||'').replace(/\/$/,'');
const csv=value=>String(value||'').split(',').map(item=>item.trim()).filter(Boolean);

export class AlpacaPaperConnector{
  constructor(){
    this.tradingBase=cleanBase(process.env.ALPACA_PAPER_TRADING_URL||process.env.ALPACA_ENDPOINT||process.env.ALPACA_ENDPINT||'https://paper-api.alpaca.markets').replace(/\/v2$/,'');
    this.dataBase=cleanBase(process.env.ALPACA_DATA_URL||'https://data.alpaca.markets');
    this.key=process.env.ALPACA_API_KEY||process.env.APCA_API_KEY_ID||'';this.secret=process.env.ALPACA_API_SECRET||process.env.APCA_API_SECRET_KEY||'';
  }
  configured(){return Boolean(this.key&&this.secret);}
  headers(){return {'APCA-API-KEY-ID':this.key,'APCA-API-SECRET-KEY':this.secret};}
  status(){return {id:'alpaca-paper',provider:'Alpaca',mode:'PAPER',configured:this.configured(),enabled:true,live:false,liveExecutionReady:false,tradingBase:this.tradingBase,dataBase:this.dataBase,capabilities:['stocks','options','news','paper-account'],credentialsStoredInApp:false,lastProbe:null};}
  async probe(){
    if(!this.configured())return {...this.status(),online:false,readiness:'BLOCKED',error:'ALPACA_PAPER_CREDENTIALS_MISSING',checkedAt:isoNow()};
    const started=Date.now();
    try{const account=await fetchJson(`${this.tradingBase}/v2/account`,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'ALPACA_PAPER'});return {...this.status(),online:true,readiness:'READY',account:{status:account.status, buyingPower:account.buying_power, equity:account.equity, currency:account.currency},latencyMs:Date.now()-started,checkedAt:isoNow()};}
    catch(error){return {...this.status(),online:false,readiness:'DEGRADED',error:error?.message||'ALPACA_PAPER_PROBE_ERROR',latencyMs:Date.now()-started,checkedAt:isoNow()};}
  }
  async order({symbol,qty,side,type='market',timeInForce='day',limitPrice,clientOrderId}={}){
    if(!this.configured())throw new Error('ALPACA_PAPER_CREDENTIALS_MISSING');
    if(!this.tradingBase.includes('paper-api.alpaca.markets'))throw new Error('ALPACA_PAPER_ENDPOINT_REQUIRED');
    const normalizedSymbol=String(symbol||'').trim().toUpperCase().replace(/[^A-Z0-9.]/g,'');
    if(!normalizedSymbol)throw new Error('ALPACA_SYMBOL_REQUIRED');
    const quantity=Number(qty);if(!Number.isFinite(quantity)||quantity<=0||quantity>1000)throw new Error('ALPACA_QTY_INVALID');
    const normalizedSide=String(side||'').toLowerCase();if(!['buy','sell'].includes(normalizedSide))throw new Error('ALPACA_SIDE_INVALID');
    const normalizedType=String(type||'market').toLowerCase();if(!['market','limit'].includes(normalizedType))throw new Error('ALPACA_ORDER_TYPE_INVALID');
    const normalizedTif=String(timeInForce||'day').toLowerCase();if(!['day','gtc','ioc','fok'].includes(normalizedTif))throw new Error('ALPACA_TIME_IN_FORCE_INVALID');
    const payload={symbol:normalizedSymbol,qty:String(quantity),side:normalizedSide,type:normalizedType,time_in_force:normalizedTif};
    if(normalizedType==='limit'){const price=Number(limitPrice);if(!Number.isFinite(price)||price<=0)throw new Error('ALPACA_LIMIT_PRICE_REQUIRED');payload.limit_price=String(price);}
    if(clientOrderId)payload.client_order_id=String(clientOrderId).slice(0,48);
    return fetchJson(`${this.tradingBase}/v2/orders`,{method:'POST',headers:{...this.headers(),'content-type':'application/json'},body:JSON.stringify(payload),timeoutMs:10000,retries:0,errorPrefix:'ALPACA_PAPER_ORDER'});
  }
  async news({symbols=csv(process.env.NYSE_NEWS_SYMBOLS||'SPY,QQQ,AAPL,MSFT'),limit=20}={}){
    if(!this.configured())throw new Error('ALPACA_PAPER_CREDENTIALS_MISSING');
    const query=new URLSearchParams({limit:String(Math.min(50,Math.max(1,limit))),sort:'desc'});if(symbols.length)query.set('symbols',symbols.join(','));
    return fetchJson(`${this.dataBase}/v1beta1/news?${query}`,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'ALPACA_NEWS'});
  }
  async latestQuotes({symbols=[]}={}){
    if(!this.configured())throw new Error('ALPACA_PAPER_CREDENTIALS_MISSING');
    const values=csv(symbols);if(!values.length)throw new Error('ALPACA_SYMBOLS_REQUIRED');
    const query=new URLSearchParams({symbols:values.join(','),feed:'iex'});
    const body=await fetchJson(`${this.dataBase}/v2/stocks/quotes/latest?${query}`,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'ALPACA_QUOTES'});
    return body?.quotes||body||{};
  }
  async latestQuote(symbol){
    const quotes=await this.latestQuotes({symbols:[symbol]});const quote=quotes?.[symbol]||quotes?.[String(symbol).toUpperCase()];if(!quote)throw new Error('ALPACA_QUOTE_NOT_FOUND');
    const bid=Number(quote.bp??quote.bid_price??quote.bidPrice),ask=Number(quote.ap??quote.ask_price??quote.askPrice);if(!(bid>0&&ask>=bid))throw new Error('ALPACA_INVALID_QUOTE');
    return {provider:'Alpaca IEX real-time quote',symbol:String(symbol).toUpperCase(),bid,ask,observedAt:(quote.t??quote.timestamp??isoNow()),bids:[[bid,Number(quote.bs||1)]],asks:[[ask,Number(quote.as||1)]]};
  }
  async stockBars({symbols=csv(process.env.OIL_SYMBOL||'USO'),limit=100}={}){
    if(!this.configured())throw new Error('ALPACA_PAPER_CREDENTIALS_MISSING');
    const query=new URLSearchParams({symbols:symbols.join(','),timeframe:'1Day',limit:String(Math.min(1000,Math.max(10,limit))),feed:'iex',sort:'desc'});
    return fetchJson(`${this.dataBase}/v2/stocks/bars?${query}`,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'ALPACA_STOCK_BARS'});
  }
  async optionContracts({underlying=process.env.OPTIONS_UNDERLYINGS?.split(',')[0]||'SPY',limit=50}={}){
    if(!this.configured())throw new Error('ALPACA_PAPER_CREDENTIALS_MISSING');
    const query=new URLSearchParams({underlying_symbols:underlying,status:'active',limit:String(Math.min(100,Math.max(1,limit))),type:'all'});
    return fetchJson(`${this.tradingBase}/v2/options/contracts?${query}`,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'ALPACA_OPTIONS'});
  }
  async optionQuotes({symbols=[]}={}){
    if(!this.configured())throw new Error('ALPACA_PAPER_CREDENTIALS_MISSING');
    const values=csv(symbols);if(!values.length)throw new Error('ALPACA_OPTION_SYMBOLS_REQUIRED');
    const query=new URLSearchParams({symbols:values.join(',')});
    const body=await fetchJson(`${this.dataBase}/v1beta1/options/quotes/latest?${query}`,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'ALPACA_OPTION_QUOTES'});
    return body?.quotes||body||{};
  }
}

export class OandaPracticeConnector{
  constructor(){this.base=cleanBase(process.env.OANDA_PRACTICE_URL||'https://api-fxpractice.oanda.com');this.streamBase=cleanBase(process.env.OANDA_STREAM_URL||'https://stream-fxpractice.oanda.com');this.token=process.env.OANDA_API_TOKEN||'';this.accountId=process.env.OANDA_ACCOUNT_ID||'';}
  configured(){return Boolean(this.token&&this.accountId);}
  headers(){return {Authorization:`Bearer ${this.token}`};}
  status(){return {id:'oanda-practice',provider:'OANDA v20',mode:'PRACTICE',configured:this.configured(),enabled:true,live:false,liveExecutionReady:false,base:this.base,streamBase:this.streamBase,capabilities:['forex-rates','practice-account','streaming-rates'],credentialsStoredInApp:false,lastProbe:null};}
  async probe(){
    if(!this.configured())return {...this.status(),online:false,readiness:'BLOCKED',error:'OANDA_PRACTICE_CREDENTIALS_MISSING',checkedAt:isoNow()};
    const started=Date.now();
    try{const account=await fetchJson(`${this.base}/v3/accounts/${encodeURIComponent(this.accountId)}/summary`,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'OANDA_PRACTICE'});return {...this.status(),online:true,readiness:'READY',account:{id:account.account?.id,balance:account.account?.balance,nav:account.account?.NAV,currency:account.account?.currency},latencyMs:Date.now()-started,checkedAt:isoNow()};}
    catch(error){return {...this.status(),online:false,readiness:'DEGRADED',error:error?.message||'OANDA_PRACTICE_PROBE_ERROR',latencyMs:Date.now()-started,checkedAt:isoNow()};}
  }
  async prices(instruments=csv(process.env.FX_PAIRS||'EUR_USD,USD_JPY,GBP_USD,AUD_USD')){
    if(!this.configured())throw new Error('OANDA_PRACTICE_CREDENTIALS_MISSING');
    const query=new URLSearchParams({instruments:instruments.join(',')});return fetchJson(`${this.base}/v3/accounts/${encodeURIComponent(this.accountId)}/pricing?${query}`,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'OANDA_PRICES'});
  }
}

export class IbkrPaperConnector{
  constructor(){this.base=cleanBase(process.env.IBKR_GATEWAY_URL||'https://localhost:5000/v1/api');this.accountId=process.env.IBKR_PAPER_ACCOUNT_ID||'';}
  configured(){return Boolean(this.accountId);}
  status(){return {id:'ibkr-paper',provider:'Interactive Brokers Client Portal',mode:'PAPER',configured:this.configured(),enabled:true,live:false,liveExecutionReady:false,base:this.base,capabilities:['stocks','options','futures','paper-account'],credentialsStoredInApp:false,requires:'Client Portal Gateway session on localhost'};}
  async probe(){
    if(!this.configured())return {...this.status(),online:false,readiness:'BLOCKED',error:'IBKR_PAPER_ACCOUNT_ID_MISSING',checkedAt:isoNow()};
    try{const auth=await fetchJson(`${this.base}/iserver/auth/status`,{timeoutMs:5000,retries:0,errorPrefix:'IBKR_GATEWAY'});return {...this.status(),online:Boolean(auth?.authenticated),readiness:auth?.authenticated?'READY':'DEGRADED',auth,checkedAt:isoNow()};}
    catch(error){return {...this.status(),online:false,readiness:'DEGRADED',error:error?.message||'IBKR_GATEWAY_UNAVAILABLE',checkedAt:isoNow()};}
  }
}

export class PublicTradFiDataConnector{
  constructor(){this.yahooBase=cleanBase(process.env.TRADFI_PUBLIC_YAHOO_BASE||'https://query1.finance.yahoo.com');this.fxBase=cleanBase(process.env.TRADFI_PUBLIC_FX_BASE||'https://open.er-api.com/v6');this.newsBase=cleanBase(process.env.NEWS_API_BASE_URL||'https://newsapi.org/v2');this.newsApiKey=process.env.NEWS_API_KEY||'';this.yahooSession=null;this.lastProbe=null;}
  status(){return {id:'public-tradfi-data',provider:'NewsAPI when configured + Yahoo Finance public + ExchangeRate API',mode:'READ_ONLY',configured:true,enabled:true,online:null,live:false,liveExecutionReady:false,capabilities:['stock-bars','indicative-quotes','options-chain','public-news','fx-reference-rates'],newsApiConfigured:Boolean(this.newsApiKey),dataQuality:'INDICATIVE_OR_DELAYED',credentialsStoredInApp:false,warning:'Datos públicos para investigación y PAPER; no habilitan órdenes ni sustituyen un broker.'};}
  async yahooAuth(){
    if(this.yahooSession&&Date.now()-this.yahooSession.createdAt<10*60*1000)return this.yahooSession;
    const headers={'user-agent':'Mozilla/5.0 (compatible; AegisFinanceBrain/1.0)','accept':'text/plain,application/json'};
    const cookieResponse=await fetch('https://fc.yahoo.com',{headers,redirect:'manual'});
    const setCookie=cookieResponse.headers.get('set-cookie')||'';
    const cookie=setCookie.split(';')[0];
    if(!cookie)throw new Error('PUBLIC_YAHOO_COOKIE_UNAVAILABLE');
    const crumbResponse=await fetch(`${this.yahooBase}/v1/test/getcrumb`,{headers:{...headers,cookie}});
    if(!crumbResponse.ok)throw new Error(`PUBLIC_YAHOO_CRUMB_${crumbResponse.status}`);
    const crumb=(await crumbResponse.text()).trim();
    if(!crumb)throw new Error('PUBLIC_YAHOO_CRUMB_EMPTY');
    this.yahooSession={cookie,crumb,createdAt:Date.now()};return this.yahooSession;
  }
  async chart(symbol,{range='6mo',interval='1d'}={}){const encoded=encodeURIComponent(String(symbol).toUpperCase());const body=await fetchJson(`${this.yahooBase}/v8/finance/chart/${encoded}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=div%2Csplits`,{timeoutMs:10000,retries:1,errorPrefix:'PUBLIC_CHART'});const result=body?.chart?.result?.[0];if(!result)throw new Error(body?.chart?.error?.description||'PUBLIC_CHART_EMPTY');const quote=result.indicators?.quote?.[0]||{};const rows=(result.timestamp||[]).map((timestamp,index)=>({t:new Date(timestamp*1000).toISOString(),o:Number(quote.open?.[index]||0),h:Number(quote.high?.[index]||0),l:Number(quote.low?.[index]||0),c:Number(quote.close?.[index]||0),v:Number(quote.volume?.[index]||0)})).filter(row=>row.c>0);return {symbol:String(symbol).toUpperCase(),rows,meta:result.meta||{}};}
  async stockBars({symbols=csv(process.env.OIL_SYMBOL||'USO'),limit=100}={}){const bars={};for(const symbol of symbols){const result=await this.chart(symbol,{range:'6mo',interval:'1d'});bars[result.symbol]=result.rows.slice(-Math.min(1000,Math.max(10,limit)));}return {provider:'Yahoo Finance public chart',source:'PUBLIC_READ_ONLY',bars,observedAt:isoNow(),dataQuality:'DELAYED_OR_INDICATIVE'};}
  async latestQuotes({symbols=[]}={}){const quotes={};for(const symbol of csv(symbols)){const result=await this.chart(symbol,{range:'1d',interval:'5m'});const last=result.rows.at(-1);if(!last)continue;const spread=Math.max(last.c*0.0005,0.01);quotes[result.symbol]={bp:last.c-spread/2,ap:last.c+spread/2,bs:1,as:1,t:last.t,indicative:true};}return quotes;}
  async latestQuote(symbol){const quotes=await this.latestQuotes({symbols:[symbol]});const quote=quotes[String(symbol).toUpperCase()];if(!quote)throw new Error('PUBLIC_QUOTE_NOT_FOUND');return {provider:'Yahoo Finance public indicative quote',symbol:String(symbol).toUpperCase(),bid:Number(quote.bp),ask:Number(quote.ap),observedAt:quote.t,bids:[[Number(quote.bp),1]],asks:[[Number(quote.ap),1]],indicative:true};}
  async news({symbols=csv(process.env.NYSE_NEWS_SYMBOLS||'SPY,QQQ,AAPL,MSFT'),limit=20}={}){
    const size=Math.min(50,Math.max(1,limit));
    if(this.newsApiKey){
      try{const query=new URLSearchParams({q:symbols.join(' OR '),pageSize:String(size),language:'en',sortBy:'publishedAt'});const body=await fetchJson(`${this.newsBase}/everything?${query}`,{headers:{'X-Api-Key':this.newsApiKey,accept:'application/json'},timeoutMs:10000,retries:1,errorPrefix:'NEWS_API'});const rows=(body?.articles||[]).map((item,index)=>({id:item.url||`newsapi-${index}`,headline:item.title||'',title:item.title||'',symbols,created_at:item.publishedAt||null,url:item.url||null,publisher:item.source?.name||null,source:'NEWS_API_READ_ONLY'})).filter(item=>item.headline);if(rows.length)return {provider:'NewsAPI public',news:rows,observedAt:isoNow(),dataQuality:'PUBLIC_API_FEED'};}
      catch(error){this.lastNewsError=error?.message||'NEWS_API_UNAVAILABLE';}
    }
    const query=encodeURIComponent(symbols.join(','));const body=await fetchJson(`${this.yahooBase}/v1/finance/search?q=${query}&newsCount=${size}&quotesCount=0`,{timeoutMs:10000,retries:1,errorPrefix:'PUBLIC_NEWS'});return {provider:'Yahoo Finance public news',news:(body?.news||[]).slice(0,size).map(item=>({id:item.uuid||item.link||item.title,headline:item.title||'',title:item.title||'',symbols:item.relatedTickers||symbols,created_at:item.providerPublishTime?new Date(item.providerPublishTime*1000).toISOString():null,url:item.link||null,publisher:item.publisher||null,source:'PUBLIC_NEWS_READ_ONLY'})),observedAt:isoNow(),dataQuality:'PUBLIC_FEED',fallbackFrom:this.newsApiKey?this.lastNewsError||'NEWS_API_EMPTY':null};
  }
  async optionContracts({underlying=process.env.OPTIONS_UNDERLYINGS?.split(',')[0]||'SPY',limit=100}={}){
    const symbol=String(underlying).toUpperCase();let body=null;
    for(let attempt=0;attempt<2;attempt++){
      try{const session=await this.yahooAuth();const query=new URLSearchParams({crumb:session.crumb});body=await fetchJson(`${this.yahooBase}/v7/finance/options/${encodeURIComponent(symbol)}?${query}`,{headers:{cookie:session.cookie,'user-agent':'Mozilla/5.0 (compatible; AegisFinanceBrain/1.0)','accept':'application/json'},timeoutMs:10000,retries:1,errorPrefix:'PUBLIC_OPTIONS'});break;}
      catch(error){this.yahooSession=null;if(attempt===1)throw error;}
    }
    const result=body?.optionChain?.result?.[0];if(!result)throw new Error('PUBLIC_OPTIONS_EMPTY');const chain=result.options?.[0]||{};const rows=[...(chain.calls||[]).map(item=>({...item,type:'call'})),...(chain.puts||[]).map(item=>({...item,type:'put'}))].slice(0,Math.min(200,Math.max(1,limit))).map(item=>({contractSymbol:item.contractSymbol,type:item.type,strike:Number(item.strike||0),expiration:item.expirationDate?new Date(item.expirationDate*1000).toISOString():null,bid:Number(item.bid||0),ask:Number(item.ask||0),last:Number(item.lastPrice||0),volume:Number(item.volume||0),openInterest:Number(item.openInterest||0),impliedVolatility:Number(item.impliedVolatility||0),inTheMoney:Boolean(item.inTheMoney),source:'PUBLIC_OPTIONS_READ_ONLY'}));return {provider:'Yahoo Finance public options chain',underlying:symbol,contracts:rows,expirationDates:(result.expirationDates||[]).map(item=>new Date(item*1000).toISOString()),observedAt:isoNow(),dataQuality:'PUBLIC_CHAIN_NOT_BROKER_QUOTE'};
  }
  async fxPrices(instruments=csv(process.env.FX_PAIRS||'EUR_USD,USD_JPY,GBP_USD,AUD_USD')){const body=await fetchJson(`${this.fxBase}/latest/USD`,{timeoutMs:8000,retries:1,errorPrefix:'PUBLIC_FX'});const rates=body?.rates||{};const prices=instruments.map(instrument=>{const [base,quote]=String(instrument).toUpperCase().split('_');const usdBase=base==='USD'?1:1/Number(rates[base]||0);const value=quote==='USD'?usdBase:Number(rates[quote]||0)*usdBase;const spread=Math.max(value*0.0003,0.00001);return {instrument, bid:value-spread/2,ask:value+spread/2,mid:value,observedAt:body?.time_last_update_utc||isoNow(),provider:'ExchangeRate API public reference',indicative:true};}).filter(item=>item.mid>0);return {provider:'ExchangeRate API public reference',prices,base:'USD',observedAt:isoNow(),dataQuality:'REFERENCE_RATE_NOT_TICK'};}
  async probe(){const started=Date.now();try{const [bars,fx]=await Promise.all([this.stockBars({symbols:['SPY'],limit:2}),this.fxPrices(['EUR_USD'])]);const result={...this.status(),online:Boolean(bars?.bars?.SPY?.length&&fx?.prices?.length),readiness:'READY',latencyMs:Date.now()-started,checkedAt:isoNow(),lastProbe:isoNow()};this.lastProbe=result;return result;}catch(error){const result={...this.status(),online:false,readiness:'DEGRADED',error:error?.message||'PUBLIC_TRADFI_UNAVAILABLE',latencyMs:Date.now()-started,checkedAt:isoNow()};this.lastProbe=result;return result;}}
}

export class PublicDiscoveryConnector{
  constructor({chainId,rpcUrl,solanaRpc}={}){this.chainId=chainId;this.rpcUrl=rpcUrl;this.solanaRpc=solanaRpc;this.query=chainId==='solana'?(process.env.MEME_SOLANA_DISCOVERY_QUERY||'SOL'):(process.env.MEME_POLYGON_DISCOVERY_QUERY||'POLY');}
  status(){return {id:`${this.chainId}-public-discovery`,provider:'DexScreener + public RPC',mode:'READ_ONLY',configured:true,online:null,live:false,executionRpcConfigured:Boolean(this.chainId==='solana'?process.env.MEME_SOLANA_FAST_RPC:process.env.MEME_POLYGON_FAST_RPC),publicRpc:this.chainId==='solana'?(this.solanaRpc?.url||'https://api.mainnet-beta.solana.com'):this.rpcUrl,capabilities:['token-discovery','pair-liquidity','read-only'],warning:'El RPC público solo descubre/verifica; no se usa para firmar órdenes.'};}
  async health(){
    try{
      if(this.chainId==='solana'){const ping=await this.solanaRpc.ping();return {...this.status(),online:ping.online,rpc:ping};}
      const started=Date.now();const body={jsonrpc:'2.0',id:Date.now(),method:'eth_blockNumber',params:[]};const response=await fetchJson(this.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),timeoutMs:7000,retries:1,errorPrefix:'POLYGON_DISCOVERY_RPC'});return {...this.status(),online:Boolean(response?.result),rpc:{blockNumber:response?.result,latencyMs:Date.now()-started}};
    }catch(error){return {...this.status(),online:false,error:error?.message||'DISCOVERY_RPC_UNAVAILABLE'};}
  }
  async search(){
    let pairs=[];
    if(['solana','polygon'].includes(this.chainId)){
      try{
        const feedUrls=['token-profiles/latest/v1','token-boosts/latest/v1'];
        const responses=await Promise.allSettled(feedUrls.map(path=>fetchJson(`https://api.dexscreener.com/${path}`,{timeoutMs:8000,retries:1,errorPrefix:'DEXSCREENER_LAUNCH_FEED'})));
        const addresses=[...new Set(responses.flatMap(result=>result.status==='fulfilled'&&Array.isArray(result.value)?result.value:[]).filter(item=>String(item?.chainId||'').toLowerCase()===this.chainId).map(item=>item.tokenAddress).filter(Boolean))].slice(0,30);
        if(addresses.length){
          const body=await fetchJson(`https://api.dexscreener.com/tokens/v1/${this.chainId}/${encodeURIComponent(addresses.join(','))}`,{timeoutMs:10000,retries:1,errorPrefix:'DEXSCREENER_LAUNCH_PAIRS'});
          pairs=Array.isArray(body)?body:(body?.pairs||[]);
        }
      }catch{}
    }
    if(!pairs.length){
      const query=encodeURIComponent(this.query);const body=await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${query}`,{timeoutMs:8000,retries:1,errorPrefix:'DEXSCREENER'});pairs=body?.pairs||[];
    }
    const normalized=pairs.filter(pair=>String(pair.chainId).toLowerCase()===this.chainId).map(pair=>{
      const txns=window=>pair.txns?.[window]||{};const createdAt=Number(pair.pairCreatedAt||0);const ageMinutes=createdAt>0?Math.max(0,(Date.now()-createdAt)/60000):null;
      const m5=txns('m5'),h1=txns('h1'),h24=txns('h24');
      return {chainId:pair.chainId,dexId:pair.dexId,pairAddress:pair.pairAddress,baseToken:pair.baseToken,quoteToken:pair.quoteToken,priceUsd:Number(pair.priceUsd||0),liquidityUsd:Number(pair.liquidity?.usd||0),volume5mUsd:Number(pair.volume?.m5||0),volume1hUsd:Number(pair.volume?.h1||0),volume24hUsd:Number(pair.volume?.h24||0),priceChange5m:Number(pair.priceChange?.m5||0),priceChange1h:Number(pair.priceChange?.h1||0),priceChange6h:Number(pair.priceChange?.h6||0),priceChange24h:Number(pair.priceChange?.h24||0),fdv:Number(pair.fdv||0),marketCap:Number(pair.marketCap||0),pairCreatedAt:createdAt?new Date(createdAt).toISOString():null,ageMinutes,buys5m:Number(m5.buys||0),sells5m:Number(m5.sells||0),txns5m:Number(m5.buys||0)+Number(m5.sells||0),buys1h:Number(h1.buys||0),sells1h:Number(h1.sells||0),txns1h:Number(h1.buys||0)+Number(h1.sells||0),buys24h:Number(h24.buys||0),sells24h:Number(h24.sells||0),txns24h:Number(h24.buys||0)+Number(h24.sells||0),boostActive:Number(pair.boosts?.active||0),url:pair.url,info:pair.info};
    });
    const best=new Map();for(const pair of normalized){const mint=pair.baseToken?.address||pair.pairAddress;if(!mint)continue;const current=best.get(mint);if(!current||pair.liquidityUsd>current.liquidityUsd)best.set(mint,pair);}return [...best.values()].sort((a,b)=>(b.txns5m+b.volume1hUsd/1000)-(a.txns5m+a.volume1hUsd/1000)).slice(0,30);
  }
}

export class PolygonPaperQuoteConnector{
  constructor(){this.base=cleanBase(process.env.POLYGON_QUOTE_API_BASE||'https://api.0x.org');this.apiKey=String(process.env.ZEROX_API_KEY||process.env.POLYGON_QUOTE_API_KEY||'');this.chainId=137;this.usdc=process.env.POLYGON_PAPER_USDC_ADDRESS||'0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';}
  configured(){return Boolean(this.apiKey);}
  status(){return {id:'polygon-paper-quotes',provider:'0x Swap API',mode:'PAPER_READ_ONLY',configured:this.configured(),online:null,live:false,liveExecutionReady:false,chainId:this.chainId,base:this.base,capabilities:['polygon-token-quotes','paper-entry-exit-pricing'],warning:'Solo cotiza; no firma ni envía transacciones.'};}
  async quote({inputToken,outputToken,amount,inputDecimals=6,outputDecimals=18,slippageBps=100}={}){
    if(!this.configured())throw new Error('POLYGON_QUOTE_API_KEY_MISSING');if(!inputToken||!outputToken||!amount)throw new Error('POLYGON_QUOTE_PARAMETERS_REQUIRED');
    const url=new URL(`${this.base}/swap/permit2/price`);for(const [key,value] of Object.entries({chainId:this.chainId,sellToken:inputToken,buyToken:outputToken,sellAmount:amount,slippageBps}))url.searchParams.set(key,String(value));const headers={accept:'application/json','0x-api-key':this.apiKey};const body=await fetchJson(url,{headers,timeoutMs:10000,retries:2,errorPrefix:'POLYGON_0X_QUOTE'});if(!body?.buyAmount)throw new Error(body?.validationErrors?.[0]?.reason||body?.reason||'POLYGON_QUOTE_EMPTY');return {...body,inputToken,outputToken,inputDecimals,outputDecimals,observedAt:isoNow(),provider:'0x Swap API Polygon'};
  }
}

export const alpacaPaper=new AlpacaPaperConnector();
export const oandaPractice=new OandaPracticeConnector();
export const ibkrPaper=new IbkrPaperConnector();
export const publicTradFi=new PublicTradFiDataConnector();
export const polygonPaperQuotes=new PolygonPaperQuoteConnector();
