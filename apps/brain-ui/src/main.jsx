import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import {createPortal} from "react-dom";
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {io as connectSocket} from "socket.io-client";
import {
  Activity, ArrowUpRight, BarChart3, Bot, Brain, Briefcase, ChevronRight, CircleDollarSign,
  Database, ExternalLink, Gauge, Globe2, Layers3, Maximize2, Orbit, Radar, Radio, RefreshCw, Rocket,
  Image as ImageIcon, Mic2, MessageCircle, Music2, Plus, Settings, ShieldCheck, Sparkles, Target, TrendingUp, Video, Volume2, WalletCards, Zap,
  Landmark, Building2, Scale, FileCode, Coins, Package, Lock, Download, HelpCircle, AlertTriangle, CheckCircle2, XCircle,
  Users, FileText, ListChecks, Network
} from "lucide-react";
import "./style.css";
import "./control-overlay.css";
import "./ecosystem.css";
import "./responsive.css";

const ports = {finance: 8811, commerce: 8812, saas: 8813, media: 8814, services: 8815, institutional: 8821};
const runtimeApi = (local, production) => import.meta.env.DEV ? local : production;
const config = {
  finance: {name: "Finance Brain", kicker: "CAPITAL INTELLIGENCE", desc: "Execution, risk and liquidity intelligence in one high-signal cockpit.", accent: "#9c7bff", accent2: "#49d9ff", icon: CircleDollarSign, page: "finance", api: runtimeApi("http://localhost:8787", "/brain-api/finance"), metric: "PAPER EQUITY"},
  commerce: {name: "Commerce Brain", kicker: "REVENUE ORCHESTRATION", desc: "Find, test and compound the next distribution opportunity before the market notices.", accent: "#4ee8d2", accent2: "#63a7ff", icon: Rocket, page: "commerce", api: runtimeApi("http://localhost:8802", "/brain-api/commerce"), metric: "ACTIVE TESTS"},
  saas: {name: "SaaS Brain", kicker: "REVENUE INTELLIGENCE", desc: "Turn product telemetry into durable MRR, retention and portfolio clarity.", accent: "#ff77c8", accent2: "#a77dff", icon: Orbit, page: "saas", api: runtimeApi("http://localhost:8790", "/brain-api/saas"), metric: "PORTFOLIO MRR"},
  media: {name: "Media Brain", kicker: "CONTENT DISTRIBUTION", desc: "Convert signals into a living editorial system that ships, learns and compounds.", accent: "#ffb86b", accent2: "#ff6f9d", icon: Radar, page: "media", api: runtimeApi("http://localhost:8804", "/brain-api/media"), metric: "CONTENT QUEUE"},
  services: {name: "Services Brain", kicker: "SERVICE REVENUE SYSTEM", desc: "Vende, cotiza y entrega videos, páginas web, SEO y servicios digitales desde un solo cockpit.", accent: "#ff8b5b", accent2: "#25e8ff", icon: Briefcase, page: "services", api: runtimeApi("http://localhost:8808", "/brain-api/services"), metric: "ACTIVE SERVICES"},
  institutional: {name: "Institutional Brain", kicker: "INSTITUTIONAL DIGITAL ASSET STUDIO", desc: "Define una operacion financiera una sola vez y modelala, validala, simulala y tradúcela a EVM, Stellar y Canton.", accent: "#5ce1ff", accent2: "#ffb545", icon: Landmark, page: "institutional", api: runtimeApi("http://localhost:8820", "/brain-api/institutional"), metric: "SECURITY SCORE"}
};

const FINANCE_ECOSYSTEM_TOOLS = [
  {
    id: "tool-solana-launchpad",
    name: "SOLANA TOKEN LAUNCHPAD",
    shortName: "Token Launchpad",
    category: "TOKEN CREATION",
    network: "SOLANA",
    description: "Generador de tokens y centro de lanzamiento para crear, configurar y preparar nuevos activos en Solana.",
    url: "https://boostify-solana-launchpad-v4.netlify.app/",
    accent: "#8f7cff",
    Icon: Rocket,
    embeddable: true,
  },
  {
    id: "tool-telegram-suite",
    name: "TELEGRAM BOT SUITE",
    shortName: "Telegram Suite",
    category: "COMMUNITY MOMENTUM",
    network: "TELEGRAM",
    description: "Convierte señales de comunidad en campañas, automatización y momentum coordinado.",
    url: "https://telegram-bot-suite-v5.netlify.app/",
    accent: "#42b7ff",
    Icon: MessageCircle,
    embeddable: false,
    embedReason: "La plataforma protege sus páginas con SAMEORIGIN. El acceso completo se abre en una pestaña segura.",
  },
  {
    id: "tool-defi-social-club",
    name: "DEFI SOCIAL CLUB",
    shortName: "DeFi Social Club",
    category: "PRIVATE INTELLIGENCE",
    network: "MIAMI CIRCLE",
    description: "Círculo privado para inteligencia DeFi, relaciones estratégicas y oportunidades de comunidad.",
    url: "https://defi-social-club-v3.netlify.app/",
    accent: "#ffb768",
    Icon: Globe2,
    embeddable: true,
  },
  {
    id: "tool-community-forge",
    name: "COMMUNITYFORGE AI",
    shortName: "CommunityForge",
    category: "COMMUNITY SYSTEM",
    network: "MULTI-CHANNEL",
    description: "Sistema de construcción y activación de comunidades asistido por inteligencia artificial.",
    url: "https://communityforge-ai-v10.netlify.app/",
    accent: "#59e2b0",
    Icon: Layers3,
    embeddable: true,
  },
  {
    id: "tool-nexus-defi",
    name: "NEXUS DEFI SYSTEMS",
    shortName: "Nexus DeFi",
    category: "EDGE DISCOVERY",
    network: "MULTI-CHAIN",
    description: "Suite de sistemas que busca ventaja, desequilibrios y oportunidades antes de que cierren.",
    url: "https://nexus-defi-systems.netlify.app/",
    accent: "#ff7fb1",
    Icon: Zap,
    embeddable: true,
  },
  {
    id: "tool-solana-liquidity",
    name: "SOLANA LIQUIDITY INTELLIGENCE",
    shortName: "Liquidity Engine",
    category: "EXECUTION SAFETY",
    network: "SOLANA",
    description: "Construcción DEX-native, simulación RPC, compute-unit sizing y puertas de seguridad de ejecución.",
    url: "https://solana-liquidity-intelligence-v7.netlify.app/",
    accent: "#29e5c0",
    Icon: Database,
    embeddable: true,
  },
  {
    id: "tool-arb-scanner",
    name: "ARB SCANNER QUANTUM",
    shortName: "Arb Scanner",
    category: "CROSS-CHAIN EDGE",
    network: "CROSS-CHAIN",
    description: "Inteligencia de precios, riesgo de liquidación y cobertura de mercados Aave para encontrar el gap temprano.",
    url: "https://arb-scanner-quantum.netlify.app/",
    accent: "#63c9ff",
    Icon: Radar,
    embeddable: true,
  },
  {
    id: "tool-multichain-command",
    name: "MULTI-CHAIN COMMAND CENTER",
    shortName: "Command Center",
    category: "MARKET INTELLIGENCE",
    network: "MULTI-CHAIN",
    description: "Scanner, planner y consola de ejecución asistida por wallet con rutas multichain protegidas.",
    url: "https://dapper-pudding-aa123b.netlify.app/",
    accent: "#f3ca62",
    Icon: Gauge,
    embeddable: true,
  },
];

// The three chain adapters, rendered as floating "ecosystem" tool nodes just like Finance's
// external platforms — except these are internal render engines (code generation), not
// external iframes, so `internal: true` routes them to InstitutionalAdapterPanel instead.
const INSTITUTIONAL_ADAPTER_TOOLS = [
  {
    id: "adapter-evm", name: "EVM ADAPTER", shortName: "EVM / Solidity",
    category: "CHAIN ADAPTER", network: "ETHEREUM / POLYGON", adapterId: "evm",
    description: "Traduce la Financial Specification a un contrato Solidity para Ethereum / Polygon.",
    accent: "#9c7bff", Icon: FileCode, internal: true, embeddable: false,
  },
  {
    id: "adapter-stellar", name: "STELLAR ADAPTER", shortName: "Stellar / Soroban",
    category: "CHAIN ADAPTER", network: "STELLAR", adapterId: "stellar",
    description: "Traduce la Financial Specification a un contrato Soroban (Rust) para Stellar.",
    accent: "#28e6f6", Icon: Coins, internal: true, embeddable: false,
  },
  {
    id: "adapter-canton", name: "CANTON ADAPTER", shortName: "Canton / Daml",
    category: "CHAIN ADAPTER", network: "CANTON NETWORK", adapterId: "canton",
    description: "Traduce la Financial Specification a un template Daml para Canton Network.",
    accent: "#ffb545", Icon: Scale, internal: true, embeddable: false,
  },
];

// The Financial Brain Hub's 12 destinations — every one of the 35 master-spec sections lives
// under one of these. Each is a clickable orbit node; selecting one opens its drawer panel.
const FINANCIAL_BRAIN_DESTINATIONS = [
  {id: "financial-brain", name: "FINANCIAL BRAIN", category: "CORE", accent: "#5ce1ff", Icon: Brain, description: "Estado del deal, riesgos, requisitos faltantes y siguiente accion — respuestas deterministicas."},
  {id: "deal-builder", name: "DEAL BUILDER", category: "SPECIFICATION", accent: "#28e6f6", Icon: ListChecks, description: "Financial Specification Engine — define la operacion una sola vez."},
  {id: "roles-counterparties", name: "ROLES & COUNTERPARTIES", category: "PARTICIPANTS", accent: "#7c5cff", Icon: Users, description: "Institutional Role Mapper + Entity & Counterparty Intelligence (SIMULATED)."},
  {id: "investors", name: "INVESTORS", category: "PARTICIPANTS", accent: "#4ee8d2", Icon: WalletCards, description: "Roster de inversionistas simulados, KYC, lock-up y transferencias."},
  {id: "compliance-risk", name: "COMPLIANCE & RISK", category: "GOVERNANCE", accent: "#ff789b", Icon: ShieldCheck, description: "Compliance Readiness Score + Risk Engine de 9 categorias."},
  {id: "capital-stack", name: "CAPITAL STACK & CASH FLOW", category: "STRUCTURE", accent: "#ffb545", Icon: Layers3, description: "Tramos del capital stack y el waterfall de pagos."},
  {id: "contracts-security", name: "CONTRACTS & SECURITY", category: "TECHNOLOGY", accent: "#9c7bff", Icon: FileCode, description: "Arquitectura de contratos generada + Security Readiness Score."},
  {id: "simulation-lab", name: "SIMULATION LAB", category: "MODELING", accent: "#63c9ff", Icon: Activity, description: "Run 1 Month / 12 Months / Full Lifecycle / Stress Test + Digital Twin."},
  {id: "governance-treasury", name: "GOVERNANCE & TREASURY", category: "GOVERNANCE", accent: "#f2bd69", Icon: Scale, description: "Aprobaciones por etapa + simulador de tesoreria multisig."},
  {id: "deployment-monitoring", name: "DEPLOYMENT & MONITORING", category: "OPERATIONS", accent: "#59e2b0", Icon: Radar, description: "Testnet Deployment Center (simulado) + Monitoring Center."},
  {id: "reports-business", name: "REPORTS & BUSINESS", category: "REPORTING", accent: "#ff8b5b", Icon: FileText, description: "Executive Dashboard, Revenue Model y el Digital Transaction Package."},
  {id: "tenants", name: "TENANTS", category: "PLATFORM", accent: "#25e8ff", Icon: Network, description: "Multi-tenant registry — Manhattan es un tenant, no el sistema."}
];

const ecosystemNode = tool => ({
  ...tool,
  nodeType: "tool",
  active: true,
  enabled: true,
  status: "CONNECTED",
  pnl24h: 0,
});

const kind = import.meta.env.VITE_BRAIN_KIND || new URLSearchParams(location.search).get("brain") || "finance";
const current = config[kind] || config.finance;
function brainGreeting(brain = kind) {
  const label = ({finance: "Finance", commerce: "Commerce", saas: "SaaS", media: "Media", services: "Services", institutional: "Institutional"}[brain] || String(brain).replace(/\s*brain$/i, ""));
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
  institutional: {name: "INSTITUTIONAL BRAIN", tagline: "El sistema operativo de activos institucionales.", core: "/brains/finance-core.png", color: "#5ce1ff"},
};
const brainTheme = KIND_BRAIN[kind] || KIND_BRAIN.finance;
const brainBase = String(import.meta.env.BASE_URL || "/").endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
const brainAsset = asset => `${brainBase}${String(asset).replace(/^\/+/, "")}`;
const brainCoreUrl = brainAsset(brainTheme.core);
const API = import.meta.env.VITE_BRAIN_API_URL || current.api;
// Shared NEXUS session state, read/written from three otherwise-unrelated places (the hub tab
// teaser, the 3D agent chamber, and the overlay itself) without prop-drilling it through
// FinancialBrainHub → FinancialBrainInlinePanel → FinancialBrainDestinationPanel. This is the
// only Context in the file — everything else here follows the codebase's normal prop-passing
// convention — because those three consumers otherwise have no common ancestor closer than App.
const NexusContext = createContext(null);
const VOICE_API = import.meta.env.VITE_VOICE_API_URL || runtimeApi("http://localhost:8806", "/brain-api/ceo");
const chainLabel = value => { const raw=String(value||"").toLowerCase(); const id=raw.startsWith("0x")?Number.parseInt(raw,16):Number(raw); return ({1:"Ethereum",137:"Polygon",42161:"Arbitrum",8453:"Base"}[id]||`Chain ${raw}`); };
const shortAddress = value => value ? `${value.slice(0,6)}…${value.slice(-4)}` : "";
const getOperatorToken=()=>{let token=sessionStorage.getItem("aegis_operator_token")||"";if(!token){token=window.prompt("AEGIS Operator Token (solo se conserva durante esta sesión):")?.trim()||"";if(token)sessionStorage.setItem("aegis_operator_token",token);}if(!token)throw new Error("Se requiere AEGIS_OPERATOR_TOKEN para operar en REAL.");return token;};
const SOLANA_MAINNET_SCOPE="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const METAMASK_SCOPES=["eip155:1","eip155:137","eip155:42161","eip155:8453",SOLANA_MAINNET_SCOPE];
const METAMASK_NETWORKS={"eip155:1":"https://ethereum-rpc.publicnode.com","eip155:137":"https://polygon-bor-rpc.publicnode.com","eip155:42161":"https://arbitrum-one-rpc.publicnode.com","eip155:8453":"https://base-rpc.publicnode.com",[SOLANA_MAINNET_SCOPE]:"https://api.mainnet-beta.solana.com"};
let multichainClientPromise=null;
const caipAddress=value=>String(value||"").split(":").slice(2).join(":");
async function getMultichainClient(){
  if(!multichainClientPromise)multichainClientPromise=import("@metamask/connect-multichain").then(({createMultichainClient})=>createMultichainClient({dapp:{name:"AEGIS Finance Brain",url:window.location.href},api:{supportedNetworks:METAMASK_NETWORKS},ui:{preferExtension:true}}));
  return multichainClientPromise;
}
async function connectMultichain(scopes=METAMASK_SCOPES){
  const client=await getMultichainClient();let session=await client.provider.getSession().catch(()=>null);const missing=scopes.filter(scope=>!session?.sessionScopes?.[scope]?.accounts?.length);
  if(!session||missing.length){await client.connect(scopes,[],undefined,Boolean(session));session=await client.provider.getSession();}
  return Object.fromEntries(Object.entries(session?.sessionScopes||{}).map(([scope,value])=>[scope,caipAddress(value?.accounts?.[0])]));
}

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
  const [selectedBotId, setSelectedBotId] = useState(() => new URLSearchParams(window.location.search).get("bot"));
  const [streamConnected, setStreamConnected] = useState(false);
  const [brainSpeaking, setBrainSpeaking] = useState(false);
  const [voiceAgentReply, setVoiceAgentReply] = useState("");
  const [voiceAgentBusy, setVoiceAgentBusy] = useState(false);
  const conversationRef = useRef([]);
  const [wallet, setWallet] = useState({address:"", chainId:"", chainName:""});
  const [walletSessions,setWalletSessions]=useState({});
  const [executionControl,setExecutionControl]=useState(null);
  const [executionBusy,setExecutionBusy]=useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState(null);
  const [institutionalDealId, setInstitutionalDealId] = useState(null);
  const [nexusSessionOpen, setNexusSessionOpen] = useState(false);
  const [nexusInitialAgentFilter, setNexusInitialAgentFilter] = useState(null);
  const [nexusLive, setNexusLive] = useState(null);
  const nexusContextValue = useMemo(() => ({
    open: nexusSessionOpen,
    openSession: agentId => { setNexusInitialAgentFilter(agentId || null); setNexusSessionOpen(true); },
    closeSession: () => setNexusSessionOpen(false),
    live: nexusLive,
    setLive: setNexusLive
  }), [nexusSessionOpen, nexusLive]);
  const Icon = current.icon;

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const h = await get("/health");
      let s, events;
      if (kind === "finance") {
        s = await get("/api/state");
        events = [...(s.opportunities || []), ...(s.executions || [])];
        setExecutionControl(await get("/api/execution/control").catch(()=>null));
      } else if (kind === "institutional") {
        // Institutional Brain has no /api/summary or /api/events — its state lives in the
        // Deal Builder (InstitutionalControlPanel), not the generic bots/events model.
        s = h; events = [];
      } else {
        [s, events] = await Promise.all([get("/api/summary"), get("/api/events")]);
      }
      setHealth(h); setSummary(s); setFeed(events || s.latestEvents || []);
      const endpoint = kind === "saas" ? "/api/revenue/summary" : kind === "finance" ? "/api/state" : "/api/kpis";
      const extra = await get(endpoint).catch(() => ({}));
      const lab = kind === "finance" ? await get("/api/liquidation/lab").catch(() => null) : null;
      const central = kind === "finance" ? await get("/api/central-agent/status").catch(() => null) : null;
      const liveContext = kind === "finance" ? await get("/api/agent/context").catch(() => null) : null;
      setKpis(kind === "finance" ? {opportunities: extra.opportunities?.length || 0, executions: extra.executions?.length || 0, balance: h.paperEquityUsd ?? extra.infrastructure?.dataQuality?.validatedPaper?.equityUsd ?? 0, health: 96, lab} : kind === "saas" ? extra : extra);
      setCentralAgent(central ? {...central, liveContext} : liveContext);
      setUpdated(new Date());
      return true;
    } catch (e) { setError(`No se pudo enlazar con ${current.name}. Verifica que el servicio esté activo en ${API}.`); return false; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [refresh]);

  useEffect(()=>{
    const url=new URL(window.location.href);if(selectedBotId)url.searchParams.set("bot",selectedBotId);else url.searchParams.delete("bot");window.history.replaceState({},"",url);
    if(kind==="finance"&&selectedBotId){const timer=setTimeout(()=>document.querySelector(".brain3dPanel")?.scrollIntoView({behavior:"smooth",block:"start"}),60);return()=>clearTimeout(timer);}
    return undefined;
  },[selectedBotId]);

  useEffect(() => {
    if (kind !== "finance") return undefined;
    const external=/^https?:\/\//i.test(API),origin=external?API:window.location.origin,path=external?"/socket.io":`${API.replace(/\/$/,"")}/socket.io`;
    const socket=connectSocket(origin,{path,transports:["websocket","polling"],reconnection:true,reconnectionDelay:1000,reconnectionDelayMax:5000});
    socket.on("connect",()=>setStreamConnected(true));
    socket.on("disconnect",()=>setStreamConnected(false));
    socket.on("state",live=>{setSummary(live);setUpdated(new Date());setFeed([...(live?.opportunities||[]),...(live?.executions||[])]);});
    socket.on("opportunity",row=>setFeed(currentFeed=>[row,...currentFeed.filter(item=>item.id!==row?.id)].slice(0,100)));
    socket.on("heartbeat",row=>setSummary(currentState=>currentState?{...currentState,bots:(currentState.bots||[]).map(bot=>bot.id===row?.id?{...bot,heartbeat:row.heartbeat,status:row.status}:bot)}:currentState));
    return()=>{socket.disconnect();setStreamConnected(false);};
  },[]);

  useEffect(() => {
    if (!window.ethereum) return undefined;
    const onAccounts = accounts => setWallet(current => ({...current, address: accounts?.[0] || ""}));
    const onChain = chainId => setWallet(current => ({...current, chainId, chainName: chainLabel(chainId)}));
    window.ethereum.on?.("accountsChanged", onAccounts); window.ethereum.on?.("chainChanged", onChain);
    return () => { window.ethereum.removeListener?.("accountsChanged", onAccounts); window.ethereum.removeListener?.("chainChanged", onChain); };
  }, []);

  const agentList = kind === "finance" ? (summary?.bots || []) : (summary?.agents || health?.agentsTotal ? (summary?.agents || Array.from({length: health?.agentsTotal || 10}, (_, i) => ({id: i + 1, name: `Agent ${String(i + 1).padStart(2, "0")}`, enabled: true}))) : []);
  const financeBots = summary?.bots || [];
  const financeTelemetry = useMemo(() => {
    const readiness = new Map((summary?.infrastructure?.readiness?.bots || []).map(row => [row.id, row]));
    const promotion = new Map((summary?.infrastructure?.performance?.promotion?.strategies || []).map(row => [row.strategyId, row]));
    return financeBots.map(bot => ({...bot, readiness:readiness.get(bot.id) || null, promotion:promotion.get(bot.id) || null, uiBusy:busyBot===bot.id, globalKillSwitch:Boolean(summary?.risk?.globalKillSwitch)}));
  }, [financeBots, summary?.infrastructure?.readiness, summary?.infrastructure?.performance?.promotion, summary?.risk?.globalKillSwitch, busyBot]);
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
  async function connectMetaMask(scopes=METAMASK_SCOPES) {
    setWalletBusy(true); setError("");
    try {
      const sessions=await connectMultichain(scopes);setWalletSessions(current=>({...current,...sessions}));
      const address=sessions["eip155:1"]||sessions["eip155:137"]||sessions["eip155:42161"]||"";const solanaAddress=sessions[SOLANA_MAINNET_SCOPE]||"";
      const chainId=window.ethereum?await window.ethereum.request({method:"eth_chainId"}).catch(()=>""):"";
      setWallet({address:address||solanaAddress,chainId,chainName:solanaAddress?"EVM + Solana":chainId?chainLabel(chainId):"Multichain"});
      const polymarket = await get("/api/integrations/polymarket/status").catch(() => null);
      if (kind === "finance" && polymarket?.enabled && address) {
        await request("/api/integrations/polymarket/wallet/connect", {method:"POST", body:JSON.stringify({address})});
        await signPendingMetaMask(address);
        setError("");
      }
      return sessions;
    } catch (e) { setError(`MetaMask: ${e.message}`); }
    finally { setWalletBusy(false); }
  }
  async function walletForBot(botControl){
    const route=botControl?.route;if(route?.wallet!=="METAMASK")return null;const scopes=route.scope?[route.scope]:METAMASK_SCOPES;const sessions=await connectMetaMask(scopes);if(!sessions)throw new Error("No se pudo crear la sesión MetaMask.");
    if(route.ecosystem==="EVM"&&route.chainId&&window.ethereum){const hex=`0x${Number(route.chainId).toString(16)}`;await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:hex}]}).catch(error=>{throw new Error(error.code===4902?`Agrega ${route.chain} a MetaMask antes de continuar.`:error.message);});}
    const scope=route.scope||Object.keys(sessions).find(key=>key.startsWith("eip155:"));const address=sessions[scope]||walletSessions[scope];if(!address)throw new Error(`MetaMask no autorizó una cuenta para ${route.chain}.`);return{address,scope,ecosystem:route.ecosystem};
  }
  async function setBotExecutionMode(botId,nextMode){
    const control=executionControl?.bots?.[botId]||await get("/api/execution/control").then(value=>value.bots?.[botId]);if(!control)throw new Error("Control de ejecución no disponible.");
    if(nextMode==="REAL"&&!window.confirm(`Activar REAL para ${botMeta(botId).label}. DEX pedirá firma en MetaMask y CEX usará únicamente credenciales del servidor. ¿Continuar?`))return null;
    const token=nextMode==="REAL"?getOperatorToken():"",publicWallet=nextMode==="REAL"?await walletForBot(control):null;const result=await request(`/api/execution/bots/${botId}`,{method:"PATCH",headers:{"content-type":"application/json",...(token?{"x-aegis-operator-token":token}:{})},body:JSON.stringify({mode:nextMode,confirmReal:nextMode==="REAL",...(publicWallet?{wallet:publicWallet}:{})})});await refresh();return result;
  }
  async function setGlobalExecutionMode(){
    if(executionBusy)return;const next=executionControl?.globalMode==="PAPER"?"REAL":"PAPER";if(next==="REAL"&&!window.confirm("Activar REAL para los 16 bots. Los DEX seguirán exigiendo firma visible en MetaMask y los conectores sin credenciales quedarán armados con bloqueos. ¿Continuar?"))return;
    setExecutionBusy(true);setError("");try{const token=next==="REAL"?getOperatorToken():"";let wallets={};if(next==="REAL"){const sessions=await connectMetaMask();for(const [id,control] of Object.entries(executionControl?.bots||{})){if(control.route?.wallet!=="METAMASK")continue;const scope=control.route.scope||Object.keys(sessions).find(key=>key.startsWith("eip155:"));if(scope&&sessions[scope])wallets[id]={address:sessions[scope],scope,ecosystem:control.route.ecosystem};}}
      const result=await request("/api/execution/global-mode",{method:"POST",headers:{"content-type":"application/json",...(token?{"x-aegis-operator-token":token}:{})},body:JSON.stringify({mode:next,confirmReal:next==="REAL",wallets})});setExecutionControl(result);await refresh();
    }catch(error){setError(`Execution control: ${error.message}`);}finally{setExecutionBusy(false);}
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
    if (kind === "institutional") return Number(health?.dealTypes || 0).toString().padStart(2, "0");
    return Number(kpis.queued || 0).toString().padStart(2, "0");
  }, [kpis]);

  return <NexusContext.Provider value={nexusContextValue}><div className="app" style={{"--accent": current.accent, "--accent2": current.accent2}}>
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
      <header className="topbar"><div className="crumb"><span>AEGIS /</span> {current.name.toUpperCase()}</div><div className="topActions">{kind==="finance"?<button className={`globalModeSwitch ${String(executionControl?.globalMode||"PAPER").toLowerCase()}`} onClick={setGlobalExecutionMode} disabled={executionBusy}><i/>{executionBusy?"UPDATING…":`${executionControl?.globalMode||"PAPER"} · GLOBAL`}</button>:<span className="mode"><i/> PAPER MODE</span>}{kind==="finance"&&<span className={`streamBadge ${streamConnected?"connected":"fallback"}`}><i/>{streamConnected?"LIVE STREAM":"POLL BACKUP"}</span>}<span className="updated">{updated ? `SYNC ${updated.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}` : "SYNCING"}</span>{kind === "finance" && <button className="walletButton" onClick={()=>connectMetaMask()} disabled={walletBusy}><WalletCards size={14}/>{wallet.address ? `${shortAddress(wallet.address)} · ${wallet.chainName}` : walletBusy ? "CONNECTING…" : "CONNECT METAMASK"}</button>}<button className="refresh" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div></header>

      <section className="hero"><div className="heroCopy"><div className="eyebrow"><span/><b>{current.kicker}</b><em>/{kind.toUpperCase()}</em></div><h1>{current.name}<br/><span>thinks in signals.</span></h1><p>{current.desc}</p><div className="heroButtons"><button className="primary" onClick={refresh}><Radio size={16}/> Sync intelligence <ArrowUpRight size={14}/></button><a href="/" className="ghost">Master Command <ChevronRight size={15}/></a></div></div><div className="heroOrb"><div className="orbit o1"/><div className="orbit o2"/><div className="orbit o3"/><div className="core"><Icon size={35}/></div><span className="orbLabel">{status}<small>CORE STATUS</small></span></div></section>

      {error && <div className="errorBar"><span>!</span>{error}<button onClick={refresh}>Retry</button></div>}

      <section className="stats"><Stat icon={Gauge} label="CORE STATUS" value={status} sub={`${agentsOnline}/${agentsTotal} agents online`} live={status === "ONLINE"}/><Stat icon={current.icon} label={current.metric} value={metric} sub={kind === "saas" ? `${kpis.growthRate || 0}% growth velocity` : kind === "finance" ? "capital in paper mode" : "updated from live API"}/><Stat icon={Bot} label="AGENT THROUGHPUT" value={processed} sub="events processed"/><Stat icon={ShieldCheck} label="RISK POSTURE" value={riskPosture} sub={riskSub}/>)</section>

      <section className="contentGrid"><div className="panel signalPanel"><PanelHead eyebrow="01 / SIGNAL FIELD" title="The system is watching." action="LIVE FEED"/><div className="signalChart"><div className="chartGrid"/>{Array.from({length: 36}, (_, i) => <i key={i} style={{height: `${18 + ((i * 17 + (i % 5) * 13) % 65)}%`, animationDelay: `${i * 0.04}s`}}/>)}<div className="chartLine"/></div><div className="chartFoot"><span><i className="legend purple"/> Signal density</span><span><i className="legend mint"/> Opportunity flow</span><b>{loading ? "SCANNING" : "NOMINAL"}</b></div></div><div className="panel pulsePanel"><PanelHead eyebrow="02 / VITALS" title="Pulse"/><div className="pulseList"><Pulse label="Availability" value={status === "ONLINE" ? "99.9%" : "0%"} color="mint"/><Pulse label="Agents online" value={`${health?.agentsOnline || 0}/${health?.agentsTotal || 0}`} color="purple"/><Pulse label="Event velocity" value={`${Math.max(1, feed.length * 3)}/m`} color="orange"/><Pulse label="Mode" value="PAPER" color="pink"/>{kind === "finance" && <><Pulse label="Paper readiness" value={`${health?.readiness?.score || 0}/100`} color="mint"/><Pulse label="Liquidation Lab" value={`${kpis.lab?.lab?.candidates || 0} candidates`} color="orange"/></>}</div><div className="pulseFoot"><Globe2 size={14}/> {kind === "finance" ? `${health?.readiness?.label || "VALIDATING"} · real-quote evidence gate` : "Local intelligence mesh"} <span>●</span></div></div></section>

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
      {kind === "institutional" && <FinancialBrainHub api={API} dealId={institutionalDealId} onDealCreated={setInstitutionalDealId} speaking={brainSpeaking}/>}
      {kind === "institutional" && <NexusAgentOrbit api={API} dealId={institutionalDealId}/>}
      {kind === "institutional" && <InstitutionalEcosystemPanel tools={INSTITUTIONAL_ADAPTER_TOOLS} api={API} dealId={institutionalDealId} onOpen={setSelectedToolId}/>}

      {kind === "finance" && <CentralFinanceBrainPanel data={centralAgent} busy={centralBusy} onRun={runCentralAgent} mediaApi="http://localhost:8804" onSpeakingChange={setBrainSpeaking}/>} 
      {kind === "finance" && <FinanceBrainOrbit bots={financeTelemetry} tools={FINANCE_ECOSYSTEM_TOOLS} central={centralAgent} speaking={brainSpeaking} streamConnected={streamConnected} selectedBotId={selectedBotId} onSelect={setSelectedBotId} onOpenTool={setSelectedToolId}/>}
      {kind === "finance" && <FinanceBotConfiguration bots={summary?.bots || []} state={summary} busyBot={busyBot} onAction={financeAction} onSelect={setSelectedBotId}/>} 
      {kind === "finance" && <FinanceEcosystemPanel tools={FINANCE_ECOSYSTEM_TOOLS} onOpen={setSelectedToolId}/>}
      {kind === "finance" && <FinanceIntegrationsPanel api={API}/>} 

      <section className="lowerGrid"><div className="panel activityPanel"><PanelHead eyebrow="04 / ACTIVITY" title="Recent intelligence" action="AUTO-SYNC"/><div className="activityList">{feed.slice(0, 6).map((item, i) => <div className="activityRow" key={item.id || i}><span className="activityIcon"><Sparkles size={14}/></span><div><b>{item.type || item.strategy || item.title || "Signal received"}</b><small>{item.payload?.asset || item.asset || item.name || item.source || "Inter-brain protocol"}</small></div><time>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) : `0${i + 1}:2${i}`}</time><ArrowUpRight size={14}/></div>)}{!feed.length && <Empty text="Waiting for the first signal…"/>}</div></div><div className="panel commandPanel"><PanelHead eyebrow="05 / COMMAND LAYER" title="Make the next move."/><div className="commandCard"><div className="commandIcon"><Target size={21}/></div><div><b>Run a clean intelligence sync</b><p>Pull current health, events and opportunity data from this Brain.</p></div><button onClick={refresh}><ArrowUpRight size={16}/></button></div><div className="commandCard mutedCard"><div className="commandIcon"><Database size={21}/></div><div><b>Open system state</b><p>Inspect the raw state without leaving the command surface.</p></div><a href={`${API}${kind === "finance" ? "/api/state" : "/api/summary"}`} target="_blank" rel="noreferrer"><ChevronRight size={17}/></a></div></div></section>

      <footer><span><i className="onlineDot"/> AEGIS INTER-BRAIN PROTOCOL · {current.name}</span><span>SAFE BY DEFAULT <ShieldCheck size={13}/></span></footer>
    </main>
    {kind === "finance" && selectedBotId && <BotControlErrorBoundary onClose={() => setSelectedBotId(null)}><BotControlModal api={API} bot={financeTelemetry.find(item => item.id === selectedBotId) || {id:selectedBotId,name:selectedBotId,active:false,status:"UNKNOWN"}} onClose={() => setSelectedBotId(null)} onScan={id => financeAction(id, "scan")} onToggle={id => financeAction(id, "toggle")} onSetExecutionMode={setBotExecutionMode}/></BotControlErrorBoundary>}
    {kind === "finance" && selectedToolId && <FinanceToolEmbed tool={FINANCE_ECOSYSTEM_TOOLS.find(item => item.id === selectedToolId)} onClose={() => setSelectedToolId(null)}/>}
    {kind === "commerce" && selectedBotId && <BotControlErrorBoundary onClose={() => setSelectedBotId(null)}><CommerceModuleControlModal api={API} moduleId={selectedBotId} onClose={() => setSelectedBotId(null)}/></BotControlErrorBoundary>}
    {kind === "institutional" && selectedToolId && <InstitutionalAdapterPanel tool={INSTITUTIONAL_ADAPTER_TOOLS.find(item => item.id === selectedToolId)} api={API} dealId={institutionalDealId} onClose={() => setSelectedToolId(null)}/>}
    {kind === "institutional" && nexusSessionOpen && <NexusSessionOverlay api={API} dealId={institutionalDealId} initialAgentFilter={nexusInitialAgentFilter} onLiveUpdate={setNexusLive} onClose={() => setNexusSessionOpen(false)}/>}
  </div></NexusContext.Provider>
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
const COMMERCE_MODULE_META = {
  "product-scout": {n: 1, label: "AMAZON PRODUCT SCOUT", accent: "#4ee8d2", Icon: Target},
  "dropship-hunter": {n: 2, label: "DROPSHIPPING HUNTER", accent: "#63a7ff", Icon: Globe2},
  "digital-builder": {n: 3, label: "DIGITAL PRODUCT BUILDER", accent: "#b58cff", Icon: Layers3},
  "offer-pricing": {n: 4, label: "OFFER & PRICING ENGINE", accent: "#f2ca63", Icon: Gauge},
  "creative-factory": {n: 5, label: "CONTENT & CREATIVE FACTORY", accent: "#ff8bc6", Icon: ImageIcon},
  "store-manager": {n: 6, label: "STORE & MARKETPLACE MANAGER", accent: "#59e2a4", Icon: Database},
  "traffic": {n: 7, label: "TRAFFIC ACQUISITION AGENT", accent: "#ff9a68", Icon: Radio},
  "closer": {n: 8, label: "SALES CLOSER / CRM", accent: "#6db7ff", Icon: MessageCircle},
  "retention": {n: 9, label: "RETENTION & UPSELL AGENT", accent: "#73e7a0", Icon: RefreshCw},
  "allocator": {n: 10, label: "REVENUE ALLOCATOR", accent: "#f0d277", Icon: WalletCards}
};
function commerceModuleMeta(id) { return COMMERCE_MODULE_META[id] || {n: 0, label: String(id || "MODULE").toUpperCase(), accent: "#4ee8d2", Icon: Bot}; }
const COMMERCE_STAGE_ORDER = ["OBSERVE", "DRAFT", "APPROVAL", "LIVE"];

