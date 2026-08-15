const BOT_INFRA={liquidation:'liquidation',arbitrage:'arbitrage','solana-radar':'solana',volatility:'volatility',momentum:'momentum',perpetuals:'perpetuals',polymarket:'polymarket','smart-money':'smartMoney',yield:'yield'};
const WAITING=/^(WAITING_|NOT_CONFIGURED)/;
const FAILURE=/ERROR|FAILED|STALE|OFFLINE|HTTP_4|HTTP_5|NOT_CONFIGURED/;
const BOT_DEPENDENCIES={
  liquidation:['rpc:arbitrum','AAVE_V3_POOL_ADDRESS','borrower_index'],arbitrage:['rpc:arbitrum','ARB_ROUTER_A','ARB_ROUTER_B','ARB_TOKEN_IN','ARB_TOKEN_OUT'],
  'solana-radar':['solana_rpc','SOLANA_LAUNCH_PROGRAMS'],volatility:['binance_spot'],momentum:['binance_spot'],perpetuals:['binance_futures'],
  polymarket:['polymarket_data'], 'smart-money':['rpc:ethereum','WHALE_TOKEN_CONFIG'],yield:['defillama_yields'],allocator:['paper_ledger']
};
const stateConnectors=state=>state.infrastructure?.marketBots?.connectors||{};

const blank=()=>({
  role:'CENTRAL_FINANCE_BRAIN',mode:'SUPERVISOR',status:'BOOTING',lastRunAt:null,lastReportAt:null,
  openIncidents:0,incidents:[],reports:[],actions:[],profitSnapshot:{},policy:{paperOnly:true,liveAutonomous:false},
  botDiagnostics:[],marketBotDiagnostics:[],objective:'Maximizar retorno ajustado a riesgo, preservar capital y reportar cada fallo.'
});

