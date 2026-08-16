import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {
  Activity, ArrowUpRight, BarChart3, Bot, Brain, Briefcase, ChevronRight, CircleDollarSign,
  Database, Gauge, Globe2, Layers3, Orbit, Radar, Radio, RefreshCw, Rocket,
  Image as ImageIcon, Mic2, MessageCircle, Music2, Plus, Settings, ShieldCheck, Sparkles, Target, TrendingUp, Video, Volume2, WalletCards, Zap
} from "lucide-react";
import "./style.css";

const ports = {finance: 8811, commerce: 8812, saas: 8813, media: 8814, services: 8815};
const runtimeApi = (local, production) => import.meta.env.DEV ? local : production;
const config = {
  finance: {name: "Finance Brain", kicker: "CAPITAL INTELLIGENCE", desc: "Execution, risk and liquidity intelligence in one high-signal cockpit.", accent: "#9c7bff", accent2: "#49d9ff", icon: CircleDollarSign, page: "finance", api: runtimeApi("http://localhost:8787", "/brain-api/finance"), metric: "PAPER EQUITY"},
  commerce: {name: "Commerce Brain", kicker: "REVENUE ORCHESTRATION", desc: "Find, test and compound the next distribution opportunity before the market notices.", accent: "#4ee8d2", accent2: "#63a7ff", icon: Rocket, page: "commerce", api: runtimeApi("http://localhost:8802", "/brain-api/commerce"), metric: "ACTIVE TESTS"},
  saas: {name: "SaaS Brain", kicker: "REVENUE INTELLIGENCE", desc: "Turn product telemetry into durable MRR, retention and portfolio clarity.", accent: "#ff77c8", accent2: "#a77dff", icon: Orbit, page: "saas", api: runtimeApi("http://localhost:8790", "/brain-api/saas"), metric: "PORTFOLIO MRR"},
  media: {name: "Media Brain", kicker: "CONTENT DISTRIBUTION", desc: "Convert signals into a living editorial system that ships, learns and compounds.", accent: "#ffb86b", accent2: "#ff6f9d", icon: Radar, page: "media", api: runtimeApi("http://localhost:8804", "/brain-api/media"), metric: "CONTENT QUEUE"},
  services: {name: "Services Brain", kicker: "SERVICE REVENUE SYSTEM", desc: "Vende, cotiza y entrega videos, páginas web, SEO y servicios digitales desde un solo cockpit.", accent: "#ff8b5b", accent2: "#25e8ff", icon: Briefcase, page: "services", api: runtimeApi("http://localhost:8808", "/brain-api/services"), metric: "ACTIVE SERVICES"}
};

const kind = import.meta.env.VITE_BRAIN_KIND || new URLSearchParams(location.search).get("brain") || "finance";
const current = config[kind] || config.finance;
function brainGreeting(brain = kind) {
  const label = ({finance: "Finance", commerce: "Commerce", saas: "SaaS", media: "Media", services: "Services"}[brain] || String(brain).replace(/\s*brain$/i, ""));
  return `Hola Neiver soy tu ${label} asistente.`;
}
function withBrainGreeting(brain, value) {
  const greeting = brainGreeting(brain);
  const body = String(value || "").trim().replace(/^hola\s+neiver,?\s*soy\s+tu\s+[^.!?]+[.!?]\s*/i, "").trim();
  return body ? `${greeting} ${body}` : greeting;
}
const KIND_BRAIN = {
  finance: {name: "FINANCE BRAIN", tagline: "El sistema operativo de capital.", core: "/brains/finance-core.png", color: "#28e6f6"},
  commerce: {name: "COMMERCE BRAIN", tagline: "El sistema operativo de ventas.", core: "/brains/commerce-core.png", color: "#ffb545"},
  saas: {name: "SAAS BRAIN", tagline: "El sistema operativo de crecimiento recurrente.", core: "/brains/saas-core.png", color: "#7c5cff"},
  media: {name: "MEDIA BRAIN", tagline: "El sistema operativo de contenido.", core: "/brains/media-core.png", color: "#ff4fc3"},
  services: {name: "SERVICES BRAIN", tagline: "El sistema operativo de servicios.", core: "/brains/services-core.svg", color: "#ff8b5b"},
};
const brainTheme = KIND_BRAIN[kind] || KIND_BRAIN.finance;
const brainBase = String(import.meta.env.BASE_URL || "/").endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
const brainAsset = asset => `${brainBase}${String(asset).replace(/^\/+/, "")}`;
const brainCoreUrl = brainAsset(brainTheme.core);
const API = import.meta.env.VITE_BRAIN_API_URL || current.api;
const VOICE_API = import.meta.env.VITE_VOICE_API_URL || runtimeApi("http://localhost:8806", "/brain-api/ceo");
const chainLabel = value => { const raw=String(value||"").toLowerCase(); const id=raw.startsWith("0x")?Number.parseInt(raw,16):Number(raw); return ({1:"Ethereum",137:"Polygon",42161:"Arbitrum",8453:"Base"}[id]||`Chain ${raw}`); };
const shortAddress = value => value ? `${value.slice(0,6)}…${value.slice(-4)}` : "";

const apiUrl = path => { const value=String(path||""); return value.startsWith("http://") || value.startsWith("https://") ? value : `${API.replace(/\/$/,"")}${value.startsWith("/") ? value : `/${value}`}`; };
async function get(path) {
  const response = await fetch(apiUrl(path));
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

async function post(path) {
  const response = await fetch(apiUrl(path), {method: "POST", headers: {"content-type": "application/json"}});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `API ${response.status}`);
  return body;
}

async function request(path, options={}) {
  const response = await fetch(apiUrl(path), {headers: {"content-type": "application/json", ...(options.headers || {})}, ...options});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `API ${response.status}`);
  return body;
}

const scanPaths = {
  liquidation: "/api/liquidation/scan", arbitrage: "/api/arbitrage/scan", "solana-radar": "/api/solana-radar/scan",
  volatility: "/api/volatility/scan", momentum: "/api/momentum/scan", perpetuals: "/api/perpetuals/scan",
  polymarket: "/api/polymarket/scan", "smart-money": "/api/smart-money/scan", yield: "/api/yield/scan", allocator: "/api/allocator/rebalance",
  "solana-meme-momentum":"/api/market-bots/solana-meme-momentum/scan", "polygon-meme-momentum":"/api/market-bots/polygon-meme-momentum/scan", "fx-macro-momentum":"/api/market-bots/fx-macro-momentum/scan", "options-defined-risk":"/api/market-bots/options-defined-risk/scan", "crude-oil-regime":"/api/market-bots/crude-oil-regime/scan", "nyse-news-impact":"/api/market-bots/nyse-news-impact/scan"
};

function App() {
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [kpis, setKpis] = useState({});
  const [centralAgent, setCentralAgent] = useState(null);
  const [centralBusy, setCentralBusy] = useState(false);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);
  const [busyBot, setBusyBot] = useState("");
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [brainSpeaking, setBrainSpeaking] = useState(false);
  const [voiceAgentReply, setVoiceAgentReply] = useState("");
  const [voiceAgentBusy, setVoiceAgentBusy] = useState(false);
  const conversationRef = useRef([]);
  const [wallet, setWallet] = useState({address:"", chainId:"", chainName:""});
  const [walletBusy, setWalletBusy] = useState(false);
  const Icon = current.icon;

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const h = await get("/health");
      let s, events;
      if (kind === "finance") {
        s = await get("/api/state");
        events = [...(s.opportunities || []), ...(s.executions || [])];
      } else {
        [s, events] = await Promise.all([get("/api/summary"), get("/api/events")]);
      }
      setHealth(h); setSummary(s); setFeed(events || s.latestEvents || []);
      const endpoint = kind === "saas" ? "/api/revenue/summary" : kind === "finance" ? "/api/state" : "/api/kpis";
      const extra = await get(endpoint).catch(() => ({}));
      const lab = kind === "finance" ? await get("/api/liquidation/lab").catch(() => null) : null;
      const central = kind === "finance" ? await get("/api/central-agent/status").catch(() => null) : null;
      const liveContext = kind === "finance" ? await get("/api/agent/context").catch(() => null) : null;
      setKpis(kind === "finance" ? {opportunities: extra.opportunities?.length || 0, executions: extra.executions?.length || 0, balance: extra.treasury?.paperBalanceUsd || 0, health: 96, lab} : kind === "saas" ? extra : extra);
      setCentralAgent(central ? {...central, liveContext} : liveContext);
      setUpdated(new Date());
      return true;
    } catch (e) { setError(`No se pudo enlazar con ${current.name}. Verifica que el servicio esté activo en ${API}.`); return false; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [refresh]);

  useEffect(() => {
    if (!window.ethereum) return undefined;
    const onAccounts = accounts => setWallet(current => ({...current, address: accounts?.[0] || ""}));
    const onChain = chainId => setWallet(current => ({...current, chainId, chainName: chainLabel(chainId)}));
    window.ethereum.on?.("accountsChanged", onAccounts); window.ethereum.on?.("chainChanged", onChain);
    return () => { window.ethereum.removeListener?.("accountsChanged", onAccounts); window.ethereum.removeListener?.("chainChanged", onChain); };
  }, []);

  const agentList = kind === "finance" ? (summary?.bots || []) : (summary?.agents || health?.agentsTotal ? (summary?.agents || Array.from({length: health?.agentsTotal || 10}, (_, i) => ({id: i + 1, name: `Agent ${String(i + 1).padStart(2, "0")}`, enabled: true}))) : []);
  const financeBots = summary?.bots || [];
  const agentsTotal = health?.agentsTotal ?? financeBots.length;
  const agentsOnline = health?.agentsOnline ?? financeBots.filter(bot => bot.active && !["PAUSED", "ERROR", "OFFLINE"].includes(String(bot.status || "").toUpperCase())).length;
  const processed = health?.processed ?? health?.eventsProcessed ?? ((summary?.opportunities?.length || 0) + (summary?.executions?.length || 0));
  const riskPosture = kind === "finance" ? (summary?.risk?.globalKillSwitch ? "HALTED" : summary?.mode === "PAPER" ? "GUARDED" : "REVIEW") : "OBSERVE";
  const riskSub = kind === "finance" ? (summary?.risk?.globalKillSwitch ? "global kill switch active" : summary?.mode === "PAPER" ? "paper risk policy active" : "policy review required") : "policy layer active";
  const status = health?.status === "online" ? "ONLINE" : "OFFLINE";
  function navigateCommand(label) {
    const targets = {"Signal field": ".signalPanel", "Agent mesh": ".meshPanel", Playbooks: ".playbooksPanel"};
    window.requestAnimationFrame(() => document.querySelector(targets[label])?.scrollIntoView({behavior: "smooth", block: "start"}));
  }
  const financeAction = async (botId, action) => {
    if (kind !== "finance") return;
    const paths = {
      liquidation: "/api/liquidation/scan", arbitrage: "/api/arbitrage/scan", volatility: "/api/volatility/scan",
      perpetuals: "/api/perpetuals/scan", "solana-radar": "/api/solana-radar/scan", polymarket: "/api/polymarket/scan",
      "smart-money": "/api/smart-money/scan", momentum: "/api/momentum/scan", yield: "/api/yield/scan", allocator: "/api/allocator/rebalance"
    };
    setBusyBot(botId);
    try { const result = await post(action === "toggle" ? `/api/bots/${botId}/toggle` : (paths[botId] || scanPaths[botId])); await refresh(); return result; }
    catch (e) { setError(`${botId}: ${e.message}`); throw e; }
    finally { setBusyBot(""); }
  };
  async function runCentralAgent() {
    setCentralBusy(true); setError("");
    try { setCentralAgent(await request("/api/central-agent/run", {method:"POST", body:JSON.stringify({})})); await refresh(); }
    catch (e) { setError(`Finance Brain: ${e.message}`); }
    finally { setCentralBusy(false); }
  }
  async function askVoiceAgent(message) {
    const text = String(message || "").trim();
    if (!text || voiceAgentBusy) return;
    setVoiceAgentBusy(true); setError("");
    try {
      const endpoint = `${API.replace(/\/$/, "")}${kind === "finance" ? "/api/agent/chat" : "/api/chat"}`;
      const requestPayload = {message: text, brain: kind, conversation: conversationRef.current};
      const response = await fetch(endpoint, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(requestPayload)});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `API ${response.status}`);
      const answer = withBrainGreeting(kind, data.reply || data.message || "No recibí una respuesta del Brain.");
      conversationRef.current = [...conversationRef.current, {role: "user", content: text}, {role: "assistant", content: answer}].slice(-12);
      setVoiceAgentReply(answer);
      // Reproduce saludo y respuesta en un solo audio para evitar la pausa artificial entre dos TTS.
      await speakBrainReply(answer, {brain: kind, mediaApi: import.meta.env.VITE_MEDIA_BRAIN_URL || runtimeApi("http://localhost:8804", "/brain-api/media"), voiceApi: VOICE_API, onSpeakingChange: setBrainSpeaking});
    } catch (e) { setError(`${current.name}: ${e.message}`); }
    finally { setVoiceAgentBusy(false); }
  }
  async function connectMetaMask() {
    setWalletBusy(true); setError("");
    try {
      if (!window.ethereum) throw new Error("MetaMask no está instalado en este navegador.");
      const accounts = await window.ethereum.request({method:"eth_requestAccounts"});
      const chainId = await window.ethereum.request({method:"eth_chainId"});
      const address = accounts?.[0] || "";
      setWallet({address, chainId, chainName:chainLabel(chainId)});
      const polymarket = await get("/api/integrations/polymarket/status").catch(() => null);
      if (kind === "finance" && polymarket?.enabled && address) {
        await request("/api/integrations/polymarket/wallet/connect", {method:"POST", body:JSON.stringify({address})});
        await signPendingMetaMask(address);
        setError("");
      }
    } catch (e) { setError(`MetaMask: ${e.message}`); }
    finally { setWalletBusy(false); }
  }
  async function signPendingMetaMask(address) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const pending = await get("/api/integrations/polymarket/pending-signature").catch(() => null);
      if (!pending) { await new Promise(resolve => setTimeout(resolve, 400)); continue; }
      try {
        const typedData = JSON.stringify({domain:pending.domain, types:pending.types, primaryType:pending.primaryType, message:pending.message});
        const signature = await window.ethereum.request({method:"eth_signTypedData_v4", params:[address, typedData]});
        await request(`/api/integrations/polymarket/pending-signature/${pending.id}`, {method:"POST", body:JSON.stringify({signature})});
      } catch (e) {
        await request(`/api/integrations/polymarket/pending-signature/${pending.id}`, {method:"POST", body:JSON.stringify({rejected:true})}).catch(() => {});
        throw e;
      }
    }
  }
  const metric = useMemo(() => {
    if (kind === "saas") return `$${Number(kpis.mrr || 0).toLocaleString()}`;
    if (kind === "finance") return `$${Number(kpis.balance || 0).toLocaleString()}`;
    if (kind === "commerce") return Number(kpis.active || 0).toString().padStart(2, "0");
    if (kind === "services") return Number(kpis.serviceCount || 0).toString().padStart(2, "0");
    return Number(kpis.queued || 0).toString().padStart(2, "0");
  }, [kpis]);

  return <div className="app" style={{"--accent": current.accent, "--accent2": current.accent2}}>
    <div className="ambient ambientA"/><div className="ambient ambientB"/>
    <aside className="rail">
      <a href="/" className="brand"><span className="brandMark"><Brain size={22}/></span><span><b>AEGIS</b><small>OPERATING SYSTEM</small></span></a>
      <div className="railLabel">BRAIN SPACE</div>
      {Object.entries(config).map(([id, item]) => <a key={id} href={`/brain-ui/${id}/`} className={`brainLink ${id === kind ? "selected" : ""}`}><item.icon size={16}/><span>{item.name.replace(" Brain", "")}</span><i/></a>)}
      <div className="railLabel lower">COMMAND</div>
      {["Signal field", "Agent mesh", "Playbooks"].map((label, i) => { const RailIcon = [Activity, Layers3, Zap][i]; return <button className="railLink" key={label} onClick={() => navigateCommand(label)} aria-label={`Open ${label}`}><RailIcon size={16}/><span>{label}</span></button>; })}
      <div className="railBottom"><span className="onlineDot"/>Network stable<small>local / paper mode</small></div>
    </aside>

    <main className="workspace">
      <header className="topbar"><div className="crumb"><span>AEGIS /</span> {current.name.toUpperCase()}</div><div className="topActions"><span className="mode"><i/> PAPER MODE</span><span className="updated">{updated ? `SYNC ${updated.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}` : "SYNCING"}</span>{kind === "finance" && <button className="walletButton" onClick={connectMetaMask} disabled={walletBusy}><WalletCards size={14}/>{wallet.address ? `${shortAddress(wallet.address)} · ${wallet.chainName}` : walletBusy ? "CONNECTING…" : "CONNECT METAMASK"}</button>}<button className="refresh" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div></header>

      <section className="hero"><div className="heroCopy"><div className="eyebrow"><span/><b>{current.kicker}</b><em>/{kind.toUpperCase()}</em></div><h1>{current.name}<br/><span>thinks in signals.</span></h1><p>{current.desc}</p><div className="heroButtons"><button className="primary" onClick={refresh}><Radio size={16}/> Sync intelligence <ArrowUpRight size={14}/></button><a href="/" className="ghost">Master Command <ChevronRight size={15}/></a></div></div><div className="heroOrb"><div className="orbit o1"/><div className="orbit o2"/><div className="orbit o3"/><div className="core"><Icon size={35}/></div><span className="orbLabel">{status}<small>CORE STATUS</small></span></div></section>

      {error && <div className="errorBar"><span>!</span>{error}<button onClick={refresh}>Retry</button></div>}

      <section className="stats"><Stat icon={Gauge} label="CORE STATUS" value={status} sub={`${agentsOnline}/${agentsTotal} agents online`} live={status === "ONLINE"}/><Stat icon={current.icon} label={current.metric} value={metric} sub={kind === "saas" ? `${kpis.growthRate || 0}% growth velocity` : kind === "finance" ? "capital in paper mode" : "updated from live API"}/><Stat icon={Bot} label="AGENT THROUGHPUT" value={processed} sub="events processed"/><Stat icon={ShieldCheck} label="RISK POSTURE" value={riskPosture} sub={riskSub}/>)</section>

      <section className="contentGrid"><div className="panel signalPanel"><PanelHead eyebrow="01 / SIGNAL FIELD" title="The system is watching." action="LIVE FEED"/><div className="signalChart"><div className="chartGrid"/>{Array.from({length: 36}, (_, i) => <i key={i} style={{height: `${18 + ((i * 17 + (i % 5) * 13) % 65)}%`, animationDelay: `${i * 0.04}s`}}/>)}<div className="chartLine"/></div><div className="chartFoot"><span><i className="legend purple"/> Signal density</span><span><i className="legend mint"/> Opportunity flow</span><b>{loading ? "SCANNING" : "NOMINAL"}</b></div></div><div className="panel pulsePanel"><PanelHead eyebrow="02 / VITALS" title="Pulse"/><div className="pulseList"><Pulse label="Availability" value={status === "ONLINE" ? "99.9%" : "0%"} color="mint"/><Pulse label="Agents online" value={`${health?.agentsOnline || 0}/${health?.agentsTotal || 0}`} color="purple"/><Pulse label="Event velocity" value={`${Math.max(1, feed.length * 3)}/m`} color="orange"/><Pulse label="Mode" value="PAPER" color="pink"/>{kind === "finance" && <Pulse label="Liquidation Lab" value={`${kpis.lab?.lab?.candidates || 0} candidates`} color="orange"/>}</div><div className="pulseFoot"><Globe2 size={14}/> Local intelligence mesh <span>●</span></div></div></section>

      <section className="panel meshPanel"><PanelHead eyebrow="03 / AGENT MESH" title="A constellation of specialized minds." action={`${agentList.length || 0} NODES`}/><div className="agentGrid">{agentList.slice(0, 12).map((agent, i) => <div className={`agentNode ${agent.enabled === false ? "paused" : ""}`} key={agent.id || i}><span className="nodeIcon"><Bot size={15}/></span><div><b>{agent.name || `Agent ${i + 1}`}</b><small>{agent.enabled === false ? "paused" : i % 3 === 0 ? "scanning signal" : "standing by"}</small></div><i className="nodeStatus"/></div>)}</div></section>

      <BrainAssistantPanel kind={kind} current={current} reply={voiceAgentReply} busy={voiceAgentBusy} onAsk={askVoiceAgent} speaking={brainSpeaking}/>
      <PlaybooksPanel kind={kind} api={API} onSync={refresh} onAsk={askVoiceAgent}/>
      {kind === "saas" && <SaaSBrainOrbit bots={summary?.agents || []} speaking={brainSpeaking} onSelect={setSelectedBotId}/>} 
      {kind === "saas" && <BrainAgentControlPanel api={API} kind="saas" agents={summary?.agents || []} summary={summary} health={health} selectedAgentId={selectedBotId} onSelect={setSelectedBotId}/>} 
      {kind === "media" && <MediaContentAutomationPanel api={API}/>} 
      {kind === "media" && <MediaBrainOrbit bots={summary?.agents || []} speaking={brainSpeaking} onSelect={setSelectedBotId}/>} 
      {kind === "media" && <BrainAgentControlPanel api={API} kind="media" agents={summary?.agents || []} summary={summary} health={health} selectedAgentId={selectedBotId} onSelect={setSelectedBotId}/>} 
      {kind === "commerce" && <CommerceBrainOrbit bots={summary?.bots || []} speaking={brainSpeaking} onSelect={setSelectedBotId}/>} 
      {kind === "commerce" && <CommerceBotControlPanel api={API} selectedBotId={selectedBotId}/>} 
      {kind === "services" && <ServicesBrainOrbit bots={summary?.agents || []} speaking={brainSpeaking} onSelect={setSelectedBotId}/>} 
      {kind === "services" && <ServicesControlPanel api={API} agents={summary?.agents || []} summary={summary} selectedAgentId={selectedBotId} onSelect={setSelectedBotId}/>} 

      {kind === "finance" && <CentralFinanceBrainPanel data={centralAgent} busy={centralBusy} onRun={runCentralAgent} mediaApi="http://localhost:8804" onSpeakingChange={setBrainSpeaking}/>} 
      {kind === "finance" && <FinanceBrainOrbit bots={summary?.bots || []} central={centralAgent} speaking={brainSpeaking} onSelect={setSelectedBotId}/>} 
      {kind === "finance" && <FinanceBotConfiguration bots={summary?.bots || []} state={summary} busyBot={busyBot} onAction={financeAction} onSelect={setSelectedBotId}/>} 
      {kind === "finance" && <FinanceIntegrationsPanel api={API}/>} 

      <section className="lowerGrid"><div className="panel activityPanel"><PanelHead eyebrow="04 / ACTIVITY" title="Recent intelligence" action="AUTO-SYNC"/><div className="activityList">{feed.slice(0, 6).map((item, i) => <div className="activityRow" key={item.id || i}><span className="activityIcon"><Sparkles size={14}/></span><div><b>{item.type || item.strategy || item.title || "Signal received"}</b><small>{item.payload?.asset || item.asset || item.name || item.source || "Inter-brain protocol"}</small></div><time>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) : `0${i + 1}:2${i}`}</time><ArrowUpRight size={14}/></div>)}{!feed.length && <Empty text="Waiting for the first signal…"/>}</div></div><div className="panel commandPanel"><PanelHead eyebrow="05 / COMMAND LAYER" title="Make the next move."/><div className="commandCard"><div className="commandIcon"><Target size={21}/></div><div><b>Run a clean intelligence sync</b><p>Pull current health, events and opportunity data from this Brain.</p></div><button onClick={refresh}><ArrowUpRight size={16}/></button></div><div className="commandCard mutedCard"><div className="commandIcon"><Database size={21}/></div><div><b>Open system state</b><p>Inspect the raw state without leaving the command surface.</p></div><a href={`${API}${kind === "finance" ? "/api/state" : "/api/summary"}`} target="_blank" rel="noreferrer"><ChevronRight size={17}/></a></div></div></section>

      <footer><span><i className="onlineDot"/> AEGIS INTER-BRAIN PROTOCOL · {current.name}</span><span>SAFE BY DEFAULT <ShieldCheck size={13}/></span></footer>
    </main>
    {kind === "finance" && selectedBotId && <BotControlErrorBoundary onClose={() => setSelectedBotId(null)}><BotControlModal api={API} bot={(summary?.bots || []).find(item => item.id === selectedBotId) || {id:selectedBotId,name:selectedBotId,active:false,status:"UNKNOWN"}} onClose={() => setSelectedBotId(null)} onScan={id => financeAction(id, "scan")} /></BotControlErrorBoundary>}
  </div>
}

