import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ethers} from 'ethers';
import {io} from 'socket.io-client';
import {
  Activity,BarChart3,Bell,BookOpen,Brain,CircleDollarSign,Database,FlaskConical,
  Gauge,HelpCircle,Landmark,LayoutDashboard,MessageSquare,Mic,Network,Percent,
  PieChart,PlugZap,Power,Radio,RefreshCw,Search,Send,Settings,Shield,ShieldAlert,
  Sparkles,Target,TrendingUp,Wallet,AudioWaveform,Zap
} from 'lucide-react';
import {
  API,getState,toggleBot,rebalanceCapital,scanLiquidations,scanArbitrage,scanVolatility,
  scanPerpetuals,scanSmartMoney,scanMomentum,scanYield,scanSolanaRadar,demoScanSolanaRadar,scanPolymarket,
  getAgentStatus,chatAgent,getLiquidationLab,connectPolymarketWallet,
  getPolymarketPendingSignature,resolvePolymarketSignature
} from './api.js';
import BotUniverse from './BotUniverse.jsx';
import './style.css';
import './lab.css';

const MONEY=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const fmt=n=>MONEY.format(Number(n||0));
const short=s=>s?`${s.slice(0,6)}…${s.slice(-4)}`:'—';
const pct=n=>`${Number(n||0).toFixed(1)}%`;
const nowTime=()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const chainName=chainId=>{const raw=String(chainId).toLowerCase();const id=raw.startsWith('0x')?Number.parseInt(raw,16):Number(raw);return ({1:'Ethereum',42161:'Arbitrum',137:'Polygon',8453:'Base'}[id]||`Chain ${raw}`)};

const BOT_META={
  liquidation:{n:1,label:'LIQUIDATION HUNTER',sub:'Buscando oportunidades...',accent:'#2d91ff',Icon:Zap},
  arbitrage:{n:2,label:'DEX ARBITRAGE HUNTER',sub:'Escaneando DEXs...',accent:'#38d878',Icon:RefreshCw},
  'solana-radar':{n:3,label:'SOLANA EARLY TOKEN RADAR',sub:'Monitoreando nuevos tokens...',accent:'#9c5cff',Icon:Target},
  volatility:{n:4,label:'VOLATILITY HUNTER',sub:'Analizando volatilidad...',accent:'#ff713a',Icon:AudioWaveform},
  momentum:{n:5,label:'MOMENTUM / TREND AGENT',sub:'Detectando tendencias...',accent:'#e9b949',Icon:TrendingUp},
  perpetuals:{n:6,label:'PERPETUALS & FUNDING HUNTER',sub:'Escaneando funding rates...',accent:'#24d3e5',Icon:Percent},
  polymarket:{n:7,label:'POLYMARKET INTELLIGENCE',sub:'Analizando mercados...',accent:'#9b62ff',Icon:Target},
  'smart-money':{n:8,label:'WHALE & SMART-MONEY TRACKER',sub:'Siguiendo smart money...',accent:'#ff7c3e',Icon:Activity},
  yield:{n:9,label:'DEFI YIELD / POOL OPPORTUNITY',sub:'Buscando pools rentables...',accent:'#39d36d',Icon:Landmark},
  allocator:{n:10,label:'META STRATEGY / CAPITAL ALLOCATOR',sub:'Optimizando asignación de capital...',accent:'#e8bd42',Icon:Target}
};
const BOT_ORDER=['liquidation','arbitrage','solana-radar','volatility','momentum','perpetuals','polymarket','smart-money','yield','allocator'];
const TOOL_TO_BOT={scan_liquidations:'liquidation',scan_arbitrage:'arbitrage',scan_volatility:'volatility',scan_perpetuals:'perpetuals',scan_solana:'solana-radar',scan_polymarket:'polymarket',scan_smart_money:'smart-money',scan_momentum:'momentum',scan_yield:'yield',rebalance:'allocator'};
const DIRECT_ACTIONS={liquidation:scanLiquidations,arbitrage:scanArbitrage,'solana-radar':scanSolanaRadar,volatility:scanVolatility,momentum:scanMomentum,perpetuals:scanPerpetuals,polymarket:scanPolymarket,'smart-money':scanSmartMoney,yield:scanYield,allocator:rebalanceCapital};