function CommerceStageStepper({actionStage, readinessState, onAdvance, busy}) {
  const currentIndex = Math.max(0, COMMERCE_STAGE_ORDER.indexOf(actionStage));
  return <div className="commerceStageStepper">
    {COMMERCE_STAGE_ORDER.map((stage, index) => {
      const done = index < currentIndex, active = index === currentIndex, nextAllowed = index === currentIndex + 1;
      return <button key={stage} className={done ? "done" : active ? "active" : "pending"} disabled={!nextAllowed || busy} onClick={() => nextAllowed && onAdvance(stage)} title={nextAllowed ? `Avanzar a ${stage}` : stage}><i>{done ? "✓" : index + 1}</i><b>{stage}</b></button>;
    })}
    <small className="commerceStageReadiness">{String(readinessState || "LOADING").replaceAll("_", " ")}</small>
  </div>;
}

function CommerceCopilotThinkingOverlay({meta, question}) {
  const phases = [
    {label: "Conectando el modelo de razonamiento", detail: "OpenAI · fallback determinista si no hay crédito"},
    {label: "Leyendo readiness real del módulo", detail: "Bloqueos, conectores y última corrida"},
    {label: "Revisando evidencia reciente", detail: "Runs, candidatos y artefactos generados"},
    {label: "Contrastando política activa", detail: "Parámetros y permisos por etapa"},
    {label: "Construyendo respuesta auditable", detail: "Hallazgos y recomendaciones, sin inventar datos"}
  ];
  const [phase, setPhase] = useState(0), [elapsed, setElapsed] = useState(0);
  useEffect(() => { setPhase(0); setElapsed(0); const phaseTimer = setInterval(() => setPhase(current => Math.min(phases.length - 1, current + 1)), 2400), clock = setInterval(() => setElapsed(current => current + 1), 1000); return () => { clearInterval(phaseTimer); clearInterval(clock); }; }, [question]);
  return <div className="copilotThinkingBackdrop" role="dialog" aria-modal="true" aria-live="polite" aria-label={`Copilot analizando ${meta.label}`}><section className="copilotThinkingWindow" style={{"--botAccent": meta.accent}}><div className="copilotThinkingTop"><span><i/> MODULE COPILOT · LIVE ANALYSIS</span><small>{String(elapsed).padStart(2, "0")}s · PAPER SAFE</small></div><div className="copilotThinkingLayout"><div className="copilotNeuralStage"><div className="copilotAmbientGrid"/><div className="copilotOrbit orbitA"><i/><i/><i/></div><div className="copilotOrbit orbitB"><i/><i/></div><div className="copilotBrainCore"><span className="copilotBrainHalo"/><img src={brainCoreUrl} alt="Commerce Brain analizando"/><meta.Icon size={44}/><b>{meta.label}</b><small>CONTEXT LOCKED</small></div></div><div className="copilotThinkingReport"><div className="copilotThinkingIdentity"><Sparkles size={18}/><div><small>ANALIZANDO TU PREGUNTA</small><p>{question || "Preparando contexto del módulo…"}</p></div></div><div className="copilotPhaseList">{phases.map((item, index) => <article className={index < phase ? "done" : index === phase ? "active" : "waiting"} key={item.label}><span>{index < phase ? "✓" : String(index + 1).padStart(2, "0")}</span><div><b>{item.label}</b><small>{item.detail}</small></div>{index === phase && <em><i/><i/><i/></em>}</article>)}</div><div className="copilotThinkingFooter"><Activity size={14}/><span>Solo lee datos reales de este módulo. No se aplicará ningún cambio sin tu aprobación.</span></div></div></div></section></div>;
}

function CommerceCandidatesPanel({moduleId, bot}) {
  const result = bot?.lastResult || {};
  if (["product-scout", "dropship-hunter"].includes(moduleId)) {
    const ranked = result.ranked || [];
    return <div className="botControlBody"><div className="botResultList modern">{ranked.length ? ranked.map(item => <article className="botDecisionCard" key={item.id}><div><span className={`decisionBadge ${String(item.tier || "review").toLowerCase()}`}>{item.tier || "REVIEW"}</span><b>{item.name}</b><small>score {item.score ?? "—"}</small></div><div className="botDecisionNumbers"><span><small>MARGIN</small><b>{item.economics?.marginPct != null ? `${item.economics.marginPct}%` : "—"}</b></span><span><small>CONTRIBUTION</small><b>{money(item.economics?.contribution)}</b></span></div>{item.risks?.length > 0 && <p>{item.risks.join(" · ")}</p>}</article>) : <div className="botControlEmpty">Ejecuta una corrida para poblar la matriz de productos.</div>}</div></div>;
  }
  if (moduleId === "digital-builder") {
    const opportunity = result.opportunity;
    return <div className="botControlBody">{opportunity ? <article className="botDecisionCard"><div><b>{opportunity.name}</b><small>{opportunity.problem}</small></div><div className="botDecisionNumbers"><span><small>PRICE</small><b>${opportunity.price}</b></span><span><small>MARGIN</small><b>{opportunity.economics?.marginPct}%</b></span><span><small>VALIDATION</small><b>{opportunity.validation?.status}</b></span></div><p>{opportunity.validation?.nextTest}</p></article> : <div className="botControlEmpty">Sin oportunidades generadas todavía.</div>}</div>;
  }
  if (moduleId === "closer") {
    const queue = result.queue || [];
    return <div className="botControlBody"><div className="botResultList modern">{queue.length ? queue.map(lead => <article className="botDecisionCard" key={lead.id}><div><span className={`decisionBadge ${lead.priority === "HOT" ? "buy" : "watch"}`}>{lead.priority}</span><b>{lead.email}</b><small>{lead.source}</small></div><div className="botDecisionNumbers"><span><small>SCORE</small><b>{lead.score}</b></span></div><p>{lead.nextAction}</p></article>) : <div className="botControlEmpty">CRM vacío — captura leads vía POST /api/leads.</div>}</div></div>;
  }
  if (moduleId === "retention") {
    const queue = result.queue || [];
    return <div className="botControlBody"><div className="botResultList modern">{queue.length ? queue.map(row => <article className="botDecisionCard" key={row.customerId}><div><b>{row.customerId}</b><small>{row.orderCount} pedidos</small></div><p>{row.action}</p></article>) : <div className="botControlEmpty">Sin cohortes todavía — necesitas pedidos verificados.</div>}</div></div>;
  }
  if (moduleId === "allocator") {
    const allocations = result.allocations || [];
    return <div className="botControlBody"><div className="botResultList modern">{allocations.length ? allocations.map(row => <article className="botDecisionCard" key={row.productId}><div><b>{row.name}</b><small>{row.rationale}</small></div><div className="botDecisionNumbers"><span><small>BUDGET</small><b>${row.recommendedBudget}</b></span><span><small>MAX CAC</small><b>${row.maxCac}</b></span></div></article>) : <div className="botControlEmpty">Sin productos TEST_READY para asignar presupuesto.</div>}</div></div>;
  }
  return <div className="botControlBody"><div className="botControlEmpty">Este módulo no produce una lista de candidatos — revisa la pestaña OUTPUTS.</div></div>;
}

function CommerceOutputsPanel({moduleId, bot, readiness}) {
  const result = bot?.lastResult || {};
  if (moduleId === "offer-pricing") {
    const sensitivity = result.pricing?.sensitivity || [];
    return <div className="botControlBody"><div className="botResultList modern">{sensitivity.length ? sensitivity.map(row => <article className="botDecisionCard" key={row.discountPct}><div><b>{row.discountPct}% descuento</b><small>precio ${row.price}</small></div><div className="botDecisionNumbers"><span><small>CONTRIBUTION</small><b>${row.contribution}</b></span><span><small>MARGIN</small><b>{row.marginPct}%</b></span></div></article>) : <div className="botControlEmpty">Ejecuta una corrida sobre un producto para ver la curva de margen.</div>}</div></div>;
  }
  if (moduleId === "creative-factory") {
    return <div className="botControlBody">{result.landingId ? <article className="botDecisionCard"><div><b>Landing draft · {result.assetStatus}</b><small>{(result.channels || []).join(" · ")}</small></div><p>Disclosure requerido: {result.disclosureRequired ? "sí" : "no"}</p></article> : <div className="botControlEmpty">Sin creatividades generadas todavía.</div>}</div>;
  }
  if (moduleId === "store-manager") {
    const draft = result.draft;
    return <div className="botControlBody">{draft ? <article className="botDecisionCard"><div><b>{draft.product?.title}</b><small>{draft.status}</small></div><div className="botDecisionNumbers"><span><small>PRICE</small><b>${draft.product?.price}</b></span><span><small>SHOPIFY</small><b>{draft.connector?.configured ? "CONFIGURED" : "NOT CONFIGURED"}</b></span></div><p>{result.publishAllowed ? "Publicación habilitada." : "Publicación bloqueada — draft only."}</p></article> : <div className="botControlEmpty">Sin drafts de tienda todavía.</div>}</div>;
  }
  if (moduleId === "traffic") {
    const campaign = result.campaign;
    return <div className="botControlBody">{campaign ? <article className="botDecisionCard"><div><b>{campaign.message}</b><small>{campaign.status}</small></div><div className="botDecisionNumbers"><span><small>DAILY BUDGET</small><b>${campaign.dailyBudget}</b></span><span><small>MAX CAC</small><b>${campaign.maxCac}</b></span></div>{campaign.blockers?.length > 0 && <p>{campaign.blockers.join(" · ")}</p>}</article> : <div className="botControlEmpty">Sin campañas generadas todavía.</div>}</div>;
  }
  if (moduleId === "allocator") {
    return <div className="botControlBody"><div className="botControlStats botControlEdgeStats"><span><small>BUDGET</small><b>${result.budget || 0}</b></span><span><small>TOTAL ALLOCATED</small><b>${result.totalAllocated || 0}</b></span><span><small>SPEND ALLOWED</small><b>{result.spendAllowed ? "YES" : "NO"}</b></span></div></div>;
  }
  return <div className="botControlBody"><div className="botControlEmpty">La salida de este módulo se muestra en CANDIDATES · evidencia real: {JSON.stringify(readiness?.evidence || {})}</div></div>;
}