function Stat({icon: Icon, label, value, sub, live}) { return <div className="stat"><span className="statIcon"><Icon size={17}/></span><div><small>{label}</small><strong className={live ? "liveValue" : ""}>{value}</strong><em>{sub}</em></div></div> }
function PanelHead({eyebrow, title, action}) { return <>{kind === "media" && eyebrow === "01 / SIGNAL FIELD" && <MediaStudioPanel api={API}/>}<div className="panelHead"><div><small>{eyebrow}</small><h2>{title}</h2></div>{action && <span className="panelAction">{action}</span>}</div></> }
function Pulse({label, value, color}) { return <div className="pulse"><span className={`pulseDot ${color}`}/><span>{label}</span><b>{value}</b></div> }
function Empty({text}) { return <div className="empty"><Orbit size={18}/>{text}</div> }
function PlaybooksPanel({kind, api, onSync, onAsk}) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  async function runSync() {
    if (syncing) return;
    setSyncing(true); setSyncMessage("SYNCING WITH BRAIN…");
    try {
      const synced = await onSync?.();
      if (synced === false) throw new Error("no se pudo enlazar con el Brain");
      setSyncMessage(`SYNC COMPLETE · ${new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}`);
    } catch (error) {
      setSyncMessage(`SYNC FAILED · ${error.message}`);
    } finally { setSyncing(false); }
  }
  const playbooks = [
    ["SYNC INTELLIGENCE", "Actualiza salud, eventos y señales del Brain.", runSync, Radio],
    ["DIAGNOSE THE BRAIN", "Pide al asistente un diagnóstico operativo del estado actual.", () => onAsk("Haz un diagnóstico operativo del estado actual y dime cuál es el siguiente paso más importante."), Target],
    ["REVIEW OPPORTUNITIES", "Solicita las oportunidades o riesgos prioritarios dentro de este Brain.", () => onAsk("Revisa las oportunidades y riesgos prioritarios de este Brain y ordénalos por impacto."), Sparkles]
  ];
  return <section className="panel playbooksPanel"><div className="panelHead"><div><small>COMMAND / PLAYBOOKS</small><h2>Acciones rápidas del {kind.toUpperCase()} Brain.</h2></div><span className={`panelAction ${syncing ? "syncing" : ""}`}>{syncing ? "SYNCING…" : "READY"}</span></div><div className="playbookGrid">{playbooks.map(([title, description, action, Icon]) => <button className={`playbookCard ${title === "SYNC INTELLIGENCE" && syncing ? "running" : ""}`} key={title} onClick={action} disabled={title === "SYNC INTELLIGENCE" && syncing}><span className="commandIcon"><Icon size={18}/></span><span><b>{title}</b><small>{description}</small></span><ChevronRight size={15}/></button>)}<a className="playbookCard" href={`${api}${kind === "finance" ? "/api/state" : "/api/summary"}`} target="_blank" rel="noreferrer"><span className="commandIcon"><Database size={18}/></span><span><b>OPEN SYSTEM STATE</b><small>Consulta el contexto bruto del Brain en una pestaña separada.</small></span><ChevronRight size={15}/></a></div>{syncMessage && <div className={`playbookStatus ${syncing ? "running" : syncMessage.includes("FAILED") ? "failed" : "complete"}`}><i/>{syncMessage}</div>}</section>;
}
function BrainAssistantPanel({kind, current, reply, busy, onAsk, speaking}) {
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  function submit(event) { event?.preventDefault(); if (message.trim()) { onAsk(message); setMessage(""); } }
  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onAsk("Explícame el estado actual de este Brain y qué requiere atención."); return; }
    const recognition = new SR(); recognition.lang = "es-ES"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    setListening(true); recognition.onresult = event => onAsk(event.results[0][0].transcript); recognition.onerror = () => setListening(false); recognition.onend = () => setListening(false); recognition.start();
  }
  return <section className={`panel brainAssistant ${speaking ? "speaking" : ""}`} style={{"--assistant-accent": current.accent}}>
    <div className="assistantHeader"><div className="assistantTitle"><span className="assistantOrb"><Brain size={18}/></span><div><small>VOICE + CHATGPT AGENT</small><h2>Habla con {current.name}</h2><p>Contexto actualizado del Brain, respuestas naturales y lectura en voz alta con el mismo canal de voz.</p></div></div><span className="assistantStatus"><i/>{speaking ? "SPEAKING" : busy ? "THINKING" : "READY"}</span></div>
    <div className="assistantBody"><div className="assistantReply">{reply || `${brainGreeting(kind)} Estoy listo para revisar el estado, oportunidades, riesgos o lo que está ocurriendo ahora.`}</div><form className="assistantComposer" onSubmit={submit}><input value={message} onChange={event => setMessage(event.target.value)} placeholder="Pregunta al Brain en lenguaje natural…"/><button type="button" className={listening ? "listening" : ""} onClick={listen} aria-label="Hablar"><Mic2 size={15}/></button><button type="submit" disabled={busy} aria-label="Enviar"><MessageCircle size={15}/></button></form></div>
    <div className="assistantFoot"><span><i/> {kind === "finance" ? "Finance Agent context" : "CEO Brain context router"}</span><span><Volume2 size={12}/> NATURAL SPANISH VOICE</span></div>
  </section>;
}
function MediaContentAutomationPanel({api}) {
  const [status, setStatus] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [content, setContent] = useState([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const base = api.replace(/\/$/, "");
    const [automation, products, pieces] = await Promise.all([
      fetch(`${base}/api/content/automation/status`).then(response => response.json()),
      fetch(`${base}/api/content/catalog`).then(response => response.json()),
      fetch(`${base}/api/content`).then(response => response.json())
    ]);
    setStatus(automation); setCatalog(products.items || []); setContent(pieces || []);
  }, [api]);
  useEffect(() => { load().catch(error => setNotice(error.message)); const timer = setInterval(() => load().catch(() => {}), 15000); return () => clearInterval(timer); }, [load]);
  async function run(path, body = {}) {
    setBusy(path); setNotice("");
    try { const response = await fetch(`${api.replace(/\/$/, "")}${path}`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)}); const data = await response.json(); if (!response.ok) throw new Error(data.error || data.reason || "Automation unavailable"); setNotice(`${data.created ?? data.items?.length ?? 0} items processed`); await load(); }
    catch (error) { setNotice(error.message); }
    finally { setBusy(""); }
  }
  const automation = status?.automation || {};
  return <section className="panel mediaAutomationPanel"><div className="panelHead"><div><small>06 / PRODUCT CONTENT AUTOMATION</small><h2>Media Brain content engine.</h2></div><span className="panelAction">{automation.enabled ? "CRON ONLINE" : "CRON PAUSED"}</span></div><div className="mediaAutomationIntro"><div><b>Only commercial products enter the factory.</b><p>Commerce opportunities and SaaS accounts are synchronized automatically. Finance and trading bots remain excluded from product marketing.</p></div><div className="automationPulse"><i className={automation.enabled ? "onlineDot" : ""}/><small>{automation.cron || "0 */6 * * *"}</small><b>{automation.nextRunAt ? new Date(automation.nextRunAt).toLocaleString() : "NEXT RUN PENDING"}</b></div></div><div className="automationMetrics"><span><small>ELIGIBLE PRODUCTS</small><b>{catalog.length}</b><em>Commerce + SaaS</em></span><span><small>CONTENT DRAFTS</small><b>{status?.content?.drafts ?? content.filter(item => item.status === "draft").length}</b><em>ready for review</em></span><span><small>AUTOMATION RUNS</small><b>{automation.runs || 0}</b><em>{automation.assetMode || "brief"} mode</em></span><span><small>EXCLUDED</small><b>TRADING</b><em>not a product</em></span></div><div className="automationActions"><button onClick={() => run("/api/content/catalog/sync")} disabled={Boolean(busy)}><RefreshCw size={14}/> SYNC CATALOG</button><button onClick={() => run("/api/content/automation/run", {reason: "manual"})} disabled={Boolean(busy)}><Sparkles size={14}/> GENERATE NOW</button><label>ASSET MODE<select value={automation.assetMode || "brief"} onChange={event => run("/api/content/automation/config", {assetMode: event.target.value})}><option value="brief">Briefs only</option><option value="mock">Local mock assets</option><option value="remote">Provider assets</option></select></label></div>{notice && <div className="automationNotice">{notice}</div>}<div className="automationCatalog">{catalog.slice(0, 8).map(item => <span key={item.id}><i className={item.source}/><b>{item.name}</b><small>{item.source.toUpperCase()} · {item.detail}</small></span>)}{!catalog.length && <div className="empty"><Database size={16}/> Waiting for Commerce/SaaS catalog sync…</div>}</div></section>;
}