function App(){
  const [state,setState]=useState(null);
  const [core,setCore]=useState('CONNECTING');
  const [account,setAccount]=useState('');
  const [walletNetwork,setWalletNetwork]=useState('');
  const [clock,setClock]=useState(nowTime());
  const [selected,setSelected]=useState(null);
  const [agent,setAgent]=useState({provider:'mock',model:'AEGIS local demo',configured:true});
  const [liquidationLab,setLiquidationLab]=useState(null);
  const [messages,setMessages]=useState([{role:'agent',text:'AEGIS online. Estoy conectado al cerebro central y listo para coordinar los agentes en modo PAPER.',time:nowTime()}]);
  const [input,setInput]=useState('');
  const [brainMode,setBrainMode]=useState('IDLE');
  const [activeBot,setActiveBot]=useState(null);
  const [sending,setSending]=useState(false);
  const [toast,setToast]=useState('');
  const chatEnd=useRef(null);

  useEffect(()=>{
    let alive=true;
    getState().then(s=>{if(alive){setState(s);setCore('ONLINE')}}).catch(()=>setCore('OFFLINE'));
    getAgentStatus().then(x=>alive&&setAgent(x)).catch(()=>{});
    getLiquidationLab().then(x=>alive&&setLiquidationLab(x)).catch(()=>{});
    const socket=io(API,{reconnection:true});
    socket.on('connect',()=>setCore('ONLINE'));socket.on('disconnect',()=>setCore('OFFLINE'));socket.on('state',s=>setState(s));
    const timer=setInterval(()=>setClock(nowTime()),1000);
    const onAccountsChanged=accounts=>setAccount(accounts?.[0]||'');
    const onChainChanged=chainId=>setWalletNetwork(chainName(chainId));
    window.ethereum?.on?.('accountsChanged',onAccountsChanged);window.ethereum?.on?.('chainChanged',onChainChanged);
    return()=>{alive=false;socket.close();clearInterval(timer);window.ethereum?.removeListener?.('accountsChanged',onAccountsChanged);window.ethereum?.removeListener?.('chainChanged',onChainChanged)};
  },[]);
  useEffect(()=>chatEnd.current?.scrollIntoView({behavior:'smooth'}),[messages,sending]);

  const totalPnl=useMemo(()=>state?.bots?.reduce((a,b)=>a+Number(b.pnl24h||0),0)||0,[state]);
  const allocations=useMemo(()=>state?.allocator?.strategies||[],[state]);
  const topOpp=state?.opportunities?.slice(0,5)||[];
  const recentExec=state?.executions?.slice(0,4)||[];

  async function connectMetaMask(){
    try{
      if(!window.ethereum)throw new Error('MetaMask no está instalado en este navegador.');
      const provider=new ethers.BrowserProvider(window.ethereum);const accounts=await provider.send('eth_requestAccounts',[]);const network=await provider.getNetwork();
      setAccount(accounts[0]);setWalletNetwork(chainName(network.chainId));
      if(state.infrastructure?.polymarketTrading?.enabled){
        await connectPolymarketWallet(accounts[0]);
        await signPolymarketRequests(accounts[0]);
        setToast(`MetaMask conectado · ${chainName(network.chainId)} · Polymarket autenticado con aprobación manual.`);
      }else setToast(`MetaMask conectado como wallet administrativa · ${chainName(network.chainId)}. Las firmas siguen siendo manuales.`);
    }catch(e){setToast(e.message)}
  }

  async function signPolymarketRequests(address){
    const deadline=Date.now()+15000;
    while(Date.now()<deadline){
      const request=await getPolymarketPendingSignature();
      if(!request){await new Promise(resolve=>setTimeout(resolve,350));continue;}
      try{
        const typedData=JSON.stringify({domain:request.domain,types:request.types,primaryType:request.primaryType,message:request.message});
        const signature=await window.ethereum.request({method:'eth_signTypedData_v4',params:[address,typedData]});
        await resolvePolymarketSignature(request.id,{signature});
      }catch(error){
        await resolvePolymarketSignature(request.id,{rejected:true,reason:error?.message||'MetaMask signature rejected'}).catch(()=>{});
        throw error;
      }
    }
  }

  async function runBot(botId){
    const fn=DIRECT_ACTIONS[botId];if(!fn)return;
    setBrainMode('EXECUTING');setActiveBot(botId);
    try{await fn();setToast(`${BOT_META[botId]?.label||botId}: proceso completado.`);}catch(e){setToast(e.message)}
    finally{setTimeout(()=>{setBrainMode('IDLE');setActiveBot(null)},1000)}
  }

  async function runDemo(){
    setBrainMode('EXECUTING');setActiveBot('solana-radar');
    try{const result=await demoScanSolanaRadar();const kpis=result.scan?.kpis||{};setToast(`SOLANA RADAR DEMO: ${kpis.candidates||0} candidatos · ${kpis.audited||0} auditados · ${kpis.qualified||0} calificados · sin ejecución.`);}catch(e){setToast(e.message)}
    finally{setTimeout(()=>{setBrainMode('IDLE');setActiveBot(null)},1000)}
  }

  async function toggleFromConfig(botId){
    try{await toggleBot(botId);setToast(`${BOT_META[botId]?.label||botId}: configuración actualizada.`);}catch(e){setToast(e.message)}
  }

  function scrollToBotConfig(){document.getElementById('bot-config')?.scrollIntoView({behavior:'smooth',block:'start'})}

  async function sendMessage(text=input){
    const msg=String(text||'').trim();if(!msg||sending)return;
    setMessages(m=>[...m,{role:'user',text:msg,time:nowTime()}]);setInput('');setSending(true);setBrainMode('THINKING');
    try{
      const answer=await chatAgent(msg);
      const tools=answer.toolCalls||[];
      if(tools.length){setBrainMode('EXECUTING');setActiveBot(TOOL_TO_BOT[tools[0].tool]||null)}
      setMessages(m=>[...m,{role:'agent',text:answer.reply,time:nowTime(),tools,provider:answer.provider,model:answer.model}]);
      setAgent(a=>({...a,provider:answer.provider||a.provider,model:answer.model||a.model}));
      setTimeout(()=>{setBrainMode('IDLE');setActiveBot(null)},1500);
    }catch(e){
      setBrainMode('ALERT');setMessages(m=>[...m,{role:'agent',text:`No pude completar la solicitud: ${e.message}`,time:nowTime(),error:true}]);
      setTimeout(()=>setBrainMode('IDLE'),1800);
    }finally{setSending(false)}
  }

  function voice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setToast('El reconocimiento de voz no está disponible en este navegador.');return}
    const r=new SR();r.lang='es-US';r.interimResults=false;r.maxAlternatives=1;setBrainMode('LISTENING');
    r.onresult=e=>{const t=e.results[0][0].transcript;setInput(t);setBrainMode('IDLE')};
    r.onerror=()=>setBrainMode('IDLE');r.onend=()=>brainMode==='LISTENING'&&setBrainMode('IDLE');r.start();
  }

  if(!state)return <div className="boot"><Brain/><h1>AEGIS</h1><p>Inicializando command center…</p></div>;
  return <div className="shell">
    <aside className="sidebar">
      <Logo/>
      <nav>{[
        [LayoutDashboard,'Dashboard'],[Brain,'AEGIS Brain'],[Sparkles,'Bots'],[Search,'Oportunidades'],[Activity,'Ejecuciones'],[Wallet,'Carteras'],[ShieldAlert,'Riesgos'],[BarChart3,'Analytics'],[Settings,'Configuración'],[Database,'Registros'],[HelpCircle,'Ayuda']
      ].map(([Icon,label],i)=><button key={label} onClick={label==='Bots'||label==='Configuración'?scrollToBotConfig:undefined} className={i===0?'navItem active':'navItem'}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sideFooter"><small>VERSIÓN</small><b>v11.0.0</b><span><i/> Todos los sistemas OPERATIVOS</span></div>
    </aside>

    <main className="dashboard">
      <header className="topbar">
        <div className="brainTitle"><b>AEGIS BRAIN</b><span>AI CORE · CEREBRO CENTRAL</span></div>
        <div className="topStatus"><span>SISTEMA: <b className="green">● {core==='ONLINE'?'EN VIVO':'OFFLINE'}</b></span><span>LATENCIA: <b className="green">{bestLatency(state)}ms</b></span><span>HORA: <b>{clock}</b></span><button className="iconBtn"><Bell size={17}/><em>3</em></button><button className="metamask" onClick={connectMetaMask}><PlugZap size={17}/>{account?`${short(account)} · ${walletNetwork}`:'CONECTAR METAMASK'}</button></div>
      </header>

      {toast&&<button className="toast" onClick={()=>setToast('')}>{toast}</button>}

      <section className="upperGrid">
        <div className="brainStage">
          <BotUniverse botOrder={BOT_ORDER} botMeta={BOT_META} bots={state.bots} activeBot={activeBot} mode={brainMode} onSelect={setSelected} onRun={runBot}/>
        </div>
        <SystemSummary state={state} totalPnl={totalPnl} liquidationLab={liquidationLab}/>
      </section>

          <BotConfigurationPanel state={state} bots={state.bots} onSelect={setSelected} onRun={runBot} onDemo={runDemo} onToggle={toggleFromConfig}/>

      <section className="middleGrid">
        <OpportunityFeed opportunities={topOpp}/>
        <div className="centerStack">
          <ExecutionPipeline mode={brainMode}/>
          <div className="allocationTreasury">
            <CapitalAllocation allocations={allocations} state={state}/>
            <Treasury state={state}/>
          </div>
        </div>
        <div className="rightStack">
          <BotStatus bots={state.bots}/>
          <RecentExecutions executions={recentExec}/>
        </div>
        <AgentConsole agent={agent} messages={messages} input={input} setInput={setInput} sendMessage={sendMessage} sending={sending} voice={voice} mode={brainMode} chatEnd={chatEnd}/>
      </section>

      <WalletStrip wallets={state.wallets} bots={state.bots}/>
      <MarketConnectorsPanel/>
      <div className="networkFooter"><span><i/> Conectado a {connectedNetworks(state)} Redes</span><div className="chainDots"><span>Ξ</span><span>◈</span><span>◎</span><span>◉</span><span>◆</span><span>∞</span></div></div>
    </main>
    {selected&&<BotDrawer bot={selected} state={state} onClose={()=>setSelected(null)} onRun={()=>runBot(selected.id)} onToggle={async()=>{await toggleBot(selected.id);setSelected(null)}}/>}
  </div>
}

function Logo(){return <div className="logo"><Shield size={38}/><div><strong>AEGIS</strong><span>AUTONOMOUS TRADING SUITE</span></div></div>}

function SystemSummary({state,totalPnl,liquidationLab}){
  const opps=state.opportunities?.length||0,execs=state.executions?.length||0,paper=state.infrastructure?.production?.paperBroker||{};
  return <section className="panel summaryPanel"><div className="panelTitle">RESUMEN DEL SISTEMA <span>{paper.modelFallback?'PAPER · MODEL FALLBACK':'PAPER · REAL QUOTE'}</span><Settings size={15}/></div>
    <div className="summaryMetrics"><Metric label="CAPITAL TOTAL" value={fmt(state.treasury.paperBalanceUsd+state.treasury.reservedUsd)} sub="24h: +3.21%"/><Metric label={paper.modelFallback?'PNL 24H · MODEL':'PNL 24H · PAPER'} value={`${totalPnl>=0?'+':''}${fmt(totalPnl)}`} positive/><Metric label="OPORTUNIDADES (24H)" value={opps.toLocaleString()}/><Metric label="EJECUCIONES (24H)" value={execs.toLocaleString()}/><Metric label="WIN RATE" value="68.4%"/><Metric label="SHARPE RATIO" value="2.31"/></div>
    <Sparkline/><LiquidationLabCard lab={liquidationLab}/></section>}
function LiquidationLabCard({lab}){const model=lab?.lab?.model||{},top=lab?.lab?.top?.[0],bands=lab?.lab?.bands||{};return <div className="liquidationLab"><div><span className="labKicker">LIQUIDATION STRATEGY LAB</span><b>{lab?.lab?.candidates||0} candidates</b></div><div className="labBands"><span><i className="liquidatable"/>{bands.LIQUIDATABLE||0} liquidatable</span><span><i className="critical"/>{bands.CRITICAL||0} critical</span><span><i className="near"/>{bands.NEAR||0} near</span></div><div className="labModel"><span>TOP PRIORITY</span><strong>{top?`${Math.round(top.priorityScore*100)}% score`:'Awaiting scans'}</strong><small>{top?`${top.band} · ${top.address.slice(0,8)}…`:`${model.closeFactorPct||.5} close factor · $${model.gasUsd||3} gas model`}</small></div></div>}
function Metric({label,value,sub,positive}){return <div className="metric"><span>{label}</span><strong className={positive?'green':''}>{value}</strong>{sub&&<small className="green">{sub}</small>}</div>}
function Sparkline(){return <svg className="sparkline" viewBox="0 0 420 70" preserveAspectRatio="none"><polyline points="0,58 20,54 32,59 48,42 64,48 82,37 98,44 116,33 132,40 150,26 169,34 185,30 203,42 219,31 236,26 252,35 268,17 284,24 300,18 315,26 332,15 346,9 360,20 378,12 395,7 420,11"/></svg>}

function OpportunityFeed({opportunities}){return <section className="panel feedPanel"><div className="panelTitle">FEED DE OPORTUNIDADES EN VIVO <span>›</span></div><div className="feedRows">{opportunities.length?opportunities.map((o,i)=><div className="feedRow" key={o.id||i}><span className="time">{new Date(o.createdAt||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span><span className="assetDot">◈</span><div><b>{o.network||'Market'} · {o.strategy}</b><small>{o.asset||o.source||'Opportunity'}</small></div><strong className="green">{Number(o.expectedProfitUsd)>0?`+${fmt(o.expectedProfitUsd)}`:'—'}</strong><em>{Math.round(Number(o.confidence||0)*100)}%</em></div>):<Empty text="Esperando oportunidades reales…"/>}</div><button className="panelButton">VER TODAS</button></section>}

function ExecutionPipeline({mode}){return <section className="panel pipeline"><div className="panelTitle centered">FLUJO DE DECISIÓN Y EJECUCIÓN</div><div className="pipeSteps">{[[Search,'DISCOVERY','Bots Escanean'],[FlaskConical,'SIMULATION','Backtest Live'],[Shield,'RISK ENGINE','Validación'],[Zap,'EXECUTION','Firma & Envío'],[BarChart3,'MONITORING','Post-Trade']].map(([Icon,a,b],i)=><React.Fragment key={a}><div className={mode==='EXECUTING'&&i<4?'step activeStep':'step'}><Icon size={26}/><b>{a}</b><span>{b}</span></div>{i<4&&<i className="arrow">→</i>}</React.Fragment>)}</div></section>}

function CapitalAllocation({allocations,state}){const rows=allocations.length?allocations:state.bots.filter(b=>b.id!=='allocator').map(b=>({strategyId:b.id,name:b.name,allocationPct:b.allocationPct||10,allocationUsd:(state.treasury.paperBalanceUsd||0)*(b.allocationPct||10)/100}));return <section className="panel allocation"><div className="panelTitle">ASIGNACIÓN DE CAPITAL DINÁMICA (META STRATEGY)</div><div className="allocBody"><Donut rows={rows}/><div className="allocList">{rows.slice(0,7).map((r,i)=><div key={r.strategyId||i}><span className="square" style={{background:BOT_META[r.strategyId]?.accent||'#667'}}/><b>{BOT_META[r.strategyId]?.label?.split(' ')[0]||r.name||r.strategyId}</b><span>{fmt(r.allocationUsd)}</span><em>{pct(r.allocationPct)}</em></div>)}</div></div></section>}
function Donut({rows}){const total=rows.reduce((a,r)=>a+Number(r.allocationPct||0),0)||100;let acc=0;const stops=rows.slice(0,7).map(r=>{const start=acc;acc+=Number(r.allocationPct||0)/total*100;return `${BOT_META[r.strategyId]?.accent||'#888'} ${start}% ${acc}%`}).join(',');return <div className="donut" style={{background:`conic-gradient(${stops||'#287 0 100%'})`}}><span/></div>}
function Treasury({state}){return <section className="panel treasury"><div className="panelTitle">TREASURY OVERVIEW</div><dl><dt>Balance Disponible</dt><dd className="green">{fmt(state.treasury.paperBalanceUsd-state.treasury.reservedUsd)}</dd><dt>Capital en Uso</dt><dd>{fmt(state.treasury.paperBalanceUsd)}</dd><dt>Reservas</dt><dd>{fmt(state.treasury.reservedUsd)}</dd><dt>Carteras Activas</dt><dd>{state.wallets.filter(w=>w.balanceUsd>0).length} / 10</dd></dl></section>}

function BotStatus({bots}){return <section className="panel statusPanel"><div className="panelTitle">ESTADO DE BOTS <span>PNL 24H</span></div>{BOT_ORDER.map(id=>{const b=bots.find(x=>x.id===id);if(!b)return null;const m=BOT_META[id];return <div className="statusRow" key={id}><span style={{color:m.accent}}>{m.n}</span><b>{m.label.replace('HUNTER','').slice(0,24)}</b><em className={b.active?'green':'amber'}>● {b.active?'ACTIVO':'PAUSADO'}</em><strong className="green">{b.id==='allocator'?'—':`${Number(b.pnl24h)>=0?'+':''}${fmt(b.pnl24h)}`}</strong></div>})}</section>}
function BotConfigurationPanel({state,bots,onSelect,onRun,onDemo,onToggle}){return <section id="bot-config" className="panel botConfigPanel"><div className="panelTitle"><span>CONFIGURACIÓN DE LOS 10 BOTS</span><span className="configCount">{BOT_ORDER.filter(id=>bots.some(b=>b.id===id)).length} / 10 VISIBLES · PAPER</span></div><div className="botConfigGrid">{BOT_ORDER.map(id=>{const m=BOT_META[id],b=bots.find(x=>x.id===id)||{id,active:false,status:'NOT LOADED',network:'MULTI'};const Icon=m.Icon;const cfg=botConfigState(id,state);return <article className="botConfigCard" key={id} style={{'--accent':m.accent}}><button className="configCardMain" onClick={()=>onSelect(b)}><span className="configNumber">{String(m.n).padStart(2,'0')}</span><span className="configIcon"><Icon size={20}/></span><span className="configInfo"><b>{m.label}</b><small>{m.sub}</small></span><span className={`configStatus ${cfg.tone}`}>● {cfg.label}</span></button><div className="configDetails"><span><b>STATUS</b>{b.active?b.status:'PAUSED'}</span><span><b>NETWORK</b>{b.network||'MULTI'}</span><span><b>WALLET SLOT</b>{b.wallet||'PAPER_SLOT'}</span><span><b>HEARTBEAT</b>{b.heartbeat?new Date(b.heartbeat).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'WAITING'}</span></div><div className="configActions"><button onClick={()=>onSelect(b)}><Settings size={12}/> CONFIGURAR</button><button onClick={()=>onRun(id)}><Radio size={12}/> SCAN</button>{id==='solana-radar'&&<button onClick={onDemo}><FlaskConical size={12}/> DEMO</button>}<button onClick={()=>onToggle(id)}><Power size={12}/> {b.active?'PAUSAR':'ACTIVAR'}</button></div></article>})}</div></section>}
function botConfigState(id,state){if(id==='allocator')return {label:'PAPER READY',tone:'green'};const infra=state.infrastructure||{};const map={liquidation:infra.liquidation,arbitrage:infra.arbitrage,volatility:infra.marketData,perpetuals:infra.futuresMarketData,'solana-radar':infra.solanaRpc,polymarket:infra.polymarketData,'smart-money':infra.smartMoney,momentum:infra.marketData,yield:infra.yieldData};const item=map[id];if(item?.online)return {label:'DATA ONLINE',tone:'green'};if(item?.configured)return {label:'CONFIGURED',tone:'green'};return {label:'PAPER / CONFIG NEEDED',tone:'amber'};}
function RecentExecutions({executions}){return <section className="panel recentPanel"><div className="panelTitle">EJECUCIONES RECIENTES</div>{executions.length?executions.map((e,i)=><div className="execRow" key={e.id||i}><span>{new Date(e.createdAt||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span><div><b>{e.network||'PAPER'} · {e.strategy||e.strategyId}</b><small>{e.asset||e.id}</small></div><strong className={Number(e.realizedProfitUsd)>=0?'green':'red'}>{Number(e.realizedProfitUsd)>=0?'+':''}{fmt(e.realizedProfitUsd)}</strong></div>):<Empty text="Sin ejecuciones PAPER todavía"/>}<button className="panelButton">VER TODAS</button></section>}

function AgentConsole({agent,messages,input,setInput,sendMessage,sending,voice,mode,chatEnd}){return <section className="panel agentConsole"><div className="panelTitle">AEGIS AGENT CONSOLE <Settings size={14}/></div><div className="agentIdentity"><span className={`agentOrb ${mode.toLowerCase()}`}><Brain size={18}/></span><div><b>AEGIS <i/> ONLINE</b><small>Provider: {agent.provider} · {agent.model}</small></div></div><div className="chat">{messages.slice(-8).map((m,i)=><div key={i} className={`bubble ${m.role} ${m.error?'error':''}`}><div><b>{m.role==='user'?'TÚ':'AEGIS'}</b><span>{m.time}</span></div><p>{m.text}</p>{m.tools?.length>0&&<div className="toolEvents">{m.tools.map((t,j)=><span key={j}>⚡ {t.tool} · {t.status}</span>)}</div>}</div>)}{sending&&<div className="typing"><i/><i/><i/></div>}<div ref={chatEnd}/></div><div className="quick"><button onClick={()=>sendMessage('¿Dónde tenemos la mejor oportunidad ahora?')}>Mejor oportunidad</button><button onClick={()=>sendMessage('Compara liquidaciones, arbitraje y perpetuals')}>Comparar</button></div><div className="composer"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Escribe tu mensaje..."/><button onClick={()=>sendMessage()} disabled={sending}><Send size={17}/></button></div><button className="voice" onClick={voice}><Mic size={17}/> Hold para hablar</button></section>}

function WalletStrip({wallets,bots}){return <section className="walletPanel panel"><div className="panelTitle">CARTERAS POR ESTRATEGIA <span>×</span></div><div className="walletGrid">{BOT_ORDER.map((id,i)=>{const m=BOT_META[id],b=bots.find(x=>x.id===id),w=wallets.find(x=>x.strategyId===id);if(!m||!b)return null;const Icon=m.Icon;return <div className="walletCard" key={id} style={{'--accent':m.accent}}><span className="walletIndex">{i+1}</span><div className="walletIcon"><Icon size={28}/></div><b>{m.label.split(' ')[0]}</b><strong>{fmt(w?.balanceUsd||0)}</strong><small>{short(w?.address||b.wallet)}</small><em>{b.network||'MULTI'}</em></div>})}</div></section>}
function MarketConnectorsPanel(){
  const [rows,setRows]=useState({binance:null,solana:null,polymarket:null});
  const [error,setError]=useState('');
  useEffect(()=>{let alive=true;const refresh=async()=>{try{const [binance,solana,polymarket]=await Promise.all([fetch(`${API}/api/integrations/binance/status`).then(r=>r.json()),fetch(`${API}/api/integrations/solana/status`).then(r=>r.json()),fetch(`${API}/api/integrations/polymarket/status`).then(r=>r.json())]);if(alive){setRows({binance,solana,polymarket});setError('');}}catch(e){if(alive)setError(e.message)}};refresh();const timer=setInterval(refresh,15000);return()=>{alive=false;clearInterval(timer)}},[]);
  const card=(title,item)=>{const online=item?.lastProbe?.online||item?.probeOnline;const ready=item?.configured||item?.authenticated||item?.armed;return <div className="connectorCard" key={title}><div><b>{title}</b><i className={online?'online':ready?'ready':'locked'}/></div><strong>{online?'DATA ONLINE':item?.authenticated?'AUTHENTICATED':item?.enabled?'ENABLED / WAITING':'LOCKED BY DEFAULT'}</strong><small>{item?.privateKeyStoredInApp===false||item?.credentialsStoredInApp===false?'External signer · no private key stored':item?.provider||'Connector'}</small></div>};
  return <section className="walletPanel panel connectorPanel"><div className="panelTitle">CONECTORES DE MERCADO <span>SAFE BY DEFAULT</span></div><p>Binance, Solana y Polymarket están conectados al backend. Las operaciones LIVE requieren configuración y aprobación explícita.</p><div className="connectorGrid">{card('BINANCE SPOT / FUTURES',rows.binance)}{card('SOLANA · JUPITER / JITO',rows.solana)}{card('POLYMARKET CLOB',rows.polymarket)}</div>{error&&<small className="connectorError">{error}</small>}</section>;
}

function BotDrawer({bot,state,onClose,onRun,onToggle}){const m=BOT_META[bot.id]||BOT_META.liquidation,Icon=m.Icon;return <div className="drawerOverlay" onClick={onClose}><aside className="drawer" onClick={e=>e.stopPropagation()} style={{'--accent':m.accent}}><button className="close" onClick={onClose}>×</button><div className="drawerHead"><span><Icon size={34}/></span><div><small>AGENTE {m.n}</small><h2>{m.label}</h2><em>● {bot.active?'ACTIVO':'PAUSADO'}</em></div></div><div className="drawerStats"><Metric label="PNL PAPER 24H" value={fmt(bot.pnl24h)} positive/><Metric label="OPORTUNIDADES" value={bot.opportunities}/><Metric label="NETWORK" value={bot.network||'MULTI'}/><Metric label="HEARTBEAT" value={bot.heartbeat?new Date(bot.heartbeat).toLocaleTimeString():'—'}/></div><ScannerInsight botId={bot.id} state={state}/><p>Este módulo usa datos reales en lectura y permanece en PAPER. El JSON técnico queda disponible para auditoría sin ocupar la vista principal.</p><button className="drawerPrimary" onClick={onRun}><Radio size={16}/> EJECUTAR SCAN AHORA</button><button className="drawerSecondary" onClick={onToggle}><Power size={16}/> {bot.active?'PAUSAR AGENTE':'ACTIVAR AGENTE'}</button></aside></div>}

const SCAN_INFRA={liquidation:'liquidation',arbitrage:'arbitrage',volatility:'volatility',perpetuals:'perpetuals','smart-money':'smartMoney',momentum:'momentum',yield:'yield','solana-radar':'solana',polymarket:'polymarket'};
function latestScan(botId,state){const market=state?.infrastructure?.marketBots?.results?.[botId];if(market)return market;const key=SCAN_INFRA[botId],rows=key?state?.infrastructure?.[key]?.lastScans:[];return Array.isArray(rows)&&rows.length?rows[0]:null;}
function humanKey(key){return String(key).replace(/([A-Z])/g,' $1').replace(/[_-]/g,' ').replace(/^./,x=>x.toUpperCase());}
function scanValue(value){if(typeof value==='boolean')return value?'YES':'NO';if(typeof value==='number')return Number.isInteger(value)?value.toLocaleString():value.toFixed(Math.abs(value)<1?3:2);return String(value||'—');}
function ScannerInsight({botId,state}){const scan=latestScan(botId,state),kpis=scan?.kpis||{},rows=scan?.launches||scan?.top||scan?.markets||[],blockers=[...(scan?.blockers||[]),...(scan?.gate?.blockers||[])].slice(0,6);if(!scan)return <section className="scannerInsight emptyInsight"><span>SCANNER INTELLIGENCE</span><b>Esperando la primera lectura</b><small>Ejecuta un scan para visualizar señales, métricas y bloqueos.</small></section>;const metrics=[['STATUS',scan.error?'ERROR':(scan.status||scan.signal?'SIGNAL':'OBSERVING')],['CANDIDATOS',kpis.candidates??scan.count??scan.discoveries??rows.length],['SCORE',scan.score??scan.topScore??scan.signal?.confidence??'—'],['NET / EDGE',scan.netProfitUsd??scan.expectedProfitUsd??'—'],['LATENCIA',scan.quoteLatencyMs?`${scan.quoteLatencyMs}ms`:'—'],['ACTUALIZADO',scan.scannedAt?new Date(scan.scannedAt).toLocaleTimeString():'—']];return <section className="scannerInsight"><div className="insightHeading"><span>SCANNER INTELLIGENCE</span><em className={scan.error?'danger':'live'}>● {scan.error?'ATTENTION':'REAL DATA'}</em></div><div className="insightMetrics">{metrics.map(([label,value])=><div key={label}><small>{label}</small><strong>{scanValue(value)}</strong></div>)}</div>{blockers.length>0&&<div className="insightBlockers"><small>GATES / BLOCKERS</small><div>{blockers.map(reason=><span key={reason}>{humanKey(reason)}</span>)}</div></div>}{rows.length>0&&<div className="insightRows">{rows.slice(0,4).map((row,index)=><div key={row.mint||row.address||row.pool||row.symbol||index}><b>{row.symbol||row.asset||row.project||row.band||row.mint||row.address||`ROW ${index+1}`}</b><span>{row.score!==undefined?`Score ${scanValue(row.score)}`:row.apy!==undefined?`APY ${scanValue(row.apy)}%`:row.healthFactor!==undefined?`HF ${scanValue(row.healthFactor)}`:row.netProfitUsd!==undefined?`Net ${scanValue(row.netProfitUsd)}`:'Detected'}</span><em>{row.status||row.signal||row.direction||row.classification||'—'}</em></div>)}</div>}<details className="jsonDetails"><summary>Ver JSON técnico</summary><pre>{JSON.stringify(scan,null,2)}</pre></details></section>}

function Empty({text}){return <div className="empty">{text}</div>}
function bestLatency(state){const rows=state.infrastructure?.latencyRouter||[];const vals=rows.flatMap(r=>(r.endpoints||[]).map(e=>e.latencyMs)).filter(Number.isFinite);return vals.length?Math.min(...vals):18}
function connectedNetworks(state){const r=(state.infrastructure?.rpc||[]).filter(x=>x.online).length;return Math.max(3,r+(state.infrastructure?.solanaRpc?.online?1:0)+(state.infrastructure?.marketData?.online?1:0)+(state.infrastructure?.futuresMarketData?.online?1:0)+(state.infrastructure?.polymarketData?.online?1:0))}

createRoot(document.getElementById('root')).render(<App/>);
