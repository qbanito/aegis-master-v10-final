import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BOT_DEFINITIONS,DEFAULT_RISK} from './config.js';
import {aegisData} from '../../../../../packages/aegis-data/src/index.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'../../data/state.json');
const infra=()=>({
  rpc:[],
  dataQuality:{legacySyntheticQuarantined:0,quarantinedAt:null},
  marketData:{provider:'Binance Spot',online:false,lastProbe:null},
  futuresMarketData:{provider:'Binance USDⓈ-M Futures',online:false,lastProbe:null},
  liquidation:{configured:false,lastScans:[],lastDiscoveries:[],lab:{candidates:0,bands:{},top:[],model:{},updatedAt:null},markets:[]},
  arbitrage:{configured:false,lastScans:[]},
  volatility:{configured:true,lastScans:[]},
  perpetuals:{configured:true,lastScans:[]},
  smartMoney:{configured:false,lastScans:[]},
  momentum:{configured:true,lastScans:[]},
  yield:{configured:true,lastScans:[]},
  yieldData:{provider:'DefiLlama Yields',online:false,lastProbe:null},
  fusion:{recent:[]},
  solana:{configured:false,lastScans:[],lastBirths:[]},
  solanaRpc:{provider:'Solana RPC',online:false,lastProbe:null},
  intelligence:{recent:[],comboLeaderboard:[]},
  simulation:{recent:[],passed:0,rejected:0},
  strategyEvidence:[],
  performance:{updatedAt:null,strategies:[],recent:[]},
  latencyRouter:[],
  polymarket:{configured:true,lastScans:[]},
  polymarketData:{provider:'Polymarket Gamma + CLOB',online:false,lastProbe:null},
  binanceTrading:{provider:'Binance',configured:false,enabled:false,armed:false,lastProbe:null,lastError:null},
  solanaTrading:{provider:'Solana RPC + Jupiter + Jito',configured:false,enabled:false,armed:false,lastProbe:null,lastError:null},
  polymarketTrading:{provider:'Polymarket CLOB',enabled:false,connected:false,authenticated:false,pendingSignatures:0,proposals:0},
  executionControl:{version:1,bots:{},pendingWalletSignatures:[],lastGlobalChangeAt:null},
  marketBots:{lastRunAt:null,bots:{},results:{},connectors:{}},
  kronos:{provider:'Kronos-mini',enabled:false,mode:'DISABLED',serviceUrl:'http://127.0.0.1:8815',lastForecastAt:null},
  botCopilot:{version:1,presets:[],proposals:[],history:[],lastAnalysisByBot:{}},
  centralAgent:{role:'CENTRAL_FINANCE_BRAIN',mode:'SUPERVISOR',status:'BOOTING',lastRunAt:null,lastReportAt:null,openIncidents:0,incidents:[],reports:[],actions:[],profitSnapshot:{},botDiagnostics:[],marketBotDiagnostics:[],policy:{paperOnly:true,liveAutonomous:false},objective:'Maximizar retorno ajustado a riesgo, preservar capital y reportar cada fallo.'},
  production:{supervisor:{status:'BOOTING',lastCheckAt:null,stale:[],recoveries:0},circuitBreakers:[],replay:{lastRun:null},execution:{paper:true,live:false,signer:'NONE',metamask:'BROWSER_MANUAL_APPROVAL'},vault:{configured:false,provider:'NONE',mode:'REFERENCE_ONLY'},wallet:{address:null,networks:[]}}
});
const paperLedger=()=>({version:3,mode:'REAL_MARKET_PAPER',startingEquityUsd:10000,reserveFloorUsd:1000,cashUsd:10000,reservedUsd:1000,equityUsd:10000,realizedPnlUsd:0,unrealizedPnlUsd:0,feesUsd:0,slippageUsd:0,openPositions:[],closedTrades:0,blockedTrades:0,lastMarkAt:null,validated:null});
const initial=()=>({
  version:'11.0.0',mode:'PAPER',startedAt:new Date().toISOString(),
  treasury:{paperBalanceUsd:10000,reservedUsd:1000},risk:{...DEFAULT_RISK},
  paperLedger:paperLedger(),
  allocator:{reservePct:10,lastRunAt:null,strategies:[]},
  bots:BOT_DEFINITIONS.map((b,i)=>({...b,active:true,status:'BOOTING',heartbeat:null,pnl24h:0,opportunities:0,allocationPct:i===9?0:10})),
  wallets:BOT_DEFINITIONS.map((b,i)=>({id:b.wallet,strategyId:b.id,type:'PAPER_SLOT',address:null,balanceUsd:i===9?0:1000})),
  opportunities:[],executions:[],infrastructure:infra()
});
function load(){
  try{
    const old=JSON.parse(fs.readFileSync(file,'utf8')),base=initial();
    const legacyPaperPnl=!old.paperLedger||Number(old.paperLedger.version||0)<2;
    if(legacyPaperPnl){
      old.bots=(old.bots||[]).map(bot=>({...bot,pnl24h:0}));
      old.executions=[];
      old.paperLedger=paperLedger();
      old.infrastructure={...(old.infrastructure||{}),dataQuality:{...(old.infrastructure?.dataQuality||{}),legacyPaperPnlQuarantined:true,quarantinedAt:new Date().toISOString()}};
    }
    // Quarantine legacy synthetic market rows. They were useful for the old
    // demo surface but must not remain in a finance bot's live/PAPER history.
    const legacySynthetic=(old.opportunities||[]).filter(item=>item.synthetic===true||item.source==='V8_SYNTHETIC_SCANNER').length;
    if(legacySynthetic){
      old.opportunities=(old.opportunities||[]).filter(item=>item.synthetic!==true&&item.source!=='V8_SYNTHETIC_SCANNER');
      old.bots=(old.bots||[]).map(bot=>({...bot,opportunities:old.opportunities.filter(item=>item.strategyId===bot.id).length,pnl24h:0}));
      old.infrastructure={...(old.infrastructure||{}),dataQuality:{...(old.infrastructure?.dataQuality||{}),legacySyntheticQuarantined:legacySynthetic,quarantinedAt:new Date().toISOString()}};
    }
    const oi=old.infrastructure||{};
    return {...base,...old,version:'11.0.0',risk:{...base.risk,...(old.risk||{})},paperLedger:{...base.paperLedger,...(old.paperLedger||{}),openPositions:(old.paperLedger?.openPositions||[])},allocator:{...base.allocator,...old.allocator},infrastructure:{...base.infrastructure,...oi,dataQuality:{...base.infrastructure.dataQuality,...(oi.dataQuality||{})},
      marketData:{...base.infrastructure.marketData,...oi.marketData},futuresMarketData:{...base.infrastructure.futuresMarketData,...oi.futuresMarketData},marketBots:{...base.infrastructure.marketBots,...oi.marketBots,bots:{...base.infrastructure.marketBots.bots,...(oi.marketBots?.bots||{})},results:{...base.infrastructure.marketBots.results,...(oi.marketBots?.results||{})},connectors:{...base.infrastructure.marketBots.connectors,...(oi.marketBots?.connectors||{})}},botCopilot:{...base.infrastructure.botCopilot,...oi.botCopilot,presets:oi.botCopilot?.presets||[],proposals:oi.botCopilot?.proposals||[],history:oi.botCopilot?.history||[],lastAnalysisByBot:oi.botCopilot?.lastAnalysisByBot||{}},
      liquidation:{...base.infrastructure.liquidation,...oi.liquidation},arbitrage:{...base.infrastructure.arbitrage,...oi.arbitrage},volatility:{...base.infrastructure.volatility,...oi.volatility},
      perpetuals:{...base.infrastructure.perpetuals,...oi.perpetuals},smartMoney:{...base.infrastructure.smartMoney,...oi.smartMoney},momentum:{...base.infrastructure.momentum,...oi.momentum},yield:{...base.infrastructure.yield,...oi.yield},yieldData:{...base.infrastructure.yieldData,...oi.yieldData},fusion:{...base.infrastructure.fusion,...oi.fusion},solana:{...base.infrastructure.solana,...oi.solana},solanaRpc:{...base.infrastructure.solanaRpc,...oi.solanaRpc},intelligence:{...base.infrastructure.intelligence,...oi.intelligence},simulation:{...base.infrastructure.simulation,...oi.simulation},performance:{...base.infrastructure.performance,...oi.performance},latencyRouter:oi.latencyRouter||base.infrastructure.latencyRouter,polymarket:{...base.infrastructure.polymarket,...oi.polymarket},polymarketData:{...base.infrastructure.polymarketData,...oi.polymarketData},binanceTrading:{...base.infrastructure.binanceTrading,...oi.binanceTrading},solanaTrading:{...base.infrastructure.solanaTrading,...oi.solanaTrading},polymarketTrading:{...base.infrastructure.polymarketTrading,...oi.polymarketTrading},executionControl:{...base.infrastructure.executionControl,...oi.executionControl,bots:{...(oi.executionControl?.bots||{})},pendingWalletSignatures:oi.executionControl?.pendingWalletSignatures||[]},centralAgent:{...base.infrastructure.centralAgent,...oi.centralAgent,policy:{...base.infrastructure.centralAgent.policy,...(oi.centralAgent?.policy||{})}},production:{...base.infrastructure.production,...oi.production}}};
  }catch{const s=initial();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(s,null,2));return s;}
}
export const state=load();
export async function hydrateStateFromNeon(){
  const snapshot=await aegisData.readState('finance');
  if(!snapshot||typeof snapshot!=='object')return false;
  Object.assign(state,snapshot);
  return true;
}
export function persist(){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(state,null,2));
  void aegisData.writeState('finance',state);
}
const publicMarketBotResult=result=>{
  if(!result?.data)return result;
  const data={...result.data};
  if(Array.isArray(data.candidates))data.candidates=data.candidates.slice(0,20);
  if(Array.isArray(data.news))data.news=data.news.slice(0,20);
  else if(data.news&&Array.isArray(data.news.news))data.news={...data.news,news:data.news.news.slice(0,20)};
  return {...result,data};
};
const recent=(value,limit)=>Array.isArray(value)?value.slice(0,limit):[];
export function publicState(){const {executionIds:validatedExecutionIds,...publicValidated}=(state.paperLedger?.validated||{});return {...state,paperLedger:{...state.paperLedger,validated:publicValidated},opportunities:recent(state.opportunities,50),executions:recent(state.executions,50),infrastructure:{...state.infrastructure,
  liquidation:{...state.infrastructure.liquidation,lastScans:recent(state.infrastructure.liquidation.lastScans,20),lastDiscoveries:recent(state.infrastructure.liquidation.lastDiscoveries,10)},
  arbitrage:{...state.infrastructure.arbitrage,lastScans:recent(state.infrastructure.arbitrage.lastScans,20)},
  volatility:{...state.infrastructure.volatility,lastScans:recent(state.infrastructure.volatility.lastScans,30)},
  perpetuals:{...state.infrastructure.perpetuals,lastScans:recent(state.infrastructure.perpetuals.lastScans,30)},
  smartMoney:{...state.infrastructure.smartMoney,lastScans:recent(state.infrastructure.smartMoney.lastScans,30)},
  momentum:{...state.infrastructure.momentum,lastScans:recent(state.infrastructure.momentum.lastScans,30)},
  yield:{...state.infrastructure.yield,lastScans:recent(state.infrastructure.yield.lastScans,20)},
  fusion:{...state.infrastructure.fusion,recent:recent(state.infrastructure.fusion.recent,20)},
  solana:{...state.infrastructure.solana,lastScans:recent(state.infrastructure.solana.lastScans,20),lastBirths:recent(state.infrastructure.solana.lastBirths,50)},
  intelligence:{...state.infrastructure.intelligence,recent:recent(state.infrastructure.intelligence.recent,20),comboLeaderboard:recent(state.infrastructure.intelligence.comboLeaderboard,20)},
  simulation:{...state.infrastructure.simulation,recent:recent(state.infrastructure.simulation.recent,30)},
  strategyEvidence:recent(state.infrastructure.strategyEvidence,150),
  performance:{...state.infrastructure.performance,recent:recent(state.infrastructure.performance.recent,30)},
  polymarket:{...state.infrastructure.polymarket,lastScans:recent(state.infrastructure.polymarket.lastScans,20)},
  marketBots:{...state.infrastructure.marketBots,results:Object.fromEntries(Object.entries(state.infrastructure.marketBots.results||{}).map(([id,result])=>[id,publicMarketBotResult(result)]))},
  botCopilot:{...state.infrastructure.botCopilot,presets:recent(state.infrastructure.botCopilot?.presets,100),proposals:recent(state.infrastructure.botCopilot?.proposals,100),history:recent(state.infrastructure.botCopilot?.history,50)},
  executionControl:{...state.infrastructure.executionControl,pendingWalletSignatures:recent(state.infrastructure.executionControl?.pendingWalletSignatures,50).map(row=>({...row,prepared:undefined}))},
  centralAgent:{...state.infrastructure.centralAgent,incidents:recent(state.infrastructure.centralAgent.incidents,40),reports:recent(state.infrastructure.centralAgent.reports,10),actions:recent(state.infrastructure.centralAgent.actions,20)}
}};}
