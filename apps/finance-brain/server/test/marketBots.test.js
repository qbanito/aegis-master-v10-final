import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketBotRegistry,MARKET_BOT_DEFINITIONS} from '../src/bots/market/marketBotRegistry.js';
import {BinanceFuturesMarketData} from '../src/infrastructure/marketData/binanceFuturesMarketData.js';
import {OkxDerivativesMarketData} from '../src/infrastructure/marketData/okxDerivativesMarketData.js';
import {GoPlusConnector} from '../src/infrastructure/security/tokenSecurity.js';

const makeState=()=>({infrastructure:{}});

test('specialized market registry exposes six paper strategies with live execution locked',()=>{
  const registry=new MarketBotRegistry({state:makeState(),persist:()=>{}});
  assert.equal(MARKET_BOT_DEFINITIONS.length,6);
  assert.equal(registry.definitions().length,6);
  assert.deepEqual(registry.definitions().map(bot=>bot.mode),Array(6).fill('PAPER'));
  assert.equal(registry.definitions().every(bot=>bot.liveExecutionReady===false),true);
  assert.match(registry.definitions().find(bot=>bot.id==='solana-meme-momentum').strategy,/Rug-filter/);
});

test('meme scan returns real candidates but never makes them tradeable without anti-rug verification',async()=>{
  const registry=new MarketBotRegistry({state:makeState(),persist:()=>{}});
  registry.solanaDiscovery={health:async()=>({online:true}),search:async()=>[{chainId:'solana',baseToken:{symbol:'TEST'},liquidityUsd:100000}]};
  registry.polygonDiscovery={health:async()=>({online:true}),search:async()=>[]};
  const result=await registry.scan('solana-meme-momentum');
  assert.equal(result.discoveries,1);
  assert.equal(result.signal,null);
  assert.equal(result.tradeable,false);
  assert.equal(result.status,'BLOCKED');
  assert.match(result.gate.blockers[0],/anti-rug/);
});

test('solana meme momentum emits a confirmed PAPER signal for a safe accelerating pair',async()=>{
  const emitted=[];const state=makeState();state.infrastructure.marketBots={connectors:{solanaDiscovery:{online:true},goPlus:{configured:true}}};
  const registry=new MarketBotRegistry({state,persist:()=>{},bus:{emit:(name,payload)=>{if(name==='raw-opportunity')emitted.push(payload);}}});
  registry.solanaDiscovery={health:async()=>({online:true}),search:async()=>[{chainId:'solana',dexId:'raydium',pairAddress:'PAIR',baseToken:{address:'MINT',symbol:'MOMO',name:'Momo'},quoteToken:{symbol:'USDC'},pairCreatedAt:Date.now()-10*60000,priceUsd:'.001',liquidityUsd:500000,volume5mUsd:100000,volume24hUsd:2000000,priceChange5m:5,priceChange1h:25,buys5m:30,sells5m:10,txns5m:40}]};
  registry.securityChecks=async()=>[{chain:'solana',address:'MINT',security:{mint:'MINT',decimals:6,securityStatus:'AUDITED',securityFlags:[],mintAuthorityRevoked:true,freezeAuthorityRevoked:true,top10HolderPct:18}}];
  const first=await registry.scan('solana-meme-momentum');const second=await registry.scan('solana-meme-momentum');
  assert.equal(first.tradeable,false);assert.equal(first.rejectedCandidates[0].blockers.includes('SIGNAL_CONFIRMATION_REQUIRED'),true);
  assert.equal(second.tradeable,true);assert.equal(second.signal.strategyId,'solana-meme-momentum');assert.equal(second.signal.direction,'LONG');assert.equal(emitted.length,1);assert.equal(emitted[0].synthetic,false);assert.equal(emitted[0].metadata.paperPlan.paperOnly,true);assert.equal(emitted[0].metadata.outputMint,'MINT');
});

test('solana meme momentum rejects active authorities and holder concentration',async()=>{
  const state=makeState();state.infrastructure.marketBots={connectors:{solanaDiscovery:{online:true},goPlus:{configured:true}}};
  const registry=new MarketBotRegistry({state,persist:()=>{}});registry.solanaDiscovery={health:async()=>({online:true}),search:async()=>[{chainId:'solana',baseToken:{address:'RISK',symbol:'RISK'},pairCreatedAt:Date.now()-10*60000,liquidityUsd:500000,volume5mUsd:100000,volume24hUsd:2000000,priceChange5m:5,priceChange1h:25,buys5m:30,sells5m:10,txns5m:40}]};registry.securityChecks=async()=>[{chain:'solana',address:'RISK',security:{securityStatus:'AUDITED',securityFlags:[],mintAuthorityRevoked:false,freezeAuthorityRevoked:false,top10HolderPct:62}}];
  const result=await registry.scan('solana-meme-momentum');const reasons=result.rejectedCandidates.flatMap(item=>item.blockers);
  assert.equal(result.tradeable,false);assert.ok(reasons.includes('MINT_AUTHORITY_NOT_REVOKED'));assert.ok(reasons.includes('FREEZE_AUTHORITY_NOT_REVOKED'));assert.ok(reasons.includes('TOP10_CONCENTRATION_TOO_HIGH'));
});

test('solana meme momentum blocks an audit with missing holder distribution',async()=>{
  const state=makeState();state.infrastructure.marketBots={connectors:{solanaDiscovery:{online:true},goPlus:{configured:true}}};
  const registry=new MarketBotRegistry({state,persist:()=>{}});registry.solanaDiscovery={health:async()=>({online:true}),search:async()=>[{chainId:'solana',baseToken:{address:'UNKNOWN_HOLDERS',symbol:'UH'},pairCreatedAt:Date.now()-10*60000,liquidityUsd:500000,volume5mUsd:100000,volume24hUsd:2000000,priceChange5m:5,priceChange1h:25,buys5m:30,sells5m:10,txns5m:40}]};registry.securityChecks=async()=>[{chain:'solana',address:'UNKNOWN_HOLDERS',security:{securityStatus:'AUDITED',securityFlags:[],mintAuthorityRevoked:true,freezeAuthorityRevoked:true}}];
  const result=await registry.scan('solana-meme-momentum');assert.ok(result.rejectedCandidates[0].blockers.includes('HOLDER_AUDIT_REQUIRED'));assert.equal(result.tradeable,false);
});

test('derivatives adapter falls back to OKX public data when Binance is unavailable',async()=>{
  const adapter=new BinanceFuturesMarketData('https://unavailable.invalid');
  adapter.get=async()=>{throw new Error('BINANCE_FUTURES_HTTP_451');};
  adapter.fallback={premiumIndex:async()=>({markPrice:'1',indexPrice:'1',lastFundingRate:'0.001'}),openInterest:async()=>({openInterest:'10'}),fundingHistory:async()=>[{fundingRate:'0.001'}]};
  assert.equal((await adapter.premiumIndex('BTCUSDT')).lastFundingRate,'0.001');
  assert.equal((await adapter.openInterest('BTCUSDT')).openInterest,'10');
});

test('public provider adapters expose safe read-only status',()=>{
  assert.equal(new OkxDerivativesMarketData().status().liveExecutionReady,false);
  assert.equal(new GoPlusConnector().status().mode,'READ_ONLY');
  assert.equal(new OkxDerivativesMarketData().instrument('BTCUSDT'),'BTC-USDT-SWAP');
});