function CommerceBotControlPanel({api, selectedBotId}) {
  const [bots, setBots] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [products, setProducts] = useState([]);
  const [landings, setLandings] = useState([]);
  const [operations, setOperations] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const base = api.replace(/\/$/, "");
  useEffect(() => {
    if (!selectedBotId) return undefined;
    setSelected(selectedBotId);
    const timer = window.setTimeout(() => document.querySelector(`[data-commerce-bot="${selectedBotId}"]`)?.scrollIntoView({behavior: "smooth", block: "center"}), 80);
    return () => window.clearTimeout(timer);
  }, [selectedBotId]);
  const load = useCallback(async () => {
    const [botBody, connectorBody, productBody, landingBody, operationsBody] = await Promise.all([
      fetch(`${base}/api/bots`).then(response => response.json()),
      fetch(`${base}/api/connectors/status`).then(response => response.json()),
      fetch(`${base}/api/products`).then(response => response.json()),
      fetch(`${base}/api/landing-pages`).then(response => response.json()),
      fetch(`${base}/api/operations/summary`).then(response => response.json())
    ]);
    setBots(botBody || []); setConnectors(connectorBody.connectors || []); setProducts(productBody.items || []); setLandings(landingBody || []); setOperations(operationsBody || null);
  }, [base]);
  useEffect(() => { load().catch(error => setNotice(error.message)); const timer = setInterval(() => load().catch(() => {}), 15000); return () => clearInterval(timer); }, [load]);
  async function action(label, path, body = {}) {
    setBusy(label); setNotice("");
    try {
      const response = await fetch(`${base}${path}`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)});
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `API ${response.status}`);
      setNotice(data.warning || data.message || `${label} completed in PAPER mode.`); await load(); return data;
    } catch (error) { setNotice(error.message); } finally { setBusy(""); }
  }
  const selectedBot = bots.find(bot => bot.id === selected);
  const statusClass = value => String(value || "").toLowerCase().replaceAll("_", "-");
  return <section className="panel commerceControlPanel">
    <div className="panelHead"><div><small>06 / COMMERCE CONTROL SURFACE</small><h2>Ten modules. One commerce cockpit.</h2></div><span className="panelAction">{bots.filter(bot => bot.active).length}/10 ACTIVE</span></div>
    <div className="commerceIntro"><div><b>Scouts, builders y operadores controlables por separado.</b><p>Cada módulo puede escanear, pausarse y generar resultados. El catálogo y Shopify permanecen en PAPER/DRAFT hasta configurar credenciales y autorizar publicación. Los assets pueden usar MuAPI remoto cuando está disponible.</p></div><div className="commerceMode"><i/> PAPER MODE<small>no store publishing</small></div></div>
    <div className="commercePipeline">{[["DISCOVERED", operations?.pipeline?.discovered || 0], ["TEST READY", operations?.pipeline?.testReady || 0], ["LANDINGS", operations?.pipeline?.landingDrafts || 0], ["CAMPAIGNS", operations?.pipeline?.campaignDrafts || 0], ["ORDERS", operations?.funnel?.paidOrders || 0], ["REVENUE", `$${Number(operations?.funnel?.revenue || 0).toFixed(2)}`]].map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}</div>
    <div className="commerceBotGrid">{bots.map((bot, index) => <div data-commerce-bot={bot.id} className={`commerceBotModule ${selected === bot.id ? "open" : ""}`} role="button" tabIndex="0" key={bot.id} onClick={() => setSelected(selected === bot.id ? null : bot.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setSelected(selected === bot.id ? null : bot.id); }}><span className="commerceBotTop"><span className="commerceBotIcon"><Bot size={16}/></span><span><b>{bot.name}</b><small>{bot.status || "STANDBY"}</small></span><i className={statusClass(bot.status)}/></span><p>{bot.description}</p><span className="commerceBotMeta"><span><small>STRATEGY</small>{bot.strategy}</span><span><small>SIGNALS</small>{bot.metrics?.signals || 0}</span><span><small>CONFIDENCE</small>{bot.metrics?.confidence ? `${bot.metrics.confidence}%` : "—"}</span></span>{selected === bot.id && <span className="commerceBotDetail" onClick={event => event.stopPropagation()}><small>{bot.lastResult?.summary || "Ready for an on-demand scan."}</small><small className="commerceBotBlocker">{bot.readiness?.blockers?.length ? `BLOCKERS · ${bot.readiness.blockers.join(" · ")}` : "READY · no active blockers"}</small><span className="commerceBotActions"><button onClick={() => action(`scan-${bot.id}`, `/api/bots/${bot.id}/scan`)} disabled={Boolean(busy)}><Radar size={12}/> RUN SCAN</button><button onClick={() => action(`toggle-${bot.id}`, `/api/bots/${bot.id}/toggle`)} disabled={Boolean(busy)}><Settings size={12}/> {bot.active ? "PAUSE" : "RESUME"}</button></span></span>}</div>)}</div>
    <div className="commerceConnectors"><div><small>CONNECTED PROVIDERS</small><b>Readiness layer</b><p>Live status is separated from sample data so the Brain never presents synthetic candidates as market truth.</p></div><div className="commerceConnectorPills">{connectors.map(item => <span className={item.configured ? "configured" : "missing"} key={item.id}><i/>{item.name}<small>{item.configured ? "CONFIGURED · DRAFT" : "CREDENTIALS NEEDED"}</small></span>)}</div></div>
    <div className="commerceActions"><button onClick={() => action("cycle", "/api/automation/run", {reason: "manual"})} disabled={Boolean(busy)}><Zap size={13}/> RUN COMMERCE CYCLE</button><button onClick={() => action("discover", "/api/products/discover")} disabled={Boolean(busy)}><RefreshCw size={13}/> DISCOVER PRODUCTS</button><span>{products.length} candidates · {operations?.automation?.enabled ? "auto cycle on" : "manual mode"}</span>{notice && <em>{notice}</em>}</div>
    <div className="commerceProducts">{products.slice(0, 6).map(product => <div className="commerceProductRow" key={product.id}><div><b>{product.name}</b><small>{String(product.source).toUpperCase()} · {product.sourceStatus} · score {product.score ?? "—"} · {product.tier || "UNSCORED"}</small></div><strong>${Number(product.economics?.price || product.price || 0).toFixed(2)}<small>{product.economics ? `${product.economics.marginPct}% contribution` : product.paper ? "PAPER SAMPLE" : "PROVIDER DATA"}</small></strong><button onClick={async () => { const result = await action(`landing-${product.id}`, `/api/products/${product.id}/landing`); if (result?.landing) setNotice(`Landing draft created: ${result.landing.headline}`); }} disabled={Boolean(busy)}><Sparkles size={13}/> LANDING</button><button onClick={() => action(`campaign-${product.id}`, `/api/products/${product.id}/campaign`)} disabled={Boolean(busy)}><Target size={13}/> CAMPAIGN</button></div>)}{!products.length && <div className="empty"><Database size={16}/> Run product discovery to populate the cockpit.</div>}</div>
    {landings[0] && <div className="commerceLanding"><div><small>LATEST LANDING DRAFT · {landings[0].status}</small><h3>{landings[0].headline}</h3><p>{landings[0].subheadline}</p></div><div className="commerceLandingOffer"><b>${Number(landings[0].offer?.price || 0).toFixed(2)}</b><small>{landings[0].asset?.mode === "brief" ? "ASSET BRIEF READY" : `ASSET ${String(landings[0].asset?.status || "QUEUED").toUpperCase()}`}</small></div><div className="commerceLandingSections">{(landings[0].sections || []).slice(0, 4).map(section => <span key={section}><Zap size={11}/>{section}</span>)}</div><em>Shopify: {landings[0].shopify?.status || "DRAFT ONLY"} · no publishing action performed</em></div>}
  </section>;
}
function CentralFinanceBrainPanel({data, busy, onRun, mediaApi, onSpeakingChange}) {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const conversationRef = useRef([]);
  const incidents = (data?.incidents || []).filter(item => item.status === "open").slice(0, 6);
  const report = data?.reports?.[0];
  const diagnostics = data?.botDiagnostics || report?.botDiagnostics || [];
  const status = data?.status || "BOOTING";
  async function askBrain(event) {
    event.preventDefault(); if (!message.trim()) return;
    setChatBusy(true);
    try { const result = await request("/api/agent/chat", {method:"POST", body:JSON.stringify({message,conversation:conversationRef.current})}); const text=withBrainGreeting("finance", result.reply || result.message || "Reporte recibido."); conversationRef.current=[...conversationRef.current,{role:"user",content:message},{role:"assistant",content:text}].slice(-12); setReply(text); setMessage(""); await speakBrainReply(text,{brain:"finance",mediaApi,onSpeakingChange}); }
    catch (error) { setReply(`No se pudo consultar el agente: ${error.message}`); }
    finally { setChatBusy(false); }
  }
  return <section className="panel centralBrainPanel"><div className="centralBrainHeader"><div className="centralBrainTitle"><span className="centralBrainOrb"><Brain size={20}/></span><div><small>03.5 / CENTRAL FINANCE BRAIN</small><h2>El agente que mantiene todo bajo control.</h2><p>Supervisa los dieciséis bots, conserva un registro auditable y prioriza retorno ajustado a riesgo.</p></div></div><div className={`centralBrainStatus ${String(status).toLowerCase()}`}><i/>{status}<small>{data?.openIncidents || 0} incidencias abiertas</small></div></div><div className="centralBrainStats"><span><small>PNL 24H · PAPER</small><b>${Number(data?.profitSnapshot?.pnl24h ?? report?.profit?.pnl24h ?? 0).toFixed(2)}</b></span><span><small>OPPORTUNITIES</small><b>{data?.profitSnapshot?.opportunities ?? report?.profit?.opportunities ?? 0}</b></span><span><small>BOTS CONTROLLED</small><b>{report?.control?.activeBots ?? 0}/{report?.control?.totalBots ?? 16}</b></span><span><small>POLICY</small><b>PAPER / SAFE</b></span></div><div className="centralBotDiagnostics">{diagnostics.map(item=><div className={`centralBotDiagnostic ${String(item.readiness||"UNKNOWN").toLowerCase()}`} key={item.id}><span><b>{item.id}</b><i/></span><small>{item.blockers?.[0] || item.warnings?.[0] || "Ready for monitored scans."}</small></div>)}</div><div className="centralBrainBody"><div><div className="centralBrainReport"><span className="centralBrainLabel">LATEST REPORT</span><b>{report?.headline || "Esperando el primer ciclo del supervisor…"}</b><small>{data?.lastReportAt ? new Date(data.lastReportAt).toLocaleString() : "No reportado todavía"}</small></div><div className="centralIncidentList">{incidents.length ? incidents.map(item => <div className={`centralIncident ${item.severity}`} key={item.id}><i/><div><b>{item.code}</b><small>{item.message}</small></div></div>) : <div className="centralNoIncident"><ShieldCheck size={15}/> Sin incidencias abiertas en este ciclo.</div>}</div></div><div className="centralBrainActions"><button className="centralRunButton" onClick={onRun} disabled={busy}><RefreshCw size={14} className={busy ? "spin" : ""}/>{busy ? "SUPERVISING…" : "RUN SUPERVISOR NOW"}</button><form onSubmit={askBrain}><label>ASK THE FINANCE BRAIN</label><div><input value={message} onChange={event=>setMessage(event.target.value)} placeholder="¿Qué está fallando? ¿Cuál es la mejor oportunidad?"/><button disabled={chatBusy}>{chatBusy ? "…" : "ASK"}</button></div></form>{reply && <p className="centralBrainReply">{reply}</p>}</div></div><div className="centralBrainFoot"><span><i/>Auditoría persistente: incidencias + reportes</span><span>{data?.policy?.liveAutonomous === false ? "LIVE AUTONOMOUS: LOCKED" : "LIVE POLICY REVIEW"}</span></div></section>;
}
let activeBrainAudio = null;
function stopBrainAudio() {
  if (activeBrainAudio) { activeBrainAudio.pause(); activeBrainAudio.currentTime = 0; activeBrainAudio = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
async function playAudioUrl(url,onSpeakingChange,cleanup=()=>{}) {
  stopBrainAudio();
  const audio=new Audio(url); activeBrainAudio = audio;
  audio.onended=()=>{if(activeBrainAudio===audio)activeBrainAudio=null;onSpeakingChange(false);cleanup();}; audio.onerror=()=>{if(activeBrainAudio===audio)activeBrainAudio=null;onSpeakingChange(false);cleanup();};
  try { await audio.play(); onSpeakingChange(true); return true; } catch { if(activeBrainAudio===audio)activeBrainAudio=null; onSpeakingChange(false); return false; }
}

async function speakBrainReply(text,{brain="finance",mediaApi="http://localhost:8804",voiceApi=VOICE_API,onSpeakingChange=()=>{}}={}) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return false;
  stopBrainAudio(); onSpeakingChange(false);
  try {
    const response=await fetch(`${voiceApi.replace(/\/$/,"")}/api/tts`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text:cleanText,brain,voice:"coral"})});
    if(response.ok){const blob=await response.blob();const url=URL.createObjectURL(blob);const played=await playAudioUrl(url,onSpeakingChange,()=>URL.revokeObjectURL(url));if(played)return;URL.revokeObjectURL(url);}
  } catch {}
  try {
    const response=await fetch(`${mediaApi.replace(/\/$/,"")}/api/speech`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text:cleanText,brain})});
    const body=await response.json().catch(()=>({})); const job=body.job;
    if(job?.outputUrl && await playAudioUrl(job.outputUrl,onSpeakingChange))return;
    if(job?.id){
      for(let attempt=0;attempt<8;attempt++){
        await new Promise(resolve=>setTimeout(resolve,300));
        const poll=await fetch(`${mediaApi.replace(/\/$/,"")}/api/generations/${job.id}`).then(r=>r.ok?r.json():null).catch(()=>null);
        if(poll?.outputUrl && await playAudioUrl(poll.outputUrl,onSpeakingChange))return;
        if(["failed","timeout"].includes(poll?.status))break;
      }
    }
  } catch {}
  if("speechSynthesis" in window){window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(cleanText);utterance.lang="es-US";utterance.rate=1.08;utterance.pitch=.98;const voices=window.speechSynthesis.getVoices?.()||[];utterance.voice=voices.find(voice=>/es[-_]MX|es[-_]ES|Spanish.*Natural|Google español/i.test(`${voice.lang} ${voice.name}`))||voices.find(voice=>/^es/i.test(voice.lang))||null;utterance.onstart=()=>onSpeakingChange(true);utterance.onend=()=>onSpeakingChange(false);utterance.onerror=()=>onSpeakingChange(false);window.speechSynthesis.speak(utterance);return true;} else onSpeakingChange(false);
  return false;
}

const BRAIN_PREVIEW_URL = import.meta.env.VITE_FINANCE_BRAIN_PREVIEW_URL || "https://cdn.muapi.ai/outputs/generated/2fc3c576b7d84c0a85e6046aec421db6.png";

function FinanceBrainOrbit({bots = [], central, speaking, onSelect}) {
  return <section className={"panel brain3dPanel " + (speaking ? "speaking" : "")}><div className="brain3dHeader"><div><small>03.6 / FINANCE BRAIN · COMMAND CHAMBER</small><h2>El sistema operativo de capital.</h2><p>Un núcleo neural coordina dieciséis módulos especializados conectados por rutas de señal. Arrastra para explorar, usa el botón derecho para desplazar y la rueda para acercar.</p></div><span className="brain3dLive"><i/>{speaking ? "VOICE STREAMING" : "NEURAL CORE · ONLINE"}</span></div><Brain3DViewport bots={bots} central={central} onSelect={onSelect}/></section>;
}

function CommerceBrainOrbit({bots = [], speaking, onSelect}) {
  return <section className={"panel brain3dPanel commerceBrain3dPanel " + (speaking ? "speaking" : "")}><div className="brain3dHeader"><div><small>03.6 / COMMERCE BRAIN · COMMAND CHAMBER</small><h2>El sistema operativo de revenue.</h2><p>Un núcleo comercial conecta descubrimiento, oferta, contenido, tienda, tráfico, CRM y asignación de presupuesto. Explora cada módulo y abre su control PAPER desde el nodo.</p></div><span className="brain3dLive"><i/>{speaking ? "VOICE STREAMING" : "COMMERCE CORE · ONLINE"}</span></div><Brain3DViewport bots={bots} onSelect={onSelect}/></section>;
}

