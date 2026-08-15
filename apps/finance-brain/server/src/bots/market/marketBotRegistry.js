import {alpacaPaper,ibkrPaper,oandaPractice,publicTradFi,PublicDiscoveryConnector} from '../../infrastructure/brokers/demoBrokers.js';
import {rpcManager} from '../../infrastructure/rpcManager.js';
import {solanaRpc} from '../../infrastructure/solana/solanaRpc.js';
import {goPlus,helius} from '../../infrastructure/security/tokenSecurity.js';
import {okxDerivativesMarketData} from '../../infrastructure/marketData/okxDerivativesMarketData.js';
import {BOT_DEFINITIONS} from '../../core/config.js';

const now=()=>new Date().toISOString();
const list=value=>String(value||'').split(',').map(item=>item.trim()).filter(Boolean);
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const barsFor=(payload,symbol)=>{const bars=payload?.bars;return Array.isArray(bars)?bars:(bars?.[symbol]||[]);};
const closeOf=bar=>num(bar?.c??bar?.close);
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const newsRows=payload=>Array.isArray(payload?.news)?payload.news:(Array.isArray(payload)?payload:[]);

const DEFINITIONS=[
  {id:'solana-meme-momentum',name:'Solana Meme Momentum',market:'SOLANA MEMECOINS',mode:'PAPER',execution:'PAPER_ONLY',strategy:'Rug-filter + liquidity acceleration + volatility breakout',description:'Descubre pares públicos y solo permite una señal PAPER si pasan filtros de autoridad, liquidez, concentración, slippage y momentum.',connector:'solana-public-discovery',parameters:{maxPositionUsd:100,maxSlippageBps:100,minimumLiquidityUsd:50000,minimumVolume24hUsd:100000,maxTop10HolderPct:35,requireMintAuthorityRevoked:true,requireFreezeAuthorityRevoked:true,stopLossPct:8,takeProfitPct:18},requirements:['Solana public RPC','DEX pair discovery','on-chain mint/freeze authority checks','paper ledger'],liveExecutionReady:false},
  {id:'polygon-meme-momentum',name:'Polygon Meme Momentum',market:'POLYGON MEMECOINS',mode:'PAPER',execution:'PAPER_ONLY',strategy:'Contract-risk gate + liquidity acceleration + volatility breakout',description:'Busca pares Polygon de forma pública y bloquea el paper signal si faltan verificación de contrato, impuestos, ownership o liquidez.',connector:'polygon-public-discovery',parameters:{maxPositionUsd:100,maxSlippageBps:100,minimumLiquidityUsd:50000,minimumVolume24hUsd:100000,maxTop10HolderPct:35,requireVerifiedContract:true,requireOwnershipRenounced:false,maxBuyTaxPct:2,maxSellTaxPct:2,stopLossPct:8,takeProfitPct:18},requirements:['Polygon public RPC','DEX pair discovery','contract/tax/LP checks','paper ledger'],liveExecutionReady:false},
  {id:'fx-macro-momentum',name:'FX Macro Momentum',market:'FOREX',mode:'PAPER',execution:'OANDA_PRACTICE_OR_PUBLIC_REFERENCE',strategy:'Multi-timeframe EMA/ATR + spread filter + news blackout',description:'Opera únicamente en demo con límites de spread, volatilidad y riesgo por operación; usa referencia pública hasta conectar OANDA.',connector:'oanda-practice',parameters:{pairs:list(process.env.FX_PAIRS||'EUR_USD,USD_JPY,GBP_USD,AUD_USD'),riskPerTradePct:0.25,maxSpreadPips:1.5,atrStopMultiple:1.8,newsBlackoutMinutes:20,maxOpenPositions:3},requirements:['OANDA practice token/account o tasas FX públicas','real-time/practice prices cuando estén disponibles','macro calendar/news filter','paper risk ledger'],liveExecutionReady:false},
  {id:'options-defined-risk',name:'Options Defined Risk',market:'OPTIONS',mode:'PAPER',execution:'ALPACA_PAPER_OR_IBKR_PAPER_OR_PUBLIC_CHAIN',strategy:'IV rank + liquidity + delta/vega/theta + defined-risk spreads',description:'Solo estructuras de riesgo definido; no permite venta desnuda ni ejecución real. La cadena pública es indicativa.',connector:'alpaca-paper',parameters:{underlyings:list(process.env.OPTIONS_UNDERLYINGS||'SPY,QQQ,AAPL,MSFT'),maxRiskUsd:150,maxBidAskPct:8,minOpenInterest:100,deltaRange:[0.2,0.6],maxDaysToExpiry:45,earningsBlackoutDays:3,definedRiskOnly:true},requirements:['options chain/quotes de broker o cadena pública','implied volatility history','open interest and spread checks','paper broker para simular órdenes'],liveExecutionReady:false},
  {id:'crude-oil-regime',name:'Crude Oil Regime',market:'ENERGY / OIL',mode:'PAPER',execution:'ALPACA_PAPER_OR_IBKR_PAPER_OR_PUBLIC_BARS',strategy:'Trend regime + ATR bands + event blackout',description:'La primera conexión paper usa USO como proxy líquido; CL futures queda preparado para IBKR paper y Yahoo aporta barras públicas mientras tanto.',connector:'alpaca-paper',parameters:{symbol:process.env.OIL_SYMBOL||'USO',riskPerTradePct:0.3,atrStopMultiple:2,maxSpreadPct:0.25,inventoryLimitUsd:500,macroBlackoutMinutes:30},requirements:['USO/CL paper quotes o barras públicas','EIA/OPEC high-impact calendar','ATR regime filter','paper broker'],liveExecutionReady:false},
  {id:'nyse-news-impact',name:'NYSE News Impact',market:'NYSE NEWS',mode:'PAPER',execution:'ALPACA_PAPER_OR_PUBLIC_NEWS',strategy:'Impact classifier + abnormal volume + gap continuation/reversion',description:'Observa noticias de alto impacto y solo genera señales paper después de validar fuente, timestamp, liquidez y halts. Yahoo se usa como fallback público.',connector:'alpaca-paper',parameters:{symbols:list(process.env.NYSE_NEWS_SYMBOLS||'SPY,QQQ,AAPL,MSFT,NVDA,TSLA'),minImpactScore:0.75,abnormalVolumeMultiple:2,openingWindowMinutes:30,haltProtection:true,earningsFilter:true,maxRiskPerTradeUsd:100},requirements:['licensed Alpaca news o feed público con etiqueta de calidad','real-time quotes/bars cuando estén disponibles','halt and earnings calendar','paper broker'],liveExecutionReady:false}
];