function CommerceModuleControlModal({api, moduleId, onClose}) {
  const base = api.replace(/\/$/, "");
  const meta = commerceModuleMeta(moduleId);
  const [tab, setTab] = useState("cockpit");
  const [debugOpen, setDebugOpen] = useState(false);
  const [bot, setBot] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [runs, setRuns] = useState([]);
  const [mode, setMode] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [copilot, setCopilot] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [policyDraft, setPolicyDraft] = useState(null);
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotMessages, setCopilotMessages] = useState([]);
  const [copilotAnalysis, setCopilotAnalysis] = useState(null);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const policyInitialized = useRef(false);

  useEffect(() => { setTab("cockpit"); setDebugOpen(false); setMessage(""); policyInitialized.current = false; setCopilotMessages([]); setCopilotAnalysis(null); }, [moduleId]);

  const load = useCallback(async () => {
    const fetchJson = async path => { const response = await fetch(`${base}${path}`); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `API ${response.status}`); return body; };
    const [botBody, readinessBody, runsBody, modeBody, policyBody, connectorsBody, copilotBody] = await Promise.all([
      fetchJson(`/api/bots/${moduleId}`), fetchJson(`/api/modules/${moduleId}/readiness`), fetchJson(`/api/modules/${moduleId}/runs?limit=20`),
      fetchJson(`/api/modules/${moduleId}/mode`), fetchJson(`/api/modules/${moduleId}/policy`), fetchJson(`/api/connectors/status`), fetchJson(`/api/modules/${moduleId}/copilot`)
    ]);
    setBot(botBody); setReadiness(readinessBody.readiness); setRuns(runsBody.items || []); setMode(modeBody); setPolicy(policyBody); setConnectors(connectorsBody.connectors || []); setCopilot(copilotBody);
    if (!policyInitialized.current) { setPolicyDraft(policyBody.parameters || {}); policyInitialized.current = true; }
    setLastSync(new Date());
  }, [base, moduleId]);

  useEffect(() => { load().catch(error => setMessage(error.message)); const timer = setInterval(() => load().catch(() => {}), 8000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { const close = event => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);

  async function postJson(path, body = {}) {
    const response = await fetch(`${base}${path}`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `API ${response.status}`);
    return data;
  }
  async function runNow() { setBusy("run"); setMessage(""); try { const result = await postJson(`/api/modules/${moduleId}/run`); await load(); setMessage(result.deduped ? "Ya existe una corrida reciente para este disparador; no se duplicó evidencia." : (result.message || `Corrida completada · ${result.status || "OK"}.`)); } catch (error) { setMessage(error.message); } finally { setBusy(""); } }
  async function toggleActive() { setBusy("toggle"); setMessage(""); try { await postJson(`/api/bots/${moduleId}/toggle`); await load(); setMessage(bot?.active ? "Módulo pausado." : "Módulo activado."); } catch (error) { setMessage(error.message); } finally { setBusy(""); } }
  async function advanceStage(stage) { setBusy("stage"); setMessage(""); try { const confirmLive = stage === "LIVE"; if (confirmLive && !window.confirm(`Avanzar ${meta.label} a LIVE habilita sus acciones reales cuando el conector correspondiente esté configurado. ¿Continuar?`)) { setBusy(""); return; } await postJson(`/api/modules/${moduleId}/mode`, {actionStage: stage, confirmLive, actor: "operator"}); await load(); setMessage(`Etapa avanzada a ${stage}.`); } catch (error) { setMessage(error.message); } finally { setBusy(""); } }
  async function savePolicy() { setBusy("policy"); setMessage(""); try { await postJson(`/api/modules/${moduleId}/policy`, {parameters: policyDraft}); await load(); setMessage("Política guardada."); } catch (error) { setMessage(error.message); } finally { setBusy(""); } }
  async function askCopilot(value) {
    const question = String(value || copilotPrompt).trim(); if (!question || copilotBusy) return;
    setCopilotQuestion(question); setCopilotBusy(true);
    try { const body = await postJson(`/api/modules/${moduleId}/copilot/chat`, {message: question, conversation: copilotMessages}); setCopilotAnalysis(body); setCopilotMessages(current => [...current, {role: "user", content: question}, {role: "assistant", content: body.reply}].slice(-12)); setCopilotPrompt(""); }
    catch (error) { setCopilotAnalysis({reply: `No se pudo consultar al copiloto: ${error.message}`, findings: [], recommendations: []}); }
    finally { setCopilotBusy(false); setCopilotQuestion(""); }
  }

  if (!readiness || !mode) return <div className="botControlOverlay" onClick={onClose}><section className="botControlModal" onClick={event => event.stopPropagation()} style={{"--botAccent": meta.accent}}><button className="botControlClose" onClick={onClose} aria-label="Close module control">×</button><div className="botControlMessage">{message || "Cargando módulo…"}</div></section></div>;

  const permissions = mode.permissions || {};
  const ownedActions = Object.entries(permissions).filter(([, row]) => row.owned);
  const tabs = [["cockpit", "COCKPIT"], ["scanner", "SCANNER"], ["candidates", "CANDIDATES"], ["outputs", "OUTPUTS"], ["automation", "AUTOMATION"], ["connectors", "CONNECTORS"], ["strategy", "STRATEGY"], ["copilot", "COPILOT"], ["audit", "AUDIT"]];

  return <div className="botControlOverlay" onClick={onClose}>
    <section className="botControlModal commerceModuleModal" onClick={event => event.stopPropagation()} style={{"--botAccent": meta.accent}}>
      <button className="botControlClose" onClick={onClose} aria-label="Close module control">×</button>
      <div className="botControlHeader"><span className="botControlOrb"><meta.Icon size={26}/></span><div><small>MODULE {String(meta.n).padStart(2, "0")} · COMMERCE COCKPIT</small><h2>{meta.label}</h2><p>{bot?.description}</p></div><div className="botControlPulse"><span><i/> AUTO-SYNC 8S</span><b>{controlTime(lastSync)}</b><em>{mode.dataMode}</em></div></div>
      <CommerceStageStepper actionStage={mode.actionStage} readinessState={readiness.state} onAdvance={advanceStage} busy={busy === "stage"}/>
      <div className={`botSafetyRail ${mode.actionStage === "LIVE" ? "real" : "paper"}`}>
        <button onClick={toggleActive} disabled={busy === "toggle"}><Zap size={12}/>{busy === "toggle" ? "UPDATING" : bot?.active ? "PAUSE MODULE" : "ACTIVATE MODULE"}</button>
        <span><i className={readiness.ready ? "online" : "blocked"}/>{readiness.blockers?.[0] || "Sin bloqueos activos"}</span>
        <button className="scan" onClick={runNow} disabled={busy === "run" || !bot?.active}><Radio size={12}/>{busy === "run" ? "RUNNING" : "RUN NOW"}</button>
        <button className={debugOpen ? "confirm" : ""} onClick={() => setDebugOpen(current => !current)}><Database size={12}/>{debugOpen ? "HIDE DEBUG" : "DEBUG"}</button>
      </div>
      <div className="botControlTabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>

      {tab === "cockpit" && <div className="botCockpit">
        <div className="botControlStats botControlEdgeStats"><span><small>SIGNALS (REAL)</small><b>{bot?.metrics?.signals || 0}</b></span><span><small>CANDIDATES</small><b>{bot?.metrics?.candidates || 0}</b></span><span><small>DRAFTS</small><b>{bot?.metrics?.drafts || 0}</b></span><span><small>READINESS SCORE</small><b>{readiness.score}/100</b></span><span><small>DATA MODE</small><b>{mode.dataMode}</b></span><span><small>ACTION STAGE</small><b>{mode.actionStage}</b></span></div>
        <section className="botSpecialReadout"><div className="botSectionTitle"><span><Radar size={14}/> ÚLTIMA CORRIDA</span><small>{bot?.lastRunAt ? controlTime(bot.lastRunAt) : "Todavía no se ha ejecutado"}</small></div><div><span><small>ESTADO</small><b>{readiness.lastRun?.status || "SIN CORRIDAS"}</b></span><span><small>TRIGGER</small><b>{readiness.lastRun?.trigger || "—"}</b></span><span><small>NEXT ACTION</small><b>{readiness.nextAction}</b></span></div></section>
        {readiness.blockers?.length > 0 && <div className="botDecisionWhy"><div><small>BLOCKERS</small><b>{readiness.blockers.join(" · ")}</b></div><p>Resuelve estos bloqueos para avanzar de etapa.</p></div>}
        {readiness.warnings?.length > 0 && <div className="botDecisionWhy"><div><small>WARNINGS</small><b>{readiness.warnings.join(" · ")}</b></div></div>}
      </div>}

      {tab === "scanner" && <div className="botControlBody"><div className="botControlToolbar"><span>Historial real de corridas · idempotencia por hora en automático</span><button onClick={runNow} disabled={busy === "run"}><RefreshCw size={13}/>{busy === "run" ? "RUNNING…" : "RUN NOW"}</button></div><div className="botResultList modern">{runs.length ? runs.map(run => <article className={`botScanCard ${["ERROR", "BLOCKED"].includes(run.status) ? "hasError" : ""}`} key={run.id}><div className="botScanCardHead"><span><i className={run.status === "SUCCESS" ? "online" : "blocked"}/><b>{run.trigger.toUpperCase()} · {run.status}</b><small>{controlTime(run.finishedAt || run.startedAt)}</small></span><strong>{run.newSignal ? "NEW SIGNAL" : "NO NEW SIGNAL"}</strong></div><p>{run.summary}</p>{run.blockers?.length > 0 && <small className="commerceBotBlocker">BLOCKERS · {run.blockers.join(" · ")}</small>}</article>) : <div className="botControlEmpty">No hay corridas todavía. Ejecuta RUN NOW para iniciar el historial.</div>}</div></div>}

      {tab === "candidates" && <CommerceCandidatesPanel moduleId={moduleId} bot={bot}/>}
      {tab === "outputs" && <CommerceOutputsPanel moduleId={moduleId} bot={bot} readiness={readiness}/>}

      {tab === "automation" && <div className="botControlBody"><div className="botResultList modern"><article className="botScanCard"><div className="botScanCardHead"><span><i className={bot?.active ? "online" : "blocked"}/><b>{bot?.active ? "ACTIVO EN EL CICLO AUTOMÁTICO" : "PAUSADO"}</b><small>Intervalo definido por COMMERCE_AUTOMATION_INTERVAL_MS</small></span></div><p>El ciclo automático llama a este módulo con trigger "scheduled"; una corrida por hora se deduplica por idempotencyKey — nunca vuelve a contar la misma evidencia dos veces.</p></article></div><button className="botSaveButton" onClick={runNow} disabled={busy === "run"}><Zap size={15}/>{busy === "run" ? "RUNNING…" : "FORZAR CORRIDA MANUAL"}</button></div>}

      {tab === "connectors" && <div className="botControlBody"><div className="botResultList modern">{connectors.map(item => <article className="botScanCard" key={item.id}><div className="botScanCardHead"><span><i className={["READY", "VERIFIED"].includes(item.readiness) ? "online" : item.readiness === "UNVERIFIED" ? "" : "blocked"}/><b>{item.name}</b><small>{item.provider}</small></span><strong>{item.readiness || (item.configured ? "CONFIGURED" : "NOT CONFIGURED")}</strong></div><p>{item.detail}{item.error ? ` · ${item.error}` : ""}</p></article>)}</div></div>}

      {tab === "strategy" && <div className="botManualForm">
        <div className="botPolicyBanner"><Gauge size={18}/><div><b>PARÁMETROS DEL MÓDULO</b><small>Valores acotados por el backend — no se aceptan claves desconocidas ni fuera de rango.</small></div></div>
        <div className="botPolicyGrid">{Object.entries(policy?.defaults || {}).map(([key, defaultValue]) => {
          const value = policyDraft?.[key];
          if (typeof defaultValue === "boolean") return <label className="botToggle" key={key}><input type="checkbox" checked={Boolean(value)} onChange={event => setPolicyDraft(current => ({...current, [key]: event.target.checked}))}/><span/> {key.toUpperCase()}</label>;
          if (Array.isArray(defaultValue)) return <label key={key}>{key.toUpperCase()}<input type="text" value={Array.isArray(value) ? value.join(", ") : ""} onChange={event => setPolicyDraft(current => ({...current, [key]: event.target.value.split(",").map(item => item.trim()).filter(Boolean)}))}/></label>;
          return <label key={key}>{key.toUpperCase()}<input type="number" value={value ?? ""} onChange={event => setPolicyDraft(current => ({...current, [key]: event.target.value}))}/></label>;
        })}</div>
        <button className="botSaveButton" onClick={savePolicy} disabled={busy === "policy"}><Settings size={15}/>{busy === "policy" ? "SAVING…" : "SAVE & SYNC POLICY"}</button>
        <div className="botLiveNotice">Permisos por acción en esta etapa ({mode.actionStage}): {ownedActions.length ? ownedActions.map(([action, row]) => `${action}: ${row.allowed ? "permitido" : "bloqueado"}`).join(" · ") : "este módulo no controla ninguna acción mutante."}</div>
      </div>}

      {tab === "copilot" && <section className="botCopilot">
        <div className="botSectionTitle"><span><MessageCircle size={14}/> MODULE COPILOT · {moduleId}</span><small>Solo datos reales · nunca inventa métricas</small></div>
        <div className="botCopilotStatus"><span className={copilot?.status?.configured ? "ready" : "fallback"}><i/>{copilot?.status?.provider || "LOCAL"}</span><span>{readiness.state}</span></div>
        <div className="botCopilotQuick">{["¿Por qué está bloqueado este módulo?", "¿Qué evidencia real tengo hasta ahora?", "¿Qué falta para avanzar de etapa?", "Resume la política activa."].map(question => <button key={question} onClick={() => askCopilot(question)} disabled={copilotBusy}>{question}</button>)}</div>
        {(copilotAnalysis || copilot?.history?.length > 0) && <div className="botCopilotAnalysis">
          <p>{copilotAnalysis?.reply || copilot.history[copilot.history.length - 1]?.content}</p>
          {copilotAnalysis?.findings?.length > 0 && <div className="botCopilotFindings">{copilotAnalysis.findings.map((row, index) => <article key={index}><b>{row}</b></article>)}</div>}
          {copilotAnalysis?.recommendations?.length > 0 && <div className="botCopilotRecommendations">{copilotAnalysis.recommendations.map((row, index) => <article key={index}><div><b>{row}</b></div></article>)}</div>}
        </div>}
        <div className="botCopilotComposer"><input value={copilotPrompt} onChange={event => setCopilotPrompt(event.target.value)} onKeyDown={event => { if (event.key === "Enter") askCopilot(); }} placeholder="Pregunta sobre este módulo…"/><button onClick={() => askCopilot()} disabled={copilotBusy || !copilotPrompt.trim()}>{copilotBusy ? "ANALYZING…" : "ASK COPILOT"}</button></div>
      </section>}

      {tab === "audit" && <div className="botControlBody"><div className="botResultList modern">{(mode.history || []).map((entry, index) => <article className="botScanCard" key={index}><div className="botScanCardHead"><span><i className="online"/><b>{entry.from} → {entry.to}</b><small>{controlTime(entry.at)} · {entry.actor}</small></span></div>{entry.reason && <p>{entry.reason}</p>}</article>)}{!(mode.history || []).length && <div className="botControlEmpty">Sin cambios de etapa todavía — este módulo sigue en OBSERVE.</div>}</div></div>}

      {debugOpen && <div className="botDebugPanel"><div><Database size={15}/><span><b>RAW TELEMETRY</b><small>Solo visible con DEBUG activado.</small></span></div><pre>{JSON.stringify({bot, readiness, mode, policy, runs}, null, 2)}</pre></div>}
      {message && <div className="botControlMessage">{message}</div>}
      {copilotBusy && <CommerceCopilotThinkingOverlay meta={meta} question={copilotQuestion}/>}
    </section>
  </div>;
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

function FinanceBrainOrbit({bots = [], tools = [], central, speaking, streamConnected, selectedBotId, onSelect, onOpenTool}) {
  const nodes = [...bots, ...tools.map(ecosystemNode)];
  return <section className={"panel brain3dPanel " + (speaking ? "speaking" : "")}><div className="brain3dHeader"><div><small>03.6 / FINANCE BRAIN · COMMAND CHAMBER</small><h2>El sistema operativo de capital.</h2><p>Un núcleo neural coordina dieciséis bots y ocho plataformas conectadas. Selecciona un nodo para enfocar sus rutas; doble clic abre el cockpit del bot o el workspace embebido de la herramienta.</p></div><span className={`brain3dLive ${streamConnected?"streaming":""}`}><i/>{speaking ? "VOICE STREAMING" : selectedBotId ? "CONTROL LINK · LOCKED" : streamConnected ? "24-NODE ECOSYSTEM · LIVE" : "NEURAL CORE · POLLING"}</span></div><Brain3DViewport bots={nodes} central={central} selectedBotId={selectedBotId} onSelect={onSelect} onOpenTool={onOpenTool}/></section>;
}

function FinanceEcosystemPanel({tools = [], onOpen}) {
  const [activeId, setActiveId] = useState(tools[0]?.id || "");
  const [loadedId, setLoadedId] = useState("");
  const active = tools.find(tool => tool.id === activeId) || tools[0];
  if (!active) return null;
  const ActiveIcon = active.Icon;
  return <section className="panel financeEcosystemPanel" id="finance-ecosystem">
    <div className="ecosystemHeader"><div><small>05 / FINANCE ECOSYSTEM · EXTERNAL PLATFORMS</small><h2>Herramientas creadas. Un solo centro de acceso.</h2><p>Estas plataformas no son bots: son productos independientes conectados al Finance Brain mediante previews seguros, enlaces directos y nodos dentro del Command Chamber 3D.</p></div><span><i/>{tools.length} PLATFORMS LINKED</span></div>
    <div className="ecosystemLayout">
      <div className="ecosystemToolGrid">{tools.map(tool => { const ToolIcon = tool.Icon; return <button key={tool.id} className={`ecosystemToolCard ${active.id === tool.id ? "active" : ""}`} onClick={() => { setActiveId(tool.id); setLoadedId(""); }} style={{"--toolAccent": tool.accent}}><span className="ecosystemToolIcon"><ToolIcon size={17}/></span><span><small>{tool.category}</small><b>{tool.shortName}</b><em>{tool.network}</em></span><i className={tool.embeddable ? "embedReady" : "linkOnly"}/></button>; })}</div>
      <article className="ecosystemPreview" style={{"--toolAccent": active.accent}}>
        <div className="ecosystemPreviewTop"><div><span className="ecosystemPreviewIcon"><ActiveIcon size={18}/></span><span><small>{active.category} · {active.network}</small><b>{active.name}</b></span></div><span className={active.embeddable ? "previewLive" : "previewProtected"}><i/>{active.embeddable ? loadedId === active.id ? "LIVE PREVIEW" : "CONNECTING" : "DIRECT ACCESS"}</span></div>
        <div className={`ecosystemFrameShell ${active.embeddable ? "" : "protected"}`}>
          {active.embeddable ? <iframe key={active.id} title={`${active.name} compact preview`} src={active.url} loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" referrerPolicy="strict-origin-when-cross-origin" tabIndex="-1" onLoad={() => setLoadedId(active.id)}/> : <div className="ecosystemProtected"><MessageCircle size={34}/><b>PREVIEW PROTEGIDO POR LA PLATAFORMA</b><p>{active.embedReason}</p></div>}
          <button className="ecosystemPreviewShield" onClick={() => onOpen?.(active.id)} aria-label={`Abrir ${active.name} dentro de Finance Brain`}/>
        </div>
        <div className="ecosystemPreviewFoot"><p>{active.description}</p><div><button onClick={() => onOpen?.(active.id)}><Maximize2 size={13}/> OPEN EMBED</button><a href={active.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> OPEN PLATFORM</a></div></div>
      </article>
    </div>
  </section>;
}

function FinanceToolEmbed({tool, onClose}) {
  useEffect(() => { const close = event => { if (event.key === "Escape") onClose?.(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  if (!tool) return null;
  const ToolIcon = tool.Icon;
  return <div className="financeToolOverlay" role="dialog" aria-modal="true" aria-label={`${tool.name} embedded workspace`} onClick={onClose}>
    <section className="financeToolWindow" onClick={event => event.stopPropagation()} style={{"--toolAccent": tool.accent}}>
      <header><div><span><ToolIcon size={18}/></span><div><small>FINANCE ECOSYSTEM · {tool.category}</small><h2>{tool.name}</h2><p>{tool.network} · EXTERNAL PLATFORM</p></div></div><div><a href={tool.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> OPEN FULL SITE</a><button onClick={onClose} aria-label="Close embedded platform">×</button></div></header>
      {tool.embeddable ? <iframe title={`${tool.name} embedded workspace`} src={tool.url} allow="clipboard-read; clipboard-write; fullscreen; payment" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals" referrerPolicy="strict-origin-when-cross-origin"/> : <div className="financeToolProtected"><span><ToolIcon size={44}/></span><small>DIRECT PLATFORM CONNECTION</small><h3>{tool.name}</h3><p>{tool.embedReason}</p><a href={tool.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> OPEN SECURE PLATFORM</a></div>}
      <footer><span><i/> LINKED TO FINANCE BRAIN</span><span>INDEPENDENT PLATFORM · WALLET ACTIONS REQUIRE ITS OWN APPROVAL</span></footer>
    </section>
  </div>;
}

function CommerceBrainOrbit({bots = [], speaking, onSelect}) {
  return <section className={"panel brain3dPanel commerceBrain3dPanel " + (speaking ? "speaking" : "")}><div className="brain3dHeader"><div><small>03.6 / COMMERCE BRAIN · COMMAND CHAMBER</small><h2>El sistema operativo de revenue.</h2><p>Un núcleo comercial conecta descubrimiento, oferta, contenido, tienda, tráfico, CRM y asignación de presupuesto. Explora cada módulo y abre su control PAPER desde el nodo.</p></div><span className="brain3dLive"><i/>{speaking ? "VOICE STREAMING" : "COMMERCE CORE · ONLINE"}</span></div><Brain3DViewport bots={bots} onSelect={onSelect}/></section>;
}

function ServicesBrainOrbit({bots = [], speaking, onSelect}) {
  return <section className={"panel brain3dPanel servicesBrain3dPanel " + (speaking ? "speaking" : "")}><div className="brain3dHeader"><div><small>03.6 / SERVICES BRAIN · COMMAND CHAMBER</small><h2>El sistema operativo de tus servicios.</h2><p>Un núcleo comercial conecta venta consultiva, cotización, delivery, web, video, SEO, branding, automatización y éxito del cliente.</p></div><span className="brain3dLive"><i/>{speaking ? "VOICE STREAMING" : "SERVICES CORE · ONLINE"}</span></div><Brain3DViewport bots={bots} onSelect={onSelect}/></section>;
}

// The Financial Brain Hub: the central node from the master spec, with the 12 destinations
// orbiting it. Every destination is clickable (single or double click) and opens a drawer with
// real, computed content — not a static mockup.
function FinancialBrainHub({api, dealId, onDealCreated, speaking}) {
  // `activeId` (which hub tab is open below) and `focusedNodeId` (which 3D node the camera is
  // locked onto) are deliberately separate: activeId defaults to "deal-builder" so the tabs below
  // aren't blank on load, but feeding that same default into Brain3DViewport's selectedBotId used
  // to auto-focus the camera onto that node from the very first frame — permanently zooming past
  // the brain core sprite at the center of the chamber so it was never actually visible. Camera
  // This used to also render its own Brain3DViewport (12 hub-tab shortcuts as nodes) above the
  // tab bar. That was a second, unrelated 3D chamber on the same page — every other kind (Finance,
  // Commerce, SaaS, Media, Services) has exactly one 3D chamber, and it always shows real
  // live bots/agents, never a static feature menu. NexusAgentOrbit (rendered once, right after
  // this component, showing the 8 real Manhattan agents) is now that one chamber for institutional
  // too; the 12 destinations navigate purely through the tab bar below, same as they already did.
  const [activeId, setActiveId] = useState("deal-builder");
  return <FinancialBrainInlinePanel activeId={activeId} onSelectDestination={setActiveId} api={api} dealId={dealId} onDealCreated={onDealCreated}/>;
}

// Inline, in-page panel (not a floating overlay) — the 12 destinations are tabs across the top,
// same as the Deal Builder used to be permanently visible. Switching tabs never loses your place
// on the page the way a modal window did.
function FinancialBrainInlinePanel({activeId, onSelectDestination, api, dealId, onDealCreated}) {
  const destination = FINANCIAL_BRAIN_DESTINATIONS.find(d => d.id === activeId) || FINANCIAL_BRAIN_DESTINATIONS[0];
  const Icon = destination.Icon;
  return <section className="panel institutionalPanel institutionalHubPanel" style={{"--toolAccent": destination.accent}}>
    <div className="institutionalDestinationTabs">
      {FINANCIAL_BRAIN_DESTINATIONS.map(item => {
        const ItemIcon = item.Icon;
        return <button key={item.id} className={`institutionalDestinationTab ${item.id === destination.id ? "active" : ""}`} style={{"--toolAccent": item.accent}} onClick={() => onSelectDestination(item.id)}>
          <ItemIcon size={14}/><span>{item.name}</span>
        </button>;
      })}
    </div>
    <div className="panelHead"><div><small>FINANCIAL BRAIN · {destination.category}</small><h2><Icon size={18} style={{verticalAlign: "-3px", marginRight: 8}}/>{destination.name}</h2><p style={{margin: "6px 0 0", color: "#7d8ba6", fontSize: 11}}>{destination.description}</p></div>{dealId && <span className="panelAction">DEAL {dealId.slice(0, 14)}…</span>}</div>
    <div className="institutionalHubBody">
      <FinancialBrainDestinationPanel destination={destination.id} api={api} dealId={dealId} onDealCreated={onDealCreated}/>
    </div>
  </section>;
}

function FinancialBrainDestinationPanel({destination, api, dealId, onDealCreated}) {
  switch (destination) {
    case "financial-brain": return <FinancialBrainQaPanel api={api} dealId={dealId}/>;
    case "deal-builder": return <InstitutionalControlPanel api={api} dealId={dealId} onDealCreated={onDealCreated}/>;
    case "roles-counterparties": return <RolesCounterpartiesPanel api={api} dealId={dealId}/>;
    case "investors": return <InvestorsPanel api={api} dealId={dealId}/>;
    case "compliance-risk": return <ComplianceRiskPanel api={api} dealId={dealId}/>;
    case "capital-stack": return <CapitalStackPanel api={api} dealId={dealId}/>;
    case "contracts-security": return <ContractsSecurityPanel api={api} dealId={dealId}/>;
    case "simulation-lab": return <SimulationLabPanel api={api} dealId={dealId}/>;
    case "governance-treasury": return <GovernanceTreasuryPanel api={api} dealId={dealId}/>;
    case "deployment-monitoring": return <DeploymentMonitoringPanel api={api} dealId={dealId}/>;
    case "reports-business": return <ReportsBusinessPanel api={api} dealId={dealId}/>;
    case "tenants": return <TenantsPanel api={api}/>;
    default: return null;
  }
}

function NeedsDeal() { return <p className="institutionalHint">Carga o crea un deal desde <b>DEAL BUILDER</b> para ver datos reales aqui.</p>; }

function FinancialBrainQaPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [summary, setSummary] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dealId) return; fetch(`${base}/api/deals/${dealId}/brain`).then(r => r.json()).then(setSummary).catch(() => {}); }, [base, dealId]);
  async function ask(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    try { const response = await fetch(`${base}/api/deals/${dealId}/brain/ask`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({question})}); const data = await response.json(); setAnswer(data.answer); }
    finally { setBusy(false); }
  }
  if (!dealId) return <NeedsDeal/>;
  if (!summary) return <p className="institutionalHint">Cargando…</p>;
  return <div>
    <div className="institutionalTotalsRow">
      <div><small>STATUS</small><b>{summary.status}</b></div>
      <div><small>SUGGESTED NEXT STATUS</small><b>{summary.suggestedStatus}</b></div>
    </div>
    <div className="institutionalScenarios">
      <h3>Q&amp;A determinístico</h3>
      {Object.entries(summary.qa).map(([q, a]) => <div key={q} className="institutionalScenarioCard"><b>{q}</b><p style={{marginTop: 8, color: "#cbd8ec", fontSize: 11}}>{a}</p></div>)}
    </div>
    <form onSubmit={ask} className="institutionalActions" style={{marginTop: 16}}>
      <input placeholder="Pregunta libre (ej: ¿por qué Canton?)" value={question} onChange={e => setQuestion(e.target.value)} style={{flex: 1, minWidth: 0, background: "#0a1122", border: "1px solid #202d47", borderRadius: 8, padding: "10px 12px", color: "#cbd8ec"}}/>
      <button className="primary" disabled={busy}>{busy ? "..." : "PREGUNTAR"}</button>
    </form>
    {answer && <p className="institutionalNotice">{answer}</p>}
  </div>;
}

function RolesCounterpartiesPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [roles, setRoles] = useState([]);
  const [counterparties, setCounterparties] = useState([]);
  const [providerDrafts, setProviderDrafts] = useState({});
  const [cpForm, setCpForm] = useState({name: "", type: "Custodian"});
  const load = useCallback(() => {
    if (!dealId) return;
    fetch(`${base}/api/deals/${dealId}/roles`).then(r => r.json()).then(d => setRoles(d.roles || []));
    fetch(`${base}/api/deals/${dealId}/counterparties`).then(r => r.json()).then(d => setCounterparties(d.counterparties || []));
  }, [base, dealId]);
  useEffect(load, [load]);
  async function assign(roleId) {
    const provider = providerDrafts[roleId];
    if (!provider) return;
    await fetch(`${base}/api/deals/${dealId}/roles/${roleId}`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({provider})});
    load();
  }
  async function addCp(event) {
    event.preventDefault();
    if (!cpForm.name.trim()) return;
    await fetch(`${base}/api/deals/${dealId}/counterparties`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(cpForm)});
    setCpForm({name: "", type: "Custodian"});
    load();
  }
  if (!dealId) return <NeedsDeal/>;
  return <div>
    <h3>Institutional Role Mapper</h3>
    <div className="institutionalChecklist">
      {roles.map(role => <div key={role.id} className={`institutionalInvariantRow ${role.assigned ? "ok" : "fail"}`}>
        {role.assigned ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
        <span style={{flex: 1}}>{role.name}{role.assigned ? `: ${role.provider}` : " — sin asignar (riesgo)"}</span>
        {!role.assigned && <><input placeholder="Proveedor" value={providerDrafts[role.id] || ""} onChange={e => setProviderDrafts({...providerDrafts, [role.id]: e.target.value})} style={{width: 140, background: "#0a1122", border: "1px solid #202d47", borderRadius: 6, padding: "4px 8px", color: "#cbd8ec", fontSize: 10}}/><button onClick={() => assign(role.id)} style={{fontSize: 9, padding: "4px 8px"}}>ASSIGN</button></>}
      </div>)}
    </div>
    <h3 style={{marginTop: 20}}>Entity &amp; Counterparty Intelligence <span className="institutionalBadge preset">SIMULATED</span></h3>
    <form onSubmit={addCp} className="institutionalActions">
      <input placeholder="Nombre de la contraparte" value={cpForm.name} onChange={e => setCpForm({...cpForm, name: e.target.value})} style={{flex: 1, minWidth: 0, background: "#0a1122", border: "1px solid #202d47", borderRadius: 8, padding: "10px 12px", color: "#cbd8ec"}}/>
      <select value={cpForm.type} onChange={e => setCpForm({...cpForm, type: e.target.value})} style={{background: "#0a1122", border: "1px solid #202d47", borderRadius: 8, padding: "10px 12px", color: "#cbd8ec"}}>
        {["Custodian", "Bank", "Broker-Dealer", "Fund Administrator", "Legal Counsel"].map(t => <option key={t}>{t}</option>)}
      </select>
      <button className="primary">SCREEN &amp; ADD</button>
    </form>
    <div className="institutionalScenarioGrid" style={{marginTop: 12}}>
      {counterparties.map(cp => <div key={cp.id} className="institutionalScenarioCard">
        <b>{cp.name}</b>
        <p style={{fontSize: 10, color: "#7d8ba6", margin: "6px 0"}}>{cp.type} · {cp.jurisdiction}</p>
        <div className="institutionalScenarioResult"><span>{cp.sanctionsScreening === "CLEAR" ? "CLEAR" : "FLAGGED"}</span><p>KYB {cp.kyb} · Risk score {cp.riskScore}/100</p></div>
      </div>)}
      {!counterparties.length && <p className="institutionalHint">Sin contrapartes registradas todavía.</p>}
    </div>
  </div>;
}

function InvestorsPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [investors, setInvestors] = useState([]);
  const [transferForm, setTransferForm] = useState({investorId: "", toWallet: ""});
  const [result, setResult] = useState(null);
  const load = useCallback(() => { if (dealId) fetch(`${base}/api/deals/${dealId}/investors`).then(r => r.json()).then(d => setInvestors(d.investors || [])); }, [base, dealId]);
  useEffect(load, [load]);
  async function attempt(event) {
    event.preventDefault();
    if (!transferForm.investorId || !transferForm.toWallet) return;
    const response = await fetch(`${base}/api/deals/${dealId}/investors/${transferForm.investorId}/transfer`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({toWallet: transferForm.toWallet})});
    setResult(await response.json());
  }
  if (!dealId) return <NeedsDeal/>;
  return <div>
    <h3>Investor Management ({investors.length})</h3>
    <div className="institutionalComparisonScroll">
      <table className="institutionalComparisonTable">
        <thead><tr><th>Name</th><th>KYC</th><th>Ownership</th><th>Lock-up</th><th>Distributions</th></tr></thead>
        <tbody>{investors.map(inv => <tr key={inv.id}><td>{inv.name}</td><td>{inv.kyc}</td><td>{inv.ownershipPct}%</td><td>{inv.lockupExpiresMonth}mo</td><td>${inv.distributionsReceivedUsd.toLocaleString()}</td></tr>)}</tbody>
      </table>
    </div>
    <h3 style={{marginTop: 20}}>Attempt Transfer</h3>
    <form onSubmit={attempt} className="institutionalActions">
      <select value={transferForm.investorId} onChange={e => setTransferForm({...transferForm, investorId: e.target.value})} style={{background: "#0a1122", border: "1px solid #202d47", borderRadius: 8, padding: "10px 12px", color: "#cbd8ec"}}>
        <option value="">Investor…</option>
        {investors.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
      </select>
      <input placeholder="Wallet destino (0x…)" value={transferForm.toWallet} onChange={e => setTransferForm({...transferForm, toWallet: e.target.value})} style={{flex: 1, minWidth: 0, background: "#0a1122", border: "1px solid #202d47", borderRadius: 8, padding: "10px 12px", color: "#cbd8ec"}}/>
      <button className="primary">ATTEMPT TRANSFER</button>
    </form>
    {result && <div className="institutionalScenarioResult" style={{marginTop: 12}}><span>{result.result}</span><p>{result.reason}</p></div>}
  </div>;
}

function ComplianceRiskPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [compliance, setCompliance] = useState(null);
  const [risk, setRisk] = useState(null);
  useEffect(() => {
    if (!dealId) return;
    fetch(`${base}/api/deals/${dealId}/compliance-score`).then(r => r.json()).then(setCompliance);
    fetch(`${base}/api/deals/${dealId}/risk`).then(r => r.json()).then(setRisk);
  }, [base, dealId]);
  if (!dealId) return <NeedsDeal/>;
  if (!compliance || !risk) return <p className="institutionalHint">Cargando…</p>;
  return <div>
    <h3>Compliance Readiness: {compliance.score}/100</h3>
    <div className="institutionalChecklist">{compliance.checklist.map(item => <div key={item.id} className={`institutionalInvariantRow ${item.satisfied ? "ok" : "fail"}`}>{item.satisfied ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}<span>{item.label}</span></div>)}</div>
    <h3 style={{marginTop: 20}}>Overall Deal Risk Score: {risk.overall}/100</h3>
    {risk.categories.map(category => <div key={category.id} className="institutionalNetworkRow">
      <b>{category.name}</b>
      <div className="institutionalNetworkBar"><span style={{width: `${category.score}%`}}/></div>
      <em>{category.score}/100</em>
      <p>{category.reason}</p>
    </div>)}
  </div>;
}

function CapitalStackPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [data, setData] = useState(null);
  useEffect(() => { if (dealId) fetch(`${base}/api/deals/${dealId}/capital-stack`).then(r => r.json()).then(setData); }, [base, dealId]);
  if (!dealId) return <NeedsDeal/>;
  if (!data) return <p className="institutionalHint">Cargando…</p>;
  return <div>
    <h3>Capital Stack ({data.tranches.length} tranche{data.tranches.length === 1 ? "" : "s"})</h3>
    <div className="institutionalComparisonScroll">
      <table className="institutionalComparisonTable">
        <thead><tr><th>Priority</th><th>Tranche</th><th>Amount</th><th>Rate</th></tr></thead>
        <tbody>{data.tranches.map(t => <tr key={t.id}><td>{t.priority}</td><td>{t.name}</td><td>${t.amountUsd.toLocaleString()}</td><td>{t.ratePct}%</td></tr>)}</tbody>
      </table>
    </div>
    <h3 style={{marginTop: 20}}>Waterfall on ${data.waterfall.availableCashUsd.toLocaleString()} available</h3>
    <div className="institutionalTotalsRow">
      {data.waterfall.payouts.map(p => <div key={p.trancheId}><small>{p.name.toUpperCase()}</small><b>${p.paidUsd.toLocaleString()}</b></div>)}
    </div>
  </div>;
}

function ContractsSecurityPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [architecture, setArchitecture] = useState([]);
  const [security, setSecurity] = useState(null);
  useEffect(() => {
    if (!dealId) return;
    fetch(`${base}/api/deals/${dealId}/architecture`, {method: "POST"}).then(r => r.json()).then(d => setArchitecture(d.architecture || []));
    fetch(`${base}/api/deals/${dealId}/security-score`).then(r => r.json()).then(setSecurity);
  }, [base, dealId]);
  if (!dealId) return <NeedsDeal/>;
  return <div>
    <h3>Contract Architecture ({architecture.length})</h3>
    {architecture.map(c => <div key={c.id} className="institutionalContractBlock" style={{padding: "8px 0"}}><b style={{fontSize: 11}}>{c.name}</b><p style={{margin: "3px 0 0", color: "#7d8ba6", fontSize: 10.5}}>{c.why}</p></div>)}
    <p className="institutionalHint">Ver codigo generado (Solidity/Soroban/Daml) en los nodos de adaptador de blockchain, debajo del Financial Brain.</p>
    {security && <>
      <h3 style={{marginTop: 20}}>Security Readiness: {security.score}/100 <small style={{color: "#7d8ba6", fontSize: 10}}>({security.roleCoverage} roles)</small></h3>
      <div className="institutionalChecklist">{security.checklist.map(item => <div key={item.id} className={`institutionalInvariantRow ${item.satisfied ? "ok" : "fail"}`}>{item.satisfied ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}<span>{item.label}</span></div>)}</div>
    </>}
  </div>;
}

function SimulationLabPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  async function run(duration) {
    setBusy(duration);
    try { const response = await fetch(`${base}/api/deals/${dealId}/simulate`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({duration})}); setResult(await response.json()); }
    finally { setBusy(""); }
  }
  if (!dealId) return <NeedsDeal/>;
  return <div>
    <h3>Simulation Lab</h3>
    <div className="institutionalActions">
      <button className="primary" disabled={busy} onClick={() => run("1m")}>{busy === "1m" ? "…" : "RUN 1 MONTH"}</button>
      <button className="primary" disabled={busy} onClick={() => run("12m")}>{busy === "12m" ? "…" : "RUN 12 MONTHS"}</button>
      <button className="primary" disabled={busy} onClick={() => run("lifecycle")}>{busy === "lifecycle" ? "…" : "RUN FULL LIFECYCLE"}</button>
      <button className="ghost" disabled={busy} onClick={() => run("stress")}>{busy === "stress" ? "…" : "STRESS TEST"}</button>
    </div>
    {result && <div className="institutionalSimulationResults" style={{marginTop: 16, paddingTop: 0, borderTop: 0}}>
      {result.stressed && <p className="institutionalHint">Stress assumptions: NOI {result.stressAssumptions.noiShockPct}%, rate +{result.stressAssumptions.rateShockBps}bps</p>}
      <div className="institutionalTotalsRow">
        <div><small>PERIODS</small><b>{result.periods?.length ?? "—"}</b></div>
        <div><small>DISTRIBUTED</small><b>${result.totals.distributedCashUsd.toLocaleString()}</b></div>
        <div><small>DEBT SERVICE</small><b>${result.totals.debtServiceUsd.toLocaleString()}</b></div>
      </div>
      <div className="institutionalInvariants">
        <h4>Timeline</h4>
        {(result.events || []).map(event => <div key={event.period} className="institutionalInvariantRow ok"><span>{event.at}: {event.description}</span></div>)}
      </div>
      <div className="institutionalInvariants">
        <h4>Financial Invariants</h4>
        {result.invariants.map(item => <div key={item.id} className={`institutionalInvariantRow ${item.satisfied ? "ok" : "fail"}`}>{item.satisfied ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}<span>{item.description}</span></div>)}
      </div>
    </div>}
  </div>;
}

function GovernanceTreasuryPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [stages, setStages] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [movementForm, setMovementForm] = useState({amountUsd: "", signatures: 1, purpose: "Distribution funding"});
  const load = useCallback(() => {
    if (!dealId) return;
    fetch(`${base}/api/deals/${dealId}/governance`).then(r => r.json()).then(d => setStages(d.stages || []));
    fetch(`${base}/api/deals/${dealId}/treasury`).then(r => r.json()).then(setTreasury);
  }, [base, dealId]);
  useEffect(load, [load]);
  async function decide(stage, decision) {
    await fetch(`${base}/api/deals/${dealId}/governance/${stage}`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({decision, actor: "demo-user"})});
    load();
  }
  async function submitMovement(event) {
    event.preventDefault();
    const amountUsd = Number(movementForm.amountUsd);
    if (!amountUsd) return;
    await fetch(`${base}/api/deals/${dealId}/treasury/movement`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({...movementForm, amountUsd})});
    setMovementForm({...movementForm, amountUsd: ""});
    load();
  }
  if (!dealId) return <NeedsDeal/>;
  return <div>
    <h3>Approval &amp; Governance Workflow</h3>
    <div className="institutionalScenarioGrid">
      {stages.map(stage => <div key={stage.stage} className="institutionalScenarioCard">
        <b>{stage.stage}</b>
        <p style={{fontSize: 10, color: "#7d8ba6", margin: "6px 0"}}>{stage.decision}{stage.actor ? ` · ${stage.actor}` : ""}</p>
        <div style={{display: "flex", gap: 6}}>
          <button onClick={() => decide(stage.stage, "APPROVED")} style={{flex: 1, fontSize: 9}}>APPROVE</button>
          <button onClick={() => decide(stage.stage, "REJECTED")} style={{flex: 1, fontSize: 9}}>REJECT</button>
        </div>
      </div>)}
    </div>
    <h3 style={{marginTop: 20}}>Multisig &amp; Treasury Simulator {treasury && <small style={{color: "#7d8ba6", fontSize: 10}}>({treasury.threshold}/{treasury.signers} required · balance ${treasury.balanceUsd.toLocaleString()})</small>}</h3>
    <form onSubmit={submitMovement} className="institutionalActions">
      <input type="number" placeholder="Amount USD" value={movementForm.amountUsd} onChange={e => setMovementForm({...movementForm, amountUsd: e.target.value})} style={{width: 130, background: "#0a1122", border: "1px solid #202d47", borderRadius: 8, padding: "10px 12px", color: "#cbd8ec"}}/>
      <input type="number" min="0" placeholder="Signatures" value={movementForm.signatures} onChange={e => setMovementForm({...movementForm, signatures: Number(e.target.value)})} style={{width: 100, background: "#0a1122", border: "1px solid #202d47", borderRadius: 8, padding: "10px 12px", color: "#cbd8ec"}}/>
      <button className="primary">SUBMIT MOVEMENT</button>
    </form>
    <div className="institutionalScenarios" style={{marginTop: 12}}>
      {(treasury?.movements || []).slice(0, 6).map(m => <div key={m.id} className="institutionalScenarioResult" style={{marginBottom: 8}}><span>{m.status}</span><p>${m.amountUsd.toLocaleString()} — {m.reason || m.purpose}</p></div>)}
    </div>
  </div>;
}

function DeploymentMonitoringPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [testnet, setTestnet] = useState(null);
  const [monitoring, setMonitoring] = useState(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    if (!dealId) return;
    fetch(`${base}/api/deals/${dealId}/testnet`).then(r => r.json()).then(setTestnet);
    fetch(`${base}/api/deals/${dealId}/monitoring`).then(r => r.json()).then(setMonitoring);
  }, [base, dealId]);
  useEffect(load, [load]);
  async function deploy(adapterId) {
    setBusy(adapterId);
    try { await fetch(`${base}/api/deals/${dealId}/testnet/deploy`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({adapterId})}); load(); }
    catch {} finally { setBusy(""); }
  }
  if (!dealId) return <NeedsDeal/>;
  return <div>
    <h3>Testnet Deployment Center</h3>
    <div className="institutionalDeployStatus"><span className="institutionalBadge locked"><Lock size={12}/> PRODUCTION LOCKED</span><span className="institutionalBadge preset">MODE: {testnet?.mode || "SIMULATION"}</span></div>
    <div className="institutionalActions" style={{marginTop: 12}}>
      {INSTITUTIONAL_ADAPTER_TOOLS.map(tool => <button key={tool.adapterId} className="ghost" disabled={busy} onClick={() => deploy(tool.adapterId)}>{busy === tool.adapterId ? "…" : `DEPLOY ${tool.shortName}`}</button>)}
    </div>
    <div className="institutionalScenarioGrid" style={{marginTop: 12}}>
      {(testnet?.deployments || []).map(d => <div key={d.id} className="institutionalScenarioCard"><b>{d.language}</b><p style={{fontSize: 10, color: "#7d8ba6"}}>{d.network}</p><p style={{fontSize: 9.5, wordBreak: "break-all", color: "#5ce1ff"}}>{d.contractAddress}</p></div>)}
    </div>
    <h3 style={{marginTop: 20}}>Monitoring Center</h3>
    <div className="institutionalInvariants">
      {(monitoring?.alerts || []).slice(0, 12).map(alert => <div key={alert.id} className={`institutionalInvariantRow ${alert.severity === "CRITICAL" ? "fail" : "ok"}`}>{alert.severity === "CRITICAL" ? <AlertTriangle size={14}/> : <CheckCircle2 size={14}/>}<span>[{alert.severity}] {alert.message}</span></div>)}
      {!monitoring?.alerts?.length && <p className="institutionalHint">Sin alertas todavia.</p>}
    </div>
  </div>;
}