function ServicesBrainOrbit({bots = [], speaking, onSelect}) {
  return <section className={"panel brain3dPanel servicesBrain3dPanel " + (speaking ? "speaking" : "")}><div className="brain3dHeader"><div><small>03.6 / SERVICES BRAIN · COMMAND CHAMBER</small><h2>El sistema operativo de tus servicios.</h2><p>Un núcleo comercial conecta venta consultiva, cotización, delivery, web, video, SEO, branding, automatización y éxito del cliente.</p></div><span className="brain3dLive"><i/>{speaking ? "VOICE STREAMING" : "SERVICES CORE · ONLINE"}</span></div><Brain3DViewport bots={bots} onSelect={onSelect}/></section>;
}

function ServicesControlPanel({api, agents = [], summary, selectedAgentId, onSelect}) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [crmForm, setCrmForm] = useState({name: "", email: "", company: "", website: "", goal: "", serviceId: ""});
  const [growth, setGrowth] = useState({dashboard: null, leads: [], promotions: [], campaigns: [], publications: [], assets: [], pipeline: null, attribution: null, retention: null, automation: null, approvals: []});
  const [promotionForm, setPromotionForm] = useState({serviceId: "web-design", audience: "", discount: ""});
  const [campaignForm, setCampaignForm] = useState({serviceId: "web-design", objective: "captar leads cualificados", channels: "linkedin,instagram,email"});
  const [assetForm, setAssetForm] = useState({serviceId: "web-design", kind: "image", audience: ""});
  const [brainCommand, setBrainCommand] = useState("");
  const [commandPlan, setCommandPlan] = useState(null);
  const [leadResearch, setLeadResearch] = useState("");
  const [leadImport, setLeadImport] = useState("");
  const base = api.replace(/\/$/, "");
  const services = summary?.services || [];
  const proposals = summary?.proposals || [];
  const kpis = summary?.kpis || {};
  const loadGrowth = useCallback(async () => {
    const read = path => fetch(`${base}${path}`).then(response => response.ok ? response.json() : null).catch(() => null);
    const [dashboard, leads, promotions, campaigns, publications, assets, pipeline, attribution, retention, automation, approvals] = await Promise.all([read("/api/crm/dashboard"), read("/api/leads/queue"), read("/api/promotions"), read("/api/campaigns"), read("/api/publications"), read("/api/assets"), read("/api/crm/pipeline"), read("/api/analytics/attribution"), read("/api/analytics/retention"), read("/api/automation/status"), read("/api/approvals?status=PENDING")]);
    setGrowth({dashboard, leads: leads?.items || [], promotions: promotions || [], campaigns: campaigns || [], publications: publications || [], assets: assets || [], pipeline, attribution, retention, automation, approvals: approvals || []});
  }, [base]);
  useEffect(() => { loadGrowth(); const timer = setInterval(loadGrowth, 15000); return () => clearInterval(timer); }, [loadGrowth]);
  async function action(label, path, body = {}) {
    setBusy(label); setNotice("");
    try { const response = await fetch(`${base}${path}`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)}); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || data.error || `API ${response.status}`); setNotice(data.message || `${label} · listo en PAPER`); await loadGrowth(); return data; }
    catch (error) { setNotice(error.message); return null; } finally { setBusy(""); }
  }
  async function createProposal(service) {
    const data = await action(service.id, "/api/proposals", {serviceId: service.id, clientName: "New service lead", source: "brain-ui", notes: "Draft from Services command chamber"});
    if (data) setNotice(`${service.name} · propuesta PAPER creada`);
  }
  async function captureLead(event) {
    event.preventDefault(); setBusy("crm");
    try { const response = await fetch(`${base}/api/crm/contacts`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({...crmForm, sendWelcome: false, source: "services-brain-ui"})}); const data = await response.json(); if (!response.ok) throw new Error(data.error || `API ${response.status}`); setCrmForm({name: "", email: "", company: "", website: "", goal: "", serviceId: ""}); setNotice(`${data.contact.name} · lead capturado · score ${data.contact.score}`); await loadGrowth(); }
    catch (error) { setNotice(error.message); } finally { setBusy(""); }
  }
  async function runBrainCommand(event) {
    event.preventDefault(); if (!brainCommand.trim()) return;
    setBusy("brain-command"); setNotice("");
    try { const response = await fetch(`${base}/api/brain/command`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({command: brainCommand})}); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || data.error || `API ${response.status}`); setNotice(data.reply || "Services Brain ejecutó la orden."); setBrainCommand(""); await loadGrowth(); }
    catch (error) { setNotice(`Brain command: ${error.message}`); } finally { setBusy(""); }
  }
  async function previewBrainCommand() {
    if (!brainCommand.trim()) return;
    setBusy("brain-plan"); setNotice("");
    try { const response = await fetch(`${base}/api/brain/plan`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({command: brainCommand})}); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || data.error || `API ${response.status}`); setCommandPlan(data); }
    catch (error) { setNotice(`Plan: ${error.message}`); } finally { setBusy(""); }
  }
  async function resolveApproval(id, status) {
    await action(`approval-${id}`, `/api/approvals/${id}/resolve`, {status});
  }
  async function importPublicLeads() {
    if (!leadImport.trim()) return;
    let leads;
    try { leads = JSON.parse(leadImport); if (!Array.isArray(leads)) throw new Error("El JSON debe ser un array de leads."); }
    catch (error) { setNotice(`Import: ${error.message}`); return; }
    const result = await action("lead-import", "/api/leads/import", {leads});
    if (result) { setLeadImport(""); setNotice(`${result.created?.length || 0} leads importados · ${result.skipped?.length || 0} duplicados omitidos`); }
  }
  async function requestLeadResearch() {
    const result = await action("lead-research", "/api/leads/research", {query: leadResearch, sources: ["public_business_directories", "inbound_forms", "referrals"]});
    if (result) { setLeadResearch(""); setNotice("Research run creado: importa una fuente autorizada para convertirlo en leads reales."); }
  }
  return <section className="panel commerceControlPanel servicesControlPanel">
    <div className="panelHead"><div><small>06 / SERVICES GROWTH ENGINE</small><h2>Captar, convencer y cerrar.</h2></div><span className="panelAction">{agents.filter(agent => agent.enabled !== false).length}/{agents.length || 10} ONLINE</span></div>
    <div className="commerceIntro"><div><b>Motor comercial de servicios conectado a CRM, Resend, Media Brain y MuAPI.</b><p>Importa leads públicos, puntúalos, crea ofertas, genera assets y prepara publicaciones. Todo queda en draft hasta una aprobación humana.</p></div><div className="commerceMode"><i/> PAPER MODE<small>approval before outreach</small></div></div>
    <form className="servicesCommandBar" onSubmit={runBrainCommand}><span><Bot size={14}/><small>COMMAND THE SERVICES BRAIN</small></span><input value={brainCommand} onChange={event => setBrainCommand(event.target.value)} placeholder="Ej.: crea una promoción de SEO y genera un asset de video con MuAPI"/><button type="button" onClick={previewBrainCommand} disabled={busy === "brain-plan"}>{busy === "brain-plan" ? "PLANNING…" : "PLAN"}</button><button type="submit" disabled={busy === "brain-command"}>{busy === "brain-command" ? "EXECUTING…" : "EXECUTE ORDER"}</button></form>
    {commandPlan && <div className="servicesCommandPlan"><div><small>COMMAND PLAN · {commandPlan.service?.name}</small><b>{commandPlan.nextStep}</b></div><div>{(commandPlan.actions || []).map(item => <span key={item.id}><i className={item.approval ? "needs" : "ready"}/>{item.title}{item.approval ? " · APPROVAL" : " · SAFE"}</span>)}</div></div>}
    <form className="servicesCrmCapture servicesLeadCapture" onSubmit={captureLead}><input required placeholder="Nombre / contacto" value={crmForm.name} onChange={event => setCrmForm({...crmForm, name: event.target.value})}/><input required type="email" placeholder="Email público" value={crmForm.email} onChange={event => setCrmForm({...crmForm, email: event.target.value})}/><input placeholder="Empresa / web" value={crmForm.company} onChange={event => setCrmForm({...crmForm, company: event.target.value})}/><input placeholder="Objetivo o señal de compra" value={crmForm.goal} onChange={event => setCrmForm({...crmForm, goal: event.target.value})}/><select value={crmForm.serviceId} onChange={event => setCrmForm({...crmForm, serviceId: event.target.value})}><option value="">Auto-recomendar servicio</option>{services.map(service => <option value={service.id} key={service.id}>{service.name}</option>)}</select><button type="submit" disabled={busy === "crm"}>{busy === "crm" ? "…" : "CAPTURE + SCORE LEAD"}</button></form>
    <div className="commercePipeline">{[["SERVICES", kpis.serviceCount || services.length], ["LEADS", growth.dashboard?.kpis?.leads ?? kpis.leads ?? 0], ["HOT LEADS", growth.dashboard?.kpis?.hotLeads ?? 0], ["WON", growth.dashboard?.kpis?.won ?? 0], ["APPROVALS", growth.automation?.dueTouchpoints ?? growth.approvals.length], ["PIPELINE", `$${Number(kpis.pipeline || 0).toLocaleString()}`]].map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}</div>
    <div className="servicesOperatingStrip"><span><small>PIPELINE</small><b>{Object.entries(growth.pipeline?.pipeline?.stages || {}).filter(([, value]) => value).map(([key, value]) => `${key} ${value}`).join(" · ") || "NEW 0"}</b></span><span><small>AUTOMATION</small><b>{growth.automation?.enabled ? "WORKER ON" : "APPROVAL ONLY"}</b></span><span><small>OUTBOUND TODAY</small><b>{growth.automation?.dailyOutbound || 0}/{growth.automation?.dailyLimit || 40}</b></span><span><small>ATTRIBUTION</small><b>{growth.attribution?.sources?.length || 0} SOURCES</b></span></div>
    <div className="servicesGrowthGrid">
      <div className="servicesGrowthCard"><div className="servicesSectionTitle"><span><Target size={14}/> LEAD QUEUE</span><small>{growth.leads.length} ranked · {growth.pipeline?.pipeline?.conversion?.proposalToWon || 0}% proposal→won</small></div>{growth.leads.slice(0, 5).map(lead => <div className="servicesLeadRow" key={lead.id}><div><b>{lead.name}</b><small>{lead.company || lead.email || "public contact"} · {lead.service || "service to recommend"} · {lead.status}</small></div><strong className={String(lead.tier || "cold").toLowerCase()}>{lead.score} <small>{lead.tier}</small></strong><button onClick={() => action(`qualify-${lead.id}`, `/api/crm/contacts/${lead.id}/qualify`, {})} disabled={Boolean(busy)}>QUALIFY</button><button onClick={() => action(`sequence-${lead.id}`, `/api/leads/${lead.id}/sequence`, {})} disabled={Boolean(busy)}><Radio size={11}/> SEQUENCE</button></div>)}{!growth.leads.length && <div className="empty"><Database size={14}/> Captura o importa leads para activar el ranking.</div>}</div>
      <div className="servicesGrowthCard"><div className="servicesSectionTitle"><span><Globe2 size={14}/> LEAD RESEARCH / IMPORT</span><small>public sources only</small></div><input placeholder="Ej.: clínicas en Miami que necesitan SEO" value={leadResearch} onChange={event => setLeadResearch(event.target.value)}/><button className="servicesPrimaryAction" onClick={requestLeadResearch} disabled={Boolean(busy)}>CREATE RESEARCH RUN</button><textarea placeholder='Import JSON: [{"name":"...","email":"...","company":"...","website":"..."}]' value={leadImport} onChange={event => setLeadImport(event.target.value)}/><button className="servicesPrimaryAction" onClick={importPublicLeads} disabled={Boolean(busy)}>IMPORT + SCORE PUBLIC LEADS</button></div>
      <div className="servicesGrowthCard"><div className="servicesSectionTitle"><span><Sparkles size={14}/> PROMOTION BUILDER</span><small>offer engine</small></div><select value={promotionForm.serviceId} onChange={event => setPromotionForm({...promotionForm, serviceId: event.target.value})}>{services.map(service => <option value={service.id} key={service.id}>{service.name}</option>)}</select><input placeholder="Audiencia específica (opcional)" value={promotionForm.audience} onChange={event => setPromotionForm({...promotionForm, audience: event.target.value})}/><input placeholder="Descuento % (opcional)" value={promotionForm.discount} onChange={event => setPromotionForm({...promotionForm, discount: event.target.value})}/><button className="servicesPrimaryAction" onClick={() => action("promotion", "/api/promotions", promotionForm)} disabled={Boolean(busy)}>CREATE PROMOTION</button></div>
      <div className="servicesGrowthCard"><div className="servicesSectionTitle"><span><Rocket size={14}/> CAMPAIGN BUILDER</span><small>multi-channel draft</small></div><select value={campaignForm.serviceId} onChange={event => setCampaignForm({...campaignForm, serviceId: event.target.value})}>{services.map(service => <option value={service.id} key={service.id}>{service.name}</option>)}</select><input placeholder="Objetivo comercial" value={campaignForm.objective} onChange={event => setCampaignForm({...campaignForm, objective: event.target.value})}/><input placeholder="Canales: linkedin,instagram,email" value={campaignForm.channels} onChange={event => setCampaignForm({...campaignForm, channels: event.target.value})}/><button className="servicesPrimaryAction" onClick={() => action("campaign", "/api/campaigns", {...campaignForm, channels: campaignForm.channels.split(",").map(item => item.trim()).filter(Boolean)})} disabled={Boolean(busy)}>CREATE CAMPAIGN</button></div>
      <div className="servicesGrowthCard"><div className="servicesSectionTitle"><span><ImageIcon size={14}/> MUAPI ASSET FACTORY</span><small>through Media Brain</small></div><select value={assetForm.serviceId} onChange={event => setAssetForm({...assetForm, serviceId: event.target.value})}>{services.map(service => <option value={service.id} key={service.id}>{service.name}</option>)}</select><select value={assetForm.kind} onChange={event => setAssetForm({...assetForm, kind: event.target.value})}><option value="image">Image / creative</option><option value="video">Video / ad</option><option value="image_to_video">Image to video</option><option value="audio">Audio / voice</option></select><input placeholder="Audiencia del asset (opcional)" value={assetForm.audience} onChange={event => setAssetForm({...assetForm, audience: event.target.value})}/><button className="servicesPrimaryAction" onClick={() => action("asset", "/api/assets/generate", assetForm)} disabled={Boolean(busy)}>GENERATE WITH MUAPI</button></div>
    </div>
    <div className="servicesGrowthCard servicesCampaignQueue"><div className="servicesSectionTitle"><span><MessageCircle size={14}/> CAMPAIGNS & PUBLICATIONS</span><small>{growth.publications.length} drafts · no auto-publish</small></div>{growth.campaigns.slice(0, 4).map(campaign => <div className="servicesPublicationRow" key={campaign.id}><div><b>{campaign.name}</b><small>{campaign.service} · {campaign.status} · {campaign.channels.join(" · ")}</small></div><button onClick={() => action(`launch-${campaign.id}`, `/api/campaigns/${campaign.id}/launch`, {})} disabled={Boolean(busy)}><Zap size={11}/> PREPARE DRAFTS</button></div>)}{growth.publications.slice(0, 3).map(publication => <div className="servicesPublicationRow" key={publication.id}><div><b>{publication.title}</b><small>{publication.channel} · {publication.status} · {publication.mediaStatus || "LOCAL DRAFT"}</small></div><button onClick={() => action(`approve-${publication.id}`, `/api/publications/${publication.id}/status`, {status: "READY_FOR_APPROVAL"})} disabled={Boolean(busy)}>MARK READY</button></div>)}{!growth.campaigns.length && !growth.publications.length && <div className="empty"><Database size={14}/> Crea una campaña para preparar la primera cola editorial.</div>}</div>
    <div className="commerceBotGrid">{services.slice(0, 12).map(service => { const basePrice = Number(service.startingFrom || 0); return <div className="commerceBotModule serviceOffer" key={service.id}><span className="commerceBotTop"><span className="commerceBotIcon"><Briefcase size={16}/></span><span><b>{service.name}</b><small>{service.category} · {service.model}</small></span><i className="ready"/></span><p>{service.description}</p><span className="commerceBotMeta"><span><small>STARTER</small>${basePrice.toLocaleString()}</span><span><small>GROWTH</small>${Math.round(basePrice * 1.8).toLocaleString()}</span><span><small>PREMIUM</small>${Math.round(basePrice * 3).toLocaleString()}</span></span><span className="commerceBotMeta"><span><small>DELIVERY</small>{service.delivery}</span><span><small>STATUS</small>{service.status}</span><span><small>NEXT</small>DIAGNOSIS</span></span><span className="commerceBotActions"><button onClick={() => createProposal(service)} disabled={busy === service.id}>{busy === service.id ? "…" : "CREATE PROPOSAL"}<ArrowUpRight size={12}/></button></span></div>; })}</div>
    {growth.approvals.length > 0 && <div className="servicesGrowthCard servicesApprovalQueue"><div className="servicesSectionTitle"><span><ShieldCheck size={14}/> APPROVAL QUEUE</span><small>{growth.approvals.length} pending</small></div>{growth.approvals.slice(0, 5).map(item => <div className="servicesPublicationRow" key={item.id}><div><b>{item.type}</b><small>{item.targetId} · {new Date(item.createdAt).toLocaleString()}</small></div><button onClick={() => resolveApproval(item.id, "APPROVED")} disabled={Boolean(busy)}>APPROVE</button><button onClick={() => resolveApproval(item.id, "REJECTED")} disabled={Boolean(busy)}>REJECT</button></div>)}</div>}
    {notice && <div className="automationNotice">{notice}</div>}
    <div className="commerceConnectors"><div><small>CROSS-BRAIN DELIVERY</small><b>Commerce + Media connected</b><p>Commerce aporta ofertas y marketplace. Media aporta producción y distribución. Services Brain lo convierte en una propuesta vendible y trazable.</p></div><div className="commerceConnectorPills"><span className="configured"><i/>COMMERCE<small>CONNECTED · DRAFTS</small></span><span className="configured"><i/>MEDIA<small>CONNECTED · PAPER</small></span></div></div>
  </section>;
}