export class CentralSupervisor{
  constructor({state,persist,journal,broadcast,performanceSnapshot,governance,tools={},intervalMs=15000}={}){
    this.state=state;this.persist=persist;this.journal=journal;this.broadcast=broadcast;this.performanceSnapshot=performanceSnapshot;this.governance=governance;this.tools=tools;this.intervalMs=intervalMs;this.timer=null;this.running=false;
    this.data={...blank(),...(state.infrastructure.centralAgent||{}),policy:{...blank().policy,...(state.infrastructure.centralAgent?.policy||{})}};
    this.state.infrastructure.centralAgent=this.data;
  }
  snapshot(){return JSON.parse(JSON.stringify(this.data));}
  start(){if(this.timer)return;this.tick();this.timer=setInterval(()=>this.tick(),this.intervalMs);this.timer.unref?.();}
  async tick(){if(this.running)return this.snapshot();this.running=true;try{
    const now=new Date().toISOString(),issues=this.collectIssues(),current=new Set(issues.map(x=>x.fingerprint));
    for(const incident of this.data.incidents||[])if(incident.status==='open'&&!current.has(incident.fingerprint)){incident.status='resolved';incident.resolvedAt=now;}
    for(const issue of issues){let incident=this.data.incidents.find(x=>x.fingerprint===issue.fingerprint&&x.status==='open');if(incident){incident.lastSeenAt=now;incident.count=(incident.count||1)+1;incident.details=issue.details;}else{incident={...issue,id:`inc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,status:'open',firstSeenAt:now,lastSeenAt:now,count:1};this.data.incidents.unshift(incident);this.journal?.centralIncident?.(incident);}}
    this.data.incidents=this.data.incidents.slice(0,200);this.data.openIncidents=this.data.incidents.filter(x=>x.status==='open').length;this.data.riskGovernance=this.governance?.snapshot?.()||null;
    const performance=this.performanceSnapshot?.()||{};this.data.botDiagnostics=this.buildBotDiagnostics();this.data.marketBotDiagnostics=this.buildMarketBotDiagnostics();const report=this.buildReport(issues,performance,now);this.data.profitSnapshot=report.profit;this.data.reports.unshift(report);this.data.reports=this.data.reports.slice(0,50);this.data.lastRunAt=now;this.data.lastReportAt=now;this.data.status=issues.some(x=>x.severity==='critical')?'DEGRADED':issues.length?'ATTENTION':'HEALTHY';
    const action=this.safeActions(issues,now);if(action)this.data.actions.unshift(action);this.data.actions=this.data.actions.slice(0,80);
    this.persist?.();this.journal?.centralReport?.(report);this.broadcast?.();return this.snapshot();
  }finally{this.running=false;}}
  collectIssues(){
    const issues=[],now=Date.now();
    for(const bot of this.state.bots){
      if(!bot.active)continue;
      const marketBot=bot.marketBotId?this.state.infrastructure.marketBots?.bots?.[bot.marketBotId]:null;const heartbeat=bot.heartbeat||marketBot?.lastScanAt;const staleWindow=bot.marketBotId?Math.max(180000,Number(process.env.MARKET_BOTS_SCAN_MS||120000)*3):90000;
      const age=heartbeat?now-Date.parse(heartbeat):Infinity;
      if(age>staleWindow)issues.push(this.issue(`bot:${bot.id}:stale`,'critical','BOT_STALE',`El bot ${bot.name} no actualiza heartbeat.`,{botId:bot.id,ageMs:Number.isFinite(age)?age:null,status:bot.status,staleWindowMs:staleWindow}));
      else if(WAITING.test(String(bot.status||'')))issues.push(this.issue(`bot:${bot.id}:${bot.status}`,'warning',String(bot.status),`${bot.name} está activo pero bloqueado por configuración o dependencia.`,{botId:bot.id,status:bot.status}));
      else if(FAILURE.test(String(bot.status||'')))issues.push(this.issue(`bot:${bot.id}:${bot.status}`,'error',String(bot.status),`${bot.name} reporta un estado de fallo.`,{botId:bot.id,status:bot.status}));
    }
    const infra=this.state.infrastructure;
    for(const [name,label,bots] of [['marketData','Binance Spot',['volatility','momentum']],['futuresMarketData','Binance Futures',['perpetuals']],['yieldData','DeFiLlama Yield',['yield']],['solanaRpc','Solana RPC',['solana-radar']],['polymarketData','Polymarket Data',['polymarket']]]){
      const item=infra[name];if(item&&!item.online){const error=String(item.error||'OFFLINE');issues.push(this.issue(`dependency:${name}:${error}`,'error','DEPENDENCY_OFFLINE',`${label} no está online para: ${bots.join(', ')}.`,{dependency:name,error,bots}));}
    }
    for(const row of infra.rpc||[])if(!row.online)issues.push(this.issue(`rpc:${row.network}:${row.error||'offline'}`,'error','RPC_OFFLINE',`RPC ${row.network} no está disponible.`,{network:row.network,error:row.error}));
    if(this.state.mode!=='LIVE')issues.push(this.issue('policy:paper-mode','info','PAPER_MODE','El sistema analiza y ejecuta simulaciones PAPER; no hay órdenes reales autónomas.',{mode:this.state.mode}));
    return issues;
  }
  issue(fingerprint,severity,code,message,details){return{fingerprint,severity,code,message,details,createdAt:new Date().toISOString()};}
  buildBotDiagnostics(){
    const infra=this.state.infrastructure||{};
    const marketDiagnostics=Object.fromEntries(this.buildMarketBotDiagnostics().map(item=>[item.id,item]));
    return this.state.bots.map(bot=>{
      if(bot.marketBotId&&marketDiagnostics[bot.marketBotId])return {...marketDiagnostics[bot.marketBotId],id:bot.id,name:bot.name,status:bot.status,marketBotId:bot.marketBotId};
      const blockers=[],warnings=[],requirements=BOT_DEPENDENCIES[bot.id]||[];
      const rpcOnline=name=>(infra.rpc||[]).some(row=>row.network===name&&row.online);
      if(!bot.active)warnings.push('Bot pausado manualmente.');
      if(/^WAITING_|NOT_CONFIGURED|ERROR|FAILED/.test(String(bot.status||'')))blockers.push(`Estado actual: ${bot.status}.`);
      if(['volatility','momentum'].includes(bot.id)&&!infra.marketData?.online)blockers.push('Binance Spot no está disponible.');
      if(bot.id==='perpetuals'&&!infra.futuresMarketData?.online)blockers.push(`Binance Futures no está disponible (${infra.futuresMarketData?.error||'OFFLINE'}).`);
      if(bot.id==='polymarket'&&!infra.polymarketData?.online)blockers.push('Gamma/CLOB de Polymarket no está disponible.');
      if(bot.id==='yield'&&!infra.yieldData?.online)blockers.push('DefiLlama Yields no está disponible.');
      if(['liquidation','arbitrage'].includes(bot.id)&&!rpcOnline('arbitrum'))blockers.push('RPC Arbitrum no está disponible.');
      if(bot.id==='smart-money'&&!rpcOnline('ethereum'))blockers.push('RPC Ethereum no está disponible.');
      if(bot.id==='solana-radar'&&!infra.solanaRpc?.online)blockers.push(`Solana RPC no está disponible (${infra.solanaRpc?.error||'OFFLINE'}).`);
      if(bot.id==='arbitrage'&&!infra.arbitrage?.configured)blockers.push('Faltan routers y tokens de la ruta.');
      if(bot.id==='liquidation'&&!infra.liquidation?.poolAddress)blockers.push('Falta AAVE_V3_POOL_ADDRESS.');
      if(bot.id==='liquidation'&&infra.liquidation?.discoveredBorrowers===0&&infra.liquidation?.watchlistCount===0)warnings.push('No hay prestatarios en watchlist/indexador; la ventana de eventos puede estar vacía.');
      if(bot.id==='solana-radar'&&!infra.solana?.configured)blockers.push('Faltan programas Solana de lanzamiento para observar.');
      if(bot.id==='smart-money'&&!infra.smartMoney?.configured)blockers.push('Falta WHALE_TOKEN_CONFIG con tokens y umbrales.');
      if(bot.id==='solana-radar'&&Number(infra.solanaRpc?.endpoints||1)<2)warnings.push('Solo hay un RPC Solana; añadir failover evita 429.');
      if(bot.id==='perpetuals'&&infra.futuresMarketData?.error==='BINANCE_FUTURES_HTTP_451')warnings.push('La región bloquea Binance Futures; añadir un mercado de derivados alternativo.');
      const readiness=blockers.length?'BLOCKED':warnings.length?'DEGRADED':'READY';
      return {id:bot.id,name:bot.name,status:bot.status,readiness,requirements,blockers,warnings,nextAction:blockers[0]||warnings[0]||'Mantener monitorización y validar edge neto.',liveExecutionReady:false};
    });
  }
  buildMarketBotDiagnostics(){
    const registry=this.tools.marketBots;
    if(registry?.definitions)return registry.definitions().map(bot=>{const gate=registry.readiness(bot.id,stateConnectors(this.state));return {id:bot.id,name:bot.name,status:bot.status,readiness:gate.status,blockers:gate.blockers,warnings:gate.warnings,requirements:bot.requirements,nextAction:gate.blockers[0]||gate.warnings[0]||'Ejecutar scan PAPER y validar edge neto.',liveExecutionReady:false};});
    return Object.values(this.state.infrastructure.marketBots?.bots||{}).map(bot=>({id:bot.id,name:bot.name,status:bot.status,readiness:'UNKNOWN',blockers:['Market bot registry no disponible.'],warnings:[],requirements:bot.requirements||[],nextAction:'Revisar el registro de bots.',liveExecutionReady:false}));
  }
  buildReport(issues,performance,now){
    const open=issues.length,critical=issues.filter(x=>x.severity==='critical').length,errors=issues.filter(x=>x.severity==='error').length;
    const pnl=this.state.bots.reduce((sum,b)=>sum+Number(b.pnl24h||0),0);const actionable=this.state.opportunities.filter(item=>!item.metadata?.advisory&&!item.metadata?.signalOnly);const opportunities=actionable.length;const executions=this.state.executions.length;
    const ranked=[...this.state.bots].filter(b=>b.id!=='allocator').sort((a,b)=>Number(b.pnl24h||0)-Number(a.pnl24h||0)).slice(0,3).map(b=>({id:b.id,name:b.name,pnl24h:b.pnl24h,opportunities:b.opportunities,status:b.status}));
    return{id:`report_${Date.now()}`,createdAt:now,status:critical?'DEGRADED':open?'ATTENTION':'HEALTHY',headline:critical?`Atención inmediata: ${critical} incidencias críticas.`:open?`${open} incidencias requieren seguimiento.`:'Todos los controles centrales están saludables.',incidents:{total:open,critical,errors,warnings:issues.filter(x=>x.severity==='warning').length},profit:{pnl24h:Number(pnl.toFixed(2)),pnlMode:this.state.mode==='LIVE'?'LIVE_RECORDED':'PAPER_SIMULATED',opportunities,executions,topBots:ranked,performance:performance.strategies||[]},riskGovernance:this.governance?.snapshot?.()||null,control:{activeBots:this.state.bots.filter(b=>b.active).length,totalBots:this.state.bots.length,marketBots:this.data.marketBotDiagnostics.length,mode:this.state.mode,liveAutonomous:false},botDiagnostics:this.data.botDiagnostics,marketBotDiagnostics:this.data.marketBotDiagnostics,issues};
  }
  safeActions(issues,now){
    const governance=this.governance?.snapshot?.();
    if(governance?.breaches?.some(item=>['DAILY_LOSS_LIMIT','DRAWDOWN_LIMIT'].includes(item))&&!this.state.risk.globalKillSwitch&&typeof this.governance?.engageKillSwitch==='function'){
      this.governance.engageKillSwitch(`Automatic risk boundary: ${governance.breaches.join(', ')}`,'CENTRAL_FINANCE_BRAIN');
      return {createdAt:now,type:'GLOBAL_KILL_SWITCH',result:'Finance Brain activó el kill-switch por límite duro de riesgo.',breaches:governance.breaches};
    }
    if(issues.some(x=>x.code==='BOT_STALE')&&typeof this.tools.recoverStale==='function'){const ids=issues.filter(x=>x.code==='BOT_STALE').map(x=>x.details.botId);for(const id of ids)this.tools.recoverStale(id);return{createdAt:now,type:'RECOVERY_ATTEMPT',bots:ids,result:'Supervisor solicitó recuperación segura; no se habilitó LIVE.'};}
    if(typeof this.tools.rebalance==='function'&&(!this.data.actions[0]||Date.now()-Date.parse(this.data.actions[0].createdAt)>60000)){try{this.tools.rebalance();return{createdAt:now,type:'PAPER_REBALANCE',result:'Asignación PAPER recalculada por el supervisor.'};}catch(error){return{createdAt:now,type:'PAPER_REBALANCE_FAILED',result:error?.message||'REBALANCE_ERROR'};}}
    return null;
  }
}

export const centralSupervisorDefaults=blank;