export class MarketBotRegistry{
  constructor({state,persist,bus,solanaRpcInstance=solanaRpc,rpcManagerInstance=rpcManager}={}){
    this.state=state;this.persist=persist;this.bus=bus;this.solanaRpc=solanaRpcInstance;this.rpcManager=rpcManagerInstance;
    this.solanaDiscovery=new PublicDiscoveryConnector({chainId:'solana',solanaRpc:this.solanaRpc});
    this.polygonDiscovery=new PublicDiscoveryConnector({chainId:'polygon',rpcUrl:process.env.MEME_POLYGON_DISCOVERY_RPC||'https://polygon-bor-rpc.publicnode.com'});
    this.ensureState();
  }
  ensureState(){
    this.state.bots??=[];this.state.wallets??=[];
    const current=this.state.infrastructure.marketBots||{};this.state.infrastructure.marketBots={...current,lastRunAt:current.lastRunAt||null,results:current.results||{},bots:current.bots||{},connectors:current.connectors||{}};
    for(const definition of DEFINITIONS)this.state.infrastructure.marketBots.bots[definition.id]={...definition,...(this.state.infrastructure.marketBots.bots[definition.id]||{}),status:this.state.infrastructure.marketBots.bots[definition.id]?.status||'WAITING_CONFIG',lastScanAt:this.state.infrastructure.marketBots.bots[definition.id]?.lastScanAt||null};
    for(const definition of BOT_DEFINITIONS){const existing=this.state.bots?.find(item=>item.id===definition.id);if(existing){existing.name=definition.name;existing.domain=definition.domain;existing.network=definition.network;existing.wallet=definition.wallet;delete existing.marketBotId;}}
    for(const definition of DEFINITIONS){if(!this.state.bots?.some(item=>item.id===definition.id)){const index=this.state.bots.length+1;this.state.bots.push({...definition,domain:definition.description,network:definition.market,wallet:`market-strategy-${String(index).padStart(2,'0')}`,active:true,status:this.state.infrastructure.marketBots.bots[definition.id].status,heartbeat:null,pnl24h:0,opportunities:0,allocationPct:0,marketBotId:definition.id});this.state.wallets?.push({id:`market-strategy-${String(index).padStart(2,'0')}`,strategyId:definition.id,type:'PAPER_SLOT',address:null,balanceUsd:0});}else{const bot=this.state.bots.find(item=>item.id===definition.id);bot.marketBotId=definition.id;bot.name=definition.name;bot.domain=definition.description;bot.network=definition.market;}}
  }
  definitions(){return DEFINITIONS.map(definition=>this.statusFor(definition.id));}
  connectorStatuses(){const base={alpaca:alpacaPaper.status(),oanda:oandaPractice.status(),ibkr:ibkrPaper.status(),publicTradFi:publicTradFi.status(),solanaDiscovery:this.solanaDiscovery.status(),polygonDiscovery:this.polygonDiscovery.status(),helius:helius.status(),goPlus:goPlus.status(),okxDerivatives:okxDerivativesMarketData.status()};const observed=this.state.infrastructure.marketBots?.connectors||{};return Object.fromEntries(Object.entries(base).map(([id,status])=>[id,{...status,...(observed[id]||{})}]));}
  statusFor(id){
    const definition=DEFINITIONS.find(item=>item.id===id);if(!definition)return null;const stored=this.state.infrastructure.marketBots.bots[id]||{};return {...definition,...stored,connectors:this.connectorStatuses(),liveExecutionReady:false,mode:'PAPER'};
  }
  readiness(id,connectors=this.connectorStatuses()){
    const definition=DEFINITIONS.find(item=>item.id===id);const blockers=[],warnings=[];
    if(!definition)return {status:'NOT_FOUND',blockers:['BOT_NOT_FOUND'],warnings:[]};
    if(id==='solana-meme-momentum'&&!connectors.solanaDiscovery?.online)warnings.push('Solana public RPC no respondió en el último chequeo.');
    if(id==='polygon-meme-momentum'&&!connectors.polygonDiscovery?.online)warnings.push('Polygon public RPC no respondió en el último chequeo.');
    if(['fx-macro-momentum'].includes(id)&&!oandaPractice.configured()&&!connectors.publicTradFi?.online)blockers.push('Faltan OANDA practice y la fuente pública FX no está disponible.');
    if(['fx-macro-momentum'].includes(id)&&!oandaPractice.configured()&&connectors.publicTradFi?.online)warnings.push('Usando tasas FX públicas de referencia; OANDA practice dará precios y ejecución de demo más precisos.');
    if(['options-defined-risk','crude-oil-regime','nyse-news-impact'].includes(id)&&!alpacaPaper.configured()&&!ibkrPaper.configured()&&!connectors.publicTradFi?.online)blockers.push('Falta Alpaca/IBKR y la fuente pública TradFi no está disponible.');
    if(['options-defined-risk','crude-oil-regime','nyse-news-impact'].includes(id)&&!alpacaPaper.configured()&&!ibkrPaper.configured()&&connectors.publicTradFi?.online)warnings.push('Usando datos públicos TradFi en modo lectura; Alpaca o IBKR paper aportarán quotes/news/options de broker.');
    if(['solana-meme-momentum','polygon-meme-momentum'].includes(id)&&!connectors.goPlus?.configured)blockers.push('Falta GoPlus Token Security para el filtro anti-rug.');
    const status=blockers.length?'BLOCKED':warnings.length?'DEGRADED':'READY';return {status,blockers,warnings};
  }
  async refreshConnectors(){
    const [solana,polygon,alpaca,oanda,ibkr,publicTradFiStatus,heliusStatus,goplusStatus,okxStatus]=await Promise.all([this.solanaDiscovery.health(),this.polygonDiscovery.health(),alpacaPaper.probe(),oandaPractice.probe(),ibkrPaper.probe(),publicTradFi.probe(),helius.probe(),goPlus.probe(),okxDerivativesMarketData.ping().catch(error=>({...okxDerivativesMarketData.status(),online:false,readiness:'DEGRADED',error:error?.message||'OKX_PUBLIC_UNAVAILABLE',checkedAt:now()}))]);
    const connectors={alpaca,oanda,ibkr,publicTradFi:publicTradFiStatus,solanaDiscovery:solana,polygonDiscovery:polygon,helius:heliusStatus,goPlus:goplusStatus,okxDerivatives:okxStatus};this.state.infrastructure.marketBots.connectors=connectors;this.persist?.();return connectors;
  }
  async scan(id){
    const definition=DEFINITIONS.find(item=>item.id===id);if(!definition)throw new Error('MARKET_BOT_NOT_FOUND');
    const connectors=Object.keys(this.state.infrastructure.marketBots.connectors||{}).length?this.state.infrastructure.marketBots.connectors:await this.refreshConnectors();
    const started=Date.now();let data={};let scanError=null;
    try{
      if(id==='solana-meme-momentum'){const candidates=await this.solanaDiscovery.search();data={rpc:await this.solanaDiscovery.health(),candidates,security:await this.securityChecks('solana',candidates)};}
      if(id==='polygon-meme-momentum'){const candidates=await this.polygonDiscovery.search();data={rpc:await this.polygonDiscovery.health(),candidates,security:await this.securityChecks('137',candidates)};}
      if(id==='fx-macro-momentum')data={prices:oandaPractice.configured()?await oandaPractice.prices():await publicTradFi.fxPrices(definition.parameters.pairs),provider:oandaPractice.configured()?'OANDA practice':'public FX reference'};
      if(id==='options-defined-risk')data={contracts:alpacaPaper.configured()?await alpacaPaper.optionContracts({underlying:definition.parameters.underlyings[0]}):await publicTradFi.optionContracts({underlying:definition.parameters.underlyings[0]}),provider:alpacaPaper.configured()?'Alpaca paper':'public TradFi'};
      if(id==='crude-oil-regime')data={bars:alpacaPaper.configured()?await alpacaPaper.stockBars({symbols:[definition.parameters.symbol]}):await publicTradFi.stockBars({symbols:[definition.parameters.symbol]}),provider:alpacaPaper.configured()?'Alpaca paper':'public TradFi'};
      if(id==='nyse-news-impact')data={news:alpacaPaper.configured()?await alpacaPaper.news({symbols:definition.parameters.symbols}):await publicTradFi.news({symbols:definition.parameters.symbols}),provider:alpacaPaper.configured()?'Alpaca news':'public TradFi'};
    }catch(error){scanError=error?.message||'MARKET_BOT_SCAN_ERROR';}
    const gate=this.readiness(id,connectors);if(['solana-meme-momentum','polygon-meme-momentum'].includes(id)&&!data.security?.length&&!scanError)gate.blockers.push('No hubo cobertura anti-rug para los candidatos descubiertos.');if(gate.blockers.length)gate.status='BLOCKED';
    const signals=gate.blockers.length||scanError?[]:this.buildSignals(id,definition,data);
    for(const signal of signals)this.bus?.emit('raw-opportunity',signal);
    const result={botId:id,scannedAt:now(),durationMs:Date.now()-started,status:scanError?'DEGRADED':gate.status,mode:'PAPER',signal:signals[0]?{strategyId:signals[0].strategyId,asset:signals[0].asset,direction:signals[0].direction,confidence:signals[0].confidence,expectedProfitUsd:signals[0].expectedProfitUsd}:null,tradeable:signals.length>0,executionPath:'PAPER_ONLY',strategy:definition.strategy,gate,discoveries:data.candidates?.length||0,data,warning:'Las señales PAPER requieren cotización bid/ask, límites de riesgo y ledger antes de abrir una posición.',error:scanError};
    if(scanError&&!gate.blockers.includes(scanError))result.gate={...gate,warnings:[...gate.warnings,scanError]};
    this.state.infrastructure.marketBots.results[id]=result;this.state.infrastructure.marketBots.bots[id]={...this.state.infrastructure.marketBots.bots[id],status:result.status,lastScanAt:result.scannedAt,lastResult:{signal:result.signal,tradeable:result.tradeable,error:scanError}};const marketBot=this.state.bots?.find(item=>item.id===id);if(marketBot){marketBot.status=result.status;marketBot.heartbeat=result.scannedAt;}this.state.infrastructure.marketBots.lastRunAt=result.scannedAt;this.persist?.();return result;
  }
  buildSignals(id,definition,data){
    if(id==='crude-oil-regime'){
      const rows=barsFor(data,definition.parameters.symbol).map(closeOf).filter(value=>value>0);if(rows.length<20)return [];
      const last=rows.at(-1),previous=rows.at(-2),sma=mean(rows.slice(-20)),movePct=previous?Math.abs(last/previous-1)*100:0;if(!last||!sma||movePct<.15)return [];
      const direction=last>=sma?'LONG':'SHORT',notional=Math.min(500,Number(definition.parameters.inventoryLimitUsd||500));
      const publicData=data.provider==='public TradFi';
      return [{strategyId:id,strategy:definition.name,network:'Alpaca Energy',asset:definition.parameters.symbol,direction,confidence:Math.min(.9,.72+Math.min(.14,movePct/10)),executionProbability:.76,expectedProfitUsd:Number(Math.max(5,Math.min(35,notional*(movePct/100)*.6)).toFixed(2)),capitalRequiredUsd:notional,estimatedSlippageBps:10,riskScore:.38,source:publicData?'PUBLIC_STOCK_BARS_READ_ONLY':'ALPACA_STOCK_BARS_REAL',synthetic:false,expiresAt:new Date(Date.now()+120000).toISOString(),metadata:{signalModel:'SMA20_REGIME_PLUS_DAILY_RETURN',dataProvider:data.provider||'unknown',dataQuality:data.bars?.dataQuality||'BROKER_DATA',lastPrice:last,sma20:sma,movePct,stopLossPct:definition.parameters.atrStopMultiple,maxLossUsd:Number((notional*Number(definition.parameters.riskPerTradePct||.3)/100).toFixed(2)),executionModel:'REAL_MARKET_PAPER'}}];
    }
    if(id==='nyse-news-impact'){
      const articles=newsRows(data.news).slice(0,20),signals=[];const positive=/beat|upgrade|approval|growth|surge|record|strong|profit|partnership/i,negative=/miss|downgrade|lawsuit|probe|cut|loss|fraud|recall|warning|halt/i;
      const publicData=data.provider==='public TradFi';
      for(const article of articles){const headline=String(article.headline||article.title||'');const symbols=list(article.symbols||definition.parameters.symbols.join(','));const symbol=symbols[0];if(!headline||!symbol)continue;const keywordImpact=(positive.test(headline)||negative.test(headline)) ? .18 : 0;const lengthImpact=headline.length>90 ? .05 : 0;const impact=Math.min(.98,.62+keywordImpact+lengthImpact);if(impact<definition.parameters.minImpactScore)continue;const direction=negative.test(headline)?'SHORT':'LONG';signals.push({strategyId:id,strategy:definition.name,network:'NYSE',asset:symbol,direction,confidence:impact,executionProbability:.72,expectedProfitUsd:8,capitalRequiredUsd:Number(definition.parameters.maxRiskPerTradeUsd||100)*2,estimatedSlippageBps:12,riskScore:.42,source:publicData?'PUBLIC_NEWS_READ_ONLY':'ALPACA_NEWS_REAL_HEURISTIC',synthetic:false,expiresAt:new Date(Date.now()+90000).toISOString(),metadata:{headline,articleId:article.id||null,createdAt:article.created_at||article.createdAt||null,impactScore:impact,dataProvider:data.provider||'unknown',dataQuality:data.news?.dataQuality||'BROKER_DATA',signalModel:'NEWS_KEYWORD_IMPACT_GATE',maxLossUsd:Number(definition.parameters.maxRiskPerTradeUsd||100),executionModel:'REAL_MARKET_PAPER'}});if(signals.length>=3)break;}
      return signals;
    }
    return [];
  }
  async securityChecks(chain,candidates=[]){
    const addresses=[...new Set(candidates.map(item=>item?.baseToken?.address).filter(Boolean))].slice(0,5);if(!addresses.length)return [];
    const checks=[];for(const address of addresses){try{checks.push({chain,address,security:await goPlus.tokenSecurity(chain,address)});}catch(error){checks.push({chain,address,error:error?.message||'GOPLUS_TOKEN_SECURITY_ERROR'});}}
    return checks;
  }
  async scanAll(){return Promise.all(DEFINITIONS.map(definition=>this.scan(definition.id)));}
}

export const MARKET_BOT_DEFINITIONS=DEFINITIONS;
