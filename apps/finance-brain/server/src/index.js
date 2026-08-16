import './loadEnv.js';
import dotenv from 'dotenv';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
dotenv.config();
dotenv.config({path:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../.env'),override:false});
import {isAddress} from 'ethers';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import {Server} from 'socket.io';
import {state,persist,publicState,hydrateStateFromNeon} from './core/store.js';
import {opportunityBus} from './core/opportunityBus.js';
import {normalizeOpportunity,brainDecision} from './core/brain.js';
import {evaluateRisk} from './core/riskEngine.js';
import {configurePaperBroker,executePaper} from './core/paperExecutor.js';
import {RealMarketPaperBroker} from './core/realMarketPaperBroker.js';
import {applyAllocations} from './core/capitalAllocator.js';
import {startSyntheticAgents} from './bots/agentRuntime.js';
import {AaveV3LiquidationScanner} from './bots/liquidation/aaveV3Scanner.js';
import {DexArbitrageScanner} from './bots/arbitrage/dexArbitrageScanner.js';
import {VolatilityScanner} from './bots/volatility/volatilityScanner.js';
import {FundingScanner} from './bots/perpetuals/fundingScanner.js';
import {Erc20WhaleScanner} from './bots/smartMoney/erc20WhaleScanner.js';
import {MomentumScanner} from './bots/momentum/momentumScanner.js';
import {YieldScanner} from './bots/yield/yieldScanner.js';
import {rpcManager} from './infrastructure/rpcManager.js';
import {binanceMarketData} from './infrastructure/marketData/binanceMarketData.js';
import {binanceFuturesMarketData} from './infrastructure/marketData/binanceFuturesMarketData.js';
import {defiLlamaYields} from './infrastructure/defi/defiLlamaYields.js';
import {SignalFusionEngine} from './core/signalFusion.js';
import {IntelligenceLayer} from './core/intelligenceLayer.js';
import {SolanaEarlyTokenScanner} from './bots/solana/earlyTokenScanner.js';
import {solanaRpc} from './infrastructure/solana/solanaRpc.js';
import {helius} from './infrastructure/security/tokenSecurity.js';
import {journal} from './storage/journal.js';
import {simulationEngine} from './core/simulationEngine.js';
import {performanceDb} from './storage/performanceDatabase.js';
import {rpcLatencyRouter} from './infrastructure/rpcLatencyRouter.js';
import {PolymarketScanner} from './bots/polymarket/polymarketScanner.js';
import {polymarketData} from './infrastructure/polymarket/polymarketData.js';
import {StrategyCircuitBreaker} from './core/circuitBreaker.js';
import {replayEngine} from './core/replayEngine.js';
import {executionAdapter} from './core/executionAdapter.js';
import {strategyConfigService} from './core/strategyConfigService.js';
import {HealthSupervisor} from './infrastructure/healthSupervisor.js';
import {secretsVault} from './infrastructure/secretsVault.js';
import {createAgentOrchestrator} from './agent/agentOrchestrator.js';
import {normalizeBrainReply} from '../../../../packages/inter-brain-protocol/src/chat.js';
import {LiquidationStrategyLab} from './bots/liquidation/liquidationStrategyLab.js';
import {loadAaveMarkets} from './bots/liquidation/liquidationMarketRegistry.js';
import {liquidationResearchStore} from './storage/liquidationResearchStore.js';
import {evmNetworkRegistry} from './infrastructure/evmNetworkRegistry.js';
import {binanceTrading} from './infrastructure/binance/binanceTrading.js';
import {solanaTrading} from './infrastructure/solana/solanaTrading.js';
import {polygonPaperQuotes} from './infrastructure/brokers/demoBrokers.js';
import {PolymarketTradingConnector} from './infrastructure/polymarket/polymarketTrading.js';
import {CentralSupervisor} from './agent/centralSupervisor.js';
import {MarketBotRegistry} from './bots/market/marketBotRegistry.js';
import {alpacaPaper} from './infrastructure/brokers/demoBrokers.js';
import {kronosForecast,kronosStatus} from './infrastructure/models/kronosForecast.js';
import {AgentGovernance} from './core/agentGovernance.js';

await hydrateStateFromNeon();
persist();
const PORT=Number(process.env.PORT||8787),CLIENT_ORIGIN=process.env.CLIENT_ORIGIN||process.env.CORS_ORIGIN||'*';
const PAPER_EXECUTE_WATCH=String(process.env.PAPER_EXECUTE_WATCH||'true').toLowerCase()!=='false';
const allowedOrigins=CLIENT_ORIGIN==='*'?null:new Set(CLIENT_ORIGIN.split(',').map(origin=>origin.trim()).filter(Boolean));
const app=express();app.use(cors({origin(origin,callback){if(!origin||!allowedOrigins||allowedOrigins.has(origin)||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:'))return callback(null,true);return callback(null,false);}}));app.use(express.json({limit:'128kb'}));
const server=http.createServer(app),io=new Server(server,{cors:{origin:CLIENT_ORIGIN}});const broadcast=()=>io.emit('state',publicState());
const fusionEngine=new SignalFusionEngine({windowMs:Number(process.env.FUSION_WINDOW_MS||120000),minSources:Number(process.env.FUSION_MIN_SOURCES||2)});
const intelligenceLayer=new IntelligenceLayer();
const circuitBreaker=new StrategyCircuitBreaker({maxConsecutiveLosses:Number(process.env.CB_MAX_CONSECUTIVE_LOSSES||3),maxDrawdownUsd:Number(process.env.CB_MAX_DRAWDOWN_USD||250),cooldownMs:Number(process.env.CB_COOLDOWN_MS||900000)});
const polymarketTrading=new PolymarketTradingConnector({data:polymarketData});
const marketBotRegistry=new MarketBotRegistry({state,persist,bus:opportunityBus});
const governance=new AgentGovernance({state,persist,broadcast});
const refreshKronosState=()=>{state.infrastructure.kronos=kronosStatus();};
refreshKronosState();
const BLOCKED_RUNTIME_STATUS=/^(WAITING_|NOT_CONFIGURED|SCAN_ERROR|ERROR|FAILED|BLOCKED|OFFLINE)/;
const CURRENT_OPPORTUNITY_MAX_AGE_MS=Math.max(10000,Number(process.env.CURRENT_OPPORTUNITY_MAX_AGE_MS||120000));
const timestamp=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:0;};
const currentOpportunity=row=>{const now=Date.now(),expires=timestamp(row?.expiresAt),created=timestamp(row?.createdAt);return Boolean(row)&&(!expires||expires>=now)&&(!created||now-created<=CURRENT_OPPORTUNITY_MAX_AGE_MS);};
function refreshBotMetrics(){
  const now=Date.now(),dayAgo=now-86400000;
  state.opportunities=(state.opportunities||[]).filter(currentOpportunity).slice(0,250);
  for(const bot of state.bots||[]){
    bot.opportunities=state.opportunities.filter(item=>item.strategyId===bot.id&&!item.metadata?.advisory&&!item.metadata?.signalOnly).length;
    bot.pnl24h=Number((state.executions||[]).filter(item=>item.strategyId===bot.id&&item.status==='CLOSED'&&timestamp(item.closedAt||item.createdAt)>=dayAgo).reduce((sum,item)=>sum+Number(item.realizedProfitUsd||0),0).toFixed(2));
  }
}
function setRuntimeStatus(bot,status){
  if(!bot)return;
  bot.heartbeat=new Date().toISOString();bot.status=bot.active?status:'PAUSED';
  if(BLOCKED_RUNTIME_STATUS.test(String(bot.status||'')))state.opportunities=(state.opportunities||[]).filter(item=>item.strategyId!==bot.id);
  refreshBotMetrics();
}
refreshBotMetrics();

const paperBroker=new RealMarketPaperBroker({state,persist,solanaTrading,polygonTrading:polygonPaperQuotes,onClose:({execution,opportunity,simulation})=>{
  if(!execution||execution.status!=='CLOSED'||!opportunity)return;
  const cb=circuitBreaker.record(opportunity.strategyId,Number(execution.realizedProfitUsd||0));
  state.infrastructure.production.circuitBreakers=circuitBreaker.snapshot();
  const perf=performanceDb.record({opportunity,simulation,execution});
  state.infrastructure.performance=performanceDb.snapshot();
  journal.execution(execution);journal.performance(perf);persist();broadcast();
}});
configurePaperBroker(paperBroker);state.infrastructure.production.paperBroker=paperBroker.status();paperBroker.start();

opportunityBus.on('raw-opportunity',async raw=>{
  const opportunity=normalizeOpportunity(raw),brain=brainDecision(opportunity);
  const routeNetwork=String(opportunity.network||'').toLowerCase();
  const simulation=simulationEngine.simulate({...opportunity,brain},{routeLatencyMs:rpcLatencyRouter.selectedLatency(routeNetwork)});
  const preRisk={...opportunity,brain,simulation};
  const baseRisk=evaluateRisk(preRisk,state),governanceRisk=governance.evaluate(preRisk);
  const risk={...baseRisk,governance:governanceRisk,approved:baseRisk.approved&&governanceRisk.approved,reasons:[...baseRisk.reasons,...governanceRisk.reasons.filter(reason=>!baseRisk.reasons.includes(reason))]};
  const enriched={...preRisk,risk};
  state.infrastructure.simulation.recent.unshift(simulation);state.infrastructure.simulation.recent=state.infrastructure.simulation.recent.slice(0,100);
  simulation.passed?state.infrastructure.simulation.passed++:state.infrastructure.simulation.rejected++;journal.simulation(simulation);
  state.opportunities.unshift(enriched);state.opportunities=state.opportunities.slice(0,250);refreshBotMetrics();
  const breaker=circuitBreaker.canRun(opportunity.strategyId);enriched.circuitBreaker=breaker;
  if(brain.decision==='CANDIDATE'&&risk.approved&&breaker.allowed){const proposal=polymarketTrading.maybePropose(enriched);if(proposal)enriched.liveProposal=proposal;}
  const paperExecutionAllowed=state.mode==='PAPER'&&PAPER_EXECUTE_WATCH&&(brain.decision==='CANDIDATE'||brain.decision==='WATCH');
  if((brain.decision==='CANDIDATE'||paperExecutionAllowed)&&risk.approved&&breaker.allowed){
    try{
      enriched.execution=await executionAdapter.execute(enriched,state,{paperExecutor:executePaper});
      if(enriched.execution&&!state.executions.some(item=>item.id===enriched.execution.id)){
        state.executions.unshift(enriched.execution);state.executions=state.executions.slice(0,250);
      }
      journal.execution(enriched.execution);
      if(enriched.execution.status==='CLOSED'){
        const cb=circuitBreaker.record(opportunity.strategyId,Number(enriched.execution.realizedProfitUsd||0));
        state.infrastructure.production.circuitBreakers=circuitBreaker.snapshot();enriched.circuitBreaker=cb;
        const perf=performanceDb.record({opportunity:enriched,simulation,execution:enriched.execution});state.infrastructure.performance=performanceDb.snapshot();journal.performance(perf);
      }
    }catch(error){
      enriched.execution={id:crypto.randomUUID(),opportunityId:enriched.id,strategyId:enriched.strategyId,mode:state.mode==='PAPER'?'PAPER':'LIVE',status:'BLOCKED',error:error?.message||'EXECUTION_BLOCKED',createdAt:new Date().toISOString()};
      state.executions.unshift(enriched.execution);state.executions=state.executions.slice(0,250);
      journal.execution(enriched.execution);
    }
  }
  const fusion=fusionEngine.ingest(enriched);if(fusion){state.infrastructure.fusion.recent.unshift(fusion);state.infrastructure.fusion.recent=state.infrastructure.fusion.recent.slice(0,50);journal.fusion(fusion);io.emit('fusion',fusion);const intel=intelligenceLayer.evaluate(fusion);state.infrastructure.intelligence.recent.unshift(intel);state.infrastructure.intelligence.recent=state.infrastructure.intelligence.recent.slice(0,50);state.infrastructure.intelligence.comboLeaderboard=intelligenceLayer.leaderboard();journal.intelligence(intel);io.emit('intelligence',intel);if(enriched.execution){intelligenceLayer.recordOutcome({strategies:intel.strategies,realizedProfitUsd:enriched.execution.realizedProfitUsd});state.infrastructure.intelligence.comboLeaderboard=intelligenceLayer.leaderboard();journal.combo({fusionId:fusion.id,executionId:enriched.execution.id,strategies:intel.strategies,realizedProfitUsd:enriched.execution.realizedProfitUsd,leaderboard:state.infrastructure.intelligence.comboLeaderboard.slice(0,5)});}}
  refreshBotMetrics();journal.opportunity(enriched);persist();io.emit('opportunity',enriched);broadcast();
});

startSyntheticAgents(state,opportunityBus,bot=>io.emit('heartbeat',{id:bot.id,heartbeat:bot.heartbeat,status:bot.status}));
const cap=(arr,x,n=60)=>{arr.unshift(x);arr.splice(n);};

const liquidationBot=state.bots.find(b=>b.id==='liquidation');
const liquidationLab=new LiquidationStrategyLab();
state.infrastructure.liquidation.markets=loadAaveMarkets();
const liquidationScanner=new AaveV3LiquidationScanner({rpcManager,bus:opportunityBus,
  onStatus:status=>{setRuntimeStatus(liquidationBot,status);broadcast();},
  onScan:scan=>{cap(state.infrastructure.liquidation.lastScans,scan,50);journal.liquidation(scan);const ranked=liquidationLab.ingest(scan);if(ranked){state.infrastructure.liquidation.lab=liquidationLab.stats();liquidationResearchStore.record(state.infrastructure.liquidation.lab);io.emit('liquidation-lab',ranked);}},
  onDiscovery:d=>{cap(state.infrastructure.liquidation.lastDiscoveries,d,20);state.infrastructure.liquidation={...state.infrastructure.liquidation,...liquidationScanner.config()};journal.discovery(d);broadcast();}});
state.infrastructure.liquidation={...state.infrastructure.liquidation,...liquidationScanner.config()};liquidationScanner.start();

const arbitrageBot=state.bots.find(b=>b.id==='arbitrage');
const arbitrageScanner=new DexArbitrageScanner({rpcManager,bus:opportunityBus,
  onStatus:status=>{setRuntimeStatus(arbitrageBot,status);broadcast();},
  onScan:scan=>{cap(state.infrastructure.arbitrage.lastScans,scan,50);journal.arbitrage(scan);broadcast();}});
state.infrastructure.arbitrage={...state.infrastructure.arbitrage,...arbitrageScanner.config()};arbitrageScanner.start();

const volatilityBot=state.bots.find(b=>b.id==='volatility');
const volatilityScanner=new VolatilityScanner({marketData:binanceMarketData,bus:opportunityBus,
  onStatus:status=>{setRuntimeStatus(volatilityBot,status);broadcast();},
  onScan:scan=>{cap(state.infrastructure.volatility.lastScans,scan,60);journal.volatility(scan);broadcast();}});
state.infrastructure.volatility={...state.infrastructure.volatility,...volatilityScanner.config()};volatilityScanner.start();

const perpetualsBot=state.bots.find(b=>b.id==='perpetuals');
const fundingScanner=new FundingScanner({marketData:binanceFuturesMarketData,bus:opportunityBus,
  onStatus:status=>{setRuntimeStatus(perpetualsBot,status);broadcast();},
  onScan:scan=>{cap(state.infrastructure.perpetuals.lastScans,scan,60);journal.perpetuals(scan);broadcast();}});
state.infrastructure.perpetuals={...state.infrastructure.perpetuals,...fundingScanner.config()};fundingScanner.start();

const smartMoneyBot=state.bots.find(b=>b.id==='smart-money');
const whaleScanner=new Erc20WhaleScanner({rpcManager,bus:opportunityBus,
  onStatus:status=>{setRuntimeStatus(smartMoneyBot,status);broadcast();},
  onScan:scan=>{cap(state.infrastructure.smartMoney.lastScans,scan,60);journal.smartMoney(scan);broadcast();}});
state.infrastructure.smartMoney={...state.infrastructure.smartMoney,...whaleScanner.config()};whaleScanner.start();

const momentumBot=state.bots.find(b=>b.id==='momentum');
const momentumScanner=new MomentumScanner({marketData:binanceMarketData,bus:opportunityBus,onStatus:status=>{setRuntimeStatus(momentumBot,status);broadcast();},onScan:scan=>{cap(state.infrastructure.momentum.lastScans,scan,60);journal.momentum(scan);broadcast();}});
state.infrastructure.momentum={...state.infrastructure.momentum,...momentumScanner.config()};momentumScanner.start();

const yieldBot=state.bots.find(b=>b.id==='yield');
const yieldScanner=new YieldScanner({data:defiLlamaYields,bus:opportunityBus,onStatus:status=>{setRuntimeStatus(yieldBot,status);broadcast();},onScan:scan=>{cap(state.infrastructure.yield.lastScans,scan,30);journal.yield(scan);broadcast();}});
state.infrastructure.yield={...state.infrastructure.yield,...yieldScanner.config()};yieldScanner.start();

const solanaBot=state.bots.find(b=>b.id==='solana-radar');
const solanaScanner=new SolanaEarlyTokenScanner({rpc:solanaRpc,auditRpc:helius.configured()?helius:solanaRpc,bus:opportunityBus,onStatus:status=>{setRuntimeStatus(solanaBot,status);broadcast();},onScan:scan=>{state.infrastructure.solana.lastScans=Array.isArray(state.infrastructure.solana.lastScans)?state.infrastructure.solana.lastScans:[];state.infrastructure.solana.lastBirths=Array.isArray(state.infrastructure.solana.lastBirths)?state.infrastructure.solana.lastBirths:[];cap(state.infrastructure.solana.lastScans,scan,30);state.infrastructure.solana.lastBirths.unshift(...(scan.births||[]));state.infrastructure.solana.lastBirths.splice(50);state.infrastructure.solana={...state.infrastructure.solana,...solanaScanner.config()};journal.solana(scan);broadcast();}});
state.infrastructure.solana={...state.infrastructure.solana,...solanaScanner.config()};solanaScanner.start();

const polymarketBot=state.bots.find(b=>b.id==='polymarket');
const polymarketScanner=new PolymarketScanner({data:polymarketData,bus:opportunityBus,onStatus:status=>{setRuntimeStatus(polymarketBot,status);broadcast();},onScan:scan=>{cap(state.infrastructure.polymarket.lastScans,scan,30);state.infrastructure.polymarket={...state.infrastructure.polymarket,...polymarketScanner.config()};journal.polymarket(scan);broadcast();}});
state.infrastructure.polymarket={...state.infrastructure.polymarket,...polymarketScanner.config()};polymarketScanner.start();

async function probeRpc(){state.infrastructure.rpc=await rpcManager.probeAll();journal.rpc(state.infrastructure.rpc);persist();broadcast();}
async function probeMarketData(){try{state.infrastructure.marketData=await binanceMarketData.ping();}catch(error){state.infrastructure.marketData={provider:'Binance Spot',online:false,error:error?.message||'MARKET_DATA_ERROR',checkedAt:new Date().toISOString()};}journal.marketData(state.infrastructure.marketData);persist();broadcast();}
async function probeFuturesMarketData(){try{state.infrastructure.futuresMarketData=await binanceFuturesMarketData.ping();}catch(error){state.infrastructure.futuresMarketData={provider:'Binance USDⓈ-M Futures',online:false,error:error?.message||'FUTURES_MARKET_DATA_ERROR',checkedAt:new Date().toISOString()};}journal.futuresMarketData(state.infrastructure.futuresMarketData);persist();broadcast();}
async function probeSolana(){state.infrastructure.solanaRpc=await solanaRpc.ping();journal.solanaRpc(state.infrastructure.solanaRpc);persist();broadcast();}
async function probePolymarket(){state.infrastructure.polymarketData=await polymarketData.ping();journal.polymarketData(state.infrastructure.polymarketData);persist();broadcast();}
async function probeLatencyRouter(){state.infrastructure.latencyRouter=await rpcLatencyRouter.probeAll();journal.latencyRouter(state.infrastructure.latencyRouter);persist();broadcast();}
async function probeYieldData(){try{state.infrastructure.yieldData=await defiLlamaYields.ping();}catch(error){state.infrastructure.yieldData={provider:'DefiLlama Yields',online:false,error:error?.message||'YIELD_DATA_ERROR',checkedAt:new Date().toISOString()};}journal.yieldData(state.infrastructure.yieldData);persist();broadcast();}
async function probeMarketBots(){try{state.infrastructure.marketBots.connectors=await marketBotRegistry.refreshConnectors();persist();broadcast();}catch(error){state.infrastructure.marketBots.connectors={error:error?.message||'MARKET_BOTS_CONNECTOR_ERROR',checkedAt:new Date().toISOString()};persist();broadcast();}}
async function scanMarketBots(){try{await marketBotRegistry.scanAll();persist();broadcast();}catch(error){journal?.centralIncident?.({fingerprint:'market-bots:scan-error',severity:'error',code:'MARKET_BOTS_SCAN_ERROR',message:error?.message||'Market bot scan failed',createdAt:new Date().toISOString()});}}
function rebalance(){refreshBotMetrics();const result=applyAllocations(state);journal.allocation(result);persist();broadcast();return result;}
function recoverBot(id){const bot=state.bots.find(b=>b.id===id);if(!bot||!bot.active)return;setRuntimeStatus(bot,'RECOVERING');const scanners={liquidation:liquidationScanner,arbitrage:arbitrageScanner,volatility:volatilityScanner,perpetuals:fundingScanner,'smart-money':whaleScanner,momentum:momentumScanner,yield:yieldScanner,'solana-radar':solanaScanner,polymarket:polymarketScanner};Promise.resolve(scanners[id]?.scanOnce?.()).catch(()=>setRuntimeStatus(bot,'SCAN_ERROR')).finally(()=>{if(bot.status==='RECOVERING')setRuntimeStatus(bot,'SCANNING');broadcast();});broadcast();}
const supervisor=new HealthSupervisor({state,onRecover:recoverBot,staleMs:Number(process.env.SUPERVISOR_STALE_MS||90000),intervalMs:Number(process.env.SUPERVISOR_INTERVAL_MS||15000)});
supervisor.start();
state.infrastructure.production.execution=executionAdapter.capabilities();
state.infrastructure.production.vault=secretsVault.status();
state.infrastructure.production.wallet={address:process.env.AEGIS_TREASURY_ADDRESS||null,networks:evmNetworkRegistry.list()};
state.infrastructure.binanceTrading=binanceTrading.status();
state.infrastructure.solanaTrading=solanaTrading.status();
state.infrastructure.polymarketTrading=polymarketTrading.status();
setInterval(()=>{refreshBotMetrics();state.infrastructure.production.supervisor=supervisor.check();persist();broadcast();},Math.max(5000,Number(process.env.SUPERVISOR_INTERVAL_MS||15000)));
setInterval(()=>{refreshKronosState();broadcast();},15000);
state.infrastructure.performance=performanceDb.snapshot();probeRpc();probeLatencyRouter();probeMarketData();probeFuturesMarketData();probeYieldData();probeSolana();probePolymarket();probeMarketBots();setTimeout(scanMarketBots,10000).unref?.();rebalance();setInterval(probeRpc,15000);setInterval(probeLatencyRouter,20000);setInterval(probeMarketData,30000);setInterval(probeFuturesMarketData,30000);setInterval(probeYieldData,300000);setInterval(probeSolana,30000);setInterval(probePolymarket,45000);setInterval(probeMarketBots,60000);setInterval(scanMarketBots,Math.max(60000,Number(process.env.MARKET_BOTS_SCAN_MS||120000)));setInterval(rebalance,Math.max(15000,Number(process.env.ALLOCATOR_REBALANCE_MS||30000)));

const centralSupervisor=new CentralSupervisor({state,persist,journal,broadcast,performanceSnapshot:()=>performanceDb.snapshot(),governance,tools:{rebalance,recoverStale:recoverBot,marketBots:marketBotRegistry},intervalMs:Math.max(10000,Number(process.env.CENTRAL_AGENT_INTERVAL_MS||15000))});
centralSupervisor.start();

const agent=createAgentOrchestrator({state,tools:{
  scan_liquidations:async()=>{await liquidationScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.liquidation.lastScans.slice(0,5),lab:liquidationLab.stats()};},
  discover_borrowers:async()=>{await liquidationScanner.discoverBorrowers();return {ok:true,discoveries:state.infrastructure.liquidation.lastDiscoveries.slice(0,5)};},
  rescore_liquidations:async()=>{for(const row of state.infrastructure.liquidation.lastScans||[])liquidationLab.ingest(row);state.infrastructure.liquidation.lab=liquidationLab.stats();liquidationResearchStore.record(state.infrastructure.liquidation.lab);persist();broadcast();return state.infrastructure.liquidation.lab;},
  scan_arbitrage:async()=>{await arbitrageScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.arbitrage.lastScans.slice(0,5)};},
  scan_volatility:async()=>{await volatilityScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.volatility.lastScans.slice(0,6)};},
  scan_perpetuals:async()=>{await fundingScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.perpetuals.lastScans.slice(0,6)};},
  scan_solana:async()=>{await solanaScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.solana.lastScans.slice(0,5)};},
  scan_polymarket:async()=>{await polymarketScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.polymarket.lastScans.slice(0,5)};},
  scan_smart_money:async()=>{await whaleScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.smartMoney.lastScans.slice(0,6)};},
  scan_momentum:async()=>{await momentumScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.momentum.lastScans.slice(0,6)};},
  scan_yield:async()=>{await yieldScanner.scanOnce();return {ok:true,lastScans:state.infrastructure.yield.lastScans.slice(0,5)};},
  scan_market_bots:async()=>{const results=await marketBotRegistry.scanAll();return {ok:true,results:results.map(result=>({botId:result.botId,status:result.status,scannedAt:result.scannedAt,discoveries:result.discoveries,error:result.error}))};},
  rebalance:async()=>rebalance(),
  probe_rpc:async()=>{await probeRpc();return state.infrastructure.rpc;},
  production_status:async()=>state.infrastructure.production,
  performance_snapshot:async()=>performanceDb.snapshot(),
  central_report:async()=>centralSupervisor.tick(),
  risk_snapshot:async()=>governance.snapshot(),
  set_risk_policy:async(args={})=>governance.applyRiskPatch(args.changes||args,'CENTRAL_FINANCE_BRAIN'),
  pause_strategy:async(args={})=>governance.pauseStrategy(args.strategyId||args.id,args.reason||'Finance Brain policy'),
  engage_kill_switch:async(args={})=>governance.engageKillSwitch(args.reason||'Finance Brain emergency policy','CENTRAL_FINANCE_BRAIN')
}});