function ReportsBusinessPanel({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState(null);
  useEffect(() => {
    fetch(`${base}/api/executive-summary`).then(r => r.json()).then(setSummary).catch(() => {});
    if (dealId) fetch(`${base}/api/deals/${dealId}/revenue-model`).then(r => r.json()).then(setRevenue).catch(() => {});
  }, [base, dealId]);
  async function exportPackage(format) {
    if (!dealId) return;
    const response = await fetch(`${base}/api/deals/${dealId}/package?format=${format}`);
    const text = format === "md" ? await response.text() : JSON.stringify(await response.json(), null, 2);
    const blob = new Blob([text], {type: format === "md" ? "text/markdown" : "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${dealId}-transaction-package.${format}`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return <div>
    <h3>Executive Dashboard</h3>
    {summary && <div className="institutionalTotalsRow">
      <div><small>ACTIVE DEALS</small><b>{summary.activeDeals}</b></div>
      <div><small>SIMULATED ASSETS</small><b>${summary.totalSimulatedAssetsUsd.toLocaleString()}</b></div>
      <div><small>INVESTORS</small><b>{summary.investors}</b></div>
      <div><small>DISTRIBUTIONS</small><b>${summary.distributionsUsd.toLocaleString()}</b></div>
      <div><small>AVG RISK</small><b>{summary.avgRiskScore}/100</b></div>
      <div><small>AVG COMPLIANCE</small><b>{summary.avgComplianceScore}/100</b></div>
      <div><small>AVG SECURITY</small><b>{summary.avgSecurityScore}/100</b></div>
      <div><small>PENDING APPROVALS</small><b>{summary.pendingApprovals}</b></div>
    </div>}
    {revenue && <>
      <h3 style={{marginTop: 20}}>Revenue &amp; Business Model <span className="institutionalBadge preset">SIMULATED</span></h3>
      <div className="institutionalTotalsRow">
        <div><small>ONE-TIME</small><b>${revenue.oneTimeUsd.toLocaleString()}</b></div>
        <div><small>ANNUAL</small><b>${revenue.annualUsd.toLocaleString()}</b></div>
        <div><small>5-YEAR</small><b>${revenue.fiveYearUsd.toLocaleString()}</b></div>
      </div>
    </>}
    <h3 style={{marginTop: 20}}>Institutional Report Generator</h3>
    <div className="institutionalActions">
      <button className="primary" disabled={!dealId} onClick={() => exportPackage("md")}><Download size={14}/> EXPORT MARKDOWN</button>
      <button className="ghost" disabled={!dealId} onClick={() => exportPackage("json")}><Download size={14}/> EXPORT JSON</button>
    </div>
    {!dealId && <p className="institutionalHint">Carga un deal para exportar su Digital Transaction Package.</p>}
  </div>;
}

function TenantsPanel({api}) {
  const base = api.replace(/\/$/, "");
  const [tenants, setTenants] = useState([]);
  useEffect(() => { fetch(`${base}/api/tenants`).then(r => r.json()).then(d => setTenants(d.tenants || [])); }, [base]);
  return <div>
    <h3>Multi-Tenant Registry</h3>
    <p className="institutionalHint">Manhattan Group es un tenant configurado, no el sistema mismo — cada organizacion tendria su propio branding, policies y templates.</p>
    <div className="institutionalScenarioGrid" style={{marginTop: 12}}>
      {tenants.map(tenant => <div key={tenant.id} className="institutionalScenarioCard" style={{"--toolAccent": tenant.accent}}><b>{tenant.name}</b><p style={{fontSize: 10, color: "#7d8ba6", marginTop: 6}}>{tenant.kind}</p></div>)}
    </div>
  </div>;
}

// Spec section 46: never rely on color alone — every status badge carries its plain-language
// label alongside the color language (GREEN/AMBER/RED/BLUE/GRAY).
const AGENT_STATUS_META = {
  APPROVE: {label: "GREEN · APPROVE", color: "#5ce3ad"},
  APPROVE_WITH_CONDITIONS: {label: "AMBER · APPROVE WITH CONDITIONS", color: "#f2bd69"},
  REJECT: {label: "RED · REJECT", color: "#ff789b"},
  BLOCK: {label: "RED · BLOCK", color: "#ff789b"},
  RETURN_FOR_REWORK: {label: "AMBER · RETURN FOR REWORK", color: "#f2bd69"},
  IDLE: {label: "GRAY · IDLE", color: "#6e7d98"}
};

// Shared formatter for any agent response, wherever it appears (single-agent quick action or a
// NEXUS Session transcript) — collapsed summary + expandable risks/questions/actions instead of
// one long wall of text.
// The chat text (`team_message`) is what a colleague actually reads live — it's rendered large,
// as speech. Everything the agent used to justify that position (formal summary, risks,
// questions, required actions) is real data too, but it reads like a memo, not a conversation, so
// it stays behind "Ver detalle técnico" instead of competing with the spoken line for attention.
function AgentMessageBubble({entry, defaultExpanded = false, animate = false, simulationNotice = null}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const meta = AGENT_STATUS_META[entry.decision] || AGENT_STATUS_META.IDLE;
  const initials = String(entry.alias || "??").split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase();
  const spoken = entry.team_message || entry.analysis_summary || entry.summary || "";
  const hasTechnicalDetail = Boolean(entry.analysis_summary) || entry.risks?.length > 0 || entry.questions?.length > 0 || entry.required_actions?.length > 0;
  return <div className={`nexusBubble ${animate ? "nexusBubbleEnter" : ""}`} style={{"--bubbleColor": meta.color}}>
    <div className="nexusBubbleAvatar">{initials}</div>
    <div className="nexusBubbleBody">
      <div className="nexusBubbleHeader">
        <b>{entry.alias}</b>
        {entry.reference && <em>({entry.reference})</em>}
        <span className="institutionalBadge" style={{background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55`}}>{meta.label}</span>
        {typeof entry.confidence === "number" && <span className="nexusConfidencePill">{entry.confidence}/100</span>}
      </div>
      {simulationNotice && <p className="nexusSimulationNotice">{simulationNotice}</p>}
      <p className="nexusBubbleSpeech">{spoken}</p>
      {hasTechnicalDetail && <button className="nexusExpandToggle" onClick={() => setExpanded(value => !value)}>{expanded ? "Ocultar detalle técnico" : "Ver detalle técnico"}</button>}
      {expanded && <div className="nexusTechnicalDetail">
        {entry.analysis_summary && <p className="nexusBubbleText">{entry.analysis_summary}</p>}
        {entry.risks?.length > 0 && <div className="nexusTagGroup"><small>RISKS</small><div>{entry.risks.map((risk, index) => <span key={index} className="nexusTag risk">{risk}</span>)}</div></div>}
        {entry.questions?.length > 0 && <div className="nexusTagGroup"><small>QUESTIONS</small><div>{entry.questions.map((question, index) => <span key={index} className="nexusTag question">{question}</span>)}</div></div>}
        {entry.required_actions?.length > 0 && <div className="nexusTagGroup"><small>ACTIONS</small><div>{entry.required_actions.map((action, index) => <span key={index} className={`nexusTag action ${action.blocking ? "blocking" : ""}`}>{action.description}</span>)}</div></div>}
      </div>}
      {entry.model && <p className="nexusBubbleMeta">model: {entry.model} · provider: {entry.provider || "fallback"}{entry.usedFallback ? " · fallback determinista" : ""}</p>}
    </div>
  </div>;
}

// The P0 single-agent / orchestrator-committee tools, relocated inside the NEXUS Session overlay
// as "Quick Actions" instead of living directly in the hub tab.
function NexusQuickActions({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const [agents, setAgents] = useState([]);
  const [flows, setFlows] = useState([]);
  const [dealAgents, setDealAgents] = useState({});
  const [actions, setActions] = useState([]);
  const [busyAgentId, setBusyAgentId] = useState("");
  const [busyCommittee, setBusyCommittee] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [committeeResult, setCommitteeResult] = useState(null);
  const [flow, setFlow] = useState("new_deal");
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    fetch(`${base}/api/agents`).then(r => r.json()).then(d => { setAgents(d.agents || []); setFlows(d.flows || []); });
    if (!dealId) return;
    fetch(`${base}/api/deals/${dealId}/agents`).then(r => r.json()).then(d => setDealAgents(d.agents || {}));
    fetch(`${base}/api/deals/${dealId}/actions`).then(r => r.json()).then(d => setActions(d.actions || []));
  }, [base, dealId]);
  useEffect(load, [load]);

  async function runOne(agentId) {
    if (!dealId || busyAgentId) return;
    setBusyAgentId(agentId); setNotice("");
    try {
      const response = await fetch(`${base}/api/deals/${dealId}/agents/${agentId}/run`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `API ${response.status}`);
      setSelectedAgentId(agentId);
      load();
    } catch (error) { setNotice(error.message); }
    finally { setBusyAgentId(""); }
  }

  async function convene() {
    if (!dealId || busyCommittee) return;
    setBusyCommittee(true); setCommitteeResult(null); setNotice("");
    try {
      const response = await fetch(`${base}/api/deals/${dealId}/committee`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({flow})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `API ${response.status}`);
      setCommitteeResult(data);
      load();
    } catch (error) { setNotice(error.message); }
    finally { setBusyCommittee(false); }
  }

  async function markActionDone(actionId) {
    await fetch(`${base}/api/deals/${dealId}/actions/${actionId}/complete`, {method: "POST"});
    load();
  }

  const selectedState = selectedAgentId ? dealAgents[selectedAgentId] : null;
  const selectedMeta = agents.find(agent => agent.id === selectedAgentId);

  return <div>
    <p className="institutionalHint">Corre un agente individual o convoca el comité orquestado (flujo fijo del orquestador). Para las 40 simulaciones con equipo y evidencia dedicados, usa la biblioteca de la izquierda.</p>
    <div className="institutionalScenarioGrid">
      {agents.map(agent => {
        const state = dealAgents[agent.id];
        const statusKey = state?.status || "IDLE";
        const meta = AGENT_STATUS_META[statusKey] || AGENT_STATUS_META.IDLE;
        return <div key={agent.id} className="institutionalScenarioCard" style={{cursor: "pointer", borderColor: selectedAgentId === agent.id ? "#bd58ff" : undefined}} onClick={() => setSelectedAgentId(agent.id)}>
          <b>{agent.alias}</b>
          <p style={{fontSize: 10, color: "#7d8ba6", margin: "4px 0"}}>{agent.role}</p>
          <span className="institutionalBadge" style={{background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55`}}>{meta.label}</span>
          <button className="ghost" style={{marginTop: 8, width: "100%", fontSize: 9}} onClick={event => { event.stopPropagation(); runOne(agent.id); }} disabled={Boolean(busyAgentId)}>
            {busyAgentId === agent.id ? "ANALIZANDO…" : "RUN AGENT"}
          </button>
        </div>;
      })}
    </div>

    {selectedState && <AgentMessageBubble defaultExpanded entry={{...selectedState.lastResponse, alias: selectedMeta?.alias, reference: selectedMeta?.reference, decision: selectedState.status, confidence: selectedState.confidence, model: selectedState.model, provider: selectedState.provider, usedFallback: selectedState.usedFallback}} simulationNotice={selectedMeta?.simulationNotice}/>}

    <h3 style={{marginTop: 20}}>Convene Committee</h3>
    <div className="institutionalActions">
      <select value={flow} onChange={event => setFlow(event.target.value)} style={{background: "#0a1122", border: "1px solid #202d47", borderRadius: 8, padding: "10px 12px", color: "#cbd8ec"}}>
        {flows.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      <button className="primary" onClick={convene} disabled={busyCommittee}>{busyCommittee ? "COMITÉ EN SESIÓN (puede tardar minutos)…" : "CONVENE COMMITTEE"}</button>
    </div>

    {committeeResult && <div className="nexusTranscript" style={{marginTop: 12}}>
      {committeeResult.roleByRoleDecisions.map((entry, index) => <AgentMessageBubble key={index} animate entry={{alias: entry.alias, reference: entry.reference, decision: entry.decision, confidence: entry.confidence, team_message: entry.team_message, analysis_summary: entry.summary}} simulationNotice={agents.find(agent => agent.id === entry.agentId)?.simulationNotice}/>)}
      <div className="nexusSynthesis">
        <h4>Síntesis</h4>
        {committeeResult.agreements.map((item, index) => <div key={index} className="institutionalInvariantRow ok"><CheckCircle2 size={14}/><span>{item}</span></div>)}
        {committeeResult.disagreements.map((item, index) => <div key={index} className="institutionalInvariantRow fail"><AlertTriangle size={14}/><span>{item}</span></div>)}
        <p style={{fontSize: 11, marginTop: 8}}><b>ATLAS Executive Decision:</b> {committeeResult.atlasExecutiveDecision}</p>
      </div>
    </div>}

    <h3 style={{marginTop: 20}}>Actions</h3>
    <div className="institutionalScenarioGrid">
      {!actions.length && <p className="institutionalHint">Sin acciones generadas todavía.</p>}
      {actions.map(action => <div key={action.action_id} className="institutionalScenarioCard">
        <b style={{fontSize: 11}}>{action.description}</b>
        <p style={{fontSize: 9.5, color: "#7d8ba6", margin: "6px 0"}}>{action.type} · {action.priority} · creado por {action.created_by}</p>
        {action.status === "OPEN" ? <button onClick={() => markActionDone(action.action_id)} style={{fontSize: 9}}>MARK COMPLETE</button> : <span className="institutionalBadge full">COMPLETED</span>}
      </div>)}
    </div>

    {notice && <p className="institutionalNotice">{notice}</p>}
  </div>;
}

// The immersive "session" the user asked for — a near-full-viewport overlay (the one deliberate
// exception to the inline-tab rule everywhere else), a 40-scenario library grouped by category,
// and a chat-style transcript per session run.
// Small three-dot "thinking" indicator shown in place of an agent's bubble while its real call
// is still in flight — this is what actually makes the session read as a live conversation
// instead of a wall of text that appears all at once after the whole team finishes.
function NexusTypingBubble({alias}) {
  const initials = String(alias || "??").split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase();
  return <div className="nexusBubble nexusBubbleEnter nexusTyping" style={{"--bubbleColor": "#6e7d98"}}>
    <div className="nexusBubbleAvatar">{initials}</div>
    <div className="nexusBubbleBody">
      <div className="nexusBubbleHeader"><b>{alias}</b><em>está analizando…</em></div>
      <div className="nexusTypingDots"><span/><span/><span/></div>
    </div>
  </div>;
}

function NexusSessionOverlay({api, dealId, onClose, initialAgentFilter = null, onLiveUpdate}) {
  const base = api.replace(/\/$/, "");
  const [presets, setPresets] = useState([]);
  const [agentsRoster, setAgentsRoster] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [agentFilter, setAgentFilter] = useState(initialAgentFilter);
  const [live, setLive] = useState(null); // {evidence, transcript:[], synthesis, typingAgentId, complete}
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showQuickActions, setShowQuickActions] = useState(false);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    fetch(`${base}/api/scenario-presets`).then(r => r.json()).then(d => setPresets(d.presets || []));
    fetch(`${base}/api/agents`).then(r => r.json()).then(d => setAgentsRoster(d.agents || []));
  }, [base]);
  useEffect(() => { const close = event => { if (event.key === "Escape") onClose?.(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({behavior: "smooth", block: "end"}); }, [live?.transcript?.length, live?.typingAgentId]);
  // Surfaces this session's live state (who's typing, who already answered with what decision) to
  // the 3D agent chamber rendered elsewhere on the page, so an agent's node visibly lights up
  // there in real time while — and only while — this overlay is actually running a session.
  useEffect(() => { onLiveUpdate?.(live); }, [live]);
  useEffect(() => () => onLiveUpdate?.(null), []);

  const categories = [...new Set(presets.map(preset => preset.category))];
  const selectedPreset = presets.find(preset => preset.id === selectedPresetId);
  const filteredPresets = agentFilter ? presets.filter(preset => preset.team.includes(agentFilter)) : presets;
  const agentAlias = agentId => agentsRoster.find(agent => agent.id === agentId)?.alias || agentId;

  async function selectPreset(preset) {
    setSelectedPresetId(preset.id); setLive(null); setNotice(""); setShowQuickActions(false);
    try {
      const response = await fetch(`${base}/api/deals/${dealId}/nexus-sessions/${preset.id}`);
      if (response.ok) {
        const data = await response.json();
        setLive({evidence: data.evidence, transcript: data.transcript, synthesis: data.synthesis, typingAgentId: null, complete: true});
      }
    } catch {}
  }

  // Reads the run as a live NDJSON stream (one event per agent turn) instead of waiting for the
  // whole team to finish — each agent shows a "thinking" bubble the instant it starts, then a
  // real animated message the instant its real response lands.
  async function runSession() {
    if (!selectedPreset || busy) return;
    setBusy(true); setNotice("");
    setLive({evidence: null, transcript: [], synthesis: null, typingAgentId: null, complete: false});
    try {
      const response = await fetch(`${base}/api/deals/${dealId}/nexus-sessions/${selectedPreset.id}/run-stream`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({})});
      if (!response.ok || !response.body) throw new Error(`API ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "evidence") setLive(prev => ({...prev, evidence: event.evidence}));
          else if (event.type === "agent_start") setLive(prev => ({...prev, typingAgentId: event.agentId}));
          else if (event.type === "agent_result") setLive(prev => ({...prev, typingAgentId: null, transcript: [...prev.transcript, event.entry]}));
          else if (event.type === "synthesis_update") setLive(prev => ({...prev, synthesis: event.synthesis}));
          else if (event.type === "session_complete") setLive(prev => ({...prev, synthesis: event.session.synthesis, complete: true}));
          else if (event.type === "error") setNotice(event.message);
        }
      }
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  // Rendered via a portal straight into <body>: several ancestors in the hub's own component
  // tree use backdrop-filter/transform for their own effects, which makes them the containing
  // block for any position:fixed descendant (per the CSS spec) — without a portal, this overlay
  // would get trapped inside that ancestor's box instead of covering the real viewport, letting
  // the sidebar show through. A portal escapes the tree entirely, guaranteeing it always sits on
  // top of everything, including the left rail.
  return createPortal(<div className="nexusOverlay" role="dialog" aria-modal="true" aria-label="NEXUS Institutional Simulation Lab" onClick={onClose}>
    <section className="nexusWindow" onClick={event => event.stopPropagation()}>
      <header className="nexusHeader">
        <div className="nexusHeaderTitle"><Sparkles size={20}/><div><small>NEXUS INSTITUTIONAL SIMULATION LAB</small><h2>{presets.length} escenarios · equipo Manhattan (simulado) con IA real</h2></div></div>
        <button onClick={onClose} aria-label="Close NEXUS session">×</button>
      </header>
      <div className="nexusBody">
        <aside className="nexusLibraryRail">
          <div className="nexusAgentFilters">
            <button className={!agentFilter ? "active" : ""} onClick={() => setAgentFilter(null)}>TODOS</button>
            {agentsRoster.map(agent => <button key={agent.id} className={agentFilter === agent.id ? "active" : ""} onClick={() => setAgentFilter(agent.id)}>{agent.alias.split(" ")[0]}</button>)}
          </div>
          {categories.map(category => {
            const items = filteredPresets.filter(preset => preset.category === category);
            if (!items.length) return null;
            return <div key={category} className="nexusCategory">
              <button className="nexusCategoryHead" onClick={() => setExpandedCategory(current => current === category ? null : category)}>
                <span>{category}</span><small>{items.length}</small>
              </button>
              {expandedCategory === category && <div className="nexusCategoryList">
                {items.map(preset => <button key={preset.id} className={`nexusScenarioItem ${selectedPresetId === preset.id ? "active" : ""}`} onClick={() => selectPreset(preset)}>
                  <span className="nexusScenarioNumber">#{preset.number}</span>
                  <span className="nexusScenarioTitle">{preset.title}</span>
                </button>)}
              </div>}
            </div>;
          })}
          <button className="nexusQuickActionsToggle" onClick={() => { setShowQuickActions(true); setSelectedPresetId(null); }}>QUICK ACTIONS →</button>
        </aside>
        <main className="nexusMain">
          {!selectedPreset && !showQuickActions && <div className="nexusIntro">
            <h3>Selecciona una simulación</h3>
            <p>40 situaciones reales que el equipo de Manhattan debe resolver — desde un nuevo deal de $150M hasta una crisis institucional completa. Cada sesión llama a IA real (costo real, ~20-70s por agente en el equipo).</p>
          </div>}
          {showQuickActions && <NexusQuickActions api={api} dealId={dealId}/>}
          {selectedPreset && <div className="nexusScenarioDetail">
            <div className="nexusScenarioDetailHead">
              <small>#{selectedPreset.number} · {selectedPreset.category}</small>
              <h3>{selectedPreset.title}</h3>
              <p>{selectedPreset.situation}</p>
              <p className="nexusWhatToProve"><b>Debe demostrar:</b> {selectedPreset.whatToProve}</p>
              <div className="nexusTeamRow">{selectedPreset.team.map(agentId => {
                const tallied = live?.synthesis?.tally?.find(entry => entry.agentId === agentId);
                const meta = tallied ? AGENT_STATUS_META[tallied.decision] : null;
                return <span key={agentId} className={`nexusTeamChip ${live?.typingAgentId === agentId ? "speaking" : ""}`} style={meta ? {borderColor: meta.color, color: meta.color, background: `${meta.color}22`} : undefined}>{agentAlias(agentId)}</span>;
              })}</div>
              <button className="primary" onClick={runSession} disabled={busy}>{busy ? "SESIÓN EN VIVO…" : live?.complete ? "RE-RUN SESSION" : "RUN SESSION"}</button>
              {busy && <p className="nexusLiveProgress"><i/> {live?.transcript?.length || 0} de {selectedPreset.team.length} agentes respondieron{live?.typingAgentId ? ` · ${agentAlias(live.typingAgentId)} está analizando…` : ""}</p>}
              {notice && <p className="institutionalNotice">{notice}</p>}
            </div>
            {live && <div className="nexusSessionResults">
              {live.evidence && <div className="nexusEvidenceCard nexusBubbleEnter"><small>EVIDENCIA DETERMINÍSTICA (motor financiero, no IA)</small><pre>{JSON.stringify(live.evidence, null, 2).slice(0, 1400)}</pre></div>}
              <div className="nexusTranscript">
                {live.transcript.map((entry, index) => <AgentMessageBubble key={entry.agentId || index} entry={entry} animate simulationNotice={agentsRoster.find(agent => agent.id === entry.agentId)?.simulationNotice}/>)}
                {live.typingAgentId && <NexusTypingBubble alias={agentAlias(live.typingAgentId)}/>}
              </div>
              {live.synthesis && <div className="nexusSynthesis nexusBubbleEnter">
                <h4>{live.synthesis.settled ? "Síntesis" : `Síntesis en vivo · ${live.synthesis.respondedCount}/${live.synthesis.teamSize} ya hablaron`}</h4>
                {live.synthesis.agreements.length ? live.synthesis.agreements.map((item, index) => <div key={index} className="institutionalInvariantRow ok"><CheckCircle2 size={14}/><span>{item}</span></div>) : live.synthesis.disagreements.length ? <p className="institutionalHint">{live.synthesis.settled ? "Sin consenso unánime — el equipo se dividió." : "El equipo todavía no coincide — sigue en desacuerdo mientras hablan los que faltan."}</p> : <p className="institutionalHint">Esperando la primera postura…</p>}
                {live.synthesis.disagreements.map((item, index) => <div key={index} className="institutionalInvariantRow fail"><AlertTriangle size={14}/><span>{item}</span></div>)}
                {live.synthesis.settled && <p style={{fontSize: 11, marginTop: 8}}>{live.synthesis.nextActions.length} acciones generadas para esta sesión.</p>}
                {live.complete && <a className="primary nexusReportDownload" href={`${base}/api/deals/${dealId}/report.pdf`} target="_blank" rel="noopener noreferrer"><FileText size={14}/> DESCARGAR REPORTE PDF</a>}
              </div>}
              <div ref={transcriptEndRef}/>
            </div>}
          </div>}
        </main>
      </div>
    </section>
  </div>, document.body);
}

const NEXUS_DECISION_STATUS = {
  APPROVE: "ready", APPROVE_WITH_CONDITIONS: "ready",
  REJECT: "blocked", BLOCK: "blocked", RETURN_FOR_REWORK: "blocked"
};

// The dedicated 3D container the user asked for: not a hub tab, not an overlay you have to
// discover a small button for — a permanent chamber directly on the institutional page where each
// of the 8 Manhattan JSON agents is its own node. Double-clicking a node runs that one agent for
// real (IA real, single call) right here, with no fullscreen overlay in the way, so the node's own
// glow actually stays visible while it thinks — a fullscreen session overlay would otherwise cover
// the exact chamber it's supposed to animate. The full 40-scenario library still opens via its own
// button below, sharing NexusContext with the hub tab teaser.
function NexusAgentOrbit({api, dealId}) {
  const base = api.replace(/\/$/, "");
  const nexus = useContext(NexusContext);
  const [agents, setAgents] = useState([]);
  const [quickRun, setQuickRun] = useState(null); // {agentId, busy, result, error}
  useEffect(() => { fetch(`${base}/api/agents`).then(r => r.json()).then(d => setAgents(d.agents || [])).catch(() => {}); }, [base]);

  async function runQuickAgent(agentId) {
    if (!dealId || quickRun?.busy) return;
    setQuickRun({agentId, busy: true, result: null, error: null});
    try {
      const response = await fetch(`${base}/api/deals/${dealId}/agents/${agentId}/run`, {
        method: "POST", headers: {"content-type": "application/json"},
        body: JSON.stringify({task: "Da tu reacción breve y natural al estado actual del deal, como si acabaras de sentarte con el equipo a revisarlo — no un reporte formal."})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `API ${response.status}`);
      setQuickRun({agentId, busy: false, result: data, error: null});
    } catch (error) { setQuickRun({agentId, busy: false, result: null, error: error.message}); }
  }

  const activeAgentId = quickRun?.busy ? quickRun.agentId : (nexus?.live?.typingAgentId || null);
  const nodes = agents.map(agent => {
    const decision = quickRun?.agentId === agent.id ? quickRun.result?.decision : null;
    const busy = activeAgentId === agent.id;
    return {
      id: agent.id,
      name: agent.alias,
      network: agent.reference || "MANHATTAN TEAM",
      nodeType: "agent",
      status: busy ? "analizando" : NEXUS_DECISION_STATUS[decision] || "standby",
      uiBusy: busy,
      tagLabel: busy ? "ANALIZANDO…" : decision ? decision.replaceAll("_", " ") : "STANDBY",
      description: agent.simulationNotice || `${agent.reference || agent.alias} · simulación profesional, IA real, no la persona real.`
    };
  });

  return <section className={"panel brain3dPanel nexusBrain3dPanel " + (activeAgentId ? "speaking" : "")}>
    <div className="brain3dHeader">
      <div><small>03.6 / FINANCIAL BRAIN · COMMAND CHAMBER</small><h2>El equipo Manhattan, en vivo.</h2><p>Ocho especialistas simulados (IA real) — cada JSON de agente es este nodo. Doble click lo pone a analizar el deal ahora mismo; se ilumina aquí mientras responde de verdad. Para las 40 simulaciones completas con equipo, usa OPEN NEXUS SESSION abajo.</p></div>
      <span className="brain3dLive"><i/>{activeAgentId ? `${agents.find(a => a.id === activeAgentId)?.alias || activeAgentId} · RESPONDIENDO` : "8 AGENTES · STANDBY"}</span>
    </div>
    <Brain3DViewport bots={nodes} selectedBotId={activeAgentId} onSelect={runQuickAgent}/>
    {!dealId && <p className="institutionalHint" style={{marginTop: 12}}>Crea un deal arriba para poder poner a analizar a un agente con doble click.</p>}
    {quickRun && <div className="nexusOrbitQuickResult">
      {quickRun.busy && <NexusTypingBubble alias={agents.find(a => a.id === quickRun.agentId)?.alias || quickRun.agentId}/>}
      {quickRun.result && <AgentMessageBubble animate entry={quickRun.result} simulationNotice={agents.find(a => a.id === quickRun.agentId)?.simulationNotice}/>}
      {quickRun.error && <p className="institutionalNotice">{quickRun.error}</p>}
    </div>}
    <div className="nexusOrbitFooter"><button className="primary" onClick={() => nexus?.openSession()}><Sparkles size={14}/> OPEN NEXUS SESSION · 40 escenarios</button></div>
  </section>;
}

function GlossaryTerm({id, glossary}) {
  const [open, setOpen] = useState(false);
  const term = glossary[id];
  if (!term) return null;
  return <span className="institutionalGlossaryTerm" onClick={() => setOpen(o => !o)}>
    <HelpCircle size={12}/>
    {open && <span className="institutionalGlossaryPopover"><b>{term.label}</b><p>{term.definition}</p></span>}
  </span>;
}

const INSTITUTIONAL_SCENARIO_LABELS = {
  "unauthorized-transfer": "Unauthorized Transfer",
  "lockup-violation": "Lock-up Violation",
  "treasury-compromise": "Treasury Compromise",
  "distribution-error": "Distribution Error"
};

function InstitutionalControlPanel({api, dealId, onDealCreated}) {
  const base = api.replace(/\/$/, "");
  const [dealTypes, setDealTypes] = useState([]);
  const [glossary, setGlossary] = useState({});
  const [selectedDealType, setSelectedDealType] = useState("real-estate-spv");
  const [deal, setDeal] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [simulation, setSimulation] = useState(null);
  const [scenarios, setScenarios] = useState({});
  const [securityScore, setSecurityScore] = useState(null);
  const [networkFitData, setNetworkFitData] = useState(null);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${base}/api/deal-types`).then(r => r.json()).catch(() => ({dealTypes: []})),
      fetch(`${base}/api/glossary`).then(r => r.json()).catch(() => ({terms: []}))
    ]).then(([dt, gl]) => {
      setDealTypes(dt.dealTypes || []);
      setGlossary(Object.fromEntries((gl.terms || []).map(term => [term.id, term])));
    });
  }, [base]);

  async function loadExtras(currentDeal) {
    const [sec, net, cmp] = await Promise.all([
      fetch(`${base}/api/deals/${currentDeal.id}/security-score`).then(r => r.json()).catch(() => null),
      fetch(`${base}/api/deals/${currentDeal.id}/network-fit`).then(r => r.json()).catch(() => null),
      fetch(`${base}/api/deals/${currentDeal.id}/comparison`).then(r => r.json()).catch(() => null)
    ]);
    setSecurityScore(sec); setNetworkFitData(net); setComparison(cmp?.comparison || null);
  }

  async function loadPreset(dealTypeId) {
    setBusy("preset"); setNotice("");
    try {
      const response = await fetch(`${base}/api/deals?preset=${dealTypeId}`, {method: "POST"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || `API ${response.status}`);
      setDeal(data); setSelectedDealType(dealTypeId); setSimulation(null); setScenarios({});
      onDealCreated?.(data.id);
      await loadExtras(data);
      setNotice(`${data.name} cargado.`);
    } catch (error) { setNotice(error.message); }
    finally { setBusy(""); }
  }

  async function runSimulation() {
    if (!deal) return;
    setBusy("simulate"); setNotice("");
    try {
      const response = await fetch(`${base}/api/deals/${deal.id}/simulate`, {method: "POST"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || `API ${response.status}`);
      setSimulation(data);
      setSecurityScore(await fetch(`${base}/api/deals/${deal.id}/security-score`).then(r => r.json()));
      setNotice("Simulación base ejecutada.");
    } catch (error) { setNotice(error.message); }
    finally { setBusy(""); }
  }

  async function runScenarioAction(scenarioId) {
    if (!deal) return;
    setBusy(`scenario-${scenarioId}`); setNotice("");
    try {
      const response = await fetch(`${base}/api/deals/${deal.id}/simulate/scenario`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({scenarioId})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || `API ${response.status}`);
      setScenarios(prev => ({...prev, [scenarioId]: data}));
    } catch (error) { setNotice(error.message); }
    finally { setBusy(""); }
  }

  async function exportPackage() {
    if (!deal) return;
    setBusy("export"); setNotice("");
    try {
      const response = await fetch(`${base}/api/deals/${deal.id}/package?format=md`);
      const text = await response.text();
      const blob = new Blob([text], {type: "text/markdown"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${deal.id}-transaction-package.md`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setNotice("Digital Transaction Package exportado.");
    } catch (error) { setNotice(error.message); }
    finally { setBusy(""); }
  }

  return <section className="panel institutionalPanel">
    <div className="panelHead"><div><small>04 / DEAL BUILDER · FINANCIAL SPECIFICATION ENGINE</small><h2>Define la operación una sola vez.</h2></div>{deal && <span className="panelAction">{deal.name}</span>}</div>

    <div className="institutionalDealTypeGrid">
      {dealTypes.map(dt => <button key={dt.id} className={`institutionalDealTypeCard ${selectedDealType === dt.id ? "active" : ""}`} onClick={() => loadPreset(dt.id)} disabled={busy === "preset"}>
        <b>{dt.name}</b><small>{dt.category}</small><p>{dt.description}</p>
        <span className={dt.fullyModeled ? "institutionalBadge full" : "institutionalBadge preset"}>{dt.fullyModeled ? "FULLY MODELED" : "SIMULATED PRESET"}</span>
      </button>)}
    </div>

    {!deal && <p className="institutionalHint">Selecciona un tipo de operación para cargar el ejemplo y generar su Financial Specification.</p>}

    {deal && <>
      <div className="institutionalSpecPreview">
        <h3>Financial Specification <GlossaryTerm id="spv" glossary={glossary}/></h3>
        <div className="institutionalSpecGrid">
          <div><small>ASSET</small><b>${Number(deal.asset.valueUsd).toLocaleString()}</b><em>{deal.asset.name}</em></div>
          <div><small>VEHICLE</small><b>{deal.vehicle}</b></div>
          <div><small>INVESTORS</small><b>{deal.investors.count}</b><em>{deal.investors.eligibility}</em></div>
          <div><small>LOCK-UP <GlossaryTerm id="lockup" glossary={glossary}/></small><b>{deal.lockupMonths} months</b></div>
          <div><small>DISTRIBUTION <GlossaryTerm id="waterfall" glossary={glossary}/></small><b>{deal.distribution.frequency}</b></div>
          <div><small>CUSTODY <GlossaryTerm id="custody" glossary={glossary}/></small><b>{deal.custody.model} ({deal.custody.multisigThreshold}/{deal.custody.multisigSigners}) <GlossaryTerm id="multisig" glossary={glossary}/></b></div>
        </div>
      </div>

      <div className="institutionalActions">
        <button className="primary" onClick={runSimulation} disabled={busy === "simulate"}>{busy === "simulate" ? "SIMULATING…" : "RUN 12-MONTH SIMULATION"}</button>
        <button className="ghost" onClick={exportPackage} disabled={busy === "export" || !simulation}><Download size={14}/> EXPORT TRANSACTION PACKAGE</button>
      </div>

      {simulation && <div className="institutionalSimulationResults">
        <h3>Digital Twin — {simulation.fullyModeled ? "Base Case" : "Simulated Preset"}</h3>
        {!simulation.fullyModeled && <p className="institutionalHint">{simulation.note}</p>}
        <div className="institutionalTotalsRow">
          <div><small>NOI / CASHFLOW</small><b>${simulation.totals.noiUsd.toLocaleString()}</b></div>
          <div><small>FEES</small><b>${simulation.totals.managementFeeUsd.toLocaleString()}</b></div>
          <div><small>RESERVE <GlossaryTerm id="reserve" glossary={glossary}/></small><b>${simulation.totals.reserveContributionUsd.toLocaleString()}</b></div>
          <div><small>DEBT SERVICE <GlossaryTerm id="debtService" glossary={glossary}/></small><b>${simulation.totals.debtServiceUsd.toLocaleString()}</b></div>
          <div><small>DISTRIBUTED</small><b>${simulation.totals.distributedCashUsd.toLocaleString()}</b></div>
        </div>
        <div className="institutionalInvariants">
          <h4>Financial Invariants</h4>
          {simulation.invariants.map(item => <div key={item.id} className={`institutionalInvariantRow ${item.satisfied ? "ok" : "fail"}`}>{item.satisfied ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}<span>{item.description}</span></div>)}
        </div>
      </div>}

      <div className="institutionalScenarios">
        <h3>Adversarial Scenarios</h3>
        <div className="institutionalScenarioGrid">
          {Object.keys(INSTITUTIONAL_SCENARIO_LABELS).map(id => { const result = scenarios[id]; return <div key={id} className="institutionalScenarioCard">
            <b>{INSTITUTIONAL_SCENARIO_LABELS[id]}</b>
            <button onClick={() => runScenarioAction(id)} disabled={busy === `scenario-${id}` || !deal}>{busy === `scenario-${id}` ? "RUNNING…" : "RUN SCENARIO"}</button>
            {result && <div className="institutionalScenarioResult"><span>{result.result}</span><p>{result.reason}</p></div>}
          </div>; })}
        </div>
      </div>

      {securityScore && <div className="institutionalSecurity">
        <h3>Security Readiness: {securityScore.score}/100</h3>
        <div className="institutionalChecklist">
          {securityScore.checklist.map(item => <div key={item.id} className={`institutionalInvariantRow ${item.satisfied ? "ok" : "fail"}`}>{item.satisfied ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}<span>{item.label}</span></div>)}
          <div className="institutionalInvariantRow fail"><AlertTriangle size={14}/><span>External Audit — {securityScore.externalAudit}</span></div>
        </div>
        <div className="institutionalDeployStatus">
          <span className="institutionalBadge locked"><Lock size={12}/> PRODUCTION DEPLOYMENT LOCKED</span>
          <span className="institutionalBadge preset">TESTNET DEPLOYMENT AVAILABLE (SIMULATED)</span>
        </div>
      </div>}

      {networkFitData && <div className="institutionalNetworkFit">
        <h3>Network Intelligence</h3>
        {networkFitData.results.map(result => <div key={result.networkId} className="institutionalNetworkRow">
          <b>{result.name}</b>
          <div className="institutionalNetworkBar"><span style={{width: `${result.matchPct}%`}}/></div>
          <em>{result.matchPct}% match</em>
          <p>{result.strengths.join(" · ")}</p>
        </div>)}
      </div>}

      {comparison && <div className="institutionalComparison">
        <h3>Compare Implementations</h3>
        <div className="institutionalComparisonScroll"><table className="institutionalComparisonTable">
          <thead><tr><th>Requirement</th><th>EVM</th><th>Stellar</th><th>Canton</th></tr></thead>
          <tbody>{comparison.map(row => <tr key={row.requirement}><td>{row.requirement}</td><td>{row.evm}</td><td>{row.stellar}</td><td>{row.canton}</td></tr>)}</tbody>
        </table></div>
      </div>}
    </>}

    {notice && <p className="institutionalNotice">{notice}</p>}
  </section>;
}

function InstitutionalEcosystemPanel({tools = [], api, dealId, onOpen}) {
  const base = api.replace(/\/$/, "");
  const [activeId, setActiveId] = useState(tools[0]?.id || "");
  const active = tools.find(tool => tool.id === activeId) || tools[0];
  const [snippet, setSnippet] = useState("");
  useEffect(() => {
    if (!active || !dealId) { setSnippet(""); return; }
    fetch(`${base}/api/deals/${dealId}/contracts/${active.adapterId}`).then(r => r.json()).then(data => setSnippet(data.contracts?.[0]?.code || "")).catch(() => setSnippet(""));
  }, [active, dealId, base]);
  if (!active) return null;
  const ActiveIcon = active.Icon;
  return <section className="panel institutionalEcosystemPanel" id="institutional-ecosystem">
    <div className="ecosystemHeader"><div><small>05 / CHAIN ADAPTERS · EVM · STELLAR · CANTON</small><h2>La misma especificación, tres implementaciones.</h2><p>No traducimos línea por línea entre lenguajes: traducimos la Financial Specification a tres implementaciones distintas.</p></div><span><i/>{tools.length} ADAPTERS</span></div>
    <div className="ecosystemLayout">
      <div className="ecosystemToolGrid">{tools.map(tool => { const ToolIcon = tool.Icon; return <button key={tool.id} className={`ecosystemToolCard ${active.id === tool.id ? "active" : ""}`} onClick={() => setActiveId(tool.id)} style={{"--toolAccent": tool.accent}}><span className="ecosystemToolIcon"><ToolIcon size={17}/></span><span><small>{tool.category}</small><b>{tool.shortName}</b><em>{tool.network}</em></span></button>; })}</div>
      <article className="ecosystemPreview" style={{"--toolAccent": active.accent}}>
        <div className="ecosystemPreviewTop"><div><span className="ecosystemPreviewIcon"><ActiveIcon size={18}/></span><span><small>{active.category} · {active.network}</small><b>{active.name}</b></span></div><span className={dealId ? "previewLive" : "previewProtected"}><i/>{dealId ? "CODE PREVIEW" : "NO DEAL LOADED"}</span></div>
        <div className="ecosystemFrameShell institutionalCodeShell">
          {dealId ? <pre className="institutionalCodePreview">{snippet || "Cargando…"}</pre> : <div className="ecosystemProtected"><FileCode size={34}/><b>SIN DEAL ACTIVO</b><p>Carga un tipo de operación en el Deal Builder para generar código real.</p></div>}
          <button className="ecosystemPreviewShield" onClick={() => onOpen?.(active.id)} aria-label={`Abrir ${active.name}`}/>
        </div>
        <div className="ecosystemPreviewFoot"><p>{active.description}</p><div><button onClick={() => onOpen?.(active.id)}><Maximize2 size={13}/> OPEN FULL VIEW</button></div></div>
      </article>
    </div>
  </section>;
}

function InstitutionalAdapterPanel({tool, api, dealId, onClose}) {
  useEffect(() => { const close = event => { if (event.key === "Escape") onClose?.(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!tool || !dealId) { setContracts([]); return; }
    setLoading(true);
    const base = api.replace(/\/$/, "");
    fetch(`${base}/api/deals/${dealId}/contracts/${tool.adapterId}`).then(r => r.json()).then(data => setContracts(data.contracts || [])).catch(() => setContracts([])).finally(() => setLoading(false));
  }, [tool, dealId, api]);
  if (!tool) return null;
  const ToolIcon = tool.Icon;
  return <div className="financeToolOverlay" role="dialog" aria-modal="true" aria-label={`${tool.name} generated code`} onClick={onClose}>
    <section className="financeToolWindow institutionalAdapterWindow" onClick={event => event.stopPropagation()} style={{"--toolAccent": tool.accent}}>
      <header><div><span><ToolIcon size={18}/></span><div><small>CHAIN ADAPTER · {tool.category}</small><h2>{tool.name}</h2><p>{tool.network} · {tool.description}</p></div></div><div><button onClick={onClose} aria-label="Close adapter view">×</button></div></header>
      <div className="institutionalAdapterBody">
        {!dealId && <div className="financeToolProtected"><span><ToolIcon size={44}/></span><small>NO DEAL LOADED</small><h3>Construye una operación primero</h3><p>Carga un tipo de operación en el Deal Builder para generar el código {tool.language} correspondiente.</p></div>}
        {dealId && loading && <p className="institutionalHint">Generando código…</p>}
        {dealId && !loading && contracts.map(contract => <div key={contract.id} className="institutionalContractBlock">
          <div className="institutionalContractHeader"><b>{contract.filename}</b><small>{contract.name}</small></div>
          <pre className="institutionalCodePreview">{contract.code}</pre>
        </div>)}
      </div>
      <footer><span><i/> CODE GENERATION ONLY</span><span>No compiler/toolchain or testnet transaction is invoked in this build</span></footer>
    </section>
  </div>;
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

function Brain3DViewport({bots = [], central, selectedBotId = null, onSelect, onOpenTool}) {
  const mountRef = useRef(null), shellRef = useRef(null), cameraRef = useRef(null), controlsRef = useRef(null), selectRef = useRef(onSelect), openToolRef = useRef(onOpenTool), hoverRef = useRef(null), selectedRef = useRef(selectedBotId), botsRef = useRef(bots), focusDistanceRef = useRef(3.25);
  const [loadStatus, setLoadStatus] = useState("online"), [fullscreen, setFullscreen] = useState(false), [hovered, setHovered] = useState(null), [focusedBotId, setFocusedBotId] = useState(selectedBotId);
  const effectiveFocusedBotId = focusedBotId || selectedBotId;
  selectRef.current = onSelect; openToolRef.current = onOpenTool; selectedRef.current = effectiveFocusedBotId; botsRef.current = bots;
  const botSignature = bots.map(bot => bot.id).join("|");
  useEffect(() => { if (selectedBotId) { setFocusedBotId(selectedBotId); focusDistanceRef.current = 3.25; } }, [selectedBotId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const records = botsRef.current.length ? botsRef.current : Array.from({length: 16}, (_, index) => ({id: "bot-" + (index + 1), name: "BOT " + String(index + 1).padStart(2, "0"), status: "WAITING", active: false}));
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#01040b", .021);
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    camera.position.set(0, .18, 9.6);
    cameraRef.current = camera;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: "high-performance"}); }
    catch { setLoadStatus("fallback"); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.domElement.className = "brain3dCanvas";
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", `${brainTheme.name} 3D command chamber with ${records.length} connected modules`);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .075;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 2.35;
    controls.maxDistance = 16;
    controls.target.set(0, .05, 0);
    controlsRef.current = controls;
    scene.add(new THREE.HemisphereLight("#c9faff", "#030719", 1.05));
    const key = new THREE.PointLight("#36eaff", 12, 16, 2);
    key.position.set(3.4, 4.2, 4.5);
    scene.add(key);
    const fill = new THREE.PointLight("#785dff", 8, 15, 2);
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
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false}));
      sprite.scale.set(size, size, 1); sprite.userData.texture = texture; sprite.userData.baseOpacity = opacity;
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

    const softParticleCanvas = document.createElement("canvas");
    softParticleCanvas.width = 64; softParticleCanvas.height = 64;
    const softParticleContext = softParticleCanvas.getContext("2d");
    const softParticleGradient = softParticleContext.createRadialGradient(32, 32, 1, 32, 32, 31);
    softParticleGradient.addColorStop(0, "rgba(255,255,255,.88)");
    softParticleGradient.addColorStop(.2, "rgba(255,255,255,.5)");
    softParticleGradient.addColorStop(.55, "rgba(255,255,255,.13)");
    softParticleGradient.addColorStop(1, "rgba(255,255,255,0)");
    softParticleContext.fillStyle = softParticleGradient;
    softParticleContext.fillRect(0, 0, 64, 64);
    const softParticleTexture = new THREE.CanvasTexture(softParticleCanvas);

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
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({map: softParticleTexture, color: "#6beaff", size: .075, transparent: true, opacity: .26, alphaTest: .01, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true})));

    const volumeGroup = new THREE.Group();
    world.add(volumeGroup);
    [
      {color: brainTheme.color, size: 5.4, opacity: .075, position: [-.65, .35, -.75]},
      {color: "rgba(104, 79, 255, .9)", size: 4.7, opacity: .065, position: [.9, -.35, -.35]},
      {color: "rgba(37, 220, 244, .85)", size: 4.2, opacity: .055, position: [.15, .9, .5]}
    ].forEach(layer => {
      const mist = makeAura(layer.color, layer.size, layer.opacity);
      mist.position.set(...layer.position);
      volumeGroup.add(mist);
    });
    const volumeDustGeometry = new THREE.BufferGeometry();
    const volumeDustPositions = new Float32Array(240 * 3);
    for (let index = 0; index < volumeDustPositions.length; index += 3) {
      const radius = 1.35 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const vertical = (Math.random() - .5) * 2.8;
      volumeDustPositions[index] = Math.cos(theta) * radius;
      volumeDustPositions[index + 1] = vertical;
      volumeDustPositions[index + 2] = Math.sin(theta) * radius * .72;
    }
    volumeDustGeometry.setAttribute("position", new THREE.BufferAttribute(volumeDustPositions, 3));
    const volumeDust = new THREE.Points(volumeDustGeometry, new THREE.PointsMaterial({map: softParticleTexture, color: "#65dff2", size: .095, transparent: true, opacity: .12, alphaTest: .005, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true}));
    volumeGroup.add(volumeDust);

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
    const statusColor = bot => { if(bot?.nodeType === "tool")return bot.accent || "#55e8ff";if(bot?.uiBusy)return "#55e8ff";const status = String(bot.readiness?.runtime?.stage || bot.readiness?.stage || bot.status || (bot.active ? "ACTIVE" : "PAUSED")).toLowerCase(); if (status.includes("recovery") || status.includes("attention") || status.includes("block") || status.includes("error") || status.includes("degraded") || status.includes("review")) return "#ff789b"; return status.includes("running") || status.includes("paper_ready") || status.includes("proven") || status.includes("scan") || status.includes("ready") || status.includes("active") ? "#5be6b0" : "#f2bd69"; };
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
      "tool-solana-launchpad": "solana", "tool-telegram-suite": "pulse", "tool-defi-social-club": "hub",
      "tool-community-forge": "cycle", "tool-nexus-defi": "bolt", "tool-solana-liquidity": "solana",
      "tool-arb-scanner": "radar", "tool-multichain-command": "hub",
      "MG-A1-ATLAS": "target", "MG-A2-ORBIT": "cycle", "MG-A3-PRISM": "shield", "MG-A4-FORGE": "bolt",
      "MG-A5-QUANTUM": "percent", "MG-A6-VOYAGER": "trend", "MG-A7-CAPITAL": "bank", "MG-A8-NEXUS": "hub",
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
      const plateGradient = ctx.createRadialGradient(cx - 22, cy - 28, 6, cx, cy, 96);
      plateGradient.addColorStop(0, "rgba(25, 38, 58, .98)");
      plateGradient.addColorStop(.55, "rgba(6, 14, 30, .98)");
      plateGradient.addColorStop(1, "rgba(2, 7, 18, .96)");
      ctx.fillStyle = plateGradient;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) { const a = Math.PI / 6 + i * Math.PI / 3; const x = cx + Math.cos(a) * 87, y = cy + Math.sin(a) * 87; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.globalAlpha = .82;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) { const a = Math.PI / 6 + i * Math.PI / 3; const x = cx + Math.cos(a) * 88, y = cy + Math.sin(a) * 88; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 7;
      drawBotIcon(ctx, cx, cy, 52, type, color);
      ctx.restore();
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, depthWrite: false, blending: THREE.NormalBlending, toneMapped: false}));
      sprite.scale.set(.31, .31, 1); sprite.userData.texture = texture;
      return sprite;
    };
    const createArtifact = (index, identityColor, stateColor, bot) => {
      const artifact = new THREE.Group();
      const halo = new THREE.Mesh(new THREE.TorusGeometry(.17, .004, 8, 64), new THREE.MeshBasicMaterial({color: identityColor, transparent: true, opacity: .42, blending: THREE.AdditiveBlending, depthWrite: false}));
      halo.rotation.x = Math.PI / 2; halo.position.y = -.16; artifact.add(halo);
      const core = makeAura(identityColor, .34, .16); core.position.y = .02; artifact.add(core);
      const frameGlow = new THREE.Mesh(new THREE.TorusGeometry(.158, .014, 8, 64), new THREE.MeshBasicMaterial({color: stateColor, transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false})); artifact.add(frameGlow);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(.158, .006, 8, 64), new THREE.MeshBasicMaterial({color: stateColor, transparent: true, opacity: .82, blending: THREE.AdditiveBlending, depthWrite: false})); artifact.add(frame);
      const frame2Glow = new THREE.Mesh(new THREE.TorusGeometry(.203, .011, 8, 56), new THREE.MeshBasicMaterial({color: identityColor, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false})); frame2Glow.rotation.x = Math.PI / 2.4; artifact.add(frame2Glow);
      const frame2 = new THREE.Mesh(new THREE.TorusGeometry(.203, .0045, 8, 56), new THREE.MeshBasicMaterial({color: identityColor, transparent: true, opacity: .66, blending: THREE.AdditiveBlending, depthWrite: false})); frame2.rotation.x = Math.PI / 2.4; artifact.add(frame2);
      const plate = makeIconPlate(bot, identityColor); plate.position.y = .01; artifact.add(plate);
      for (let spoke = 0; spoke < 3; spoke += 1) { const dot = new THREE.Mesh(new THREE.SphereGeometry(.011, 8, 8), new THREE.MeshBasicMaterial({color: identityColor, transparent: true, opacity: .72, blending: THREE.AdditiveBlending})); const a = spoke * Math.PI * 2 / 3; dot.position.set(Math.cos(a) * .17, .01 + Math.sin(a * 2) * .035, Math.sin(a) * .17); artifact.add(dot); }
      artifact.userData.frame = frame; artifact.userData.frameGlow = frameGlow; artifact.userData.frame2 = frame2; artifact.userData.frame2Glow = frame2Glow; artifact.userData.plate = plate;
      return artifact;
    };
    const makePnlLabel = (amount, label = "") => {
      const positive = amount > .005,negative=amount < -.005,color=positive?"#6dffc1":negative?"#ff789b":"#9fb0c9",border=positive?"rgba(92, 255, 191, .9)":negative?"rgba(255, 120, 155, .9)":"rgba(151, 171, 201, .65)",background=positive?"rgba(3, 31, 30, .88)":negative?"rgba(43, 9, 25, .9)":"rgba(10, 20, 38, .9)";
      const canvas = document.createElement("canvas");
      canvas.width = 360; canvas.height = 80;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = background; context.strokeStyle = border; context.lineWidth = 2; context.beginPath(); context.roundRect(3, 3, 354, 74, 18); context.fill(); context.stroke();
      context.fillStyle = color; context.font = "700 26px DM Mono, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label || `${positive ? "+" : ""}${amount.toFixed(2)} USD`, 180, 40);
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
      const color = statusColor(bot), identityColor = bot.accent || palette[index % palette.length]; const artifact = createArtifact(index, identityColor, color, bot); node.add(artifact); node.add(makeNameLabel(bot, color));
      const pnl = botProfit24h(bot),pnlLabel=makePnlLabel(pnl, bot.nodeType === "tool" ? "PLATFORM LINK" : bot.nodeType === "agent" ? (bot.tagLabel || "SIMULATED AGENT") : "");node.add(pnlLabel);node.userData.lastPnl=pnl;
      const routePoints = [new THREE.Vector3(0, .12, 0), new THREE.Vector3(position.x * .42, position.y * .7 + .12, position.z * .42), position.clone().setY(position.y - .08)];
      const route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(routePoints), new THREE.LineBasicMaterial({color, transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false})); routeGroup.add(route);
      const pulse = new THREE.Sprite(new THREE.SpriteMaterial({map: softParticleTexture, color, transparent: true, opacity: .68, blending: THREE.AdditiveBlending, depthWrite: false})); pulse.scale.set(.11, .11, 1); routeGroup.add(pulse);
      lanes.add(node); nodeRecords.push({botId:bot.id,node,artifact,pnlLabel,route,routePoints,pulse,speed: .08 + (index % 4) * .018,color,identityColor});
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
      const material = new THREE.LineBasicMaterial({color: "#e3faff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
      const line = new THREE.Line(new THREE.BufferGeometry(), material);
      const boltGlow = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({color: i % 2 ? "#806cff" : "#39dcff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
      boltGlow.visible = false;
      boltGroup.add(boltGlow, line);
      bolts.push({line, glow:boltGlow, a: entry.position, b: nodePositions[nearest].position, flashAt: Math.random() * 3, fadeEnd: 0});
    });

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const lastPointer = {x: 0, y: 0},pointerDown={x:0,y:0};
    let lastClickedBot = null;
    const handlePointerMove = event => {
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(rayTargets, false)[0];
      const hitBot = hit?.object?.userData?.bot || null;
      const bot = botsRef.current.find(item => item.id === hitBot?.id) || hitBot;
      hoverRef.current = bot;
      setHovered(current => current?.id === bot?.id ? current : bot);
    };
    const handlePointerLeave = () => { hoverRef.current = null; setHovered(null); };
    const handlePointerDown=event=>{pointerDown.x=event.clientX;pointerDown.y=event.clientY;};
    const pickBot = event => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(rayTargets, false)[0]?.object?.userData?.bot || null;
    };
    const handleClick = event => {
      if(Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)>7)return;
      const bot = pickBot(event);
      lastClickedBot = bot;
      setFocusedBotId(bot?.id || null);
      selectedRef.current = bot?.id || null;
      if (bot?.id) focusDistanceRef.current = 3.25;
    };
    const handleDoubleClick = event => {
      event.preventDefault();
      const bot = pickBot(event) || lastClickedBot;
      if (!bot?.id) return;
      setFocusedBotId(bot.id);
      selectedRef.current = bot.id;
      focusDistanceRef.current = 3.25;
      if (bot.nodeType === "tool") openToolRef.current?.(bot.id);
      else selectRef.current?.(bot.id);
    };
    const handleKeyDown = event => {
      if (!['ArrowLeft','ArrowRight','Enter',' '].includes(event.key)) return;
      event.preventDefault();
      const rows=botsRef.current.length?botsRef.current:records,currentIndex=Math.max(0,rows.findIndex(bot=>bot.id===selectedRef.current));
      if(event.key==='Enter'||event.key===' '){const item=rows[currentIndex];if(item?.id){if(item.nodeType==="tool")openToolRef.current?.(item.id);else selectRef.current?.(item.id);}return;}
      const step=event.key==='ArrowRight'?1:-1,next=(currentIndex+step+rows.length)%rows.length;
      if(rows[next]?.id){setFocusedBotId(rows[next].id);selectedRef.current=rows[next].id;focusDistanceRef.current=3.25;}
    };
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);
    renderer.domElement.addEventListener("keydown", handleKeyDown);

    const resize = () => {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(320, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    window.addEventListener("resize", resize);
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);
    resize();
    let frame;
    const clock = new THREE.Clock();
    const focusPoint = new THREE.Vector3(), focusDirection = new THREE.Vector3(), desiredCamera = new THREE.Vector3(), chamberCenter = new THREE.Vector3(0, .05, 0);
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      brainRoot.rotation.y = Math.sin(elapsed * .16) * .075;
      brainRoot.rotation.x = Math.sin(elapsed * .12) * .022;
      brainCore.material.opacity = .92 + Math.sin(elapsed * 1.1) * .06;
      const coreBreath = 1 + Math.sin(elapsed * .7) * .012;
      brainCore.scale.set(3 * coreBreath, 3 * coreBreath, 1);
      volumeGroup.rotation.y = -elapsed * .018;
      volumeDust.rotation.y = elapsed * .026;
      volumeDust.material.opacity = .09 + Math.sin(elapsed * .42) * .02;
      volumeGroup.children.forEach((layer,index) => {
        if (!layer.isSprite) return;
        const base = layer.userData.baseOpacity || .05;
        layer.material.opacity = base * (1 + Math.sin(elapsed * (.28 + index * .035) + index) * .18);
      });
      lanes.rotation.y = elapsed * .024;
      bolts.forEach(bolt => {
        if (elapsed >= bolt.flashAt) {
          const points = buildBoltPoints(bolt.a, bolt.b, 8, .17);
          bolt.line.geometry.dispose();
          bolt.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
          bolt.glow.geometry.dispose();
          bolt.glow.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, .013, 4, false);
          bolt.fadeEnd = elapsed + .3;
          bolt.flashAt = elapsed + 1.3 + Math.random() * 2.6;
        }
        const remaining = bolt.fadeEnd - elapsed;
        const flash = remaining > 0 ? Math.max(0, remaining / .3) : 0;
        bolt.line.material.opacity = flash * .72;
        bolt.glow.material.opacity = flash * .16;
        bolt.glow.visible = flash > 0;
      });
      const focusRecord=nodeRecords.find(record=>record.botId===selectedRef.current);
      nodeRecords.forEach(record => {const {botId,node,artifact,route,routePoints,pulse,speed}=record;
        const liveBot=botsRef.current.find(bot=>bot.id===botId)||node.userData.bot;node.userData.bot=liveBot;
        const livePnl=botProfit24h(liveBot);if(liveBot.nodeType!=="tool"&&liveBot.nodeType!=="agent"&&Math.abs(livePnl-node.userData.lastPnl)>.004){node.remove(record.pnlLabel);record.pnlLabel.material.map?.dispose();record.pnlLabel.material.dispose();record.pnlLabel=makePnlLabel(livePnl);node.add(record.pnlLabel);node.userData.lastPnl=livePnl;}
        if(liveBot.nodeType==="agent"&&liveBot.tagLabel!==node.userData.lastTagLabel){node.remove(record.pnlLabel);record.pnlLabel.material.map?.dispose();record.pnlLabel.material.dispose();record.pnlLabel=makePnlLabel(0,liveBot.tagLabel||"STANDBY");node.add(record.pnlLabel);node.userData.lastTagLabel=liveBot.tagLabel;}
        const selected = (selectedRef.current&&botId===selectedRef.current)||(hoverRef.current?.id&&botId===hoverRef.current.id);
        const liveColor=statusColor(liveBot);artifact.userData.frame.material.color.set(liveColor);artifact.userData.frameGlow.material.color.set(liveColor);route.material.color.set(liveColor);pulse.material.color.set(liveColor);route.material.opacity=selected ? .72 : .18;
        node.position.y = node.userData.anchor.y + Math.sin(elapsed * 1.05 + node.userData.phase) * .045;
        node.rotation.y = elapsed * .17 + node.userData.phase;
        node.scale.setScalar(selected ? 1.26 : 1 + Math.sin(elapsed * 1.8 + node.userData.phase) * .035);
        artifact.rotation.z = Math.sin(elapsed * .8 + node.userData.phase) * .12;
        artifact.userData.frame.rotation.z += selected ? .011 : .0035;
        artifact.userData.frame2.rotation.x += selected ? .007 : .002;
        artifact.userData.frameGlow.rotation.z = artifact.userData.frame.rotation.z;
        artifact.userData.frame2Glow.rotation.x = artifact.userData.frame2.rotation.x;
        artifact.userData.frameGlow.material.opacity = selected ? .3 : .14 + Math.sin(elapsed * 1.15 + node.userData.phase) * .035;
        artifact.userData.frame2Glow.material.opacity = selected ? .25 : .11 + Math.sin(elapsed * .9 + node.userData.phase) * .025;
        const routeT = (elapsed * (speed || .1) + (node.userData.phase % 1)) % 1;
        pulse.position.copy(new THREE.CatmullRomCurve3(routePoints).getPoint(routeT));
      });
      if(focusRecord){
        focusRecord.node.getWorldPosition(focusPoint);
        focusDirection.subVectors(camera.position,controls.target);
        if(focusDirection.lengthSq()<.001)focusDirection.set(0,.18,1);
        focusDirection.normalize();
        desiredCamera.copy(focusPoint).addScaledVector(focusDirection,focusDistanceRef.current);
        controls.target.lerp(focusPoint,.105);
        camera.position.lerp(desiredCamera,.075);
      }else controls.target.lerp(chamberCenter,.035);
      platform.rotation.z = elapsed * .035; platformInner.rotation.z = -elapsed * .07;
      glow.material.opacity = .08 + Math.sin(elapsed * 1.4) * .025;
      aura.material.opacity = .5 + Math.sin(elapsed * 1.1) * .08;
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
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      renderer.domElement.removeEventListener("keydown", handleKeyDown);
      controls.dispose();
      scene.traverse(object=>{object.geometry?.dispose?.();const materials=Array.isArray(object.material)?object.material:[object.material];materials.filter(Boolean).forEach(material=>{material.map?.dispose?.();material.dispose?.();});});
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [botSignature]);

  const zoom = factor => { const camera = cameraRef.current, controls = controlsRef.current; if (!camera || !controls) return; if (effectiveFocusedBotId) focusDistanceRef.current = Math.min(9, Math.max(2.4, focusDistanceRef.current * factor)); else { const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor); camera.position.copy(controls.target).add(offset); } controls.update(); };
  const toggleFullscreen = async () => { const target = shellRef.current?.closest(".app") || shellRef.current; if (!target) return; if (document.fullscreenElement) await document.exitFullscreen(); else await target.requestFullscreen?.(); };
  const selected = hovered || bots.find(bot => bot.id === effectiveFocusedBotId) || null;
  const status = String(selected?.status || ((selected?.active ?? selected?.enabled) ? "ACTIVE" : "PAUSED")).toUpperCase();
  const moduleCount = bots.length || 16;
  const selectedEvidence=selected?.readiness?.validation,selectedRuntime=selected?.readiness?.runtime?.stage||selected?.readiness?.stage;
  return <div className={`brain3dCanvasShell ${effectiveFocusedBotId ? "hasPinnedBot" : ""}`} ref={shellRef}>{loadStatus === "fallback" && <img className="brain3dFallback" src={brainCoreUrl} alt={`${brainTheme.name} preview`}/>}<div className="brain3dCanvasMount" ref={mountRef}/><div className="brain3dCanvasHud"><span><i className={"brain3dStatusDot " + loadStatus}/>{loadStatus === "online" ? effectiveFocusedBotId ? "NODE LINK · FOCUSED" : "COMMAND CHAMBER · ONLINE" : "3D FALLBACK · WEBGL UNAVAILABLE"}</span><small>{moduleCount} MODULES · SIGNAL ROUTES ACTIVE</small><small>CLICK FOCUS · DOUBLE CLICK OPEN · WHEEL ZOOM · ARROWS SELECT</small></div><div className="brain3dControls"><button onClick={() => zoom(.82)} aria-label="Zoom in">+</button><button onClick={() => zoom(1.22)} aria-label="Zoom out">−</button><button onClick={toggleFullscreen} aria-label="Toggle fullscreen">{fullscreen ? "×" : "⛶"}</button></div>{selected && <div className={`brainBotFloat ${selected.nodeType === "tool" ? "toolNode" : ""}`} role="dialog" aria-label={`${selected.nodeType === "tool" ? "Plataforma" : "Reporte"} ${selected.name || selected.id}`}><div className="brainBotFloatTop"><span><i className={"brain3dStatusDot " + String(selected.nodeType === "tool" ? "online" : selectedRuntime || status).toLowerCase()}/>{selected.nodeType === "tool" ? "EXTERNAL PLATFORM · LINKED" : `${selectedRuntime?.replaceAll("_"," ") || status} · LIVE MODULE REPORT`}</span><button onClick={() => selected.nodeType === "tool" ? onOpenTool?.(selected.id) : onSelect?.(selected.id)}>{selected.nodeType === "tool" ? "OPEN EMBED" : selectedBotId === selected.id ? "CONTROL OPEN" : "OPEN CONTROL"}</button></div><h3>{selected.name || selected.id}</h3><p>{selected.description || botDescription(selected)}</p><div className="brainBotMetrics">{selected.nodeType === "tool" ? <><span><small>TYPE</small><b>PLATFORM</b></span><span><small>NETWORK</small><b>{selected.network}</b></span><span><small>ACCESS</small><b>{selected.embeddable ? "EMBED" : "DIRECT"}</b></span></> : kind === "finance" ? <><span><small>READINESS</small><b>{Number(selected.readiness?.score||0).toFixed(0)}/100</b></span><span><small>VALIDATION</small><b>{selectedEvidence?.stage?.replaceAll("_"," ")||"SYNCING"}</b></span><span><small>EVIDENCE</small><b>{selectedEvidence?.target?`${selectedEvidence.evidence||0}/${selectedEvidence.target}`:"N/A"}</b></span></> : <><span><small>STATUS</small><b>{selected.status || (selected.enabled === false ? "PAUSED" : "ACTIVE")}</b></span><span><small>SIGNALS</small><b>{selected.metrics?.signals ?? selected.signals ?? "—"}</b></span><span><small>CONFIDENCE</small><b>{selected.metrics?.confidence ? `${selected.metrics.confidence}%` : "—"}</b></span></>}</div><div className="brainBotSignal"><small>{selected.nodeType === "tool" ? `${selected.category} · ${selected.embeddable ? "preview y workspace disponibles" : "acceso directo protegido"}` : selected.lastError || selected.lastAction || selected.readiness?.blockers?.[0] || selected.readiness?.warnings?.[0] || selected.readiness?.nextAction || selected.status || "Observando señales y esperando el siguiente ciclo."}</small></div></div>}</div>;
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
    return <div className={this.props.embedded ? "botControlDock" : "botControlOverlay"} onClick={this.props.embedded ? undefined : this.props.onClose}><section className="botControlModal botControlCrash" onClick={event => event.stopPropagation()}><button className="botControlClose" onClick={this.props.onClose}>×</button><div className="botControlHeader"><span className="botControlOrb"><ShieldCheck size={26}/></span><div><small>BOT CONTROL · RECOVERABLE ERROR</small><h2>No se pudo abrir este bot</h2><p>El Brain sigue operativo. El panel se protegió para evitar bloquear toda la pantalla.</p></div></div><div className="botControlMessage">{this.state.error?.message || "Respuesta de datos incompatible"}</div><button className="botSaveButton" onClick={this.props.onClose}>CERRAR Y CONTINUAR</button></section></div>;
  }
}

function botLaunchLabel(row) {
  const launches = Array.isArray(row?.launches) ? row.launches : [];
  const discoveries = Array.isArray(row?.discoveries) ? row.discoveries : [];
  return launches[0]?.symbol || discoveries.find(item => item && typeof item === "object" && item.symbol)?.symbol || row?.symbol || row?.asset || row?.token || row?.question || "Scanner result";
}

const money=value=>`${Number(value||0).toFixed(2)} USD`;
const controlTime=value=>value?new Date(value).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—";
function BotEquityCurve({executions=[]}){
  const rows=[...executions].filter(row=>row.status==="CLOSED"&&row.paperQuality==="REAL_MARKET_QUOTE").sort((a,b)=>Date.parse(a.closedAt||a.createdAt||0)-Date.parse(b.closedAt||b.createdAt||0));
  let cumulative=0;const values=[0,...rows.map(row=>(cumulative+=Number(row.realizedProfitUsd||0)))];
  const min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min),points=values.map((value,index)=>`${(index/Math.max(1,values.length-1))*100},${46-((value-min)/range)*40}`).join(" ");
  return <div className="botEquityCurve"><div><span><small>VALIDATED EQUITY CURVE</small><b>{rows.length} REAL-QUOTE CLOSES</b></span><strong className={cumulative>=0?"positive":"negative"}>{cumulative>=0?"+":""}{money(cumulative)}</strong></div><svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-label="Validated cumulative PNL curve"><defs><linearGradient id="botCurveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--botAccent)" stopOpacity=".34"/><stop offset="1" stopColor="var(--botAccent)" stopOpacity="0"/></linearGradient></defs><polyline points={`0,50 ${points} 100,50`} fill="url(#botCurveFill)" stroke="none"/><polyline points={points} fill="none" stroke="var(--botAccent)" strokeWidth="1.7" vectorEffect="non-scaling-stroke"/></svg></div>;
}
function BotDecisionPipeline({scans=[],opportunities=[],executions=[]}){
  const latest=opportunities[0],execution=executions[0];
  const steps=[{label:"DETECTED",done:scans.length>0},{label:"AUDITED",done:Boolean(latest?.metadata?.security||latest?.metadata?.audit||latest?.risk)},{label:"SCORED",done:Boolean(latest?.brain)},{label:"APPROVED",done:latest?.risk?.approved===true},{label:"PAPER FILL",done:Boolean(execution&&["OPEN","CLOSED","FILLED"].includes(execution.status))},{label:"CLOSED",done:execution?.status==="CLOSED"}];
  const current=Math.max(0,steps.findIndex(step=>!step.done));
  return <div className="botDecisionPipeline">{steps.map((step,index)=><span className={step.done?"done":index===current?"current":"waiting"} key={step.label}><i>{step.done?"✓":String(index+1).padStart(2,"0")}</i><b>{step.label}</b></span>)}</div>;
}
function botSpecificReadout(bot,scans,opportunities){
  const scan=scans[0]||{},source=scan.data||scan,result=opportunities[0]||{},meta=result.metadata||{},kpis=scan.kpis||{};
  const common=[{label:"CANDIDATES",value:kpis.candidates??source.candidates?.length??source.discoveries?.length??0},{label:"QUALIFIED",value:kpis.qualified??source.qualified?.length??(result.id?1:0)},{label:"BLOCKED",value:kpis.blocked??source.blocked?.length??0}];
  const map={
    "solana-radar":[{label:"BIRTHS",value:kpis.births??source.births?.length??source.launches?.length??0},{label:"LIQUIDITY",value:meta.liquidityUsd?`$${Number(meta.liquidityUsd).toLocaleString()}`:"GATED"},{label:"HOLDER AUDIT",value:meta.holderConcentrationPct!=null?`${Number(meta.holderConcentrationPct).toFixed(1)}% top`:"WAITING"}],
    "solana-meme-momentum":[{label:"MOMENTUM",value:meta.momentumScore??result.brain?.score??"—"},{label:"VOLUME",value:meta.volume24h?`$${Number(meta.volume24h).toLocaleString()}`:"—"},{label:"ANTI-RUG",value:meta.securityVerified?"VERIFIED":"GATED"}],
    "polygon-meme-momentum":[{label:"MOMENTUM",value:meta.momentumScore??result.brain?.score??"—"},{label:"BUY TAX",value:meta.buyTax!=null?`${meta.buyTax}%`:"—"},{label:"HONEYPOT",value:meta.honeypot===false?"CLEAR":"GATED"}],
    arbitrage:[{label:"SPREAD",value:result.spreadBps!=null?`${Number(result.spreadBps).toFixed(1)} BPS`:"—"},{label:"NET EDGE",value:money(result.expectedProfitUsd)},{label:"ROUTE",value:meta.route||result.network||"MULTI-DEX"}],
    liquidation:[{label:"BORROWERS",value:kpis.candidates??source.candidates?.length??0},{label:"HEALTH FACTOR",value:meta.healthFactor??"—"},{label:"BONUS",value:meta.liquidationBonusPct?`${meta.liquidationBonusPct}%`:"—"}],
    volatility:[{label:"REGIME",value:meta.regime||source.regime||"OBSERVING"},{label:"EXPANSION",value:meta.expansionScore??result.brain?.score??"—"},{label:"ATR",value:meta.atrPct!=null?`${Number(meta.atrPct).toFixed(2)}%`:"—"}],
    momentum:[{label:"TREND",value:meta.trend||result.direction||"WATCH"},{label:"MOMENTUM",value:meta.momentumScore??result.brain?.score??"—"},{label:"VOLUME",value:meta.volumeRatio!=null?`${Number(meta.volumeRatio).toFixed(2)}×`:"—"}],
    perpetuals:[{label:"FUNDING",value:meta.fundingRate!=null?`${(Number(meta.fundingRate)*100).toFixed(3)}%`:"—"},{label:"BASIS",value:meta.basisPct!=null?`${Number(meta.basisPct).toFixed(2)}%`:"—"},{label:"DIRECTION",value:result.direction||"WATCH"}],
    polymarket:[{label:"MARKETS",value:kpis.candidates??source.markets?.length??source.candidates?.length??0},{label:"PROBABILITY",value:meta.probability!=null?`${(Number(meta.probability)*100).toFixed(1)}%`:"—"},{label:"EDGE",value:meta.edgePct!=null?`${Number(meta.edgePct).toFixed(2)}%`:"—"}],
    "smart-money":[{label:"WALLETS",value:source.wallets?.length??source.discoveries?.length??0},{label:"FLOW",value:meta.flowUsd?`$${Number(meta.flowUsd).toLocaleString()}`:"—"},{label:"DIRECTION",value:result.direction||"WATCH"}],
    yield:[{label:"APY",value:meta.apy!=null?`${Number(meta.apy).toFixed(2)}%`:"—"},{label:"TVL",value:meta.tvlUsd?`$${Number(meta.tvlUsd).toLocaleString()}`:"—"},{label:"PROTOCOL",value:meta.project||meta.protocol||"DEFI"}],
    allocator:[{label:"RESERVE",value:meta.reservePct!=null?`${meta.reservePct}%`:"10%"},{label:"ALLOCATED",value:money(meta.allocatedUsd||result.capitalRequiredUsd)},{label:"POLICY",value:"RISK ADJUSTED"}],
    "fx-macro-momentum":[{label:"PAIR",value:result.asset||meta.instrument||"MULTI-FX"},{label:"MACRO SCORE",value:meta.macroScore??result.brain?.score??"—"},{label:"DIRECTION",value:result.direction||"WATCH"}],
    "options-defined-risk":[{label:"STRUCTURE",value:meta.structure||result.asset||"DEFINED RISK"},{label:"MAX LOSS",value:money(meta.maxLossUsd)},{label:"CONFIDENCE",value:`${Math.round(Number(result.confidence||0)*100)}%`}],
    "crude-oil-regime":[{label:"REGIME",value:meta.regime||"OBSERVING"},{label:"SYMBOL",value:result.asset||meta.symbol||"USO"},{label:"MOVE",value:meta.movePct!=null?`${Number(meta.movePct).toFixed(2)}%`:"—"}],
    "nyse-news-impact":[{label:"HEADLINES",value:source.news?.length??source.articles?.length??0},{label:"IMPACT",value:meta.impactScore!=null?`${Math.round(Number(meta.impactScore)*100)}%`:"—"},{label:"SYMBOL",value:result.asset||meta.symbol||"—"}],
  };
  return map[bot.id]||common;
}
function HumanFacts({row}){
  const preferred=["provider","network","symbol","asset","direction","confidence","riskScore","expectedProfitUsd","netProfitUsd","latencyMs","scannedAt","createdAt"],facts=[];
  for(const key of preferred){const value=row?.[key];if(value!==undefined&&value!==null&&typeof value!=="object")facts.push([key,value]);}
  for(const [key,value] of Object.entries(row?.kpis||{})){if(facts.length>=8)break;if(typeof value!=="object")facts.push([key,value]);}
  return <div className="botHumanFacts">{facts.slice(0,8).map(([label,value])=><span key={label}><small>{label.replaceAll("_"," ").toUpperCase()}</small><b>{typeof value==="number"?Number(value.toFixed?.(4)??value):String(value)}</b></span>)}</div>;
}
function CopilotThinkingOverlay({bot,copilot,data,question}){
  const phases=[
    {label:"Conectando el modelo de razonamiento",detail:`${copilot?.status?.provider||"OpenAI"} · ${copilot?.status?.model||"GPT-5.6 Sol"}`},
    {label:"Sincronizando telemetría del bot",detail:"Scanner, señales y estado operativo"},
    {label:"Leyendo decisiones recientes",detail:"Oportunidades, bloqueos y evidencia"},
    {label:"Contrastando rendimiento",detail:"PnL validado, expectancy y drawdown"},
    {label:"Evaluando el envelope de riesgo",detail:"Readiness, límites y circuit breakers"},
    {label:"Construyendo respuesta auditable",detail:"Hallazgos, recomendaciones y propuestas"}
  ];
  const [phase,setPhase]=useState(0),[elapsed,setElapsed]=useState(0);
  useEffect(()=>{setPhase(0);setElapsed(0);const phaseTimer=setInterval(()=>setPhase(current=>Math.min(phases.length-1,current+1)),2600),clock=setInterval(()=>setElapsed(current=>current+1),1000);return()=>{clearInterval(phaseTimer);clearInterval(clock);};},[question]);
  const scans=data?.scans?.length||0,opportunities=data?.opportunities?.length||0,executions=data?.executions?.length||0,readiness=Math.round(Number(data?.readiness?.score||bot?.readiness?.score||0)),coverage=copilot?.contextCoverage;
  return <div className="copilotThinkingBackdrop" role="dialog" aria-modal="true" aria-live="polite" aria-label={`Copilot analizando ${bot.name||bot.id}`}><section className="copilotThinkingWindow" style={{"--botAccent":botMeta(bot.id).accent}}><div className="copilotThinkingTop"><span><i/> QUANT COPILOT · LIVE ANALYSIS</span><small>{String(elapsed).padStart(2,"0")}s · PAPER SAFE</small></div><div className="copilotThinkingLayout"><div className="copilotNeuralStage"><div className="copilotAmbientGrid"/><div className="copilotOrbit orbitA"><i/><i/><i/></div><div className="copilotOrbit orbitB"><i/><i/></div><div className="copilotBrainCore"><span className="copilotBrainHalo"/><img src={brainCoreUrl} alt="Finance Brain analizando"/><Brain size={50}/><b>{botMeta(bot.id).label}</b><small>CONTEXT LOCKED</small></div><svg className="copilotSignalGraph" viewBox="0 0 420 150" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="copilotGraphStroke" x1="0" x2="1"><stop offset="0" stopColor="var(--botAccent)" stopOpacity="0"/><stop offset=".45" stopColor="var(--botAccent)"/><stop offset="1" stopColor="#58e8ff" stopOpacity=".15"/></linearGradient></defs><path d="M0 112 C35 95 55 126 88 84 S142 58 174 91 S232 119 264 66 S325 34 352 70 S392 102 420 44"/><path className="ghost" d="M0 124 C54 138 64 71 115 102 S186 135 224 85 S295 79 328 104 S380 63 420 82"/></svg><div className="copilotMetricRail"><span><small>SCANS</small><b>{scans}</b></span><span><small>DECISIONS</small><b>{opportunities}</b></span><span><small>EXECUTIONS</small><b>{executions}</b></span><span><small>READINESS</small><b>{readiness}/100</b></span></div></div><div className="copilotThinkingReport"><div className="copilotThinkingIdentity"><Sparkles size={18}/><div><small>ANALYZANDO TU PREGUNTA</small><p>{question||"Preparando contexto del bot…"}</p></div></div><div className="copilotContextLine"><span><Database size={13}/>{coverage?`${coverage.connected}/${coverage.total} fuentes conectadas`:"Sincronizando fuentes"}</span><span><ShieldCheck size={13}/> Sin acceso a LIVE</span></div><div className="copilotPhaseList">{phases.map((item,index)=><article className={index<phase?"done":index===phase?"active":"waiting"} key={item.label}><span>{index<phase?"✓":String(index+1).padStart(2,"0")}</span><div><b>{item.label}</b><small>{item.detail}</small></div>{index===phase&&<em><i/><i/><i/></em>}</article>)}</div><div className="copilotThinkingFooter"><Activity size={14}/><span>El modelo está trabajando con datos reales. No se aplicará ningún cambio sin tu aprobación.</span></div></div></div></section></div>;
}
function BotCopilotPanel({bot,copilot,analysis,busy,prompt,setPrompt,onAsk,onReview,onActivate,confirmId,setConfirmId}){
  const current=analysis||copilot?.lastAnalysis,pending=(copilot?.proposals||[]).filter(row=>row.status==="PENDING"),presets=copilot?.presets||[],status=copilot?.status,coverage=copilot?.contextCoverage;
  return <section className="botCopilot"><div className="botSectionTitle"><span><MessageCircle size={14}/> QUANT COPILOT · {bot.id}</span><small>Todos los datos · PAPER approval gate</small></div><div className="botCopilotStatus"><span className={status?.configured?"ready":"fallback"}><i/>{status?.provider||"CONNECTING"} · {status?.model||"MODEL"}</span><span>{coverage?`${coverage.connected}/${coverage.total} DATA SOURCES`:"CONTEXT SYNC"}</span><span>{current?.dataFreshness||"WAITING"}</span></div><div className="botCopilotQuick">{["¿Por qué está bloqueado o en recuperación?","Resume las operaciones con evidencia real.","Propón un ajuste conservador en PAPER.","Genera un preset nuevo basado en el rendimiento."].map(question=><button key={question} onClick={()=>onAsk(question)} disabled={busy}>{question}</button>)}</div>{current&&<div className="botCopilotAnalysis"><p>{current.reply}</p>{current.findings?.length>0&&<div className="botCopilotFindings">{current.findings.map((row,index)=><article className={row.severity} key={`${row.title}-${index}`}><b>{row.title}</b><small>{row.evidence}</small></article>)}</div>}{current.recommendations?.length>0&&<div className="botCopilotRecommendations">{current.recommendations.map((row,index)=><article key={`${row.title}-${index}`}><span>{row.priority}</span><div><b>{row.title}</b><small>{row.rationale} · {row.expectedImpact}</small></div></article>)}</div>}</div>}<div className="botCopilotComposer"><input value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")onAsk();}} placeholder="Pregunta, solicita análisis o pide un preset…"/><button onClick={()=>onAsk()} disabled={busy||!prompt.trim()}>{busy?"ANALYZING…":"ASK COPILOT"}</button></div>{pending.length>0&&<div className="botCopilotQueue"><div className="botCopilotSubhead"><b>HUMAN APPROVAL QUEUE</b><small>{pending.length} pendientes · PAPER ONLY</small></div>{pending.map(row=><article key={row.id}><div><span>{row.kind.replaceAll("_"," ")}</span><b>{row.title}</b><p>{row.rationale}</p><small>{Object.entries(row.changes||{}).map(([key,value])=>`${key}: ${value}`).join(" · ")}</small></div><div><button className={confirmId===row.id?"confirm":""} onClick={()=>confirmId===row.id?onReview(row.id,"approve"):setConfirmId(row.id)}>{confirmId===row.id?"CONFIRM PAPER":"REVIEW & APPLY"}</button><button onClick={()=>onReview(row.id,"reject")}>REJECT</button></div></article>)}</div>}{presets.length>0&&<div className="botPresetShelf"><div className="botCopilotSubhead"><b>STRATEGY PRESETS</b><small>{presets.length} guardados</small></div>{presets.slice(0,6).map(row=><article className={row.active?"active":""} key={row.id}><div><b>{row.name}</b><small>{row.description||"Reusable PAPER strategy"}</small></div><button className={confirmId===`preset:${row.id}`?"confirm":""} disabled={row.active} onClick={()=>confirmId===`preset:${row.id}`?onActivate(row.id):setConfirmId(`preset:${row.id}`)}>{row.active?"ACTIVE":confirmId===`preset:${row.id}`?"CONFIRM PAPER":"ACTIVATE"}</button></article>)}</div>}</section>;
}
function BotControlModal({api, bot, onClose, onScan, onToggle, onSetExecutionMode, embedded=false}) {
  const [tab,setTab]=useState("cockpit"),[data,setData]=useState(null),[configValue,setConfigValue]=useState({enabled:true,maxAllocationPct:20,minConfidence:"",maxRiskScore:.65,minExpectedProfitUsd:5,maxSlippageBps:75,notes:""}),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[connector,setConnector]=useState(null),[proposals,setProposals]=useState([]),[lastSync,setLastSync]=useState(null),[confirmProposal,setConfirmProposal]=useState(null),[copilotPrompt,setCopilotPrompt]=useState(""),[copilotQuestion,setCopilotQuestion]=useState(""),[copilotAnalysis,setCopilotAnalysis]=useState(null),[copilotData,setCopilotData]=useState(null),[copilotMessages,setCopilotMessages]=useState([]),[confirmCopilotProposal,setConfirmCopilotProposal]=useState(null),[copilotBusy,setCopilotBusy]=useState(false);
  const configInitialized=useRef(false),meta=botMeta(bot.id),BotIcon=meta.Icon;
  useEffect(()=>{configInitialized.current=false;setData(null);setCopilotData(null);setCopilotAnalysis(null);setCopilotMessages([]);setCopilotQuestion("");setConfirmCopilotProposal(null);setTab("cockpit");setMessage("");},[bot.id]);
  const load=useCallback(async()=>{
    const fetchJson=async url=>{const response=await fetch(url);const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||`API ${response.status}`);return body;};
    const [result,strategy,market,copilot]=await Promise.all([fetchJson(`${api}/api/bots/${bot.id}/results?limit=60`),fetchJson(`${api}/api/strategies/config`),bot.marketBotId?fetchJson(`${api}/api/market-bots/${bot.marketBotId}`).catch(()=>null):Promise.resolve(null),fetchJson(`${api}/api/bots/${bot.id}/copilot`).catch(()=>null)]);
    setData(market?.result?{...result,scans:[market.result,...(result.scans||[]).filter(row=>row.scannedAt!==market.result.scannedAt)],marketResult:market.result}:result);
    if(copilot)setCopilotData(copilot);
    if(!configInitialized.current){setConfigValue({enabled:strategy[bot.id]?.enabled!==false,maxAllocationPct:strategy[bot.id]?.maxAllocationPct??20,minConfidence:strategy[bot.id]?.minConfidence??"",maxRiskScore:strategy[bot.id]?.maxRiskScore??.65,minExpectedProfitUsd:strategy[bot.id]?.minExpectedProfitUsd??5,maxSlippageBps:strategy[bot.id]?.maxSlippageBps??75,notes:strategy[bot.id]?.notes||""});configInitialized.current=true;}
    if(bot.id==="polymarket"&&!bot.marketBotId){setConnector(await fetchJson(`${api}/api/integrations/polymarket/status`));setProposals(await fetchJson(`${api}/api/integrations/polymarket/proposals`));}
    setLastSync(new Date());
  },[api,bot.id,bot.marketBotId]);
  useEffect(()=>{load().catch(error=>setMessage(error.message));const timer=setInterval(()=>load().catch(()=>{}),5000);return()=>clearInterval(timer);},[load]);
  useEffect(()=>{const close=event=>{if(event.key==="Escape")onClose();};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[onClose]);
  async function scan(){setBusy("scan");setMessage("");try{await onScan(bot.id);await load();setMessage("Scanner completado. El nodo 3D y el cockpit ya reflejan los nuevos datos.");}catch(error){setMessage(error.message);}finally{setBusy("");}}
  async function toggle(){setBusy("toggle");setMessage("");try{await onToggle?.(bot.id);await load();setMessage(bot.active?"Bot pausado de forma segura.":"Bot activado en modo PAPER.");}catch(error){setMessage(error.message);}finally{setBusy("");}}
  async function save(){setBusy("save");setMessage("");try{const body={...configValue,maxAllocationPct:Number(configValue.maxAllocationPct),minConfidence:configValue.minConfidence===""?null:Number(configValue.minConfidence),maxRiskScore:Number(configValue.maxRiskScore),minExpectedProfitUsd:Number(configValue.minExpectedProfitUsd),maxSlippageBps:Number(configValue.maxSlippageBps)};await request(`/api/strategies/${bot.id}/config`,{method:"PATCH",body:JSON.stringify(body)});configInitialized.current=false;await load();setMessage("Política operativa guardada y sincronizada.");}catch(error){setMessage(error.message);}finally{setBusy("");}}
  async function setExecutionMode(){const mode=data?.executionControl?.mode==="REAL"?"PAPER":"REAL";setBusy("mode");setMessage("");try{const result=await onSetExecutionMode?.(bot.id,mode);if(result){await load();setMessage(mode==="REAL"?(result.readiness?.ready?"REAL activo y ruta operativa lista.":`REAL armado · ${result.readiness?.blockers?.join(" · ")||"pendiente de conectores"}.`):"Bot devuelto a PAPER inmediatamente.");}}catch(error){setMessage(error.message);}finally{setBusy("");}}
  async function applyBuiltInPolicy(changes){setBusy("policy");setMessage("");try{const response=await fetch(`${api}/api/execution/bots/${bot.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(changes)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||`API ${response.status}`);configInitialized.current=false;await load();setMessage(`Política ${body.riskLevel} · ${body.selectedPreset?.name||"preset"} aplicada.`);}catch(error){setMessage(error.message);}finally{setBusy("");}}
  async function signDexRequest(summaryRow){setBusy(`sign:${summaryRow.id}`);setMessage("");let token="",row=summaryRow;try{token=getOperatorToken();const preparedResponse=await fetch(`${api}/api/execution/pending-signatures/${summaryRow.id}`,{headers:{"x-aegis-operator-token":token}}),preparedBody=await preparedResponse.json().catch(()=>({}));if(!preparedResponse.ok)throw new Error(preparedBody.message||preparedBody.error||`API ${preparedResponse.status}`);row=preparedBody;if(!row?.prepared)throw new Error("El constructor de esta estrategia todavía no produjo una transacción firmable.");const client=await getMultichainClient(),scope=row.route?.scope,address=row.wallet?.address;if(!scope||!address)throw new Error("Sesión MetaMask incompleta para esta blockchain.");await connectMultichain([scope]);let transactionHash=null;
      if(row.prepared.kind==="SOLANA"){const result=await client.invokeMethod({scope,request:{method:"signAndSendTransaction",params:{account:{address},transaction:row.prepared.transactionBase64}}});transactionHash=result?.signature||result;}
      if(row.prepared.kind==="EVM"){const asHex=value=>{if(value==null||value==="")return undefined;if(typeof value==="string"&&value.startsWith("0x"))return value;return `0x${BigInt(value).toString(16)}`;};const quantityFields=["value","gas","gasPrice","maxFeePerGas","maxPriorityFeePerGas","nonce"],normalizeTx=tx=>Object.fromEntries(Object.entries({...tx,from:address}).filter(([,value])=>value!==undefined&&value!==null).map(([key,value])=>[key,quantityFields.includes(key)?asHex(value):value]));
        if(row.prepared.approval){const approval=row.prepared.approval,spender=String(approval.spender).replace(/^0x/,"").padStart(64,"0"),amount=BigInt(approval.amount).toString(16).padStart(64,"0");await client.invokeMethod({scope,request:{method:"eth_sendTransaction",params:[{from:address,to:approval.token,value:"0x0",data:`0x095ea7b3${spender}${amount}`}]}});}
        transactionHash=await client.invokeMethod({scope,request:{method:"eth_sendTransaction",params:[normalizeTx(row.prepared.transaction)]}});
      }
      await fetch(`${api}/api/execution/pending-signatures/${row.id}/resolve`,{method:"POST",headers:{"content-type":"application/json","x-aegis-operator-token":token},body:JSON.stringify({status:"SIGNED_AND_SENT",transactionHash})});await load();setMessage(`MetaMask transmitió la operación · ${shortAddress(String(transactionHash||""))}`);
    }catch(error){if(token)await fetch(`${api}/api/execution/pending-signatures/${row.id}/resolve`,{method:"POST",headers:{"content-type":"application/json","x-aegis-operator-token":token},body:JSON.stringify({status:error?.code===4001?"REJECTED_BY_USER":"SIGNING_FAILED",error:error.message})}).catch(()=>{});setMessage(error?.code===4001?"Firma cancelada por el operador.":error.message);await load().catch(()=>{});}finally{setBusy("");}}
  async function resolveProposal(id,action){setBusy(`${action}:${id}`);setMessage("");try{const token=action==="approve"?getOperatorToken():"";await request(`/api/integrations/polymarket/proposals/${id}/${action}`,{method:"POST",headers:token?{"x-aegis-operator-token":token}:{}});await load();setMessage(action==="approve"?"Orden enviada al CLOB.":"Propuesta rechazada.");}catch(error){setMessage(error.message);}finally{setBusy("");}}
  async function askCopilot(value){const question=String(value||copilotPrompt).trim();if(!question||copilotBusy)return;setCopilotQuestion(question);setCopilotBusy(true);try{const response=await fetch(`${api}/api/bots/${bot.id}/copilot/chat`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:question,conversation:copilotMessages}),signal:AbortSignal.timeout(115000)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||`API ${response.status}`);setCopilotAnalysis(body);setCopilotMessages(current=>[...current,{role:"user",content:question},{role:"assistant",content:body.reply}].slice(-12));setCopilotPrompt("");await load();}catch(error){setCopilotAnalysis({reply:error.name==="TimeoutError"?"El análisis excedió el tiempo disponible. No se modificó ninguna estrategia.":`No se pudo consultar al copiloto: ${error.message}`,dataFreshness:"INSUFFICIENT",findings:[],recommendations:[]});}finally{setCopilotBusy(false);setCopilotQuestion("");}}
  async function reviewCopilotProposal(id,action){setBusy(`copilot:${action}:${id}`);try{const response=await fetch(`${api}/api/bots/${bot.id}/copilot/proposals/${id}/${action}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({confirmPaper:action==="approve"})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||`API ${response.status}`);setConfirmCopilotProposal(null);configInitialized.current=false;await load();setMessage(action==="approve"?(body.applied?"Ajuste del copiloto aplicado y guardado en PAPER.":"Preset generado y guardado. Aún no está activo."):"Propuesta del copiloto rechazada.");}catch(error){setMessage(error.message);}finally{setBusy("");}}
  async function activateCopilotPreset(id){setBusy(`preset:${id}`);try{const response=await fetch(`${api}/api/bots/${bot.id}/copilot/presets/${id}/activate`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({confirmPaper:true})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||`API ${response.status}`);setConfirmCopilotProposal(null);configInitialized.current=false;await load();setMessage("Preset activado y sincronizado con los filtros PAPER.");}catch(error){setMessage(error.message);}finally{setBusy("");}}
  const scans=data?.scans||[],opportunities=data?.opportunities||[],executions=data?.executions||[],execution=data?.executionControl||null,promotion=data?.promotion||bot.promotion,readiness=data?.readiness||bot.readiness,validation=readiness?.validation||{},runtimeStage=readiness?.runtime?.stage||readiness?.stage||"LOADING",edge=promotion?.metrics||{},limits=promotion?.limits||{},edgeStage=validation.stage||"SYNCING",factor=edge.profitFactor==null?(edge.wins>0?"∞":"—"):Number(edge.profitFactor||0).toFixed(2),readouts=botSpecificReadout(bot,scans,opportunities),latestOpportunity=opportunities[0];
  const tabs=[['cockpit','COCKPIT'],['scanner','SCANNER'],['opportunities','DECISIONS'],['executions','EXECUTIONS'],...(execution?.route?.executionKind==="DEX"?[['signing','METAMASK QUEUE']]:[]),...(bot.id==="polymarket"&&!bot.marketBotId?[['live','CLOB QUEUE']]:[]),['config','POLICY'],['debug','DEBUG']];
  return <div className={embedded?"botControlDock":"botControlOverlay"} onClick={embedded?undefined:onClose}><section className="botControlModal" onClick={event=>event.stopPropagation()} style={{"--botAccent":meta.accent}}>
    <button className="botControlClose" onClick={onClose} aria-label="Close bot control">×</button>
    <div className="botControlHeader"><span className="botControlOrb"><BotIcon size={26}/></span><div><small>BOT {String(meta.n).padStart(2,"0")} · COMMAND COCKPIT</small><h2>{meta.label}</h2><p>{execution?.route?.chain||bot.network||"MULTI"} · {execution?.route?.venue||bot.status||"UNKNOWN"}</p></div><div className="botControlPulse"><span><i/> AUTO-SYNC 5S</span><b>{controlTime(lastSync)}</b><em className={execution?.mode==="REAL"?"real":""}>{execution?.mode||"PAPER"} · {execution?.riskLevel||"MEDIUM"} RISK</em></div></div>
    <div className={`botSafetyRail ${execution?.mode==="REAL"?"real":"paper"}`}><button className="executionToggle" onClick={setExecutionMode} disabled={busy==="mode"}><ShieldCheck size={13}/>{busy==="mode"?"SWITCHING":execution?.mode==="REAL"?"REAL · TURN OFF":"PAPER · TURN REAL ON"}</button><span><i className={execution?.readiness?.ready?"online":"blocked"}/>{execution?.route?.wallet==="METAMASK"?`${execution.route.chain} · METAMASK`:execution?.route?.venue||readiness?.provider?.name||"PROVIDER"}</span><span>{bot.globalKillSwitch?"GLOBAL KILL SWITCH ACTIVE":execution?.mode==="REAL"?(execution?.readiness?.ready?"REAL ROUTE READY":execution?.readiness?.blockers?.[0]||"REAL ARMED"):"PAPER LEDGER ACTIVE"}</span><button onClick={toggle} disabled={busy==="toggle"}><Zap size={12}/>{busy==="toggle"?"UPDATING":bot.active?"PAUSE BOT":"ACTIVATE BOT"}</button><button className="scan" onClick={scan} disabled={busy==="scan"}><Radio size={12}/>{busy==="scan"?"SCANNING":"RUN SCAN"}</button></div>
    <div className={`botEdgeBand ${String(edgeStage).toLowerCase()}`}><div><small>PAPER VALIDATION</small><b>{edgeStage.replaceAll("_"," ")}</b></div><span><small>RUNTIME</small><b>{runtimeStage.replaceAll("_"," ")}</b></span><span><small>{validation.mode==="REAL_MARKET_QUOTE_CLOSES"?"REAL-QUOTE EVIDENCE":"VERIFIED EVIDENCE"}</small><b>{validation.target?`${validation.evidence||0}/${validation.target}`:"N/A"}</b></span><p>{readiness?.blockers?.[0]||validation.nextAction||readiness?.nextAction||promotion?.nextGate||"Collecting verified PAPER evidence."}</p></div>
    <div className="botControlTabs">{tabs.map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==="cockpit"&&<div className="botCockpit"><BotEquityCurve executions={executions}/><div className="botControlStats botControlEdgeStats"><span><small>VALIDATED PNL</small><b className={Number(edge.realizedPnlUsd||0)>=0?"positive":"negative"}>{money(edge.realizedPnlUsd)}</b></span><span><small>EXPECTANCY</small><b>{money(edge.expectancyUsd)}</b></span><span><small>PROFIT FACTOR</small><b>{factor}</b></span><span><small>WIN RATE</small><b>{Number(edge.winRate||0).toFixed(1)}%</b></span><span><small>MAX DRAWDOWN</small><b>{money(edge.maxDrawdownUsd)}</b></span><span><small>LOSS STREAK</small><b>{edge.maxConsecutiveLosses||0}</b></span><span><small>OPEN POSITIONS</small><b>{edge.openPositions||0}/{limits.maxOpenPositions??"—"}</b></span><span><small>MAX NOTIONAL</small><b>{money(limits.maxNotionalUsd)}</b></span></div><section className="botSpecialReadout"><div className="botSectionTitle"><span><Radar size={14}/> LIVE SCANNER READOUT</span><small>{botDescription(bot)}</small></div><div>{readouts.map(item=><span key={item.label}><small>{item.label}</small><b>{item.value}</b></span>)}</div></section><section className="botDecisionSection"><div className="botSectionTitle"><span><Brain size={14}/> DECISION PIPELINE</span><small>{latestOpportunity?.asset||"Waiting for the next candidate"}</small></div><BotDecisionPipeline scans={scans} opportunities={opportunities} executions={executions}/>{latestOpportunity&&<div className="botDecisionWhy"><div><small>DECISION</small><b>{latestOpportunity.brain?.decision||"WATCH"} · SCORE {latestOpportunity.brain?.score||"—"}</b></div><div><small>DIRECTION / CONFIDENCE</small><b>{latestOpportunity.direction||"—"} · {Math.round(Number(latestOpportunity.confidence||0)*100)}%</b></div><p>{latestOpportunity.risk?.reasons?.[0]||latestOpportunity.promotion?.reasons?.[0]||latestOpportunity.brain?.reason||"Signal is progressing through PAPER validation gates."}</p></div>}</section><BotCopilotPanel bot={bot} copilot={copilotData} analysis={copilotAnalysis} busy={copilotBusy} prompt={copilotPrompt} setPrompt={setCopilotPrompt} onAsk={askCopilot} onReview={reviewCopilotProposal} onActivate={activateCopilotPreset} confirmId={confirmCopilotProposal} setConfirmId={setConfirmCopilotProposal}/></div>}
    {tab==="scanner"&&<div className="botControlBody"><div className="botControlToolbar"><span>Lectura humana del scanner · raw payload permanece en DEBUG</span><button onClick={scan} disabled={busy==="scan"}><RefreshCw size={13}/>{busy==="scan"?"SCANNING…":"SCAN NOW"}</button></div><div className="botResultList modern">{scans.length?scans.map((row,index)=><article className={`botScanCard ${row.error?"hasError":""}`} key={row.scannedAt||row.createdAt||index}><div className="botScanCardHead"><span><i className={row.error?"blocked":"online"}/><b>{botLaunchLabel(row)}</b><small>{controlTime(row.scannedAt||row.at||row.createdAt)} · {row.provider||row.source||"SCANNER"}</small></span><strong>{row.error?"BLOCKED":row.kpis?`${row.kpis.qualified||0} QUALIFIED`:row.triggered?"TRIGGERED":"OBSERVED"}</strong></div>{row.error?<p>{row.error}</p>:<HumanFacts row={row}/>}</article>):<div className="botControlEmpty">No hay resultados todavía. Ejecuta RUN SCAN para iniciar el flujo.</div>}</div></div>}
    {tab==="opportunities"&&<div className="botControlBody"><div className="botResultList modern">{opportunities.length?opportunities.map((row,index)=><article className="botDecisionCard" key={row.id||index}><div><span className={`decisionBadge ${String(row.brain?.decision||"watch").toLowerCase()}`}>{row.brain?.decision||"WATCH"}</span><b>{row.asset||row.strategy}</b><small>{row.direction||"—"} · {row.source||"Opportunity Bus"} · {controlTime(row.createdAt)}</small></div><div className="botDecisionNumbers"><span><small>SCORE</small><b>{row.brain?.score||"—"}</b></span><span><small>CONFIDENCE</small><b>{Math.round(Number(row.confidence||0)*100)}%</b></span><span><small>EXPECTED</small><b>{money(row.expectedProfitUsd)}</b></span><span><small>RISK</small><b>{row.risk?.approved?"APPROVED":"GATED"}</b></span></div><p>{row.risk?.reasons?.[0]||row.promotion?.reasons?.[0]||row.brain?.reason||"No blocking reason reported."}</p></article>):<div className="botControlEmpty">Este bot todavía no ha emitido decisiones al Opportunity Bus.</div>}</div></div>}
    {tab==="executions"&&<div className="botControlBody"><div className="botResultList modern">{executions.length?executions.map((row,index)=><article className="botExecutionCard" key={row.id||index}><span className={`executionState ${String(row.status).toLowerCase()}`}>{row.status}</span><div><b>{row.asset||row.strategyId||bot.id}</b><small>{row.paperQuality||row.mode} · {row.quote?.provider||row.exit?.quote?.provider||row.reason||"EXECUTION ENGINE"}</small></div><strong className={Number(row.realizedProfitUsd||0)>=0?"positive":"negative"}>{row.status==="CLOSED"?money(row.realizedProfitUsd):money(row.entry?.notionalUsd||row.notionalUsd)}</strong><time>{controlTime(row.closedAt||row.createdAt)}</time></article>):<div className="botControlEmpty">No hay ejecuciones registradas para este bot.</div>}</div></div>}
    {tab==="signing"&&<div className="botSigningQueue"><div className="botPolicyBanner"><WalletCards size={18}/><div><b>{execution?.route?.chain} · DIRECT METAMASK SIGNING</b><small>AEGIS prepara la ruta; la clave privada nunca sale de MetaMask y cada transacción exige aprobación visible.</small></div></div>{(data?.pendingSignatures||[]).length?(data.pendingSignatures||[]).map(row=><article key={row.id} className={row.status==="READY_FOR_WALLET"?"ready":""}><div><span>{row.status.replaceAll("_"," ")}</span><b>{row.asset}</b><small>{row.route?.venue} · {money(row.capitalRequiredUsd)} · expira {controlTime(row.expiresAt)}</small></div><button onClick={()=>signDexRequest(row)} disabled={busy===`sign:${row.id}`||row.status!=="READY_FOR_WALLET"}>{busy===`sign:${row.id}`?"OPENING METAMASK…":row.status==="READY_FOR_WALLET"?"REVIEW & SIGN":"NOT SIGNABLE"}</button>{row.error&&<p>{row.error}</p>}{row.transactionHash&&<p>TX · {row.transactionHash}</p>}</article>):<div className="botControlEmpty">No hay transacciones esperando firma. En REAL, una decisión aprobada aparecerá aquí.</div>}</div>}
    {tab==="live"&&<div className="botLivePanel"><div className={`botLiveState ${connector?.enabled&&connector?.authenticated?"armed":"locked"}`}><b>{connector?.enabled&&connector?.authenticated?"POLYMARKET LIVE READY · MANUAL APPROVAL":"POLYMARKET LIVE LOCKED"}</b><small>{connector?.enabled?connector.authenticated?`Wallet ${shortAddress(connector.address)} autenticada · cada orden exige revisión y confirmación explícita.`:"Conecta MetaMask para autenticar el CLOB.":"LIVE permanece deshabilitado por configuración del servidor."}</small></div>{proposals.length?proposals.map(proposal=><article className="botProposal" key={proposal.id}><div><b>{proposal.question||proposal.marketId}</b><small>{proposal.side} · {proposal.size} USD · {proposal.status}</small></div><span>{proposal.price}</span>{proposal.status==="pending"&&<div className="botProposalActions"><button className={confirmProposal===proposal.id?"confirm":""} onClick={()=>confirmProposal===proposal.id?resolveProposal(proposal.id,"approve"):setConfirmProposal(proposal.id)} disabled={busy===`approve:${proposal.id}`}>{confirmProposal===proposal.id?"CONFIRM SEND":"REVIEW ORDER"}</button><button onClick={()=>{setConfirmProposal(null);resolveProposal(proposal.id,"reject");}} disabled={busy===`reject:${proposal.id}`}>REJECT</button></div>}</article>):<div className="botControlEmpty">No hay propuestas pendientes.</div>}</div>}
    {tab==="config"&&<div className="botManualForm"><div className={`botPolicyBanner ${execution?.mode==="REAL"?"real":""}`}><ShieldCheck size={18}/><div><b>{execution?.mode||"PAPER"} EXECUTION · {execution?.riskLevel||"MEDIUM"} RISK</b><small>{execution?.route?.executionKind==="DEX"?`Cada orden abre ${execution.route.chain} y exige firma directa en MetaMask.`:execution?.route?.executionKind==="CEX"?"Las claves CEX se leen exclusivamente desde el .env del backend; nunca llegan al navegador.":"Esta ruta usa datos reales pero no firma operaciones autónomas."}</small></div></div><section className="riskPresetControl"><div className="botSectionTitle"><span><Gauge size={14}/> NIVEL DE RIESGO</span><small>Cambia límites, confianza, exposición y slippage.</small></div><div className="riskLevelButtons">{["LOW","MEDIUM","HIGH"].map(level=><button key={level} className={execution?.riskLevel===level?`active ${level.toLowerCase()}`:""} onClick={()=>applyBuiltInPolicy({riskLevel:level})} disabled={busy==="policy"}><i/>{level==="LOW"?"BAJO":level==="MEDIUM"?"MEDIO":"ALTO"}</button>)}</div><div className="presetCards">{(execution?.presets||[]).map(preset=><button key={preset.id} className={execution?.presetId===preset.id?"active":""} onClick={()=>applyBuiltInPolicy({presetId:preset.id})} disabled={busy==="policy"}><span><b>{preset.name}</b><small>{preset.description}</small></span><em>{preset.config.minConfidence*100}% CONF · {preset.config.maxSlippageBps} BPS</em></button>)}</div></section><label className="botToggle"><input type="checkbox" checked={configValue.enabled} onChange={event=>setConfigValue(current=>({...current,enabled:event.target.checked}))}/><span/> ENABLE STRATEGY</label><div className="botPolicyGrid"><label>MAX ALLOCATION %<input type="number" min="0" max="50" step="0.5" value={configValue.maxAllocationPct} onChange={event=>setConfigValue(current=>({...current,maxAllocationPct:event.target.value}))}/></label><label>MIN CONFIDENCE (0–1)<input type="number" min="0.5" max="0.99" step="0.01" placeholder="Global risk" value={configValue.minConfidence} onChange={event=>setConfigValue(current=>({...current,minConfidence:event.target.value}))}/></label><label>MAX RISK SCORE<input type="number" min="0.05" max="0.9" step="0.01" value={configValue.maxRiskScore} onChange={event=>setConfigValue(current=>({...current,maxRiskScore:event.target.value}))}/></label><label>MIN EXPECTED PROFIT USD<input type="number" min="0" step="0.5" value={configValue.minExpectedProfitUsd} onChange={event=>setConfigValue(current=>({...current,minExpectedProfitUsd:event.target.value}))}/></label><label>MAX SLIPPAGE BPS<input type="number" min="1" max="500" step="1" value={configValue.maxSlippageBps} onChange={event=>setConfigValue(current=>({...current,maxSlippageBps:event.target.value}))}/></label></div><label>OPERATOR NOTES<textarea value={configValue.notes} onChange={event=>setConfigValue(current=>({...current,notes:event.target.value}))} placeholder="Describe la política manual y el criterio de recuperación del bot..."/></label><button className="botSaveButton" onClick={save} disabled={busy==="save"}><Settings size={15}/>{busy==="save"?"SAVING…":"SAVE & SYNC POLICY"}</button><div className="botLiveNotice">Execution route: {execution?.route?.venue||"read only"} · {execution?.readiness?.status||"PAPER"}. {execution?.readiness?.blockers?.join(" · ")||promotion?.nextGate||"Risk policy synchronized."}</div></div>}
    {tab==="debug"&&<div className="botDebugPanel"><div><Database size={15}/><span><b>RAW TELEMETRY</b><small>Datos técnicos para auditoría; no forman parte de la lectura operativa principal.</small></span></div><pre>{JSON.stringify(data,null,2)}</pre></div>}
    {message&&<div className="botControlMessage">{message}</div>}
    {copilotBusy&&<CopilotThinkingOverlay bot={bot} copilot={copilotData} data={data} question={copilotQuestion}/>}
  </section></div>;
}

function botMeta(id) { const map={liquidation:{n:1,label:"LIQUIDATION HUNTER",accent:"#6db7ff",Icon:Target},arbitrage:{n:2,label:"DEX ARBITRAGE HUNTER",accent:"#59e2a4",Icon:RefreshCw},"solana-radar":{n:3,label:"SOLANA EARLY TOKEN RADAR",accent:"#bd8bff",Icon:Target},volatility:{n:4,label:"VOLATILITY HUNTER",accent:"#ff9a68",Icon:Activity},momentum:{n:5,label:"MOMENTUM / TREND AGENT",accent:"#f2ca63",Icon:TrendingUp},perpetuals:{n:6,label:"PERPETUALS & FUNDING HUNTER",accent:"#5fe4ef",Icon:Gauge},polymarket:{n:7,label:"POLYMARKET INTELLIGENCE",accent:"#b58cff",Icon:Target},"smart-money":{n:8,label:"WHALE & SMART-MONEY TRACKER",accent:"#ffad78",Icon:Activity},yield:{n:9,label:"DEFI YIELD / POOL OPPORTUNITY",accent:"#73e7a0",Icon:Database},allocator:{n:10,label:"META STRATEGY / CAPITAL ALLOCATOR",accent:"#f0d277",Icon:Zap},"solana-meme-momentum":{n:11,label:"SOLANA MEME MOMENTUM",accent:"#d09bff",Icon:Target},"polygon-meme-momentum":{n:12,label:"POLYGON MEME MOMENTUM",accent:"#ffad78",Icon:Activity},"fx-macro-momentum":{n:13,label:"FX MACRO MOMENTUM",accent:"#ff9a68",Icon:TrendingUp},"options-defined-risk":{n:14,label:"OPTIONS DEFINED RISK",accent:"#f2ca63",Icon:Gauge},"crude-oil-regime":{n:15,label:"CRUDE OIL REGIME",accent:"#5fe4ef",Icon:Activity},"nyse-news-impact":{n:16,label:"NYSE NEWS IMPACT",accent:"#b58cff",Icon:Target}};return map[id]||map.allocator; }

function FinanceBotConfiguration({bots, state, busyBot, onAction, onSelect}) {
  const order = ["liquidation", "arbitrage", "solana-radar", "volatility", "momentum", "perpetuals", "polymarket", "smart-money", "yield", "allocator", "solana-meme-momentum", "polygon-meme-momentum", "fx-macro-momentum", "options-defined-risk", "crude-oil-regime", "nyse-news-impact"];
  const fallback = id => ({id, name: id.replaceAll("-", " "), active: false, status: "NOT LOADED", network: "MULTI", wallet: "PAPER_SLOT"});
  return <section className="panel botConfigPanel"><PanelHead eyebrow="04 / BOT CONTROL" title="All ten core bots + six market bots. One control surface." action={`${order.length}/${order.length} VISIBLE · PAPER`}/><p className="botControlIntro">Cada bot muestra ahora evidencia con cotización real, readiness y el siguiente bloqueo que debe resolver antes de recibir más capital.</p><div className="botConfigGrid">{order.map(id => { const bot = bots.find(item => item.id === id) || fallback(id); const readiness = financeBotReadiness(id, state, bot); return <article className="botConfigCard" key={id}><button className="botConfigOpen" onClick={() => onSelect(id)}><div className="botConfigTop"><span className="botConfigIndex">{String(order.indexOf(id) + 1).padStart(2, "0")}</span><span className="botConfigIcon"><Bot size={17}/></span><div><b>{bot.name || id}</b><small>{bot.active ? bot.status : "PAUSED"}</small></div><i className={readiness.tone}/></div></button><div className="botConfigMeta"><span><small>NETWORK</small>{bot.network || "MULTI"}</span><span><small>EDGE SCORE</small>{readiness.score}/100</span><span><small>EVIDENCE</small>{readiness.evidence}</span></div><div className="botConfigReadiness"><span className={readiness.tone}>{readiness.label}</span><button onClick={() => onSelect(id)}><Settings size={12}/> CONTROL</button></div><small className="botConfigNext">{readiness.nextAction}</small><div className="botConfigActions"><button disabled={busyBot === id} onClick={() => onAction(id, "scan")}><Radio size={12}/> {busyBot === id ? "RUNNING" : "SCAN"}</button><button onClick={() => onAction(id, "toggle")}><Zap size={12}/> {bot.active ? "PAUSE" : "ACTIVATE"}</button></div></article> })}</div></section>;
}
function financeBotReadiness(id,state,bot){const report=state?.infrastructure?.readiness?.bots?.find(item=>item.id===id);if(report){const runtime=report.runtime?.stage||report.stage,validation=report.validation||{},tone=["RUNNING","SCANNING"].includes(runtime)?(validation.stage==="RECOVERY_PAPER"?"recovery":"ready"):"needs";return {label:runtime.replaceAll("_"," "),tone,score:Number(report.score||0).toFixed(0),evidence:validation.target?`${validation.evidence||0}/${validation.target}`:"N/A",nextAction:report.blockers?.[0]||validation.nextAction||report.nextAction||"RUNNING"};}if(!bot?.active)return {label:"PAUSED",tone:"needs",score:"0",evidence:"N/A",nextAction:"BOT_PAUSED"};return {label:`ACTIVE · ${String(bot.status||"STARTING")}`,tone:"needs",score:"—",evidence:"—",nextAction:"WAITING_FOR_READINESS_SYNC"};}

createRoot(document.getElementById("root")).render(<App/>);