function SaaSBrainOrbit({bots = [], speaking, onSelect}) {
  return <section className={"panel brain3dPanel saasBrain3dPanel " + (speaking ? "speaking" : "")}><div className="brain3dHeader"><div><small>03.6 / SAAS BRAIN · COMMAND CHAMBER</small><h2>El sistema operativo de MRR.</h2><p>Diez módulos conectan ingresos, churn, cohortes, billing, salud de clientes, pricing y asignación de crecimiento. Explora cada nodo y abre su control operativo.</p></div><span className="brain3dLive"><i/>{speaking ? "VOICE STREAMING" : "SAAS CORE · ONLINE"}</span></div><Brain3DViewport bots={bots} onSelect={onSelect}/></section>;
}

function MediaBrainOrbit({bots = [], speaking, onSelect}) {
  return <section className={"panel brain3dPanel mediaBrain3dPanel " + (speaking ? "speaking" : "")}><div className="brain3dHeader"><div><small>03.6 / MEDIA BRAIN · COMMAND CHAMBER</small><h2>El sistema operativo de distribución.</h2><p>Diez módulos convierten investigación y señales en estrategia editorial, piezas generativas, publicación, comunidad y crecimiento. Cada nodo está conectado al control de contenido.</p></div><span className="brain3dLive"><i/>{speaking ? "VOICE STREAMING" : "MEDIA CORE · ONLINE"}</span></div><Brain3DViewport bots={bots} onSelect={onSelect}/></section>;
}

