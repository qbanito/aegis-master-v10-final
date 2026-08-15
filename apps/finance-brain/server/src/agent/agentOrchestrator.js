import {completeWithProvider,getProviderStatus} from './providerAdapter.js';

const allowedTools=new Set(['scan_liquidations','discover_borrowers','rescore_liquidations','scan_arbitrage','scan_volatility','scan_perpetuals','scan_solana','scan_polymarket','scan_smart_money','scan_momentum','scan_yield','scan_market_bots','rebalance','probe_rpc','production_status','performance_snapshot','central_report','risk_snapshot','set_risk_policy','pause_strategy','engage_kill_switch']);

function parseEnvelope(text){
  const raw=String(text||'').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  try{
    const parsed=JSON.parse(raw);
    const calls=Array.isArray(parsed.toolCalls)?parsed.toolCalls.map(call=>typeof call==='string'?{name:call,args:{}}:call).filter(call=>allowedTools.has(call?.name)):[];
    return {reply:String(parsed.reply||'').trim()||'Proceso completado.',toolCalls:calls};
  }catch{
    return {reply:String(text||'').trim()||'Proceso completado.',toolCalls:[]};
  }
}

export function createAgentOrchestrator({state,tools}){
  const history=[];
  function context(){
    const opp=state.opportunities.filter(o=>!o.metadata?.advisory&&!o.metadata?.signalOnly).slice(0,8).map(o=>({strategy:o.strategy,network:o.network,asset:o.asset,expectedProfitUsd:o.expectedProfitUsd,score:o.brain?.score,decision:o.brain?.decision,riskApproved:o.risk?.approved}));
    const bots=state.bots.map(b=>({id:b.id,name:b.name,status:b.status,active:b.active,pnl24h:b.pnl24h,opportunities:b.opportunities,heartbeat:b.heartbeat,network:b.network}));
    const infra=state.infrastructure||{};
    const marketBots=Object.fromEntries(Object.entries(infra.marketBots?.bots||{}).map(([id,bot])=>[id,{id,name:bot.name,status:bot.status,lastScanAt:bot.lastScanAt,market:bot.market,strategy:bot.strategy,parameters:bot.parameters}]));
    const marketResults=Object.fromEntries(Object.entries(infra.marketBots?.results||{}).map(([id,result])=>[id,{status:result.status,scannedAt:result.scannedAt,durationMs:result.durationMs,discoveries:result.discoveries,tradeable:result.tradeable,signal:result.signal,gate:result.gate,error:result.error,summary:{candidateCount:result.data?.candidates?.length||0,securityCount:result.data?.security?.length||0,newsCount:result.data?.news?.length||0,barCount:result.data?.bars?.bars?.length||result.data?.bars?.length||0,contractCount:result.data?.contracts?.contracts?.length||result.data?.contracts?.length||0,priceCount:result.data?.prices?.prices?.length||result.data?.prices?.length||0}}]));
    return {generatedAt:new Date().toISOString(),mode:state.mode,treasury:state.treasury,risk:state.risk,riskGovernance:infra.centralAgent?.governance||null,bots,topOpportunities:opp,providers:{marketData:infra.marketData,futuresMarketData:infra.futuresMarketData,solanaRpc:infra.solanaRpc,polymarketData:infra.polymarketData,yieldData:infra.yieldData,kronos:infra.kronos,rpc:infra.rpc,marketBots:infra.marketBots?.connectors||{}},marketBots,marketResults,centralAgent:{status:infra.centralAgent?.status,openIncidents:infra.centralAgent?.openIncidents,lastReportAt:infra.centralAgent?.lastReportAt,objective:infra.centralAgent?.objective,botDiagnostics:infra.centralAgent?.botDiagnostics,marketBotDiagnostics:infra.centralAgent?.marketBotDiagnostics,recentIncidents:(infra.centralAgent?.incidents||[]).filter(item=>item.status==='open').slice(0,10)}};
  }
  async function chat(message,conversation=[]){
    const provider=getProviderStatus();
    const snapshot=context();
    const turns=Array.isArray(conversation)?conversation.filter(turn=>['user','assistant'].includes(turn?.role)&&String(turn?.content||'').trim()).slice(-10):[];
    const history=turns.length?` Conversación reciente: ${turns.map(turn=>`${turn.role==='user'?'Neiver':'Finance Brain'}: ${String(turn.content).slice(0,1800)}`).join(' | ')}`:'';
    const system=`You are AEGIS, the central Finance Brain supervisor and AI operator of a trading research suite. Speak in Spanish unless the user writes in another language. Your job is to control the health of all bots, preserve capital, compare risk-adjusted opportunities, detect failures, keep an auditable report and recommend the next safe action. You have a fresh snapshot with provider health, bot heartbeats, last scans, gates, incidents, paper ledger and governance limits. Answer from that snapshot and state the timestamp/source when freshness matters. If data is missing or stale, say exactly what is missing and which connector fixes it. You may coordinate only read-only scanners and bounded PAPER-mode governance actions. The deterministic governance layer is always the final veto: never bypass its limits, never lower hard safety bounds, never clear the kill switch, never enable LIVE, never claim a guaranteed profit and never claim LIVE execution occurred. Speak naturally in 2 to 6 connected sentences; do not use long report-style lists unless Neiver asks. Tool calls must be objects with "name" and optional "args". Reply as compact JSON with exactly two keys: "reply" (string) and "toolCalls" (array). Allowed toolCalls: scan_liquidations, discover_borrowers, rescore_liquidations, scan_arbitrage, scan_volatility, scan_perpetuals, scan_solana, scan_polymarket, scan_smart_money, scan_momentum, scan_yield, scan_market_bots, rebalance, probe_rpc, production_status, performance_snapshot, central_report, risk_snapshot, set_risk_policy, pause_strategy, engage_kill_switch. For set_risk_policy use {"args":{"changes":{...}}}; for pause_strategy use {"args":{"strategyId":"...","reason":"..."}}; for engage_kill_switch use {"args":{"reason":"..."}}. If no tool is needed use []. Current AEGIS state: ${JSON.stringify(snapshot)}.${history}`;
    const llm=await completeWithProvider({system,user:message});
    const envelope=parseEnvelope(llm.text);
    const events=[];
    for(const call of envelope.toolCalls){
      const name=call.name,args=call.args||{};
      const fn=tools[name];
      if(typeof fn!=='function') continue;
      const startedAt=new Date().toISOString();
      let result=null;
      try{result=await fn(args);events.push({tool:name,args,status:'completed',startedAt,finishedAt:new Date().toISOString(),summary:summarize(result)});}catch(error){events.push({tool:name,args,status:'failed',startedAt,finishedAt:new Date().toISOString(),summary:error?.message||'TOOL_ERROR'});}
      if(name==='central_report'&&result?.reports?.[0]){
        const report=result.reports[0],profit=report.profit||{};
        envelope.reply=`${envelope.reply} ${report.headline} Incidencias abiertas: ${result.openIncidents||0}. PNL PAPER 24h: $${Number(profit.pnl24h||0).toFixed(2)}; oportunidades: ${profit.opportunities||0}.`;
      }
    }
    const answer={id:`msg_${Date.now()}`,reply:envelope.reply,toolCalls:events,provider:llm.provider,model:llm.model,createdAt:new Date().toISOString()};
    history.unshift({user:message,...answer});history.splice(30);
    return answer;
  }
  return {chat,status:()=>({...getProviderStatus(),history:history.slice(0,10)}),snapshot:context,history};
}

function summarize(v){
  if(Array.isArray(v)) return `${v.length} registros`;
  if(v?.ok===true) return 'OK';
  if(v?.lastScans) return `${v.lastScans.length} scans`;
  if(v?.discoveries) return `${v.discoveries.length} descubrimientos`;
  if(v?.candidates!==undefined) return `${v.candidates} candidatos de liquidación`;
  if(v?.execution||v?.supervisor||v?.vault) return 'Estado de producción consultado';
  if(v?.strategies&&v?.recent) return `${v.strategies.length} estrategias en rendimiento`;
  if(v?.strategies) return `${v.strategies.length} estrategias`;
  return 'Completado';
}