app.get('/api/agent/status',(req,res)=>res.json(agent.status()));
app.get('/api/agent/context',(req,res)=>res.json(agent.snapshot()));
app.post('/api/agent/chat',async(req,res)=>{try{const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({error:'MESSAGE_REQUIRED'});const answer=await agent.chat(message,req.body?.conversation);answer.reply=normalizeBrainReply('finance',answer.reply);broadcast();res.json({...answer,speak:true,brain:'finance'});}catch(error){res.status(500).json({error:'AGENT_ERROR',message:error?.message||'Agent request failed'});}});
app.get('/api/central-agent/status',(req,res)=>res.json(centralSupervisor.snapshot()));
app.get('/api/central-agent/diagnostics',(req,res)=>res.json(centralSupervisor.snapshot().botDiagnostics||[]));
app.get('/api/central-agent/report',(req,res)=>res.json(centralSupervisor.snapshot().reports?.[0]||null));
app.get('/api/central-agent/incidents',(req,res)=>res.json(centralSupervisor.snapshot().incidents||[]));
app.post('/api/central-agent/run',async(req,res)=>{try{res.json(await centralSupervisor.tick());}catch(error){res.status(500).json({error:error?.message||'CENTRAL_AGENT_ERROR'});}});
app.get('/api/agent/governance',(req,res)=>res.json(governance.snapshot()));
app.post('/api/agent/governance/risk',(req,res)=>{try{res.json(governance.applyRiskPatch(req.body||{},'MANUAL_API'));}catch(error){res.status(400).json({error:error?.message||'RISK_POLICY_ERROR'});}});
app.get('/api/market-bots',(req,res)=>res.json({mode:'PAPER',bots:marketBotRegistry.definitions(),connectors:state.infrastructure.marketBots.connectors||{},lastRunAt:state.infrastructure.marketBots.lastRunAt}));
app.get('/api/market-bots/:id',(req,res)=>{const bot=marketBotRegistry.statusFor(req.params.id);if(!bot)return res.status(404).json({error:'MARKET_BOT_NOT_FOUND'});res.json({bot,result:state.infrastructure.marketBots.results?.[req.params.id]||null});});
app.post('/api/market-bots/connectors/probe',async(req,res)=>{try{const connectors=await marketBotRegistry.refreshConnectors();res.json({mode:'PAPER',connectors});}catch(error){res.status(502).json({error:error?.message||'MARKET_CONNECTORS_PROBE_ERROR'});}});
app.post('/api/market-bots/:id/scan',async(req,res)=>{try{res.json(await marketBotRegistry.scan(req.params.id));}catch(error){res.status(400).json({error:error?.message||'MARKET_BOT_SCAN_ERROR'});}});
app.get('/api/integrations/brokers/status',(req,res)=>res.json({mode:'PAPER',liveExecutionReady:false,brokers:marketBotRegistry.connectorStatuses(),lastProbeAt:state.infrastructure.marketBots.connectors?.alpaca?.checkedAt||null}));
app.post('/api/integrations/alpaca/paper-order',async(req,res)=>{try{if(req.body?.confirmPaper!==true)return res.status(409).json({error:'PAPER_CONFIRMATION_REQUIRED',message:'Envía confirmPaper=true para confirmar que la orden es solo de Paper Trading.'});res.status(201).json({mode:'PAPER',live:false,order:await alpacaPaper.order(req.body||{})});}catch(error){res.status(400).json({mode:'PAPER',live:false,error:error?.message||'ALPACA_PAPER_ORDER_ERROR'});}});
app.get('/api/integrations/data-providers/status',(req,res)=>res.json({mode:'PAPER',liveExecutionReady:false,providers:{binanceSpot:state.infrastructure.marketData,binanceFutures:state.infrastructure.futuresMarketData,polymarket:state.infrastructure.polymarketData,solanaRpc:state.infrastructure.solanaRpc,evmRpc:state.infrastructure.rpc,defiLlama:state.infrastructure.yieldData,...marketBotRegistry.connectorStatuses()},checkedAt:new Date().toISOString()}));
app.get('/api/kronos/status',(req,res)=>res.json(kronosStatus()));
app.post('/api/kronos/forecast',async(req,res)=>{try{const result=await kronosForecast(req.body||{});res.status(result.available?200:503).json(result);}catch(error){res.status(400).json({available:false,error:error?.message||'KRONOS_FORECAST_ERROR'});}});