function BrainAgentControlPanel({api, kind: panelKind, agents = [], summary, health, selectedAgentId, onSelect}) {
  const [connector, setConnector] = useState(null);
  const [mediaStatus, setMediaStatus] = useState(null);
  const base = api.replace(/\/$/, "");
  useEffect(() => {
    if (!selectedAgentId) return undefined;
    const timer = window.setTimeout(() => document.querySelector(`[data-brain-agent="${selectedAgentId}"]`)?.scrollIntoView({behavior: "smooth", block: "center"}), 80);
    return () => window.clearTimeout(timer);
  }, [selectedAgentId]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (panelKind === "saas") {
        const response = await fetch(`${base}/api/connectors/status`).then(item => item.json()).catch(() => null);
        if (!cancelled) setConnector(response?.connectors?.[0] || null);
      } else {
        const response = await fetch(`${base}/api/media/status`).then(item => item.json()).catch(() => null);
        if (!cancelled) setMediaStatus(response);
      }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [base, panelKind]);
  const isSaaS = panelKind === "saas";
  const revenue = summary?.revenue || {};
  const catalog = summary?.catalog || [];
  const stats = isSaaS
    ? [["MRR", `$${Number(revenue.mrr || 0).toLocaleString()}`], ["NRR", `${revenue.netRevenueRetention || 0}%`], ["CHURN", `${revenue.churnRate || 0}%`], ["HEALTH", `${revenue.portfolioHealth || 0}/100`]]
    : [["CONTENT", summary?.state?.processed || health?.processed || 0], ["MODELS", mediaStatus?.models || health?.modelCount || 0], ["CATALOG", catalog.length], ["PROVIDER", mediaStatus?.provider?.mode || health?.generation?.mode || "PAPER"]];
  return <section className="panel commerceControlPanel brainAgentControlPanel">
    <div className="panelHead"><div><small>{isSaaS ? "06 / SAAS CONTROL SURFACE" : "06 / MEDIA CONTROL SURFACE"}</small><h2>{isSaaS ? "Ten revenue modules. One growth cockpit." : "Ten content modules. One distribution cockpit."}</h2></div><span className="panelAction">{agents.filter(agent => agent.enabled !== false).length}/{agents.length || 10} ONLINE</span></div>
    <div className="commerceIntro"><div><b>{isSaaS ? "Revenue telemetry connected to the operating layer." : "Research, creation and distribution connected to the content factory."}</b><p>{isSaaS ? "MRR, retention, cohorts, billing and pricing remain read-only until their respective connectors are explicitly configured." : "The generative studio and product-content automation stay in PAPER/BRIEF mode until a provider or publishing connector is deliberately enabled."}</p></div><div className="commerceMode"><i/> {isSaaS ? "READ ONLY" : "PAPER MODE"}<small>{isSaaS ? "billing protected" : "drafts before publish"}</small></div></div>
    <div className="commercePipeline">{stats.map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}</div>
    <div className="commerceBotGrid">{agents.map((agent, index) => { const active = agent.enabled !== false; const open = selectedAgentId === agent.id; return <div data-brain-agent={agent.id} className={`commerceBotModule ${open ? "open" : ""}`} role="button" tabIndex="0" key={agent.id || index} onClick={() => onSelect?.(open ? null : agent.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") onSelect?.(open ? null : agent.id); }}><span className="commerceBotTop"><span className="commerceBotIcon"><Bot size={16}/></span><span><b>{agent.name || agent.id}</b><small>{active ? "ACTIVE" : "PAUSED"}</small></span><i className={active ? "ready" : "needs"}/></span><p>{botDescription(agent)}</p><span className="commerceBotMeta"><span><small>MODULE</small>{String(agent.id || "agent").toUpperCase()}</span><span><small>STATE</small>{active ? "ONLINE" : "PAUSED"}</span><span><small>LINK</small>{isSaaS ? "REVENUE" : "CONTENT"}</span></span>{open && <span className="commerceBotDetail" onClick={event => event.stopPropagation()}><small>{isSaaS ? `${revenue.healthyAccounts || "—"} healthy accounts · ${revenue.expansionMrr || 0} USD expansion MRR tracked.` : `${mediaStatus?.models || health?.modelCount || 0} models available · ${mediaStatus?.provider?.mode || "PAPER"} provider mode.`}</small><small className="commerceBotBlocker">{isSaaS ? connector?.configured ? "STRIPE CONNECTED · READ ONLY" : "STRIPE CONNECTOR · CREDENTIALS NEEDED" : mediaStatus?.provider?.configured ? "MEDIA PROVIDER CONNECTED" : "MEDIA PROVIDER · PAPER MOCK"}</small><span className="commerceBotActions"><a href={`${base}/api/${isSaaS ? "summary" : "content"}`} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}><Database size={12}/> OPEN DATA</a>{!isSaaS && <a href={`${base}/api/models`} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}><Sparkles size={12}/> MODEL MESH</a>}</span></span>}</div>; })}</div>
    <div className="commerceConnectors"><div><small>{isSaaS ? "REVENUE CONNECTOR" : "GENERATION CONNECTOR"}</small><b>{isSaaS ? "Stripe adapter" : "MuAPI / media gateway"}</b><p>{isSaaS ? "Billing events are normalized, but webhook verification remains a required safety gate." : "Image, video, audio and avatar tools are available from the adjacent Media Studio."}</p></div><div className="commerceConnectorPills"><span className={(isSaaS ? connector?.configured : mediaStatus?.provider?.configured) ? "configured" : "missing"}><i/>{isSaaS ? "STRIPE" : "MEDIA PROVIDER"}<small>{isSaaS ? (connector?.configured ? "CONFIGURED · READ ONLY" : "CREDENTIALS NEEDED") : (mediaStatus?.provider?.configured ? "CONFIGURED · PAPER" : "PAPER MOCK · READY")}</small></span></div></div>
  </section>;
}

function botDescription(bot) {
  const descriptions = {
    liquidation: "Busca liquidaciones y desequilibrios de riesgo en mercados perpetuos.",
    arbitrage: "Compara rutas DEX y CEX para detectar diferencias netas después de costes.",
    "solana-radar": "Rastrea nuevos tokens, liquidez y señales tempranas en Solana.",
    volatility: "Clasifica expansiones de rango y cambios de régimen de volatilidad.",
    momentum: "Filtra tendencia, fuerza relativa y continuidad de movimiento.",
    perpetuals: "Analiza funding, basis y estructura de futuros perpetuos.",
    polymarket: "Supervisa mercados de predicción y oportunidades de probabilidad.",
    "smart-money": "Observa carteras de alto impacto y movimientos de liquidez.",
    yield: "Compara rendimiento, riesgo de smart contract y disponibilidad de pools.",
    allocator: kind === "commerce" ? "Distribuye presupuesto PAPER entre productos y experimentos elegibles." : "Coordina señales y distribuye capital PAPER con la política de riesgo.",
    "solana-meme-momentum": "Busca momentum temprano en meme coins de Solana con filtros de liquidez.",
    "polygon-meme-momentum": "Busca momentum temprano en meme coins de Polygon con protección de liquidez.",
    "fx-macro-momentum": "Evalúa pares FX y el impacto de datos macroeconómicos.",
    "options-defined-risk": "Construye ideas de opciones con riesgo definido y payoff trazable.",
    "crude-oil-regime": "Clasifica el régimen del petróleo y sus impulsos macro.",
    "nyse-news-impact": "Detecta noticias de alto impacto y su posible efecto en NYSE.",
    "service-sales": "Detecta intención, recomienda servicios y prepara el siguiente paso comercial.",
    "service-qualifier": "Ordena objetivos, presupuesto, urgencia y alcance del cliente.",
    "service-quoting": "Construye cotizaciones PAPER con alcance, precio y entregables.",
    "service-web": "Coordina páginas, landings, CRO y activos web.",
    "service-video": "Organiza videos, music videos, reels y entregas audiovisuales.",
    "service-seo": "Convierte oportunidades orgánicas en planes de posicionamiento.",
    "service-brand": "Gestiona branding, identidad y dirección creativa.",
    "service-automation": "Diseña SaaS, automatizaciones e integraciones.",
    "service-delivery": "Pasa una venta aprobada a intake, milestones y proyecto.",
    "service-success": "Cuida la relación, recompra, upsell y continuidad del servicio.",
    "product-scout": "Detecta productos con demanda y margen potencial en Amazon.",
    "dropship-hunter": "Busca productos de AliExpress y valida proveedor, coste logístico y señales de demanda.",
    "digital-builder": "Convierte problemas de clientes en productos digitales, bundles y upsells.",
    "offer-pricing": "Calcula precio, margen, CAC objetivo, anclaje y sensibilidad de la oferta.",
    "creative-factory": "Prepara briefs de landing, contenido y assets conectados con Media Brain.",
    "store-manager": "Genera drafts de catálogo y sincronización controlada con Shopify.",
    traffic: "Ordena canales, audiencias, experimentos y límites de CAC.",
    closer: "Prioriza leads, intención comercial y próximos pasos de cierre.",
    retention: "Detecta cohortes de recompra, cross-sell, upsell y recuperación.",
    "revenue-intelligence": "Consolida MRR, ARR, expansión y señales de crecimiento del portfolio.",
    "churn-radar": "Detecta riesgo de churn y prioriza cuentas que necesitan intervención.",
    "cohort-analyst": "Compara cohortes, retención y revenue para encontrar patrones de producto.",
    "billing-observer": "Supervisa billing, eventos de suscripción y anomalías de facturación.",
    "growth-scout": "Busca oportunidades de expansión, nuevas cuentas y crecimiento eficiente.",
    "mrr-forecaster": "Proyecta MRR, ARR y escenarios de crecimiento con señales históricas.",
    "customer-health": "Resume salud de clientes y ordena acciones de retención por impacto.",
    "pricing-lab": "Diseña experimentos de pricing, packaging y elasticidad de conversión.",
    "stripe-adapter": "Normaliza eventos de Stripe para alimentar métricas de revenue verificables.",
    "saas-allocator": "Distribuye foco y presupuesto entre crecimiento, retención y experimentos.",
    "content-intel": "Convierte señales de mercado y producto en oportunidades editoriales.",
    research: "Investiga tendencias, fuentes y ángulos con potencial de distribución.",
    editorial: "Ordena calendario, formatos y prioridades para la estrategia editorial.",
    script: "Transforma briefs en guiones, copy y narrativas listas para producción.",
    visual: "Diseña dirección visual y briefs para imágenes, video y piezas de campaña.",
    video: "Coordina producción de video, escenas, assets y estados de generación.",
    repurpose: "Reconvierte una pieza en formatos nativos para distintos canales.",
    publisher: "Prepara distribución, scheduling y publicación controlada de contenido.",
    community: "Lee respuesta de audiencia y detecta conversaciones para engagement.",
    growth: "Asigna esfuerzo editorial hacia los canales y piezas con mayor potencial."
  };
  return descriptions[bot?.id] || "Agente de inteligencia financiera conectado al supervisor central.";
}

function botMetric(bot, key, fallback = "—") {
  const value = bot?.[key];
  return value === null || value === undefined || value === "" ? fallback : value;
}

function botProfit24h(bot) {
  return Number(bot?.pnl24h ?? bot?.profit24hUsd ?? bot?.realizedPnl24h ?? 0) || 0;
}

function Brain3DViewport({bots = [], central, onSelect}) {
  const mountRef = useRef(null), shellRef = useRef(null), cameraRef = useRef(null), controlsRef = useRef(null), selectRef = useRef(onSelect), hoverRef = useRef(null);
  const [loadStatus, setLoadStatus] = useState("online"), [fullscreen, setFullscreen] = useState(false), [hovered, setHovered] = useState(null);
  selectRef.current = onSelect;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const records = bots.length ? bots : Array.from({length: 16}, (_, index) => ({id: "bot-" + (index + 1), name: "BOT " + String(index + 1).padStart(2, "0"), status: "WAITING", active: false}));
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#01040b", .026);
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    camera.position.set(0, .18, 9.6);
    cameraRef.current = camera;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: "high-performance"}); }
    catch { setLoadStatus("fallback"); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.domElement.className = "brain3dCanvas";
    renderer.domElement.setAttribute("aria-label", `${brainTheme.name} 3D command chamber with ${records.length} connected modules`);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .075;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 3.15;
    controls.maxDistance = 16;
    controls.target.set(0, .05, 0);
    controlsRef.current = controls;
    scene.add(new THREE.HemisphereLight("#c9faff", "#030719", 1.45));
    const key = new THREE.PointLight("#36eaff", 18, 16, 2);
    key.position.set(3.4, 4.2, 4.5);
    scene.add(key);
    const fill = new THREE.PointLight("#785dff", 12, 15, 2);
    fill.position.set(-4, -1.8, 2.5);
    scene.add(fill);
    const warm = new THREE.PointLight("#ff9e6b", 5, 10, 2);
    warm.position.set(0, 3, -3);
    scene.add(warm);

    const world = new THREE.Group();
    scene.add(world);
    const brainRoot = new THREE.Group();
    brainRoot.position.y = .12;
    brainRoot.scale.setScalar(1.12);
    world.add(brainRoot);

    const makeAura = (color, size, opacity) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext("2d");
      const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 128);
      gradient.addColorStop(0, color);
      gradient.addColorStop(.28, "rgba(19, 222, 244, .28)");
      gradient.addColorStop(1, "rgba(0, 12, 35, 0)");
      context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false}));
      sprite.scale.set(size, size, 1); sprite.userData.texture = texture;
      return sprite;
    };
    const aura = makeAura(brainTheme.color, 3.4, .55);
    aura.position.y = .05;
    brainRoot.add(aura);

    const coreTexture = new THREE.TextureLoader().load(brainCoreUrl);
    coreTexture.colorSpace = THREE.SRGBColorSpace;
    const brainCore = new THREE.Sprite(new THREE.SpriteMaterial({map: coreTexture, transparent: true, opacity: .98, blending: THREE.AdditiveBlending, depthWrite: false}));
    brainCore.scale.set(3, 3, 1);
    brainCore.position.y = .05;
    brainCore.userData.texture = coreTexture;
    brainRoot.add(brainCore);

    const platform = new THREE.Mesh(new THREE.TorusGeometry(3.05, .012, 10, 160), new THREE.MeshBasicMaterial({color: "#2eeaff", transparent: true, opacity: .48, blending: THREE.AdditiveBlending}));
    platform.rotation.x = Math.PI / 2;
    platform.position.y = -1.82;
    world.add(platform);
    const platformInner = new THREE.Mesh(new THREE.TorusGeometry(1.2, .008, 8, 100), new THREE.MeshBasicMaterial({color: "#9c7bff", transparent: true, opacity: .62, blending: THREE.AdditiveBlending}));
    platformInner.rotation.x = Math.PI / 2; platformInner.position.y = -1.8; world.add(platformInner);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.95, 96), new THREE.MeshBasicMaterial({color: "#087e9a", transparent: true, opacity: .1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending}));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.81;
    world.add(glow);

    const stars = new THREE.BufferGeometry();
    const starPositions = new Float32Array(900 * 3);
    for (let index = 0; index < starPositions.length; index += 3) {
      const radius = 4.3 + Math.random() * 4.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      starPositions[index] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[index + 1] = radius * Math.cos(phi);
      starPositions[index + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    stars.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({color: "#6beaff", size: .014, transparent: true, opacity: .62, blending: THREE.AdditiveBlending})));

    const lanes = new THREE.Group();
    lanes.rotation.x = .18;
    world.add(lanes);
    for (let lane = 0; lane < 4; lane += 1) {
      const points = [];
      const radius = 2.15 + lane * .22;
      const elevation = (lane - 1.5) * .42;
      for (let step = 0; step <= 128; step += 1) {
        const angle = (step / 128) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, elevation + Math.sin(angle * 2 + lane) * .12, Math.sin(angle) * radius * .78));
      }
      const laneLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color: lane % 2 ? "#6e5dff" : "#23dce9", transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false}));
      lanes.add(laneLine);
    }
    const routeGroup = new THREE.Group();
    lanes.add(routeGroup);
    const rayTargets = [];
    const nodeRecords = [];
    const palette = ["#55e8ff", "#a88aff", "#66e4ae", "#ffb36d", "#ff7db3", "#7bafff"];
    const statusColor = bot => { const status = String(bot.status || (bot.active ? "ACTIVE" : "PAUSED")).toLowerCase(); if (status.includes("attention") || status.includes("block") || status.includes("error") || status.includes("degraded") || status.includes("review")) return "#ff789b"; return status.includes("scan") || status.includes("ready") || status.includes("active") ? "#5be6b0" : "#f2bd69"; };
    const ICON_TYPE = {
      liquidation: "bolt", arbitrage: "cycle", "solana-radar": "solana", volatility: "wave",
      momentum: "trend", perpetuals: "percent", polymarket: "polymarket", "smart-money": "pulse",
      yield: "bank", allocator: "hub",
      "solana-meme-momentum": "solana", "polygon-meme-momentum": "polygon", "fx-macro-momentum": "trend",
      "options-defined-risk": "shield", "crude-oil-regime": "drop", "nyse-news-impact": "bell",
      "product-scout": "radar", "dropship-hunter": "drop", "digital-builder": "target",
      "offer-pricing": "trend", "creative-factory": "spark", "store-manager": "hub",
      traffic: "trend", closer: "target", retention: "pulse",
      "revenue-intelligence": "trend", "churn-radar": "radar", "cohort-analyst": "pulse",
      "billing-observer": "bank", "growth-scout": "target", "mrr-forecaster": "trend",
      "customer-health": "pulse", "pricing-lab": "trend", "stripe-adapter": "cycle", "saas-allocator": "hub",
      "content-intel": "radar", research: "radar", editorial: "target", script: "target",
      visual: "hub", video: "cycle", repurpose: "cycle", publisher: "trend", community: "pulse", growth: "hub",
    };
    const arrowHead = (ctx, x, y, angle, size, color) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, size * .55); ctx.lineTo(-size, -size * .55); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    const drawBotIcon = (ctx, cx, cy, r, type, color) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = r * .16; ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (type === "bolt") {
        ctx.beginPath();
        ctx.moveTo(cx + r * .12, cy - r * .85); ctx.lineTo(cx - r * .55, cy + r * .12); ctx.lineTo(cx - r * .05, cy + r * .12);
        ctx.lineTo(cx - r * .12, cy + r * .85); ctx.lineTo(cx + r * .55, cy - r * .15); ctx.lineTo(cx + r * .05, cy - r * .15);
        ctx.closePath(); ctx.fill();
      } else if (type === "cycle") {
        ctx.beginPath(); ctx.arc(cx, cy, r * .6, -Math.PI * .15, Math.PI * 1.1); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r * .6, Math.PI * .85, Math.PI * 2.1); ctx.stroke();
        arrowHead(ctx, cx + Math.cos(Math.PI * 1.1) * r * .6, cy + Math.sin(Math.PI * 1.1) * r * .6, Math.PI * 1.1 + Math.PI / 2, r * .24, color);
        arrowHead(ctx, cx + Math.cos(Math.PI * 2.1) * r * .6, cy + Math.sin(Math.PI * 2.1) * r * .6, Math.PI * 2.1 + Math.PI / 2, r * .24, color);
      } else if (type === "radar") {
        [.32, .55, .78].forEach((rad, i) => { ctx.globalAlpha = .45 + i * .2; ctx.beginPath(); ctx.arc(cx, cy, r * rad, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke(); });
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(-Math.PI * .25) * r * .88, cy + Math.sin(-Math.PI * .25) * r * .88); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r * .09, 0, Math.PI * 2); ctx.fill();
      } else if (type === "wave") {
        const bars = [.4, .78, 1, .55, .85, .35]; const w = r * 1.7 / bars.length;
        bars.forEach((h, i) => { const x = cx - r * .85 + i * w; ctx.beginPath(); ctx.moveTo(x, cy + r * .8 * h); ctx.lineTo(x, cy - r * .8 * h); ctx.stroke(); });
      } else if (type === "trend") {
        ctx.beginPath(); ctx.moveTo(cx - r * .8, cy + r * .55); ctx.lineTo(cx - r * .2, cy - r * .05); ctx.lineTo(cx + r * .15, cy + r * .25); ctx.lineTo(cx + r * .8, cy - r * .65); ctx.stroke();
        arrowHead(ctx, cx + r * .8, cy - r * .65, -Math.PI * .28, r * .26, color);
      } else if (type === "percent") {
        ctx.beginPath(); ctx.arc(cx - r * .42, cy - r * .42, r * .24, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + r * .42, cy + r * .42, r * .24, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - r * .6, cy + r * .6); ctx.lineTo(cx + r * .6, cy - r * .6); ctx.stroke();
      } else if (type === "target") {
        [.85, .55, .22].forEach(rad => { ctx.beginPath(); ctx.arc(cx, cy, r * rad, 0, Math.PI * 2); ctx.stroke(); });
      } else if (type === "solana") {
        const grad = ctx.createLinearGradient(cx - r * .82, cy - r * .6, cx + r * .82, cy + r * .6);
        grad.addColorStop(0, "#9945FF"); grad.addColorStop(1, "#14F195"); ctx.fillStyle = grad;
        [-.52, 0, .52].forEach((row, i) => {
          const yOff = cy + row * r * .66, barW = r * 1.5, barH = r * .24, skew = r * .24 * (i === 1 ? -1 : 1);
          ctx.beginPath();
          ctx.moveTo(cx - barW / 2 + (i === 1 ? skew : 0), yOff - barH / 2);
          ctx.lineTo(cx + barW / 2 + (i === 1 ? skew : 0), yOff - barH / 2);
          ctx.lineTo(cx + barW / 2 - skew * .2, yOff + barH / 2);
          ctx.lineTo(cx - barW / 2 - skew * .2, yOff + barH / 2);
          ctx.closePath(); ctx.fill();
        });
      } else if (type === "polygon") {
        ctx.strokeStyle = "#8247E5"; ctx.fillStyle = "#8247E5"; ctx.lineWidth = r * .15;
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) { const a = Math.PI / 6 + i * Math.PI / 3; const x = cx + Math.cos(a) * r * .78, y = cy + Math.sin(a) * r * .78; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r * .16, 0, Math.PI * 2); ctx.fill();
      } else if (type === "polymarket") {
        ctx.beginPath(); ctx.arc(cx, cy, r * .82, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - r * .38, cy + r * .4); ctx.lineTo(cx - r * .12, cy - r * .1); ctx.lineTo(cx + r * .14, cy + r * .18); ctx.lineTo(cx + r * .45, cy - r * .42);
        ctx.stroke();
        arrowHead(ctx, cx + r * .45, cy - r * .42, -Math.PI * .3, r * .2, color);
      } else if (type === "pulse") {
        ctx.beginPath(); ctx.moveTo(cx - r * .9, cy); ctx.lineTo(cx - r * .35, cy); ctx.lineTo(cx - r * .15, cy - r * .6);
        ctx.lineTo(cx + r * .1, cy + r * .6); ctx.lineTo(cx + r * .3, cy); ctx.lineTo(cx + r * .9, cy); ctx.stroke();
      } else if (type === "bank") {
        ctx.beginPath(); ctx.moveTo(cx - r * .75, cy - r * .25); ctx.lineTo(cx, cy - r * .8); ctx.lineTo(cx + r * .75, cy - r * .25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - r * .85, cy - r * .25); ctx.lineTo(cx + r * .85, cy - r * .25); ctx.stroke();
        [-.55, -.18, .18, .55].forEach(dx => { ctx.beginPath(); ctx.moveTo(cx + dx * r, cy - r * .1); ctx.lineTo(cx + dx * r, cy + r * .55); ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(cx - r * .85, cy + r * .75); ctx.lineTo(cx + r * .85, cy + r * .75); ctx.stroke();
      } else if (type === "shield") {
        ctx.beginPath(); ctx.moveTo(cx, cy - r * .85); ctx.lineTo(cx + r * .7, cy - r * .5); ctx.lineTo(cx + r * .7, cy + r * .15);
        ctx.quadraticCurveTo(cx + r * .7, cy + r * .75, cx, cy + r * .9); ctx.quadraticCurveTo(cx - r * .7, cy + r * .75, cx - r * .7, cy + r * .15);
        ctx.lineTo(cx - r * .7, cy - r * .5); ctx.closePath(); ctx.stroke();
      } else if (type === "drop") {
        ctx.beginPath(); ctx.moveTo(cx, cy - r * .85); ctx.quadraticCurveTo(cx + r * .7, cy + r * .15, cx, cy + r * .85);
        ctx.quadraticCurveTo(cx - r * .7, cy + r * .15, cx, cy - r * .85); ctx.closePath(); ctx.stroke();
      } else if (type === "bell") {
        ctx.beginPath(); ctx.arc(cx, cy - r * .05, r * .55, Math.PI, 0); ctx.lineTo(cx + r * .65, cy + r * .45); ctx.lineTo(cx - r * .65, cy + r * .45); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy + r * .6, r * .12, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(cx, cy, r * .2, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 6; i += 1) { const a = i / 6 * Math.PI * 2; const x2 = cx + Math.cos(a) * r * .8, y2 = cy + Math.sin(a) * r * .8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke(); ctx.beginPath(); ctx.arc(x2, y2, r * .1, 0, Math.PI * 2); ctx.fill(); }
      }
    };
    const makeIconPlate = (bot, color) => {
      const type = ICON_TYPE[bot.id] || "hub";
      const canvas = document.createElement("canvas"); canvas.width = 220; canvas.height = 220;
      const ctx = canvas.getContext("2d"); const cx = 110, cy = 110;
      const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 105);
      glow.addColorStop(0, color + "55"); glow.addColorStop(1, color + "00");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, 105, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = .85;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) { const a = Math.PI / 6 + i * Math.PI / 3; const x = cx + Math.cos(a) * 92, y = cy + Math.sin(a) * 92; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 24;
      drawBotIcon(ctx, cx, cy, 58, type, color);
      ctx.restore();
      ctx.save(); ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 7; ctx.globalAlpha = .92;
      drawBotIcon(ctx, cx, cy, 50, type, "#f8feff");
      ctx.restore();
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
      sprite.scale.set(.3, .3, 1); sprite.userData.texture = texture;
      return sprite;
    };
    const createArtifact = (index, color, bot) => {
      const artifact = new THREE.Group();
      const halo = new THREE.Mesh(new THREE.TorusGeometry(.17, .004, 8, 64), new THREE.MeshBasicMaterial({color, transparent: true, opacity: .6, blending: THREE.AdditiveBlending}));
      halo.rotation.x = Math.PI / 2; halo.position.y = -.16; artifact.add(halo);
      const core = makeAura(color, .36, .7); core.position.y = .02; artifact.add(core);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(.155, .007, 8, 56), new THREE.MeshBasicMaterial({color, transparent: true, opacity: .85, blending: THREE.AdditiveBlending})); artifact.add(frame);
      const frame2 = new THREE.Mesh(new THREE.TorusGeometry(.195, .004, 8, 48), new THREE.MeshBasicMaterial({color: palette[(index + 2) % palette.length], transparent: true, opacity: .5, blending: THREE.AdditiveBlending})); frame2.rotation.x = Math.PI / 2.4; artifact.add(frame2);
      const plate = makeIconPlate(bot, color); plate.position.y = .01; artifact.add(plate);
      for (let spoke = 0; spoke < 3; spoke += 1) { const dot = new THREE.Mesh(new THREE.SphereGeometry(.013, 8, 8), new THREE.MeshBasicMaterial({color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending})); const a = spoke * Math.PI * 2 / 3; dot.position.set(Math.cos(a) * .17, .01 + Math.sin(a * 2) * .035, Math.sin(a) * .17); artifact.add(dot); }
      artifact.userData.frame = frame; artifact.userData.frame2 = frame2; artifact.userData.plate = plate;
      return artifact;
    };
    const makePnlLabel = (amount) => {
      const canvas = document.createElement("canvas");
      canvas.width = 360; canvas.height = 80;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(3, 31, 30, .88)"; context.strokeStyle = "rgba(92, 255, 191, .9)"; context.lineWidth = 2; context.beginPath(); context.roundRect(3, 3, 354, 74, 18); context.fill(); context.stroke();
      context.fillStyle = "#6dffc1"; context.font = "700 26px DM Mono, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("+" + amount.toFixed(2) + " USD", 180, 40);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, opacity: .98, depthWrite: false, blending: THREE.AdditiveBlending}));
      sprite.scale.set(.38, .085, 1); sprite.position.y = .38;
      sprite.userData.texture = texture;
      return sprite;
    };
    const makeNameLabel = (bot, color) => {
      const canvas = document.createElement("canvas"); canvas.width = 520; canvas.height = 92; const context = canvas.getContext("2d");
      context.fillStyle = "rgba(2, 8, 19, .84)"; context.strokeStyle = color; context.lineWidth = 2; context.beginPath(); context.roundRect(3, 3, 514, 86, 14); context.fill(); context.stroke();
      context.fillStyle = "#edfaff"; context.font = "700 22px DM Mono, monospace"; context.textAlign = "center"; context.fillText(String(bot.name || bot.id || "BOT").toUpperCase().slice(0, 27), 260, 36);
      context.fillStyle = color; context.font = "500 14px DM Mono, monospace"; context.fillText(String(bot.network || bot.status || "PAPER").toUpperCase().slice(0, 34), 260, 66);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, opacity: .86, depthWrite: false})); sprite.scale.set(.56, .099, 1); sprite.position.y = .24; sprite.userData.texture = texture; return sprite;
    };
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const nodePositions = [];
    records.forEach((bot, index) => {
      const total = records.length;
      const t = (index + .5) / total;
      const yNorm = 1 - t * 2;
      const ring = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
      const phi = index * goldenAngle;
      const radius = 3.85;
      const position = new THREE.Vector3(Math.cos(phi) * ring * radius, yNorm * radius * .6, Math.sin(phi) * ring * radius * .78);
      const node = new THREE.Group();
      node.position.copy(position);
      node.userData.bot = bot;
      node.userData.phase = index * .63; node.userData.anchor = position.clone();
      const color = statusColor(bot); const artifact = createArtifact(index, color, bot); node.add(artifact); node.add(makeNameLabel(bot, color));
      const pnl = botProfit24h(bot);
      if (pnl > .005) node.add(makePnlLabel(pnl));
      const routePoints = [new THREE.Vector3(0, .12, 0), new THREE.Vector3(position.x * .42, position.y * .7 + .12, position.z * .42), position.clone().setY(position.y - .08)];
      const route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(routePoints), new THREE.LineBasicMaterial({color, transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false})); routeGroup.add(route);
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 8), new THREE.MeshBasicMaterial({color, transparent: true, opacity: .95, blending: THREE.AdditiveBlending})); routeGroup.add(pulse);
      lanes.add(node); nodeRecords.push({node, artifact, routePoints, pulse, speed: .08 + (index % 4) * .018, color});
      node.traverse(child => { if (child.isMesh || child.isSprite) { child.userData.bot = bot; rayTargets.push(child); } });
      nodePositions.push({position, color});
    });

    const buildBoltPoints = (a, b, segments, spread) => {
      const dir = new THREE.Vector3().subVectors(b, a);
      const up = Math.abs(dir.y) < dir.length() * .95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const perp1 = new THREE.Vector3().crossVectors(dir, up).normalize();
      const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
      const points = [];
      for (let s = 0; s <= segments; s += 1) {
        const t = s / segments;
        const point = new THREE.Vector3().lerpVectors(a, b, t);
        if (s > 0 && s < segments) {
          point.addScaledVector(perp1, (Math.random() - .5) * spread);
          point.addScaledVector(perp2, (Math.random() - .5) * spread);
        }
        points.push(point);
      }
      return points;
    };
    const boltGroup = new THREE.Group();
    lanes.add(boltGroup);
    const bolts = [];
    const boltPairs = new Set();
    nodePositions.forEach((entry, i) => {
      let nearest = -1, nearestDist = Infinity;
      nodePositions.forEach((other, j) => {
        if (i === j) return;
        const d = entry.position.distanceTo(other.position);
        if (d < nearestDist) { nearestDist = d; nearest = j; }
      });
      if (nearest === -1) return;
      const key = i < nearest ? `${i}-${nearest}` : `${nearest}-${i}`;
      if (boltPairs.has(key)) return;
      boltPairs.add(key);
      const material = new THREE.LineBasicMaterial({color: "#cdf4ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
      const line = new THREE.Line(new THREE.BufferGeometry(), material);
      boltGroup.add(line);
      bolts.push({line, a: entry.position, b: nodePositions[nearest].position, flashAt: Math.random() * 3, fadeEnd: 0});
    });

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const lastPointer = {x: 0, y: 0};
    const handlePointerMove = event => {
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(rayTargets, false)[0];
      const bot = hit?.object?.userData?.bot || null;
      hoverRef.current = bot;
      setHovered(current => current?.id === bot?.id ? current : bot);
    };
    const handlePointerLeave = () => { hoverRef.current = null; setHovered(null); };
    const handleClick = () => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((lastPointer.x - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((lastPointer.y - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const bot = raycaster.intersectObjects(rayTargets, false)[0]?.object?.userData?.bot;
      if (bot?.id) selectRef.current?.(bot.id);
    };
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("click", handleClick);

    const resize = () => {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(320, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    window.addEventListener("resize", resize);
    resize();
    let frame;
    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      brainRoot.rotation.y = Math.sin(elapsed * .16) * .075;
      brainRoot.rotation.x = Math.sin(elapsed * .12) * .022;
      brainCore.material.opacity = .92 + Math.sin(elapsed * 1.1) * .06;
      const coreBreath = 1 + Math.sin(elapsed * .7) * .012;
      brainCore.scale.set(3 * coreBreath, 3 * coreBreath, 1);
      lanes.rotation.y = elapsed * .045;
      bolts.forEach(bolt => {
        if (elapsed >= bolt.flashAt) {
          bolt.line.geometry.dispose();
          bolt.line.geometry = new THREE.BufferGeometry().setFromPoints(buildBoltPoints(bolt.a, bolt.b, 7, .16));
          bolt.fadeEnd = elapsed + .22;
          bolt.flashAt = elapsed + 1.3 + Math.random() * 2.6;
        }
        const remaining = bolt.fadeEnd - elapsed;
        bolt.line.material.opacity = remaining > 0 ? Math.max(0, remaining / .22) * .85 : 0;
      });
      nodeRecords.forEach(({node, artifact, routePoints, pulse, speed, phase}) => {
        const selected = hoverRef.current?.id && node.userData.bot?.id === hoverRef.current.id;
        node.position.y = node.userData.anchor.y + Math.sin(elapsed * 1.05 + node.userData.phase) * .045;
        node.rotation.y = elapsed * .28 + node.userData.phase;
        node.scale.setScalar(selected ? 1.26 : 1 + Math.sin(elapsed * 1.8 + node.userData.phase) * .035);
        artifact.rotation.z = Math.sin(elapsed * .8 + node.userData.phase) * .12;
        artifact.userData.frame.rotation.z += selected ? .025 : .009;
        artifact.userData.frame2.rotation.x += selected ? .018 : .006;
        const routeT = (elapsed * (speed || .1) + (node.userData.phase % 1)) % 1;
        pulse.position.copy(new THREE.CatmullRomCurve3(routePoints).getPoint(routeT));
      });
      platform.rotation.z = elapsed * .08; platformInner.rotation.z = -elapsed * .16;
      glow.material.opacity = .08 + Math.sin(elapsed * 1.4) * .025;
      aura.material.opacity = .66 + Math.sin(elapsed * 1.1) * .12;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    const fullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", fullscreenChange);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("fullscreenchange", fullscreenChange);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", handleClick);
      controls.dispose();
      renderer.dispose();
      aura.userData.texture?.dispose();
      brainCore.userData.texture?.dispose();
      mount.replaceChildren();
    };
  }, [bots, central]);

  const zoom = factor => { const camera = cameraRef.current; if (!camera) return; camera.position.multiplyScalar(factor); controlsRef.current?.update(); };
  const toggleFullscreen = async () => { const target = shellRef.current; if (!target) return; if (document.fullscreenElement) await document.exitFullscreen(); else await target.requestFullscreen?.(); };
  const selected = hovered;
  const status = String(selected?.status || ((selected?.active ?? selected?.enabled) ? "ACTIVE" : "PAUSED")).toUpperCase();
  const moduleCount = bots.length || 16;
  return <div className="brain3dCanvasShell" ref={shellRef}>{loadStatus === "fallback" && <img className="brain3dFallback" src={brainCoreUrl} alt={`${brainTheme.name} preview`}/>}<div className="brain3dCanvasMount" ref={mountRef}/><div className="brain3dCanvasHud"><span><i className={"brain3dStatusDot " + loadStatus}/>{loadStatus === "online" ? "COMMAND CHAMBER · ONLINE" : "3D FALLBACK · WEBGL UNAVAILABLE"}</span><small>{moduleCount} MODULES · SIGNAL ROUTES ACTIVE</small><small>LEFT DRAG EXPLORE · RIGHT DRAG PAN · WHEEL ZOOM · HOVER MODULE</small></div><div className="brain3dControls"><button onClick={() => zoom(.82)} aria-label="Zoom in">+</button><button onClick={() => zoom(1.22)} aria-label="Zoom out">−</button><button onClick={toggleFullscreen} aria-label="Toggle fullscreen">{fullscreen ? "×" : "⛶"}</button></div>{selected && <div className="brainBotFloat" role="dialog" aria-label={"Reporte de " + (selected.name || selected.id)}><div className="brainBotFloatTop"><span><i className="brain3dStatusDot online"/>{status} · LIVE MODULE REPORT</span><button onClick={() => onSelect?.(selected.id)}>OPEN CONTROL</button></div><h3>{selected.name || selected.id}</h3><p>{botDescription(selected)}</p><div className="brainBotMetrics">{kind === "finance" ? <><span><small>NETWORK</small><b>{botMetric(selected, "network", "MULTI")}</b></span><span><small>PAPER PNL</small><b>{Number(botMetric(selected, "pnl24h", 0)).toFixed(2)} USD</b></span><span><small>OPPS</small><b>{botMetric(selected, "opportunities", 0)}</b></span></> : <><span><small>STATUS</small><b>{selected.status || (selected.enabled === false ? "PAUSED" : "ACTIVE")}</b></span><span><small>SIGNALS</small><b>{selected.metrics?.signals ?? selected.signals ?? "—"}</b></span><span><small>CONFIDENCE</small><b>{selected.metrics?.confidence ? `${selected.metrics.confidence}%` : "—"}</b></span></>}</div><div className="brainBotSignal"><small>{selected.lastError || selected.lastAction || selected.readiness?.blockers?.[0] || selected.status || "Observando señales y esperando el siguiente ciclo."}</small></div></div>}</div>;
}



function MediaStudioPanel({api}){
  const typeMap={image:{label:"IMAGE",category:"t2i",icon:ImageIcon},video:{label:"VIDEO",category:"t2v",icon:Video},audio:{label:"AUDIO",category:"audio",icon:Music2},lipsync:{label:"LIP SYNC / AVATAR",category:"lipsync",icon:Mic2}};
  const [kind,setKind]=useState("image"),[models,setModels]=useState({}),[prompts,setPrompts]=useState({}),[avatars,setAvatars]=useState([]),[status,setStatus]=useState(null),[model,setModel]=useState(""),[preset,setPreset]=useState(""),[prompt,setPrompt]=useState(""),[imageUrl,setImageUrl]=useState(""),[audioUrl,setAudioUrl]=useState(""),[avatarId,setAvatarId]=useState(""),[job,setJob]=useState(null),[busy,setBusy]=useState(false),[avatarName,setAvatarName]=useState(""),[avatarImage,setAvatarImage]=useState("");
  const refresh=useCallback(async()=>{try{const [m,p,a,s]=await Promise.all([fetch(`${api}/api/models`).then(r=>r.json()),fetch(`${api}/api/prompts`).then(r=>r.json()),fetch(`${api}/api/avatars`).then(r=>r.json()),fetch(`${api}/api/media/status`).then(r=>r.json())]);setModels(m.categories||{});setPrompts(p.presets||{});setAvatars(a||[]);setStatus(s);}catch(error){setStatus({error:error.message});}},[api]);
  useEffect(()=>{refresh();},[refresh]);
  const options=models[typeMap[kind].category]||[];const presetOptions=prompts[kind]||[];
  useEffect(()=>{if(options.length&&!options.some(item=>item.id===model))setModel(options[0].id);if(presetOptions.length&&!presetOptions.some(item=>item.id===preset))setPreset(presetOptions[0].id);},[kind,options,presetOptions,model,preset]);
  useEffect(()=>{if(!job?.id||job.status!=="processing")return;const timer=setInterval(async()=>{const next=await fetch(`${api}/api/generations/${job.id}`).then(r=>r.json()).catch(()=>null);if(next){setJob(next);if(["completed","failed","timeout"].includes(next.status))clearInterval(timer);}},3000);return()=>clearInterval(timer);},[api,job?.id,job?.status]);
  async function generate(){setBusy(true);try{const body={model,preset,prompt};if(imageUrl)body.image_url=imageUrl;if(audioUrl)body.audio_url=audioUrl;if(avatarId)body.avatarId=avatarId;const response=await fetch(`${api}/api/generate/${kind}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Generation failed");setJob(data.job);setStatus(current=>({...current,lastGeneration:data.job.status}));}catch(error){setJob({status:"failed",error:error.message});}finally{setBusy(false)}}
  async function createAvatar(){if(!avatarName||!avatarImage)return;const response=await fetch(`${api}/api/avatars`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:avatarName,imageUrl:avatarImage,lipSyncModel:"kling-v2-avatar-pro"})});const data=await response.json();if(data.avatar){setAvatars(current=>[data.avatar,...current]);setAvatarId(data.avatar.id);setAvatarName("");setAvatarImage("");}}
  const TypeIcon=typeMap[kind].icon;return <section className="panel mediaStudioPanel"><PanelHead eyebrow="01 / GENERATIVE MEDIA CONTROL" title="Generate with the full model mesh." action={`${status?.models||422} MODELS · ${status?.provider?.mode||"PAPER_MOCK"}`}/><div className="mediaStudioTabs">{Object.entries(typeMap).map(([id,item])=><button key={id} className={kind===id?"selected":""} onClick={()=>setKind(id)}><item.icon size={15}/>{item.label}</button>)}</div><div className="mediaStudioForm"><div className="mediaField"><label>MODEL</label><select value={model} onChange={event=>setModel(event.target.value)}>{options.map(item=><option key={item.id} value={item.id}>{item.name} · {item.provider||item.family||"model"}</option>)}</select></div><div className="mediaField"><label>PROMPT PRESET</label><select value={preset} onChange={event=>setPreset(event.target.value)}><option value="">Custom direction</option>{presetOptions.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="mediaField mediaPrompt"><label>CREATIVE PROMPT</label><textarea value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="Describe the image, video, audio or avatar performance..."/></div>{kind==="lipsync"&&<div className="mediaField"><label>AVATAR</label><select value={avatarId} onChange={event=>setAvatarId(event.target.value)}><option value="">Use direct media URLs</option>{avatars.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}{(kind==="image"||kind==="video"||kind==="lipsync")&&<div className="mediaField"><label>IMAGE / VIDEO URL</label><input value={imageUrl} onChange={event=>setImageUrl(event.target.value)} placeholder="https://..."/></div>}{(kind==="audio"||kind==="lipsync")&&<div className="mediaField"><label>AUDIO URL</label><input value={audioUrl} onChange={event=>setAudioUrl(event.target.value)} placeholder="https://..."/></div>}<button className="mediaGenerate" onClick={generate} disabled={busy}><TypeIcon size={17}/>{busy?"SUBMITTING...":`GENERATE ${typeMap[kind].label}`}</button></div>{kind==="lipsync"&&<div className="avatarBuilder"><div><b>AVATAR REGISTRY</b><small>Create a reusable portrait avatar for lip-sync.</small></div><input value={avatarName} onChange={event=>setAvatarName(event.target.value)} placeholder="Avatar name"/><input value={avatarImage} onChange={event=>setAvatarImage(event.target.value)} placeholder="Portrait image URL"/><button onClick={createAvatar}><Plus size={14}/> SAVE AVATAR</button></div>}{job&&<div className={`mediaJob ${job.status}`}><span>JOB {job.status?.toUpperCase()}</span><b>{job.model}</b>{job.outputUrl&&<a href={job.outputUrl} target="_blank" rel="noreferrer">OPEN OUTPUT ↗</a>}{job.error&&<small>{job.error}</small>}</div>}</section>;
}
function FinanceIntegrationsPanel({api}) {
  const [rows, setRows] = useState({binance:null, solana:null, polymarket:null, providers:{}});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [binance, solana, polymarket, providers] = await Promise.all([
        get("/api/integrations/binance/status"),
        get("/api/integrations/solana/status"),
        get("/api/integrations/polymarket/status"),
        get("/api/integrations/data-providers/status")
      ]);
      setRows({binance, solana, polymarket, providers:providers.providers||{}}); setError("");
    } catch (e) { setError(e.message); }
  }, [api]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [refresh]);
  async function probe(name, path, body) {
    setBusy(name); setError("");
    try {
      const response = await fetch(`${api}${path}`, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body || {})});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `API ${response.status}`);
      setRows(current => ({...current, [name]: {...current[name], lastProbe:data, probeOnline:data.online, lastError:null}}));
    } catch (e) { setError(`${name}: ${e.message}`); }
    finally { setBusy(""); }
  }
  const card = (name, label, item, probePath, probeBody) => {
    const ready = item?.armed || item?.authenticated || item?.configured;
    const online = item?.probeOnline || item?.lastProbe?.online;
    return <article className="integrationCard" key={name}><div className="integrationTop"><b>{label}</b><i className={online ? "online" : ready ? "ready" : "locked"}/></div><div className="integrationStatus">{online ? "DATA ONLINE" : item?.authenticated ? "AUTHENTICATED" : item?.enabled ? "ENABLED / WAITING" : "LOCKED BY DEFAULT"}</div><small>{item?.privateKeyStoredInApp === false || item?.credentialsStoredInApp === false ? "External signer / no private key stored" : item?.provider || "Connector"}</small>{probePath && <button onClick={() => probe(name, probePath, probeBody)} disabled={busy===name}>{busy===name ? "PROBING…" : "PROBE CONNECTOR"}</button>}</article>;
  };
  return <section className="panel integrationsPanel"><PanelHead eyebrow="05 / MARKET CONNECTORS" title="External markets" action="SAFE BY DEFAULT"/><p className="integrationIntro">RPC, APIs y proveedores de seguridad están conectados aquí. Live orders remain disabled until each connector is explicitly armed.</p><div className="integrationGrid">{card("binance","BINANCE SPOT / FUTURES",rows.binance,"/api/integrations/binance/probe",{market:"spot"})}{card("solana","SOLANA · JUPITER / JITO",rows.solana,"/api/integrations/solana/probe")}{card("polymarket","POLYMARKET CLOB",rows.polymarket,null,null)}{card("okx","OKX DERIVATIVES FALLBACK",rows.providers.okxDerivatives,null,null)}{card("helius","HELIUS SOLANA RPC",rows.providers.helius,null,null)}{card("goplus","GOPLUS TOKEN SECURITY",rows.providers.goPlus,null,null)}{card("alpaca","ALPACA PAPER",rows.providers.alpaca,null,null)}{card("oanda","OANDA PRACTICE",rows.providers.oanda,null,null)}</div>{error&&<div className="integrationError">{error}</div>}</section>;
}

class BotControlErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = {error: null}; }
  static getDerivedStateFromError(error) { return {error}; }
  componentDidCatch(error) { console.error("Bot control render error", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="botControlOverlay" onClick={this.props.onClose}><section className="botControlModal botControlCrash" onClick={event => event.stopPropagation()}><button className="botControlClose" onClick={this.props.onClose}>×</button><div className="botControlHeader"><span className="botControlOrb"><ShieldCheck size={26}/></span><div><small>BOT CONTROL · RECOVERABLE ERROR</small><h2>No se pudo abrir este bot</h2><p>El Brain sigue operativo. El panel se protegió para evitar bloquear toda la pantalla.</p></div></div><div className="botControlMessage">{this.state.error?.message || "Respuesta de datos incompatible"}</div><button className="botSaveButton" onClick={this.props.onClose}>CERRAR Y CONTINUAR</button></section></div>;
  }
}

function botLaunchLabel(row) {
  const launches = Array.isArray(row?.launches) ? row.launches : [];
  const discoveries = Array.isArray(row?.discoveries) ? row.discoveries : [];
  return launches[0]?.symbol || discoveries.find(item => item && typeof item === "object" && item.symbol)?.symbol || row?.symbol || row?.asset || row?.token || row?.question || "Scanner result";
}

function BotControlModal({api, bot, onClose, onScan}) {
  const [tab, setTab] = useState("results");
  const [data, setData] = useState(null);
  const [configValue, setConfigValue] = useState({enabled:true,maxAllocationPct:20,minConfidence:"",notes:""});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [connector, setConnector] = useState(null);
  const [proposals, setProposals] = useState([]);
  const meta = botMeta(bot.id);
  const BotIcon = meta.Icon;
  const load = useCallback(async () => {
    const [result, strategy, market] = await Promise.all([fetch(`${api}/api/bots/${bot.id}/results?limit=40`).then(r => r.json()), fetch(`${api}/api/strategies/config`).then(r => r.json()), bot.marketBotId ? fetch(`${api}/api/market-bots/${bot.marketBotId}`).then(r => r.json()).catch(() => null) : Promise.resolve(null)]);
    setData(market?.result ? {...result, scans:[market.result,...(result.scans||[]).filter(row => row.scannedAt !== market.result.scannedAt)], marketResult:market.result} : result);
    setConfigValue({enabled:strategy[bot.id]?.enabled !== false,maxAllocationPct:strategy[bot.id]?.maxAllocationPct ?? 20,minConfidence:strategy[bot.id]?.minConfidence ?? "",notes:strategy[bot.id]?.notes || ""});
    if (bot.id === "polymarket" && !bot.marketBotId) { setConnector(await fetch(`${api}/api/integrations/polymarket/status`).then(r => r.json())); setProposals(await fetch(`${api}/api/integrations/polymarket/proposals`).then(r => r.json())); }
  }, [api, bot.id]);
  useEffect(() => { load().catch(error => setMessage(error.message)); }, [load]);
  async function scan() {
    setBusy("scan"); setMessage("");
    try { await onScan(bot.id); await load(); setMessage("Scan completado y resultados actualizados."); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  }
  async function save() {
    setBusy("save"); setMessage("");
    try {
      const body={...configValue,maxAllocationPct:Number(configValue.maxAllocationPct),minConfidence:configValue.minConfidence===""?null:Number(configValue.minConfidence)};
      await request(`/api/strategies/${bot.id}/config`,{method:"PATCH",body:JSON.stringify(body)});
      await load(); setMessage("Parámetros guardados.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  }
  async function resolveProposal(id, action) {
    setBusy(`${action}:${id}`); setMessage("");
    try { await request(`/api/integrations/polymarket/proposals/${id}/${action}`, {method:"POST"}); await load(); setMessage(action === "approve" ? "Orden enviada al CLOB." : "Propuesta rechazada."); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  }
  const scans=data?.scans||[], opportunities=data?.opportunities||[], executions=data?.executions||[];
  return <div className="botControlOverlay" onClick={onClose}><section className="botControlModal" onClick={event => event.stopPropagation()} style={{"--botAccent":meta.accent}}>
    <button className="botControlClose" onClick={onClose}>×</button>
    <div className="botControlHeader"><span className="botControlOrb"><BotIcon size={26}/></span><div><small>BOT {meta.n} · LIVE TELEMETRY</small><h2>{meta.label}</h2><p>{bot.network || "MULTI"} · {bot.status || "UNKNOWN"} · {bot.active ? "ACTIVE" : "PAUSED"}</p></div><div className="botControlPulse"><i/> HEARTBEAT<br/><b>{bot.heartbeat ? new Date(bot.heartbeat).toLocaleTimeString() : "—"}</b></div></div>
    <div className="botControlStats"><span><small>OPPORTUNITIES</small><b>{bot.opportunities || opportunities.length}</b></span><span><small>RESULTS</small><b>{scans.length}</b></span><span><small>EXECUTIONS</small><b>{executions.length}</b></span><span><small>PNL PAPER</small><b>{Number(bot.pnl24h || 0).toFixed(2)} USD</b></span></div>
    <div className="botControlTabs"><button className={tab==="results"?"active":""} onClick={() => setTab("results")}>RESULTS / SCANS</button><button className={tab==="opportunities"?"active":""} onClick={() => setTab("opportunities")}>OPPORTUNITIES</button>{bot.id === "polymarket" && !bot.marketBotId && <button className={tab==="live"?"active":""} onClick={() => setTab("live")}>LIVE PROPOSALS</button>}<button className={tab==="config"?"active":""} onClick={() => setTab("config")}>MANUAL PARAMETERS</button></div>
    {tab !== "config" && tab !== "live" && <div className="botControlToolbar"><span>{tab === "results" ? "Resultados propios del scanner" : "Señales emitidas al Opportunity Bus"}</span><button onClick={scan} disabled={busy === "scan"}><Radio size={14}/>{busy === "scan" ? "SCANNING…" : "RUN SCAN NOW"}</button></div>}
    {tab === "results" && <div className="botResultList">{scans.length ? scans.map((row,index) => <article className={`botResultRow ${row.error ? "hasError" : ""}`} key={row.scannedAt || row.createdAt || index}><div><b>{botLaunchLabel(row)}</b><small>{row.kpis ? `${row.kpis.candidates || 0} launches · ${row.kpis.qualified || 0} qualified` : row.scannedAt || row.at || row.createdAt || "—"}</small></div><strong>{row.error ? `ERROR · ${row.error}` : row.kpis ? `${row.kpis.qualified || 0} QUALIFIED · ${row.kpis.blocked || 0} BLOCKED` : row.triggered === true ? "TRIGGERED" : Array.isArray(row.discoveries) ? `${row.discoveries.length} discoveries` : row.netProfitUsd != null ? `${Number(row.netProfitUsd).toFixed(2)} USD net` : row.confidence != null ? `${Math.round(Number(row.confidence)*100)}% confidence` : "RESULT RECEIVED"}</strong><details><summary>DETAILS</summary><pre>{JSON.stringify(row,null,2)}</pre></details></article>) : <div className="botControlEmpty">No hay resultados de este bot todavía. Pulsa RUN SCAN NOW.</div>}</div>}
    {tab === "opportunities" && <div className="botResultList">{opportunities.length ? opportunities.map((row,index) => <article className="botResultRow" key={row.id || index}><div><b>{row.asset || row.strategy}</b><small>{row.createdAt || "—"} · {row.source || "Opportunity Bus"}</small></div><strong>{row.brain?.decision || "WATCH"} · {Number(row.expectedProfitUsd || 0).toFixed(2)} USD</strong><details><summary>DETAILS</summary><pre>{JSON.stringify(row,null,2)}</pre></details></article>) : <div className="botControlEmpty">Este bot todavía no ha emitido oportunidades.</div>}</div>}
    {tab === "live" && <div className="botLivePanel"><div className={`botLiveState ${connector?.enabled && connector?.authenticated ? "armed" : "locked"}`}><b>{connector?.enabled && connector?.authenticated ? "POLYMARKET LIVE READY" : "POLYMARKET LIVE LOCKED"}</b><small>{connector?.enabled ? connector.authenticated ? `Wallet ${shortAddress(connector.address)} autenticada · Polygon` : "Conecta MetaMask para autenticar el CLOB" : "Activa POLYMARKET_LIVE_ENABLED en el servidor y reinicia para habilitar órdenes."}</small></div>{proposals.length ? proposals.map(proposal => <article className="botProposal" key={proposal.id}><div><b>{proposal.question || proposal.marketId}</b><small>{proposal.side} · {proposal.size} USD · {proposal.status}</small></div><span>{proposal.price}</span>{proposal.status === "pending" && <div className="botProposalActions"><button onClick={() => resolveProposal(proposal.id,"approve")} disabled={busy === `approve:${proposal.id}`}>APPROVE</button><button onClick={() => resolveProposal(proposal.id,"reject")} disabled={busy === `reject:${proposal.id}`}>REJECT</button></div>}</article>) : <div className="botControlEmpty">No hay propuestas LIVE pendientes. Las señales elegibles aparecerán aquí antes de enviar una orden.</div>}</div>}
    {tab === "config" && <div className="botManualForm"><label className="botToggle"><input type="checkbox" checked={configValue.enabled} onChange={event => setConfigValue(current => ({...current,enabled:event.target.checked}))}/><span/> ENABLE STRATEGY</label><label>MAX ALLOCATION %<input type="number" min="0" max="50" step="0.5" value={configValue.maxAllocationPct} onChange={event => setConfigValue(current => ({...current,maxAllocationPct:event.target.value}))}/></label><label>MIN CONFIDENCE (0–1)<input type="number" min="0" max="1" step="0.01" placeholder="Global risk" value={configValue.minConfidence} onChange={event => setConfigValue(current => ({...current,minConfidence:event.target.value}))}/></label><label>OPERATOR NOTES<textarea value={configValue.notes} onChange={event => setConfigValue(current => ({...current,notes:event.target.value}))} placeholder="Describe the manual operating policy for this bot..."/></label><button className="botSaveButton" onClick={save} disabled={busy === "save"}><Settings size={15}/>{busy === "save" ? "SAVING…" : "SAVE PARAMETERS"}</button><div className="botLiveNotice">These controls affect strategy enablement, risk threshold and capital allocation. Market-specific credentials and LIVE signing remain separate safety gates.</div></div>}
    {message && <div className="botControlMessage">{message}</div>}
  </section></div>;
}

function botMeta(id) { const map={liquidation:{n:1,label:"LIQUIDATION HUNTER",accent:"#6db7ff",Icon:Target},arbitrage:{n:2,label:"DEX ARBITRAGE HUNTER",accent:"#59e2a4",Icon:RefreshCw},"solana-radar":{n:3,label:"SOLANA EARLY TOKEN RADAR",accent:"#bd8bff",Icon:Target},volatility:{n:4,label:"VOLATILITY HUNTER",accent:"#ff9a68",Icon:Activity},momentum:{n:5,label:"MOMENTUM / TREND AGENT",accent:"#f2ca63",Icon:TrendingUp},perpetuals:{n:6,label:"PERPETUALS & FUNDING HUNTER",accent:"#5fe4ef",Icon:Gauge},polymarket:{n:7,label:"POLYMARKET INTELLIGENCE",accent:"#b58cff",Icon:Target},"smart-money":{n:8,label:"WHALE & SMART-MONEY TRACKER",accent:"#ffad78",Icon:Activity},yield:{n:9,label:"DEFI YIELD / POOL OPPORTUNITY",accent:"#73e7a0",Icon:Database},allocator:{n:10,label:"META STRATEGY / CAPITAL ALLOCATOR",accent:"#f0d277",Icon:Zap},"solana-meme-momentum":{n:11,label:"SOLANA MEME MOMENTUM",accent:"#d09bff",Icon:Target},"polygon-meme-momentum":{n:12,label:"POLYGON MEME MOMENTUM",accent:"#ffad78",Icon:Activity},"fx-macro-momentum":{n:13,label:"FX MACRO MOMENTUM",accent:"#ff9a68",Icon:TrendingUp},"options-defined-risk":{n:14,label:"OPTIONS DEFINED RISK",accent:"#f2ca63",Icon:Gauge},"crude-oil-regime":{n:15,label:"CRUDE OIL REGIME",accent:"#5fe4ef",Icon:Activity},"nyse-news-impact":{n:16,label:"NYSE NEWS IMPACT",accent:"#b58cff",Icon:Target}};return map[id]||map.allocator; }

function FinanceBotConfiguration({bots, state, busyBot, onAction, onSelect}) {
  const order = ["liquidation", "arbitrage", "solana-radar", "volatility", "momentum", "perpetuals", "polymarket", "smart-money", "yield", "allocator", "solana-meme-momentum", "polygon-meme-momentum", "fx-macro-momentum", "options-defined-risk", "crude-oil-regime", "nyse-news-impact"];
  const fallback = id => ({id, name: id.replaceAll("-", " "), active: false, status: "NOT LOADED", network: "MULTI", wallet: "PAPER_SLOT"});
  return <section className="panel botConfigPanel"><PanelHead eyebrow="04 / BOT CONTROL" title="All ten core bots + six market bots. One control surface." action={`${order.length}/${order.length} VISIBLE · PAPER`}/><p className="botControlIntro">Los diez bots existentes se conservan. Los seis bots de mercado se añaden en la misma grilla, con el mismo control de resultados, parámetros y ejecución PAPER.</p><div className="botConfigGrid">{order.map(id => { const bot = bots.find(item => item.id === id) || fallback(id); const readiness = financeBotReadiness(id, state, bot); return <article className="botConfigCard" key={id}><button className="botConfigOpen" onClick={() => onSelect(id)}><div className="botConfigTop"><span className="botConfigIndex">{String(order.indexOf(id) + 1).padStart(2, "0")}</span><span className="botConfigIcon"><Bot size={17}/></span><div><b>{bot.name || id}</b><small>{bot.active ? bot.status : "PAUSED"}</small></div><i className={readiness.tone}/></div></button><div className="botConfigMeta"><span><small>NETWORK</small>{bot.network || "MULTI"}</span><span><small>WALLET</small>{bot.wallet || "PAPER_SLOT"}</span><span><small>HEARTBEAT</small>{bot.heartbeat ? new Date(bot.heartbeat).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) : "WAITING"}</span></div><div className="botConfigReadiness"><span className={readiness.tone}>{readiness.label}</span><button onClick={() => onSelect(id)}><Settings size={12}/> CONTROL</button></div><div className="botConfigActions"><button disabled={busyBot === id} onClick={() => onAction(id, "scan")}><Radio size={12}/> {busyBot === id ? "RUNNING" : "SCAN"}</button><button onClick={() => onAction(id, "toggle")}><Zap size={12}/> {bot.active ? "PAUSE" : "ACTIVATE"}</button></div></article> })}</div></section>;
}
function financeBotReadiness(id, state, bot) { if (!bot?.active) return {label: "PAUSED", tone: "needs"}; if (id === "allocator") return {label: "ACTIVE · PAPER", tone: "ready"}; const marketStatus=bot.marketBotId ? state?.infrastructure?.marketBots?.bots?.[bot.marketBotId]?.status : null; const status = String(marketStatus || bot.status || "STARTING"); if (["SCANNING", "SCANNING_REAL", "ALLOCATING", "READY"].includes(status)) return {label: `ACTIVE · ${status}`, tone: "ready"}; if (["BLOCKED","DEGRADED","SCAN_ERROR"].includes(status)) return {label: `ACTIVE · ${status}`, tone: "needs"}; return {label: `ACTIVE · ${status}`, tone: "needs"}; }

createRoot(document.getElementById("root")).render(<App/>);