const healthPayload=()=>{refreshBotMetrics();const bots=state.bots||[],agentsTotal=bots.length,agentsOnline=bots.filter(bot=>bot.active&&!BLOCKED_RUNTIME_STATUS.test(String(bot.status||'').toUpperCase())&&String(bot.status||'').toUpperCase()!=='PAUSED').length,blockedBots=bots.filter(bot=>bot.active&&BLOCKED_RUNTIME_STATUS.test(String(bot.status||'').toUpperCase())).map(bot=>({id:bot.id,status:bot.status})),processed=(state.opportunities?.length||0)+(state.executions?.length||0);return {ok:true,service:'AEGIS Core',kind:'finance',version:'11.0.0',status:blockedBots.length?'degraded':'online',mode:state.mode,time:new Date().toISOString(),agentsOnline,agentsTotal,blockedBots,processed,eventsProcessed:processed,paperEquityUsd:Number(state.treasury?.paperBalanceUsd||0)};};
app.get('/health',(req,res)=>res.json(healthPayload()));
app.get('/api/health',(req,res)=>res.json(healthPayload()));
app.get('/api/state',(req,res)=>res.json(publicState()));app.get('/api/bots',(req,res)=>res.json(state.bots));app.get('/api/opportunities',(req,res)=>res.json(state.opportunities.slice(0,100)));
app.get('/api/infrastructure/rpc',(req,res)=>res.json(state.infrastructure.rpc));app.post('/api/infrastructure/rpc/probe',async(req,res)=>{await probeRpc();res.json(state.infrastructure.rpc);});
app.post('/api/infrastructure/market-data/probe',async(req,res)=>{await probeMarketData();res.json(state.infrastructure.marketData);});
app.post('/api/infrastructure/futures-market-data/probe',async(req,res)=>{await probeFuturesMarketData();res.json(state.infrastructure.futuresMarketData);});
app.post('/api/liquidation/scan',async(req,res)=>{if(!liquidationBot?.active)return res.status(409).json({error:'LIQUIDATION_BOT_PAUSED'});await liquidationScanner.scanOnce();state.infrastructure.liquidation={...state.infrastructure.liquidation,...liquidationScanner.config()};res.json({ok:true,lastScans:state.infrastructure.liquidation.lastScans.slice(0,10)});});
app.post('/api/liquidation/discover',async(req,res)=>{if(!liquidationBot?.active)return res.status(409).json({error:'LIQUIDATION_BOT_PAUSED'});await liquidationScanner.discoverBorrowers();state.infrastructure.liquidation={...state.infrastructure.liquidation,...liquidationScanner.config()};res.json({ok:true,config:liquidationScanner.config(),discoveries:state.infrastructure.liquidation.lastDiscoveries.slice(0,5)});});
app.get('/api/liquidation/lab',(req,res)=>res.json({lab:liquidationLab.stats(),history:liquidationResearchStore.snapshot(),markets:state.infrastructure.liquidation.markets,recommendedScanMs:liquidationLab.recommendedIntervalMs()}));
app.post('/api/liquidation/lab/rescore',(req,res)=>{for(const row of state.infrastructure.liquidation.lastScans||[])liquidationLab.ingest(row);state.infrastructure.liquidation.lab=liquidationLab.stats();liquidationResearchStore.record(state.infrastructure.liquidation.lab);persist();broadcast();res.json({lab:state.infrastructure.liquidation.lab,recommendedScanMs:liquidationLab.recommendedIntervalMs()});});
app.post('/api/arbitrage/scan',async(req,res)=>{if(!arbitrageBot?.active)return res.status(409).json({error:'ARBITRAGE_BOT_PAUSED'});await arbitrageScanner.scanOnce();res.json({ok:true,lastScans:state.infrastructure.arbitrage.lastScans.slice(0,10)});});
app.post('/api/volatility/scan',async(req,res)=>{if(!volatilityBot?.active)return res.status(409).json({error:'VOLATILITY_BOT_PAUSED'});await volatilityScanner.scanOnce();res.json({ok:true,lastScans:state.infrastructure.volatility.lastScans.slice(0,12)});});
app.post('/api/perpetuals/scan',async(req,res)=>{if(!perpetualsBot?.active)return res.status(409).json({error:'PERPETUALS_BOT_PAUSED'});await fundingScanner.scanOnce();res.json({ok:true,lastScans:state.infrastructure.perpetuals.lastScans.slice(0,12)});});
app.post('/api/infrastructure/solana/probe',async(req,res)=>{await probeSolana();res.json(state.infrastructure.solanaRpc);});
app.post('/api/solana-radar/scan',async(req,res)=>{if(!solanaBot?.active)return res.status(409).json({error:'SOLANA_RADAR_PAUSED'});await solanaScanner.scanOnce();state.infrastructure.solana={...state.infrastructure.solana,...solanaScanner.config()};res.json({ok:true,lastScans:state.infrastructure.solana.lastScans.slice(0,10)});});
app.post('/api/solana-radar/demo',async(req,res)=>{if(!solanaBot?.active)return res.status(409).json({error:'SOLANA_RADAR_PAUSED'});try{const scan=await solanaScanner.scanOnce({emitSignals:false});state.infrastructure.solana={...state.infrastructure.solana,...solanaScanner.config()};res.json({ok:true,mode:'DEMO',live:false,executed:false,signalsEmitted:0,scan:{...scan,mode:'DEMO',paperExecution:'Disabled for this demo request; no opportunity bus emission, no ledger mutation.'}});}catch(error){res.status(502).json({ok:false,mode:'DEMO',live:false,error:error?.message||'SOLANA_RADAR_DEMO_ERROR'});}});
app.post('/api/infrastructure/rpc/latency-probe',async(req,res)=>{await probeLatencyRouter();res.json(state.infrastructure.latencyRouter);});
app.post('/api/infrastructure/polymarket/probe',async(req,res)=>{await probePolymarket();res.json(state.infrastructure.polymarketData);});
app.post('/api/polymarket/scan',async(req,res)=>{if(!polymarketBot?.active)return res.status(409).json({error:'POLYMARKET_BOT_PAUSED'});await polymarketScanner.scanOnce();res.json({ok:true,lastScans:state.infrastructure.polymarket.lastScans.slice(0,10)});});
app.get('/api/simulation',(req,res)=>res.json(state.infrastructure.simulation));
app.get('/api/paper/status',(req,res)=>res.json({mode:state.mode,live:false,broker:paperBroker.status(),ledger:state.paperLedger,legacyPnlQuarantined:Boolean(state.infrastructure.dataQuality?.legacyPaperPnlQuarantined)}));
app.post('/api/paper/positions/:id/close',async(req,res)=>{try{const result=await paperBroker.close(req.params.id,'MANUAL_API');if(!result)return res.status(404).json({error:'PAPER_POSITION_NOT_FOUND_OR_QUOTE_UNAVAILABLE'});res.json(result);}catch(error){res.status(502).json({error:error?.message||'PAPER_CLOSE_ERROR'});}});
app.get('/api/performance',(req,res)=>res.json(performanceDb.snapshot()));
app.get('/api/intelligence',(req,res)=>res.json(state.infrastructure.intelligence));
app.post('/api/momentum/scan',async(req,res)=>{if(!momentumBot?.active)return res.status(409).json({error:'MOMENTUM_BOT_PAUSED'});await momentumScanner.scanOnce();res.json({ok:true,lastScans:state.infrastructure.momentum.lastScans.slice(0,12)});});
app.post('/api/yield/scan',async(req,res)=>{if(!yieldBot?.active)return res.status(409).json({error:'YIELD_BOT_PAUSED'});await yieldScanner.scanOnce();res.json({ok:true,lastScans:state.infrastructure.yield.lastScans.slice(0,10)});});
app.post('/api/infrastructure/yield-data/probe',async(req,res)=>{await probeYieldData();res.json(state.infrastructure.yieldData);});
app.post('/api/smart-money/scan',async(req,res)=>{if(!smartMoneyBot?.active)return res.status(409).json({error:'SMART_MONEY_BOT_PAUSED'});await whaleScanner.scanOnce();state.infrastructure.smartMoney={...state.infrastructure.smartMoney,...whaleScanner.config()};res.json({ok:true,lastScans:state.infrastructure.smartMoney.lastScans.slice(0,12)});});
app.post('/api/allocator/rebalance',(req,res)=>res.json(rebalance()));
app.post('/api/bots/:id/toggle',(req,res)=>{const b=state.bots.find(x=>x.id===req.params.id);if(!b)return res.status(404).json({error:'BOT_NOT_FOUND'});b.active=!b.active;b.status=b.active?'SCANNING':'PAUSED';persist();broadcast();res.json(b);});
app.post('/api/system/mode',(req,res)=>{const mode=String(req.body?.mode||'').toUpperCase();if(!['PAPER','LIVE'].includes(mode))return res.status(400).json({error:'INVALID_MODE'});if(mode==='LIVE')return res.status(409).json({error:'LIVE_EXECUTION_LOCKED_IN_V10',message:'V10 is production-ready in PAPER mode. LIVE requires an external signer/vault adapter and AEGIS_LIVE_EXECUTION_ENABLED=true; no private keys are stored in the app.'});state.mode=mode;persist();broadcast();res.json({mode});});
app.post('/api/risk',(req,res)=>{try{const result=governance.applyRiskPatch(req.body||{},'MANUAL_API');rebalance();res.json({...state.risk,governance:result});}catch(error){res.status(400).json({error:error?.message||'RISK_POLICY_ERROR'});}});
app.get('/api/production/status',(req,res)=>res.json(state.infrastructure.production));
app.post('/api/replay/run',(req,res)=>{const result=replayEngine.run({limit:Math.min(5000,Math.max(1,Number(req.body?.limit||500))),riskState:state});state.infrastructure.production.replay.lastRun=result;persist();broadcast();res.json(result);});
app.get('/api/strategies/config',(req,res)=>res.json(strategyConfigService.get()));
app.patch('/api/strategies/:id/config',(req,res)=>{try{const id=req.params.id;if(!strategyConfigService.get()[id]&&marketBotRegistry.statusFor(id)){strategyConfigService.config[id]={enabled:true,maxAllocationPct:10,minConfidence:null,notes:'',wallet:state.bots.find(item=>item.id===id)?.wallet||`market-${id}`};strategyConfigService.save();}const cfg=strategyConfigService.patch(id,req.body||{});const bot=state.bots.find(x=>x.id===id);if(bot&&typeof req.body?.enabled==='boolean'){bot.active=req.body.enabled;bot.status=bot.active?'SCANNING':'PAUSED';bot.heartbeat=new Date().toISOString();}persist();broadcast();res.json(cfg);}catch(e){res.status(404).json({error:e.message});}});
const BOT_INFRA_KEYS={liquidation:'liquidation',arbitrage:'arbitrage','solana-radar':'solana',volatility:'volatility',momentum:'momentum',perpetuals:'perpetuals',polymarket:'polymarket','smart-money':'smartMoney',yield:'yield',allocator:null};
app.get('/api/bots/:id/results',(req,res)=>{const id=String(req.params.id);const bot=state.bots.find(x=>x.id===id);if(!bot)return res.status(404).json({error:'BOT_NOT_FOUND'});const limit=Math.min(100,Math.max(1,Number(req.query.limit||30)));const infraKey=BOT_INFRA_KEYS[id];const infrastructure=infraKey?state.infrastructure[infraKey]:state.allocator;let scans=(infrastructure?.lastScans||[]).slice(0,limit);const marketBotId=bot.marketBotId;const marketResult=marketBotId?state.infrastructure.marketBots?.results?.[marketBotId]:null;if(marketResult)scans=[marketResult,...scans.filter(row=>row.scannedAt!==marketResult.scannedAt)].slice(0,limit);const opportunities=state.opportunities.filter(x=>x.strategyId===id).slice(0,limit);const executions=state.executions.filter(x=>x.strategyId===id).slice(0,limit);res.json({bot,config:strategyConfigService.get()[id]||null,infrastructure,marketBotId,marketResult,scans,opportunities,executions,updatedAt:new Date().toISOString()});});
app.post('/api/circuit-breakers/:id/reset',(req,res)=>{const row=circuitBreaker.reset(req.params.id);state.infrastructure.production.circuitBreakers=circuitBreaker.snapshot();persist();broadcast();res.json(row);});
app.get('/api/execution/capabilities',(req,res)=>res.json(executionAdapter.capabilities()));
app.get('/api/vault/status',(req,res)=>res.json(secretsVault.status()));
app.get('/api/infrastructure/evm/networks',(req,res)=>res.json(evmNetworkRegistry.list()));
app.get('/api/wallet/status',async(req,res)=>{try{const address=String(req.query.address||process.env.AEGIS_TREASURY_ADDRESS||'');if(!address)return res.status(400).json({error:'ADDRESS_REQUIRED'});res.json(await evmNetworkRegistry.walletStatus(address));}catch(error){res.status(400).json({error:error?.message||'WALLET_STATUS_ERROR'});}});
app.get('/api/integrations/binance/status',(req,res)=>res.json(binanceTrading.status()));
app.post('/api/integrations/binance/probe',async(req,res)=>{try{const market=String(req.body?.market||'spot');const result=await binanceTrading.ping(market);state.infrastructure.binanceTrading={...binanceTrading.status(),lastProbe:result,lastError:null};persist();broadcast();res.json(result);}catch(error){const result={provider:'Binance',online:false,error:error?.message||'BINANCE_PROBE_ERROR',checkedAt:new Date().toISOString()};state.infrastructure.binanceTrading={...binanceTrading.status(),lastProbe:result,lastError:result.error};persist();broadcast();res.status(502).json(result);}});
app.get('/api/integrations/binance/account',async(req,res)=>{try{res.json(await binanceTrading.account(String(req.query.market||'spot')));}catch(error){res.status(400).json({error:error?.message||'BINANCE_ACCOUNT_ERROR'});}});
app.post('/api/integrations/binance/order',async(req,res)=>{try{res.json(await binanceTrading.order(req.body||{}));}catch(error){res.status(400).json({error:error?.message||'BINANCE_ORDER_ERROR'});}});
app.get('/api/integrations/solana/status',(req,res)=>res.json(solanaTrading.status()));
app.post('/api/integrations/solana/probe',async(req,res)=>{try{const result=await solanaTrading.ping();state.infrastructure.solanaTrading={...solanaTrading.status(),lastProbe:result,lastError:null};persist();broadcast();res.json(result);}catch(error){const result={provider:'Solana RPC',online:false,error:error?.message||'SOLANA_PROBE_ERROR',checkedAt:new Date().toISOString()};state.infrastructure.solanaTrading={...solanaTrading.status(),lastProbe:result,lastError:result.error};persist();broadcast();res.status(502).json(result);}});
app.get('/api/integrations/solana/quote',async(req,res)=>{try{res.json(await solanaTrading.quote({inputMint:req.query.inputMint,outputMint:req.query.outputMint,amount:req.query.amount,slippageBps:req.query.slippageBps}));}catch(error){res.status(400).json({error:error?.message||'SOLANA_QUOTE_ERROR'});}});
app.post('/api/integrations/solana/swap/prepare',async(req,res)=>{try{res.json(await solanaTrading.prepareSwap(req.body||{}));}catch(error){res.status(400).json({error:error?.message||'SOLANA_SWAP_PREPARE_ERROR'});}});
app.post('/api/integrations/solana/swap/submit',async(req,res)=>{try{res.json(await solanaTrading.submitSignedTransaction(String(req.body?.signedTransactionBase64||'')));}catch(error){res.status(400).json({error:error?.message||'SOLANA_SWAP_SUBMIT_ERROR'});}});
app.get('/api/integrations/polymarket/status',(req,res)=>res.json(polymarketTrading.status()));
app.post('/api/integrations/polymarket/wallet/connect',async(req,res)=>{try{const address=String(req.body?.address||'');if(!isAddress(address))return res.status(400).json({error:'INVALID_EVM_ADDRESS'});res.status(202).json({status:'connecting',address});void polymarketTrading.connect(address).then(()=>{state.infrastructure.polymarketTrading=polymarketTrading.status();persist();broadcast();}).catch(error=>{state.infrastructure.polymarketTrading={...polymarketTrading.status(),lastError:error?.message||String(error)};persist();broadcast();});}catch(error){res.status(400).json({error:error?.message||'POLYMARKET_CONNECT_ERROR'});}});
app.post('/api/integrations/polymarket/wallet/disconnect',(req,res)=>{polymarketTrading.disconnect();state.infrastructure.polymarketTrading=polymarketTrading.status();persist();broadcast();res.json({ok:true});});
app.get('/api/integrations/polymarket/pending-signature',(req,res)=>res.json(polymarketTrading.pendingSignatures()[0]||null));
app.post('/api/integrations/polymarket/pending-signature/:id',(req,res)=>{const ok=req.body?.rejected?polymarketTrading.resolveSignature(req.params.id,''):polymarketTrading.resolveSignature(req.params.id,String(req.body?.signature||''));res.json({ok});});
app.get('/api/integrations/polymarket/balance',async(req,res)=>{try{res.json(await polymarketTrading.balance());}catch(error){res.status(400).json({error:error?.message||'POLYMARKET_BALANCE_ERROR'});}});
app.get('/api/integrations/polymarket/proposals',(req,res)=>res.json(polymarketTrading.listProposals()));
app.post('/api/integrations/polymarket/proposals/:id/approve',async(req,res)=>{try{res.json(await polymarketTrading.approveProposal(req.params.id));}catch(error){res.status(400).json({error:error?.message||'POLYMARKET_ORDER_ERROR'});}});
app.post('/api/integrations/polymarket/proposals/:id/reject',(req,res)=>{const p=polymarketTrading.rejectProposal(req.params.id);p?res.json(p):res.status(404).json({error:'PROPOSAL_NOT_FOUND'});});
app.post('/api/opportunities/test',(req,res)=>{opportunityBus.emit('raw-opportunity',{strategyId:'liquidation',strategy:'Liquidation Hunter',network:'Arbitrum',asset:'WETH/USDC',confidence:.91,executionProbability:.93,expectedProfitUsd:184,capitalRequiredUsd:0,estimatedSlippageBps:18,riskScore:.21,source:'MANUAL_TEST',synthetic:true,...req.body});res.status(202).json({accepted:true});});
io.on('connection',socket=>socket.emit('state',publicState()));server.listen(PORT,()=>console.log(`AEGIS Command Center core listening on http://localhost:${PORT}`));
