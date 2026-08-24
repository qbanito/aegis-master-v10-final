import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Brain,
  Building2,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CircleX,
  Clock3,
  Command,
  Cpu,
  Crown,
  Eye,
  FileText,
  GitBranch,
  Landmark,
  ListChecks,
  LockKeyhole,
  Mail,
  MessageCircle,
  Mic,
  Network,
  Plus,
  Radio,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Terminal,
  Users,
  Wand2,
  Waves,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import "./style.css";
import "./satellite.css";
import "./hover-fix.css";
import "./electricity.css";
import "./responsive.css";

const runtimeApi = (local, production) => import.meta.env.DEV ? local : production;
const CEO = import.meta.env.VITE_CEO_BRAIN_URL || runtimeApi("http://localhost:8806", "/brain-api/ceo");
const MANAGER = import.meta.env.VITE_MANAGER_BRAIN_URL || runtimeApi("http://localhost:8805", "/brain-api/manager");
const FINANCE = import.meta.env.VITE_FINANCE_BRAIN_URL || runtimeApi("http://localhost:8787", "/brain-api/finance");
const COMMERCE = import.meta.env.VITE_COMMERCE_BRAIN_URL || runtimeApi("http://localhost:8802", "/brain-api/commerce");
const SAAS = import.meta.env.VITE_SAAS_BRAIN_URL || runtimeApi("http://localhost:8790", "/brain-api/saas");
const MEDIA = import.meta.env.VITE_MEDIA_BRAIN_URL || runtimeApi("http://localhost:8804", "/brain-api/media");
const SERVICES = import.meta.env.VITE_SERVICES_BRAIN_URL || runtimeApi("http://localhost:8808", "/brain-api/services");
const INSTITUTIONAL = import.meta.env.VITE_INSTITUTIONAL_BRAIN_URL || runtimeApi("http://localhost:8820", "/brain-api/institutional");
const BRAIN_APIS = {ceo: CEO, manager: MANAGER, finance: FINANCE, commerce: COMMERCE, saas: SAAS, media: MEDIA, services: SERVICES, institutional: INSTITUTIONAL, banking: MANAGER, account: MANAGER};
function brainChatRequest(brain, message, conversation) {
  return {url: `${String(BRAIN_APIS[brain] || CEO).replace(/\/$/, "")}${brain === "finance" ? "/api/agent/chat" : "/api/chat"}`, body: {message, brain, conversation}};
}
const CEO_IMAGE = "/brains/ceo.png";
const MANAGER_IMAGE = "/brains/manager.png";
const brainMeta = {
  finance: {
    label: "BRAIN 01",
    name: "FINANCE BRAIN",
    color: "#57ef75",
    subtitle: "Trading · DeFi · Risk",
    detail: "Capital Optimization",
    icon: CircleDollarSign,
    image: "/brains/finance.png",
    agentsActive: "12",
    stats: ["AGENTS ACTIVE", "OPPORTUNITIES", "CAPITAL DEPLOYED", "30D RETURN"],
  },
  commerce: {
    label: "BRAIN 02",
    name: "COMMERCE BRAIN",
    color: "#ffc531",
    subtitle: "E-Commerce · Products",
    detail: "Revenue Generation",
    icon: Zap,
    image: "/brains/commerce.png",
    agentsActive: "12",
    stats: ["AGENTS ACTIVE", "PRODUCTS", "REVENUE 30D", "GROWTH"],
  },
  services: {
    label: "BRAIN 05",
    name: "SERVICES BRAIN",
    color: "#ff8b5b",
    subtitle: "Services · Sales · Delivery",
    detail: "Service Revenue",
    icon: Briefcase,
    image: "/brains/services.svg",
    agentsActive: "10",
    stats: ["AGENTS ACTIVE", "SERVICES", "PIPELINE", "PROJECTS"],
  },
  saas: {
    label: "BRAIN 03",
    name: "SAAS BRAIN",
    color: "#25e8ff",
    subtitle: "SaaS · Subscriptions",
    detail: "MRR Optimization",
    icon: Waves,
    image: "/brains/saas.png",
    agentsActive: "8",
    stats: ["AGENTS ACTIVE", "PROJECTS", "MRR", "GROWTH"],
  },
  media: {
    label: "BRAIN 04",
    name: "MEDIA BRAIN",
    color: "#ff42bb",
    subtitle: "Content · Social · SEO",
    detail: "Audience & Traffic",
    icon: Sparkles,
    image: "/brains/media.png",
    agentsActive: "8",
    stats: ["AGENTS ACTIVE", "PIECES TODAY", "REACH 7D", "ENGAGEMENT"],
  },
  institutional: {
    label: "BRAIN 06",
    name: "INSTITUTIONAL BRAIN",
    color: "#5ce1ff",
    subtitle: "Real Estate · Private Credit · Structured Finance",
    detail: "Institutional Digital Asset Studio",
    icon: Landmark,
    image: "/brains/institutional.svg",
    agentsActive: "4",
    stats: ["DEAL TYPES", "SECURITY SCORE", "NETWORKS", "INVARIANTS"],
  },
};
const satelliteMeta = {
  banking: {
    id: "banking",
    name: "BANKING BRAIN",
    color: "#14b8a6",
    role: "Internal Treasury",
    detail: "Custodia fondos, transferencias y liquidez entre Brains — actúa como banco interno.",
    image: "/brains/banking.png",
  },
  account: {
    id: "account",
    name: "ACCOUNT BRAIN",
    color: "#818cf8",
    role: "Finance & Tax Structure",
    detail: "Consolida ganancias, impuestos y estructura financiera del sistema.",
    image: "/brains/account.png",
  },
};
const brainDirectory = {
  ceo: {
    id: "ceo",
    name: "CEO BRAIN",
    color: "#bd58ff",
    image: CEO_IMAGE,
    role: "Strategic Command",
    greeting: "Hola Neiver soy tu CEO asistente. Estoy listo para ayudarte.",
  },
  manager: {
    id: "manager",
    name: "MANAGER BRAIN",
    color: "#20a9ff",
    image: MANAGER_IMAGE,
    role: "Operations Command",
    greeting: "Hola Neiver soy tu Manager asistente. Coordino las unidades operativas 24/7.",
  },
  ...Object.fromEntries(
    Object.entries(brainMeta).map(([id, m]) => [
      id,
      {
        id,
        name: m.name,
        color: m.color,
        image: m.image,
        role: m.subtitle,
        greeting: `Hola Neiver soy tu ${m.name.replace(" BRAIN", "")} asistente. Pregúntame por ${m.detail.toLowerCase()}.`,
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(satelliteMeta).map(([id, m]) => [
      id,
      {
        id,
        name: m.name,
        color: m.color,
        image: m.image,
        role: m.role,
        greeting: `Hola Neiver soy tu ${m.name.replace(" BRAIN", "")} asistente. Estoy listo en modo PAPER para revisar los controles internos.`,
      },
    ]),
  ),
};

const brainVoice = () => "coral";
function assistantGreeting(id) {
  const label = (brainDirectory[id]?.name || `${id} BRAIN`).replace(/\s*BRAIN\s*$/i, "");
  return `Hola Neiver soy tu ${label} asistente.`;
}
function stripAssistantGreeting(value) {
  return String(value || "").trim().replace(/^hola\s+neiver,?\s*soy\s+tu\s+[^.!?]+[.!?]\s*/i, "").trim();
}
function withAssistantGreeting(id, value) {
  const greeting = assistantGreeting(id);
  const body = stripAssistantGreeting(value);
  return body ? `${greeting} ${body}` : greeting;
}

function CommandCenter() {
  const [report, setReport] = useState(null),
    [state, setState] = useState(null),
    [command, setCommand] = useState(""),
    [answer, setAnswer] = useState(
      "Hola Neiver soy tu CEO asistente. Estoy listo para ayudarte.",
    ),
    [talking, setTalking] = useState(false),
    [listening, setListening] = useState(false),
    [thinking, setThinking] = useState(false),
    [chatOpen, setChatOpen] = useState(false),
    [chatBrain, setChatBrain] = useState("ceo"),
    [hoveredBrain, setHoveredBrain] = useState(null),
    [error, setError] = useState(""),
    [lastSync, setLastSync] = useState(null),
    [activePage, setActivePage] = useState("overview"),
    [focusMode, setFocusMode] = useState(false),
    [financeStatus, setFinanceStatus] = useState(null),
    [hoverVoiceBrain, setHoverVoiceBrain] = useState(null),
    [hoverReport, setHoverReport] = useState(""),
    [hoverBusy, setHoverBusy] = useState(false),
    [goals, setGoals] = useState([]),
    [goalMode, setGoalMode] = useState(false),
    [goalBusy, setGoalBusy] = useState(false);
  const hoverRequestRef = useRef({ id: "", at: 0 });
  const speechAudioRef = useRef(null);
  const speechTokenRef = useRef(0);
  const conversationRef = useRef({});
  const refresh = useCallback(async () => {
    try {
      const [r, s, f] = await Promise.all([
        fetch(`${CEO}/api/report`).then((x) => x.json()),
        fetch(`${MANAGER}/api/state`).then((x) => x.json()),
        fetch(`${FINANCE}/api/paper/status`).then((x) => x.json()).catch(() => null),
      ]);
      setReport(r);
      setState(s);
      setFinanceStatus(f);
      setLastSync(new Date());
      setError("");
    } catch (e) {
      setError("CEO / Manager connection unavailable");
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  const refreshGoals = useCallback(async () => {
    try {
      const list = await fetch(`${CEO}/api/goals`).then((x) => x.json());
      setGoals(Array.isArray(list) ? list : []);
    } catch (e) {
      /* goals panel stays stale until next successful poll */
    }
  }, []);
  useEffect(() => {
    refreshGoals();
    const timer = setInterval(refreshGoals, 20000);
    return () => clearInterval(timer);
  }, [refreshGoals]);
  async function setGoal(objective) {
    const text = String(objective || "").trim();
    if (!text || goalBusy) return;
    setGoalBusy(true);
    setChatOpen(true);
    setCommand("");
    setAnswer(`Delegando objetivo al Manager: "${text}"`);
    try {
      const r = await fetch(`${CEO}/api/goals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objective: text }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || data.error || "Goal error");
      setAnswer(
        `Objetivo aceptado. Plan del Manager: ${data.goal.steps.join(" → ")}.`,
      );
      setGoalMode(false);
      refreshGoals();
    } catch (e) {
      setAnswer(`No pude delegar el objetivo: ${e.message}`);
    } finally {
      setGoalBusy(false);
    }
  }
  async function goalAction(id, action) {
    try {
      await fetch(`${CEO}/api/goals/${id}/${action}`, { method: "POST" });
      refreshGoals();
    } catch (e) {
      /* best-effort control action */
    }
  }
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const stopVoice = useCallback(() => {
    speechTokenRef.current += 1;
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current.currentTime = 0;
      speechAudioRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setTalking(false);
  }, []);
  const cancelHoverVoice = useCallback(() => {
    hoverRequestRef.current = {id: "", at: Date.now()};
    setHoverBusy(false);
    setHoveredBrain(null);
    setHoverVoiceBrain(null);
    setHoverReport("");
    stopVoice();
  }, [stopVoice]);
  useEffect(() => {
    if (!hoverVoiceBrain) return undefined;
    const cancelIfOutsideBrain = (event) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target?.closest(".brainHoverZone")) cancelHoverVoice();
    };
    window.addEventListener("pointermove", cancelIfOutsideBrain, true);
    window.addEventListener("blur", cancelHoverVoice);
    document.addEventListener("mouseleave", cancelHoverVoice);
    return () => {
      window.removeEventListener("pointermove", cancelIfOutsideBrain, true);
      window.removeEventListener("blur", cancelHoverVoice);
      document.removeEventListener("mouseleave", cancelHoverVoice);
    };
  }, [hoverVoiceBrain, cancelHoverVoice]);
  const fallbackSpeak = useCallback((text) => {
    stopVoice();
    const token = speechTokenRef.current;
    if (!("speechSynthesis" in window)) return Promise.resolve();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.05;
    utterance.pitch = 1.03;
    const voices = window.speechSynthesis.getVoices?.() || [];
    utterance.voice = voices.find((voice) => /es[-_]MX|es[-_]ES|Spanish.*Natural|Google español/i.test(`${voice.lang} ${voice.name}`)) || voices.find((voice) => /^es/i.test(voice.lang)) || null;
    return new Promise((resolve) => {
      const finish = () => { if (token === speechTokenRef.current) setTalking(false); resolve(); };
      utterance.onstart = () => token === speechTokenRef.current && setTalking(true);
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
  }, [stopVoice]);
  const speak = useCallback(
    async (text, voice = "coral", brain = "ceo") => {
      stopVoice();
      const token = speechTokenRef.current;
      try {
        const r = await fetch(`${CEO}/api/tts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, voice, brain }),
        });
        if (!r.ok) throw new Error("TTS_UNAVAILABLE");
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        speechAudioRef.current = audio;
        audio.onplay = () => token === speechTokenRef.current && setTalking(true);
        audio.onended = () => {
          if (token === speechTokenRef.current) setTalking(false);
          speechAudioRef.current = null;
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          if (token === speechTokenRef.current) setTalking(false);
          speechAudioRef.current = null;
          URL.revokeObjectURL(url);
        };
        if (token !== speechTokenRef.current) { URL.revokeObjectURL(url); return; }
        await audio.play();
        if (token !== speechTokenRef.current) { audio.pause(); return; }
        await new Promise((resolve) => {
          const finish = () => resolve();
          audio.onended = () => { if (token === speechTokenRef.current) setTalking(false); speechAudioRef.current = null; URL.revokeObjectURL(url); finish(); };
          audio.onerror = () => { if (token === speechTokenRef.current) setTalking(false); speechAudioRef.current = null; URL.revokeObjectURL(url); finish(); };
          audio.onpause = () => { if (token !== speechTokenRef.current) finish(); };
        });
      } catch (e) {
        if (token !== speechTokenRef.current) return;
        return fallbackSpeak(text);
      }
    },
    [fallbackSpeak, stopVoice],
  );
  async function sendCommand(raw = command, brainOverride) {
    const text = String(raw || "").trim();
    if (!text || thinking) return;
    const brain = brainOverride || chatBrain;
    setChatBrain(brain);
    setChatOpen(true);
    setCommand("");
    setThinking(true);
    setAnswer(`Procesando comando: “${text}”`);
    const greetingPlayback = speak(assistantGreeting(brain), brainVoice(), brain);
    try {
      const conversation = conversationRef.current[brain] || [];
      const request = brainChatRequest(brain, text, conversation);
      const r = await fetch(request.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || data.error || "Command error");
      const reply = withAssistantGreeting(brain, data.reply);
      conversationRef.current[brain] = [...conversation, {role: "user", content: text}, {role: "assistant", content: reply}].slice(-12);
      setAnswer(reply);
      if (data.speak !== false) {
        const body = stripAssistantGreeting(reply);
        await greetingPlayback;
        if (body) speak(`Ahora te cuento. ${body}`, brainVoice(), brain);
      }
      refresh();
    } catch (e) {
      setAnswer(`No pude completar el comando: ${e.message}`);
    } finally {
      setThinking(false);
    }
  }
  function listen(brainOverride) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setChatOpen(true);
      setAnswer(
        "El reconocimiento de voz no está disponible en este navegador. Usa Chrome o Safari.",
      );
      return;
    }
    const recognition = new SR();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setChatOpen(true);
    setListening(true);
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setCommand(text);
      sendCommand(text, brainOverride);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }
  function openChat(id) {
    const brain = brainDirectory[id] || brainDirectory.ceo;
    setChatBrain(brain.id);
    setChatOpen(true);
    setAnswer(brain.greeting);
  }
  const askHoverBrain = useCallback(async (id, message, options = {}) => {
    const brain = brainDirectory[id] || brainDirectory.ceo;
    const automaticHover = !message;
    const text = String(message || `Dame un reporte breve, actualizado y útil de lo que estás haciendo ahora.`).trim();
    setHoverVoiceBrain(id);
    setHoverBusy(true);
    try {
      const conversation = message ? (conversationRef.current[id] || []) : [];
      const request = brainChatRequest(id, text, conversation);
      const r = await fetch(request.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || data.error || "Brain unavailable");
      if (hoverRequestRef.current.id !== id) return;
      const reply = withAssistantGreeting(id, data.reply || brain.greeting);
      if (message) conversationRef.current[id] = [...conversation, {role: "user", content: text}, {role: "assistant", content: reply}].slice(-12);
      setHoverReport(reply);
      if (options.greetingPlayback) {
        const body = stripAssistantGreeting(reply);
        if (body) {
          await options.greetingPlayback;
          if (hoverRequestRef.current.id !== id) return;
          speak(`Ahora te cuento. ${body}`, brainVoice(), id);
        }
      } else if (!automaticHover || options.speakReply !== false) {
        speak(reply, brainVoice(), id);
      }
    } catch (e) {
      if (hoverRequestRef.current.id === id) setHoverReport(`${brain.name} está listo, pero el canal de datos necesita reconexión.`);
    } finally {
      if (hoverRequestRef.current.id === id) setHoverBusy(false);
    }
  }, [speak]);
  function handleBrainHover(id) {
    const now = Date.now();
    if (hoverRequestRef.current.id === id && now - hoverRequestRef.current.at < 6000) {
      setHoverVoiceBrain(id);
      return;
    }
    hoverRequestRef.current = { id, at: now };
    setHoveredBrain(id);
    setHoverReport(assistantGreeting(id));
    const greetingPlayback = speak(assistantGreeting(id), brainVoice(), id);
    askHoverBrain(id, undefined, { greetingPlayback });
  }
  function handleBrainLeave(id) {
    if (hoverRequestRef.current.id === id || hoverVoiceBrain === id) cancelHoverVoice();
  }
  function openPage(page) {
    setActivePage(page);
    setFocusMode(false);
    setHoveredBrain(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function handleSurfaceDoubleClick(event) {
    if (activePage !== "overview") return;
    const interactive = event.target.closest("a,button,input,textarea,select,[role='button'],.brainHoverZone,.brainCard,.brainStation,.rightRail,.hierarchy");
    if (interactive) return;
    setFocusMode((current) => !current);
  }
  const snapshot = state?.snapshot?.brains || [];
  const online = (id) => snapshot.find((b) => b.id === id)?.status === "online";
  const critical = state?.incidents?.filter((i) => i.status === "open") || [];
  const active = thinking || talking || listening;
  const fullBrainMode = ["finance", "commerce", "services", "saas", "media", "institutional"].includes(activePage);
  return (
    <div className={`commandApp ${focusMode ? "focusMode" : ""} ${fullBrainMode ? "fullBrainMode" : ""}`} onDoubleClick={handleSurfaceDoubleClick}>
      <div className="scanline" />
      <header className="masthead">
        <div className="brandBlock">
          <div className="aegisWord">AEGIS</div>
          <div className="architecture">MASTER ARCHITECTURE</div>
        <div className="mission">
            9 BRAINS <i /> 60 AGENTS <i /> 1 MISSION
          </div>
        </div>
        <div className="topCommand">
          <span className="liveDot" /> INTER-BRAIN NETWORK{" "}
          <b>{report?.brainsOnline || "SYNCING"}</b>
          {focusMode && <span className="focusModeLabel">FOCUS VIEW · ESC TO RESTORE</span>}
          <button onClick={refresh} aria-label="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </header>
      <div className={`layout ${fullBrainMode ? "fullBrainLayout" : ""}`}>
        <aside className="hierarchy">
          <SectionLabel>HIERARCHY OVERVIEW</SectionLabel>
          <HierarchyItem
            icon={Brain}
            label="CEO BRAIN"
            sub="Strategic Command"
            color="#c56bff"
            active={activePage === "ceo"}
            onClick={() => openPage("ceo")}
          />
          <HierarchyItem
            icon={Command}
            label="MANAGER BRAIN"
            sub="Operations Command"
            color="#2d9fff"
            active={activePage === "manager"}
            onClick={() => openPage("manager")}
          />
          <SectionLabel extra="brains">OPERATIVE LAYERS</SectionLabel>
          {Object.entries(brainMeta).map(([id, m]) => (
            <button
              type="button"
              onClick={() => openPage(id)}
              key={id}
              className={`hierarchyLink pageLink ${activePage === id ? "selected" : ""}`}
            >
              <m.icon size={17} />
              <span>
                <b>{m.label}</b>
                <small>{m.name.replace(" BRAIN", "")}</small>
              </span>
              <i className={online(id) ? "up" : "down"} />
            </button>
          ))}
          <SectionLabel extra="brains">FINANCE OPERATIONS</SectionLabel>
          {Object.entries(satelliteMeta).map(([id, m]) => {
            const Icon = id === "banking" ? Landmark : ReceiptText;
            return (
              <button
                key={id}
                className={`hierarchyLink pageLink ${activePage === id ? "selected" : ""}`}
                style={{ "--item": m.color }}
                onClick={() => openPage(id)}
              >
                <Icon size={17} />
                <span>
                  <b>{m.name.replace(" BRAIN", "")}</b>
                  <small>{id === "banking" ? "Treasury" : "Taxes & entities"}</small>
                </span>
                <i className="up" />
              </button>
            );
          })}
          <div className="hierarchyFoot">
            <ShieldCheck size={16} />
            <span>
              Paper-safe
              <br />
              <b>command boundary</b>
            </span>
          </div>
        </aside>
        <main className={`stage ${activePage !== "overview" ? "pageStage" : ""}`}>
          {activePage === "overview" ? (
            <>
          <section className="executiveRow">
            <BrainStation
              label="BRAIN 07"
              name="CEO BRAIN"
              subtitle="STRATEGIC INTELLIGENCE"
              detail="Filters · Prioritizes · Reports"
              tagline="Communicates with YOU"
              color="#bd58ff"
              image={CEO_IMAGE}
              big
              active={active}
              talking={talking && (hoverVoiceBrain === "ceo" || chatBrain === "ceo")}
              brainId="ceo"
              report={hoverVoiceBrain === "ceo" ? hoverReport : ""}
              hoverBusy={hoverBusy && hoverVoiceBrain === "ceo"}
              onHover={() => handleBrainHover("ceo")}
              onLeave={() => handleBrainLeave("ceo")}
              onAsk={(question) => askHoverBrain("ceo", question)}
              onTalk={() => openChat("ceo")}
              onOpen={() => openPage("ceo")}
              functionsTitle="CEO BRAIN FUNCTIONS"
              functionsItems={[
                "Executive Reporting",
                "Intelligent Filtering",
                "Critical Alerts",
                "Daily Briefings",
                "Email & WhatsApp",
                "Decision Support",
              ]}
            />
          </section>
          <Connection />
          <section className="managerRow">
            <ManagerSatellites
              onTalk={openChat}
              onOpenPage={openPage}
              onHover={handleBrainHover}
              onLeave={handleBrainLeave}
              report={hoverReport}
              hoverVoiceBrain={hoverVoiceBrain}
              hoverBusy={hoverBusy}
              talking={talking}
              onAsk={askHoverBrain}
            />
            <BrainStation
              label="BRAIN 06"
              name="MANAGER BRAIN"
              subtitle="OPERATIONS INTELLIGENCE"
              detail="Analyzes · Optimizes · Proposes"
              tagline="Monitors all Brains 24/7"
              color="#20a9ff"
              image={MANAGER_IMAGE}
              active={active}
              talking={talking && (hoverVoiceBrain === "manager" || chatBrain === "manager")}
              brainId="manager"
              report={hoverVoiceBrain === "manager" ? hoverReport : ""}
              hoverBusy={hoverBusy && hoverVoiceBrain === "manager"}
              onHover={() => handleBrainHover("manager")}
              onLeave={() => handleBrainLeave("manager")}
              onAsk={(question) => askHoverBrain("manager", question)}
              manager
              onTalk={() => openChat("manager")}
              onOpen={() => openPage("manager")}
              functionsTitle="MANAGER FUNCTIONS"
              functionsItems={[
                "Performance Analysis",
                "Problem Detection",
                "Opportunity Discovery",
                "Improvement Proposals",
                "Resource Allocation",
                "Experiment Management",
                "Risk & Governance",
                "Strategy & Planning",
                "Cross-Brain Coordination",
                "Executive Summary",
              ]}
            />
          </section>
          <ConnectionBranches active={active} hovered={hoveredBrain} />
          <div className="brainRail">
            <ElectricBrainRail hovered={hoveredBrain} />
            {Object.entries(brainMeta).map(([id, m]) => (
              <BrainCard
                key={id}
                id={id}
                meta={m}
                online={online(id)}
                onHover={() => handleBrainHover(id)}
                onLeave={() => handleBrainLeave(id)}
                report={hoverVoiceBrain === id ? hoverReport : ""}
                hoverBusy={hoverBusy && hoverVoiceBrain === id}
                talking={talking && (hoverVoiceBrain === id || chatBrain === id)}
                onTalk={() => openChat(id)}
                onAsk={(question) => askHoverBrain(id, question)}
                onOpen={() => openPage(id)}
              />
            ))}
          </div>
          <section className="bottomStats">
            <div className="communication">
              <div>
                <b>INTER-BRAIN COMMUNICATION</b>
                <small>SECURE · ENCRYPTED · REAL-TIME</small>
              </div>
              <div className="wave">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <BottomMetric
              label="TOTAL AGENTS"
              value={report?.brainsOnline === "5/5" ? "60" : "—"}
              accent
            />
            <BottomMetric label="DATA PROCESSED (24H)" value="2.47 TB" />
            <BottomMetric label="DECISIONS MADE (24H)" value="1,842" />
            <BottomMetric label="AUTOMATIONS (24H)" value="18,936" />
            <div className="syncMetric">
              <RefreshCw size={16} />
              <b>LAST SYNC</b>
              <span>
                {lastSync
                  ? `${Math.max(1, Math.round((Date.now() - lastSync) / 1000))}s ago`
                  : "—"}
              </span>
            </div>
          </section>
            </>
          ) : activePage === "ceo" ? (
            <CeoPage
              report={report}
              onTalk={() => openChat("ceo")}
              onBack={() => openPage("overview")}
            />
          ) : activePage === "manager" ? (
            <ManagerPage
              report={report}
              onTalk={() => openChat("manager")}
              onOpenPage={openPage}
              onBack={() => openPage("overview")}
            />
          ) : ["finance", "commerce", "services", "saas", "media", "institutional"].includes(activePage) ? (
            <OperationalBrainPage
              brainId={activePage}
              onTalk={() => openChat(activePage)}
              onBack={() => openPage("overview")}
            />
          ) : activePage === "banking" ? (
            <BankingPage
              financeStatus={financeStatus}
              onTalk={() => openChat("banking")}
              onBack={() => openPage("overview")}
            />
          ) : (
            <AccountPage
              report={report}
              financeStatus={financeStatus}
              onTalk={() => openChat("account")}
              onBack={() => openPage("overview")}
            />
          )}
        </main>
        <aside className="rightRail">
          <Panel title="SYSTEM STATUS" accent="#5ee7a0">
            <div className="systemHeadline">
              <span className="liveDot" /> ALL SYSTEMS OPERATIONAL
            </div>
            <div className="contacts">
              <div>
                <MessageCircle size={20} />
                <span>
                  WHATSAPP<small>+1 (555) 123-4567</small>
                </span>
                <b>CONNECTED</b>
              </div>
              <div>
                <Mail size={20} />
                <span>
                  EMAIL<small>you@aegis.com</small>
                </span>
                <b>CONNECTED</b>
              </div>
            </div>
            <StatusLine label="CEO Brain" ok />
            <StatusLine label="Manager Brain" ok />
            {Object.entries(brainMeta).map(([id, m]) => (
              <StatusLine key={id} label={m.name} ok={online(id)} />
            ))}
            <StatusLine label="Banking Brain" ok />
            <StatusLine label="Account Brain" ok />
          </Panel>
          <Panel
            title="ACTIVE ALERTS"
            badge={critical.length || 0}
            accent="#ff6478"
          >
            {critical.length ? (
              critical.slice(0, 4).map((item, i) => (
                <div className="alert" key={item.id}>
                  <span className={`alertIcon a${i}`}>
                    <AlertTriangle size={12} />
                  </span>
                  <div>
                    <b>
                      {item.brain.toUpperCase()} · {item.severity || "ALERT"}
                    </b>
                    <small>{item.reason || "Requires attention"}</small>
                  </div>
                  <time>{i + 2}m ago</time>
                </div>
              ))
            ) : (
              <div className="emptyPanel">
                <CheckCircle2 size={16} /> No active alerts
              </div>
            )}
            <a
              className="panelLink"
              href={`${MANAGER}/api/incidents`}
              target="_blank"
              rel="noreferrer"
            >
              VIEW ALL ALERTS <ArrowRight size={13} />
            </a>
          </Panel>
          <Panel
            title="ACTIVE GOALS"
            badge={goals.filter((g) => g.status === "active").length || 0}
            accent="#57ef75"
          >
            {goals.length ? (
              goals.slice(0, 4).map((goal) => (
                <div className="goalRow" key={goal.id}>
                  <div>
                    <b>
                      {goal.objective.length > 58
                        ? `${goal.objective.slice(0, 58)}…`
                        : goal.objective}
                    </b>
                    <small>
                      {goal.log[goal.log.length - 1]?.message ||
                        "Sin actividad todavía"}
                    </small>
                  </div>
                  <span className={`goalStatus ${goal.status}`}>
                    {goal.status.toUpperCase()}
                  </span>
                  <div className="goalActions">
                    {goal.status === "active" && (
                      <button
                        onClick={() => goalAction(goal.id, "pause")}
                        title="Pausar"
                      >
                        <Clock3 size={12} />
                      </button>
                    )}
                    {goal.status === "paused" && (
                      <button
                        onClick={() => goalAction(goal.id, "resume")}
                        title="Reanudar"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                    {["active", "paused", "needs-review"].includes(
                      goal.status,
                    ) && (
                      <button
                        onClick={() => goalAction(goal.id, "cancel")}
                        title="Cancelar"
                      >
                        <CircleX size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="emptyPanel">
                <Target size={16} /> Sin objetivos activos
              </div>
            )}
          </Panel>
          <Panel title="TODAY'S EXECUTIVE REPORT" accent="#c56bff">
            <div className="reportRows">
              <ReportRow
                label="Portfolio Health"
                value={`${report?.portfolioHealth ?? 0}%`}
                up
              />
              <ReportRow
                label="Brains Online"
                value={report?.brainsOnline || "0/4"}
                up
              />
              <ReportRow
                label="Critical Problems"
                value={report?.criticalProblems ?? 0}
                up={!report?.criticalProblems}
              />
              <ReportRow
                label="Open Incidents"
                value={report?.openIncidents ?? 0}
                up={!report?.openIncidents}
              />
            </div>
            <a
              className="panelLink"
              href={`${CEO}/api/report`}
              target="_blank"
              rel="noreferrer"
            >
              VIEW FULL REPORT <ArrowRight size={13} />
            </a>
          </Panel>
          <div className="vision">
            ONE VISION. NINE BRAINS.<strong>INFINITE POSSIBILITIES.</strong>
          </div>
        </aside>
      </div>
      {chatOpen && (
        <CommandModal
          answer={answer}
          command={command}
          setCommand={setCommand}
          sendCommand={sendCommand}
          listen={listen}
          onClose={() => setChatOpen(false)}
          active={active}
          thinking={thinking}
          talking={talking}
          listening={listening}
          brain={brainDirectory[chatBrain] || brainDirectory.ceo}
          goalMode={goalMode}
          setGoalMode={setGoalMode}
          setGoal={setGoal}
          goalBusy={goalBusy}
        />
      )}
    </div>
  );
}

function AccessGate() {
  const [screen, setScreen] = useState("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setScreen(window.sessionStorage.getItem("aegis-master-access") === "granted" ? "granted" : "login");
    }, 1100);
    return () => window.clearTimeout(timer);
  }, []);

  function unlock(event) {
    event.preventDefault();
    if (password !== "boostify") {
      setError("ACCESS DENIED · CHECK PASSWORD");
      setPassword("");
      return;
    }
    window.sessionStorage.setItem("aegis-master-access", "granted");
    setError("");
    setScreen("granted");
  }

  if (screen === "granted") return <CommandCenter />;

  return (
    <main className={`accessGate ${screen === "loading" ? "accessLoading" : "accessLogin"}`}>
      <div className="accessGrid" />
      <div className="accessGlow accessGlowOne" />
      <div className="accessGlow accessGlowTwo" />
      <section className="accessPanel" aria-label="AEGIS Master access">
        <div className="accessOrb"><Brain size={30} /></div>
        <span className="accessEyebrow">AEGIS · MASTER ARCHITECTURE</span>
        {screen === "loading" ? (
          <>
            <h1>INITIALIZING</h1>
            <p>Preparing the inter-brain command surface</p>
            <div className="accessProgress"><i /></div>
            <small className="accessStatus"><span /> SECURE BOOT SEQUENCE</small>
          </>
        ) : (
          <>
            <h1>WELCOME, NEIVER</h1>
            <p>Introduce la contraseña para acceder al Command Center.</p>
            <form className="accessForm" onSubmit={unlock}>
              <label htmlFor="aegis-access-password">COMMAND PASSWORD</label>
              <div className="accessInputWrap">
                <LockKeyhole size={15} />
                <input
                  id="aegis-access-password"
                  type="password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(""); }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              <button type="submit"><ShieldCheck size={15} /> UNLOCK COMMAND CENTER</button>
              <small className={`accessError ${error ? "visible" : ""}`}>{error || "ACCESS CONTROL ACTIVE"}</small>
            </form>
          </>
        )}
      </section>
      <footer className="accessFooter"><span><i /> PRIVATE CONTROL SURFACE</span><b>V10 · PAPER-SAFE</b></footer>
    </main>
  );
}

function App() {
  return <AccessGate />;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function numericStatus(status, keys, fallback = 0) {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], status);
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

const TREASURY_ACCOUNT_SLOTS = [
  { id: "operating", label: "OPERATING TREASURY", detail: "Liquidez operativa" },
  { id: "defi", label: "DEFI RESERVE", detail: "Capital para protocolos DeFi" },
  { id: "risk", label: "RISK BUFFER", detail: "Capital protegido" },
  { id: "tax", label: "TAX RESERVE", detail: "Reserva fiscal" },
];
const EVM_CHAIN_NAMES = { 1: "Ethereum", 10: "Optimism", 56: "BNB Chain", 137: "Polygon", 8453: "Base", 42161: "Arbitrum", 43114: "Avalanche" };
const isWalletAddress = value => /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
const shortWallet = value => isWalletAddress(value) ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";
function nativeToHex(value) {
  const text = String(value || "").trim();
  if (!/^\d+(\.\d{1,18})?$/.test(text) || Number(text) < 0) throw new Error("Introduce un importe nativo válido (máximo 18 decimales).");
  const [whole, fraction = ""] = text.split(".");
  const wei = BigInt(whole || "0") * 1000000000000000000n + BigInt((fraction + "000000000000000000").slice(0, 18));
  return `0x${wei.toString(16)}`;
}
function formatNativeBalance(hex) {
  try { return (Number(BigInt(hex || "0x0")) / 1e18).toFixed(4); } catch { return "0.0000"; }
}

function PageHeader({ eyebrow, title, description, color, image, onBack, onTalk }) {
  return (
    <div className="brainPageHeader" style={{ "--page-accent": color }}>
      <div className="pageHeaderCopy">
        <button className="pageBack" onClick={onBack}>
          <ArrowRight size={13} /> CONTROL SURFACE
        </button>
        <span className="pageEyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="pageHeaderActions">
          <span className="paperBadge"><i /> PAPER · INTERNAL LEDGER</span>
          <button className="pageTalk" onClick={onTalk}>
            <MessageCircle size={14} /> Hablar con este Brain
          </button>
        </div>
      </div>
      <div className="pageHeaderBrain">
        <BrainImage src={image} color={color} size={178} active />
        <i />
      </div>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="financeMetric" style={{ "--metric": color }}>
      <div className="metricIcon"><Icon size={16} /></div>
      <small>{label}</small>
      <b>{value}</b>
      <span>{sub}</span>
    </div>
  );
}

function InternalAction({ icon: Icon, children, onClick, tone = "cyan", disabled = false }) {
  return (
    <button className={`internalAction ${tone}`} onClick={onClick} disabled={disabled}>
      <Icon size={14} /> {children}
    </button>
  );
}

function CeoPage({ report, onTalk, onBack }) {
  const [data, setData] = useState({ reports: [], audit: [], agents: [] });
  const [notice, setNotice] = useState("Executive reporting stream ready");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [latest, reports, audit, agents] = await Promise.all([
      fetch(`${CEO}/api/report`).then((r) => r.json()),
      fetch(`${CEO}/api/reports`).then((r) => r.json()),
      fetch(`${CEO}/api/audit`).then((r) => r.json()),
      fetch(`${CEO}/api/agents`).then((r) => r.json()),
    ]);
    setData({ reports, audit, agents });
    return latest;
  }, []);
  useEffect(() => {
    load().catch(() => setNotice("CEO telemetry unavailable · retrying"));
    const timer = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [load]);
  const latest = data.reports[0] || report || {};
  const agentsOnline = data.agents.filter((agent) => agent.status === "online").length;
  async function deliver(channel) {
    setBusy(true);
    try {
      const response = await fetch(`${CEO}/api/deliver/${channel}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "master-ui", report: latest }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || "Delivery failed");
      setNotice(result.ok ? `Reporte enviado por ${channel}` : `${channel.toUpperCase()} listo · ${result.reason || "configuración pendiente"}`);
      load().catch(() => {});
    } catch (error) {
      setNotice(`${channel.toUpperCase()} no disponible · ${error.message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="brainPage ceoPage">
      <PageHeader
        eyebrow="BRAIN 07 · EXECUTIVE COMMAND"
        title="CEO BRAIN"
        description="Centro ejecutivo de AEGIS: recibe el reporte del Manager, filtra prioridades, registra auditoría y comunica decisiones a Neiver."
        color="#bd58ff"
        image={CEO_IMAGE}
        onBack={onBack}
        onTalk={onTalk}
      />
      <div className="pageNotice"><Crown size={14} /> {notice}</div>
      <div className="financeMetrics">
        <MetricTile icon={Activity} label="PORTFOLIO HEALTH" value={`${latest.portfolioHealth ?? 0}%`} sub="latest Manager report" color="#bd58ff" />
        <MetricTile icon={Network} label="BRAINS ONLINE" value={latest.brainsOnline || "0/5"} sub="Manager telemetry" color="#25e8ff" />
        <MetricTile icon={AlertTriangle} label="OPEN INCIDENTS" value={latest.openIncidents ?? 0} sub="requires executive review" color="#ff6478" />
        <MetricTile icon={Users} label="CEO AGENTS" value={`${agentsOnline}/${data.agents.length || 10}`} sub="command mesh online" color="#57ef75" />
      </div>
      <div className="financeColumns">
        <section className="financePanel executiveReportPanel">
          <div className="financePanelTitle"><div><span>MANAGER → CEO FEED</span><h2>Executive report</h2></div><i className="liveLabel"><em /> LIVE</i></div>
          <div className="ceoBrief"><b>{latest.headline || "WAITING FOR REPORT"}</b><p>{latest.summary || "El CEO está esperando la primera lectura del Manager."}</p><small>{latest.generatedAt ? new Date(latest.generatedAt).toLocaleString() : "No timestamp"}</small></div>
          <div className="reportRows">
            <ReportRow label="Portfolio health" value={`${latest.portfolioHealth ?? 0}%`} up={(latest.portfolioHealth ?? 0) >= 80} />
            <ReportRow label="Critical problems" value={latest.criticalProblems ?? 0} up={!latest.criticalProblems} />
            <ReportRow label="Pending proposals" value={latest.pendingProposals ?? 0} up={!latest.pendingProposals} />
            <ReportRow label="Open incidents" value={latest.openIncidents ?? 0} up={!latest.openIncidents} />
          </div>
          {(latest.priorities || []).length > 0 && <div className="priorityList">{latest.priorities.slice(0, 4).map((item) => <span key={`${item.brain}-${item.action}`}><AlertTriangle size={11} /> {item.brain} · {item.action}</span>)}</div>}
        </section>
        <section className="financePanel actionPanel">
          <div className="financePanelTitle"><div><span>CEO → NEIVER ROUTER</span><h2>Delivery controls</h2></div><i className="guarded">GUARDED</i></div>
          <p className="panelExplain">El CEO prepara el mismo informe ejecutivo para los canales autorizados. Si falta una credencial, el sistema devuelve un estado explícito y no simula un envío.</p>
          <InternalAction icon={Mail} onClick={() => deliver("email")} disabled={busy}>Enviar reporte por email</InternalAction>
          <InternalAction icon={Send} onClick={() => deliver("telegram")} tone="purple" disabled={busy}>Enviar reporte por Telegram</InternalAction>
          <InternalAction icon={RefreshCw} onClick={() => load().then(() => setNotice("Executive feed refreshed")).catch(() => setNotice("Refresh failed"))}>Actualizar reporte</InternalAction>
          <div className="controlFoot"><ShieldCheck size={13} /> approval + audit trail · active</div>
        </section>
      </div>
      <section className="financePanel booksPanel">
        <div className="financePanelTitle"><div><span>CEO AGENT MESH</span><h2>Executive responsibilities</h2></div><i>{data.agents.length || 10} AGENTS</i></div>
        <div className="agentCards">{data.agents.map((agent) => <div className="agentCard" key={agent.id}><span className="agentIcon"><Crown size={14} /></span><div><b>{agent.name}</b><small>executive control plane</small></div><i className={agent.status === "online" ? "agentOnline" : "agentOffline"}>{agent.status}</i></div>)}</div>
      </section>
      <section className="financePanel booksPanel downstreamPanel">
        <div className="financePanelTitle"><div><span>MANAGER TELEMETRY RETURN</span><h2>Downstream Brain reports</h2></div><i>{(latest.brains || []).length || 5} TARGETS</i></div>
        <div className="downstreamGrid">{(latest.brains || []).map((brain) => <div className="downstreamItem" key={brain.id}><span className={brain.status === "online" ? "agentOnline" : "agentOffline"}>{brain.status === "online" ? <CheckCircle2 size={13} /> : <CircleX size={13} />}</span><div><b>{brain.name || brain.id}</b><small>{brain.health?.mode || brain.health?.status || brain.error || "telemetry received"}</small></div><strong>{brain.status}</strong></div>)}</div>
      </section>
      <section className="financePanel ledgerPanel">
        <div className="financePanelTitle"><div><span>EXECUTIVE AUDIT STREAM</span><h2>Reports & decisions</h2></div><i>{data.audit.length} EVENTS</i></div>
        <div className="ledgerTable ledgerHeader"><span>TIME</span><span>ACTION</span><span>CHANNEL</span><span>STATUS</span><span>ID</span></div>
        {(data.audit.length ? data.audit : [{ at: new Date().toISOString(), action: "waiting_for_event" }]).slice(0, 8).map((event, index) => <div className="ledgerTable ledgerEntry" key={event.id || index}><span>{new Date(event.at).toLocaleTimeString("en-US", { hour12: false })}</span><b>{event.action}</b><span>{event.message ? "CEO CHAT" : "SYSTEM"}</span><strong className="gain">RECORDED</strong><i>{event.id ? event.id.slice(0, 8) : "—"}</i></div>)}
      </section>
      <div className="pageSafety ceoSafety"><Crown size={15} /><span><b>EXECUTIVE BOUNDARY</b> · CEO Brain puede reportar, priorizar y solicitar acciones. Las operaciones de riesgo permanecen bajo las políticas del Manager y el modo PAPER.</span></div>
    </section>
  );
}

function ManagerPage({ report, onTalk, onOpenPage, onBack }) {
  const [data, setData] = useState({ state: null, agents: [], functions: [], proposals: [], incidents: [] });
  const [notice, setNotice] = useState("Manager control plane ready");
  const [running, setRunning] = useState("");
  const load = useCallback(async () => {
    const [state, agents, functions, proposals, incidents] = await Promise.all([
      fetch(`${MANAGER}/api/state`).then((r) => r.json()),
      fetch(`${MANAGER}/api/agents`).then((r) => r.json()),
      fetch(`${MANAGER}/api/functions`).then((r) => r.json()),
      fetch(`${MANAGER}/api/proposals`).then((r) => r.json()),
      fetch(`${MANAGER}/api/incidents`).then((r) => r.json()),
    ]);
    setData({ state, agents, functions, proposals, incidents });
  }, []);
  useEffect(() => {
    load().catch(() => setNotice("Manager telemetry unavailable · retrying"));
    const timer = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [load]);
  const snapshot = data.state?.snapshot || { brains: [], online: 0, total: 0 };
  const openIncidents = data.incidents.filter((incident) => incident.status === "open");
  const onlineCount = snapshot.online ?? snapshot.brains.filter((brain) => brain.status === "online").length;
  const satelliteCount = Object.keys(satelliteMeta).length;
  async function runFunction(id) {
    setRunning(id);
    try {
      const response = await fetch(`${MANAGER}/api/functions/${id}/run`, { method: "POST", headers: { "content-type": "application/json" } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Function failed");
      setNotice(`${result.function.label} · completed`);
      load().catch(() => {});
    } catch (error) {
      setNotice(`Function error · ${error.message}`);
    } finally {
      setRunning("");
    }
  }
  async function resolveIncident(id) {
    const response = await fetch(`${MANAGER}/api/incidents/${id}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "master-ui" }) });
    if (!response.ok) setNotice("Incident could not be resolved");
    else { setNotice("Incident marked resolved"); load().catch(() => {}); }
  }
  return (
    <section className="brainPage managerPage">
      <PageHeader
        eyebrow="BRAIN 06 · OPERATIONS ORCHESTRATOR"
        title="MANAGER BRAIN"
        description="Centro de control de la jerarquía operativa: inspecciona cada Brain, ejecuta funciones de gobierno, registra incidentes y entrega el resumen al CEO."
        color="#20a9ff"
        image={MANAGER_IMAGE}
        onBack={onBack}
        onTalk={onTalk}
      />
      <div className="pageNotice"><GitBranch size={14} /> {notice}</div>
      <div className="financeMetrics">
        <MetricTile icon={Network} label="OPERATIVE BRAINS" value={`${onlineCount}/${snapshot.total || 5}`} sub="live hierarchy probe" color="#20a9ff" />
        <MetricTile icon={Users} label="MANAGER AGENTS" value={`${data.agents.filter((agent) => agent.status === "online").length}/${data.agents.length || 10}`} sub="orchestration mesh" color="#57ef75" />
        <MetricTile icon={ListChecks} label="CONTROL FUNCTIONS" value={data.functions.length} sub="click to run audit" color="#25e8ff" />
        <MetricTile icon={Landmark} label="INTERNAL SATELLITES" value={`${satelliteCount}/${satelliteCount}`} sub="Banking + Account · PAPER" color="#14b8a6" />
      </div>
      <div className="financeColumns">
        <section className="financePanel hierarchyPanel">
          <div className="financePanelTitle"><div><span>CEO → MANAGER → BRAINS</span><h2>Operational hierarchy</h2></div><i className="liveLabel"><em /> PROBING</i></div>
          <div className="managerHierarchy"><div className="hierarchyNode root"><Crown size={15} /><div><b>CEO BRAIN</b><small>receives executive report</small></div><i className="agentOnline">ONLINE</i></div><div className="hierarchyConnector" /><div className="hierarchyNode managerNodePage"><Command size={15} /><div><b>MANAGER BRAIN</b><small>allocates, audits, escalates</small></div><i className="agentOnline">ONLINE</i></div><div className="hierarchyConnector" />{snapshot.brains.map((brain) => <div className="hierarchyNode targetNode" key={brain.id}><Brain size={14} style={{ color: brain.status === "online" ? "#57ef75" : "#ff6478" }} /><div><b>{brain.name || brain.id}</b><small>{brain.url || "target telemetry"}</small></div><i className={brain.status === "online" ? "agentOnline" : "agentOffline"}>{brain.status === "online" ? "ONLINE" : "OFFLINE"}</i></div>)}<div className="hierarchyConnector" /><div className="managerSatelliteDivider"><span>INTERNAL SATELLITE LAYER</span><small>managed in Master UI · paper-safe</small></div>{Object.entries(satelliteMeta).map(([id, meta]) => { const Icon = id === "banking" ? Landmark : ReceiptText; return <button className="hierarchyNode targetNode managerSatelliteNode" key={id} onClick={() => onOpenPage?.(id)}><Icon size={14} style={{ color: meta.color }} /><div><b>{meta.name}</b><small>{meta.role}</small></div><i className="agentOnline">PAPER</i></button>; })}</div>
        </section>
        <section className="financePanel actionPanel">
          <div className="financePanelTitle"><div><span>MANAGER → CEO FEED</span><h2>Executive handoff</h2></div><i className="guarded">GUARDED</i></div>
          <p className="panelExplain">El Manager alimenta el reporte ejecutivo con el snapshot de los cinco Brains y mantiene incidentes/propuestas para revisión del CEO.</p>
          <ReportRow label="Portfolio health" value={`${report?.portfolioHealth ?? 0}%`} up={(report?.portfolioHealth ?? 0) >= 80} />
          <ReportRow label="Brains online" value={report?.brainsOnline || `${onlineCount}/${snapshot.total || 5}`} up={onlineCount === (snapshot.total || 5)} />
          <ReportRow label="Pending proposals" value={data.proposals.filter((proposal) => proposal.status === "proposed").length} up={!data.proposals.some((proposal) => proposal.status === "proposed")} />
          <InternalAction icon={RefreshCw} onClick={() => load().then(() => setNotice("Hierarchy snapshot refreshed")).catch(() => setNotice("Snapshot failed"))}>Actualizar jerarquía</InternalAction>
          <div className="controlFoot"><ShieldCheck size={13} /> Manager governance boundary · active</div>
        </section>
      </div>
      <section className="financePanel booksPanel managerSatellitePanel">
        <div className="financePanelTitle"><div><span>MANAGER → INTERNAL SATELLITES</span><h2>Banking & Account operations</h2></div><i className="liveLabel"><em /> CONNECTED</i></div>
        <p className="panelExplain">Estas dos unidades forman la capa interna del sistema. Manager las coordina mediante políticas PAPER y las abre en sus superficies operativas para revisión.</p>
        <div className="downstreamGrid">{Object.entries(satelliteMeta).map(([id, meta]) => { const Icon = id === "banking" ? Landmark : ReceiptText; return <button className="downstreamItem managerSatelliteLink" key={id} onClick={() => onOpenPage?.(id)} style={{ "--satellite": meta.color }}><span><Icon size={16} /></span><div><b>{meta.name}</b><small>{meta.role} · internal control</small></div><strong>PAPER READY</strong><ArrowRight size={14} /></button>; })}</div>
      </section>
      <section className="financePanel booksPanel">
        <div className="financePanelTitle"><div><span>MANAGER CONTROL ROOM</span><h2>Functions & agents</h2></div><i>{data.functions.length} FUNCTIONS</i></div>
        <div className="functionCards">{data.functions.map((fn) => <div className="functionCard" key={fn.id}><span className="functionSymbol">{fn.symbol || "◈"}</span><div><b>{fn.label}</b><small>{fn.agent} · {fn.lastRunAt ? new Date(fn.lastRunAt).toLocaleTimeString("en-US", { hour12: false }) : "never run"}</small></div><button onClick={() => runFunction(fn.id)} disabled={running === fn.id}>{running === fn.id ? "RUNNING" : "RUN"}</button></div>)}</div>
      </section>
      <div className="financeColumns managerLowerColumns">
        <section className="financePanel incidentPanel">
          <div className="financePanelTitle"><div><span>PROBLEM DETECTOR</span><h2>Incidents</h2></div><i>{openIncidents.length} OPEN</i></div>
          {data.incidents.length ? data.incidents.slice(0, 6).map((incident) => <div className="incidentRow" key={incident.id}><span className={incident.status === "open" ? "incidentOpen" : "incidentResolved"}>{incident.status === "open" ? <CircleX size={13} /> : <CheckCircle2 size={13} />}</span><div><b>{incident.brain?.toUpperCase()} · {incident.severity}</b><small>{incident.reason || "No reason provided"}</small></div>{incident.status === "open" && <button onClick={() => resolveIncident(incident.id)}>RESOLVE</button>}</div>) : <div className="emptyPanel"><CheckCircle2 size={16} /> No incidents</div>}
        </section>
        <section className="financePanel proposalPanel">
          <div className="financePanelTitle"><div><span>OPTIMIZATION QUEUE</span><h2>Proposals</h2></div><i>{data.proposals.length} TOTAL</i></div>
          {data.proposals.length ? data.proposals.slice(0, 6).map((proposal) => <div className="proposalRow" key={proposal.id}><SlidersHorizontal size={13} /><div><b>{proposal.title || proposal.name || "Optimization proposal"}</b><small>{proposal.status} · confidence {Math.round(Number(proposal.confidence || 0) * 100)}%</small></div><strong>{proposal.risk || "low"}</strong></div>) : <div className="emptyPanel"><Radio size={16} /> No pending proposals</div>}
        </section>
      </div>
      <div className="pageSafety managerSafety"><GitBranch size={15} /><span><b>MANAGER BOUNDARY</b> · Manager Brain coordina la jerarquía operativa y reporta al CEO. No ejecuta capital real desde esta página; cada función conserva su propia política y auditoría.</span></div>
    </section>
  );
}

function SatelliteCommandChamber({ brain, color, subtitle, modules }) {
  const [selected, setSelected] = useState(modules?.[0]?.id || null);
  const active = modules.find((module) => module.id === selected) || modules[0];
  function openModule(module) {
    setSelected(module.id);
    window.setTimeout(() => document.querySelector(`[data-satellite-module="${module.target || module.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }
  return (
    <section className="satelliteChamber" style={{ "--chamber-accent": color }}>
      <div className="satelliteChamberHeader">
        <div><small>03.6 / {brain} · COMMAND CHAMBER</small><h2>{subtitle}</h2><p>Explora los módulos operativos y abre directamente el control conectado. Todo permanece en modo PAPER y requiere revisión antes de cualquier acción sensible.</p></div>
        <span className="satelliteLive"><i />PAPER CORE · ONLINE</span>
      </div>
      <div className="satelliteChamberBody">
        <div className="satelliteStage" aria-label={`${brain} 3D command chamber`}>
          <div className="satelliteStarField" />
          <div className="satelliteRing ringOuter" /><div className="satelliteRing ringMiddle" /><div className="satelliteRing ringInner" />
          <div className="satelliteRoute routeOne" /><div className="satelliteRoute routeTwo" /><div className="satelliteRoute routeThree" />
          <div className="satelliteCore"><span><Brain size={25} /></span><b>{brain.replace(" BRAIN", "")}</b><small>SAFE / PAPER</small></div>
          {modules.map((module, index) => {
            const angle = (Math.PI * 2 * index) / modules.length - Math.PI / 2;
            const Icon = module.icon || Brain;
            const left = 50 + Math.cos(angle) * 39;
            const top = 50 + Math.sin(angle) * 39;
            return <button className={`satelliteNode ${selected === module.id ? "selected" : ""}`} key={module.id} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => openModule(module)} aria-label={`Open ${module.label}`}><span><Icon size={16} /></span><b>{module.label}</b><i /></button>;
          })}
        </div>
        <div className="satelliteInspector"><small>SELECTED MODULE</small><h3>{active?.label || "COMMAND NODE"}</h3><p>{active?.detail || "Selecciona un nodo para inspeccionar su control."}</p><button onClick={() => active && openModule(active)}><ArrowRight size={14} /> OPEN CONNECTED CONTROL</button><span><CheckCircle2 size={13} /> no live movement · approval boundary active</span></div>
      </div>
      <div className="satelliteModuleStrip">{modules.map((module) => <button key={module.id} className={selected === module.id ? "selected" : ""} onClick={() => openModule(module)}><span>{module.label}</span><small>{module.detail}</small></button>)}</div>
    </section>
  );
}

const operationalModules = {
  finance: [
    { id: "portfolio", label: "PORTFOLIO", detail: "Equity, paper PnL y asignación de capital.", icon: CircleDollarSign, target: "operational-metrics" },
    { id: "risk", label: "RISK CONTROL", detail: "Límites, exposición y guardas de ejecución.", icon: ShieldCheck, target: "operational-controls" },
    { id: "opportunities", label: "OPPORTUNITIES", detail: "Señales y oportunidades para revisar.", icon: Target, target: "operational-controls" },
    { id: "ledger", label: "PAPER LEDGER", detail: "Actividad simulada y trazabilidad.", icon: ReceiptText, target: "operational-metrics" },
  ],
  commerce: [
    { id: "catalog", label: "CATALOG", detail: "Productos y drafts comerciales.", icon: Briefcase, target: "operational-metrics" },
    { id: "signals", label: "DEMAND SIGNALS", detail: "Señales de demanda y proveedores.", icon: Activity, target: "operational-controls" },
    { id: "offers", label: "OFFERS", detail: "Precio, margen y sensibilidad.", icon: CircleDollarSign, target: "operational-controls" },
    { id: "sync", label: "MARKETPLACE SYNC", detail: "Sincronización controlada.", icon: RefreshCw, target: "operational-controls" },
  ],
  saas: [
    { id: "products", label: "PRODUCTS", detail: "Productos SaaS y proyectos activos.", icon: Cpu, target: "operational-metrics" },
    { id: "mrr", label: "MRR CONTROL", detail: "Ingresos recurrentes y crecimiento.", icon: CircleDollarSign, target: "operational-metrics" },
    { id: "retention", label: "RETENTION", detail: "Cohortes, churn y expansión.", icon: Users, target: "operational-controls" },
    { id: "billing", label: "BILLING", detail: "Stripe y eventos de suscripción.", icon: ReceiptText, target: "operational-controls" },
  ],
  media: [
    { id: "content", label: "CONTENT", detail: "Piezas, briefs y calendario.", icon: Sparkles, target: "operational-metrics" },
    { id: "generation", label: "GENERATION", detail: "MuAPI y generación de assets.", icon: Wand2, target: "operational-controls" },
    { id: "distribution", label: "DISTRIBUTION", detail: "Social, SEO y alcance.", icon: Radio, target: "operational-controls" },
    { id: "analytics", label: "ANALYTICS", detail: "Reach, engagement y rendimiento.", icon: Activity, target: "operational-metrics" },
  ],
  institutional: [
    { id: "deal-builder", label: "DEAL BUILDER", detail: "Financial Specification Engine.", icon: ListChecks, target: "operational-metrics" },
    { id: "simulation-lab", label: "SIMULATION LAB", detail: "Digital twin y escenarios adversos.", icon: Terminal, target: "operational-controls" },
    { id: "security-center", label: "SECURITY CENTER", detail: "Invariantes financieros y readiness.", icon: ShieldCheck, target: "operational-controls" },
    { id: "network-intelligence", label: "NETWORK INTELLIGENCE", detail: "EVM · Stellar · Canton fit.", icon: Network, target: "operational-metrics" },
  ],
};

function OperationalBrainPage({ brainId, onTalk, onBack }) {
  const meta = brainMeta[brainId];
  const url = BRAIN_APIS[brainId];
  const [health, setHealth] = useState(null);
  const [notice, setNotice] = useState("Operational telemetry ready");
  const load = useCallback(async () => {
    const response = await fetch(`${url}/health?master_ui=${Date.now()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    setHealth(data);
    setNotice("Live connection confirmed · PAPER boundary active");
  }, [url]);
  useEffect(() => {
    load().catch(() => setNotice("Brain telemetry unavailable · retrying"));
    const timer = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [load]);
  const modules = operationalModules[brainId] || [];
  const color = meta?.color || "#25e8ff";
  return (
    <section className="brainPage operationalPage fullBrainSurface" style={{ "--page-accent": color }}>
      <div className="brainEmbedShell" style={{ "--page-accent": color }}>
        <iframe title={`${meta.name} full cockpit`} src={`/brain-ui/${brainId}/`} />
      </div>
    </section>
  );
}

function ServicesPage({ onTalk, onBack }) {
  const [data, setData] = useState({ services: [], leads: [], proposals: [], projects: [], kpis: {}, crm: null });
  const [notice, setNotice] = useState("Service catalog ready · PAPER mode");
  const [busy, setBusy] = useState("");
  const [crmForm, setCrmForm] = useState({name: "", email: "", company: "", serviceId: "", goal: ""});
  const load = useCallback(async () => {
    const [summaryResponse, crmResponse] = await Promise.all([fetch(`${SERVICES}/api/summary`), fetch(`${SERVICES}/api/crm/dashboard`)]);
    if (!summaryResponse.ok || !crmResponse.ok) throw new Error("Services telemetry unavailable");
    const [summary, crm] = await Promise.all([summaryResponse.json(), crmResponse.json()]);
    setData({...summary, crm});
  }, []);
  useEffect(() => {
    load().catch(() => setNotice("Services Brain unavailable · start the service node"));
    const timer = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [load]);
  async function createProposal(service) {
    setBusy(service.id);
    try {
      const response = await fetch(`${SERVICES}/api/proposals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ serviceId: service.id, clientName: "New service lead", source: "master-ui", notes: "Draft created from Services Brain command surface" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Proposal failed");
      setNotice(`${service.name} · propuesta PAPER creada`);
      await load();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(""); }
  }
  async function captureLead(event) {
    event.preventDefault(); setBusy("crm");
    try {
      const response = await fetch(`${SERVICES}/api/crm/contacts`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({...crmForm, sendWelcome: true, source: "master-services-crm"})});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "CRM contact failed");
      setNotice(`${result.contact.name} · contacto capturado y welcome enviado`); setCrmForm({name: "", email: "", company: "", serviceId: "", goal: ""}); await load();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(""); }
  }
  return (
    <section className="brainPage servicesPage">
      <PageHeader eyebrow="BRAIN 05 · SERVICE REVENUE" title="SERVICES BRAIN" description="Tu unidad comercial para vender, cotizar y entregar videos, páginas web, SEO, music videos y servicios digitales desde un solo command center." color="#ff8b5b" image="/brains/services.svg" onBack={onBack} onTalk={onTalk} />
      <div className="pageNotice"><Briefcase size={14} /> {notice}</div>
      <div className="financeMetrics">
        <MetricTile icon={Briefcase} label="SERVICES READY" value={data.kpis.serviceCount ?? data.services.length} sub="commercial catalog" color="#ff8b5b" />
        <MetricTile icon={Users} label="ACTIVE LEADS" value={data.crm?.kpis?.leads ?? data.kpis.leads ?? data.leads.length} sub="qualification queue" color="#25e8ff" />
        <MetricTile icon={FileText} label="PROPOSALS" value={data.crm?.kpis?.proposals ?? data.kpis.proposals ?? data.proposals.length} sub="PAPER drafts" color="#ffc531" />
        <MetricTile icon={Activity} label="PIPELINE" value={money(data.kpis.pipeline)} sub="proposal value" color="#57ef75" />
      </div>
      <section className="financePanel crmPanel"><div className="financePanelTitle"><div><span>CRM COMMAND CENTER</span><h2>Capture, qualify and communicate</h2></div><i className="liveLabel"><em /> RESEND {data.crm?.email?.verified ? "VERIFIED" : "CHECKING"}</i></div><div className="crmPanelBody"><form className="crmLeadForm" onSubmit={captureLead}><input required placeholder="Nombre" value={crmForm.name} onChange={event => setCrmForm({...crmForm, name: event.target.value})}/><input required type="email" placeholder="Email" value={crmForm.email} onChange={event => setCrmForm({...crmForm, email: event.target.value})}/><input placeholder="Empresa" value={crmForm.company} onChange={event => setCrmForm({...crmForm, company: event.target.value})}/><select value={crmForm.serviceId} onChange={event => setCrmForm({...crmForm, serviceId: event.target.value})}><option value="">Servicio de interés</option>{data.services.map(service => <option value={service.id} key={service.id}>{service.name}</option>)}</select><input className="crmGoal" placeholder="¿Qué quiere lograr?" value={crmForm.goal} onChange={event => setCrmForm({...crmForm, goal: event.target.value})}/><button type="submit" disabled={busy === "crm"}>{busy === "crm" ? "GUARDANDO…" : "CAPTURAR + WELCOME"}</button></form><div className="crmSignals"><span><small>PIPELINE</small><b>{data.crm?.pipeline?.newLeads || 0} NEW · {data.crm?.pipeline?.qualified || 0} QUALIFIED</b></span><span><small>FROM</small><b>{data.crm?.email?.from || "Resend pending"}</b></span><span><small>TOOLS</small><b>Commerce · Media · SaaS · MuAPI</b></span></div></div></section>
      <section className="financePanel serviceCatalogPanel">
        <div className="financePanelTitle"><div><span>SERVICE REVENUE CATALOG</span><h2>Sell the full capability stack</h2></div><i>{data.services.length || 12} SERVICES</i></div>
        <p className="panelExplain">Cada tarjeta abre un siguiente paso comercial. Las propuestas se guardan como borradores PAPER y pueden pasar a delivery después de tu aprobación.</p>
        <div className="serviceCatalogGrid">
          {data.services.map((service) => <article className="serviceCatalogCard" key={service.id}>
            <div><span>{service.category}</span><i>{service.model}</i></div>
            <h3>{service.name}</h3>
            <p>{service.description}</p>
            <small>{service.delivery} · desde {money(service.startingFrom)}</small>
            <button onClick={() => createProposal(service)} disabled={busy === service.id}>{busy === service.id ? "CREATING…" : "CREAR PROPUESTA"}<ArrowUpRight size={12} /></button>
          </article>)}
        </div>
      </section>
      <div className="financeColumns">
        <section className="financePanel actionPanel"><div className="financePanelTitle"><div><span>SERVICE PIPELINE</span><h2>Next commercial moves</h2></div><i className="guarded">PAPER</i></div><ReportRow label="Leads to qualify" value={data.leads.length} up={data.leads.length === 0} /><ReportRow label="Draft proposals" value={data.proposals.length} up={data.proposals.length === 0} /><ReportRow label="Active projects" value={data.projects.length} up /><div className="controlFoot"><ShieldCheck size={13} /> sales + delivery boundary · active</div></section>
        <section className="financePanel actionPanel"><div className="financePanelTitle"><div><span>CROSS-BRAIN DELIVERY</span><h2>Commerce + Media connected</h2></div><i className="liveLabel"><em /> READY</i></div><p className="panelExplain">Commerce aporta ofertas y marketplace. Media aporta producción, creatividades y distribución. Services Brain convierte esa capacidad en propuestas vendibles y proyectos trazables.</p><InternalAction icon={MessageCircle} onClick={onTalk}>Hablar con Sales Agent</InternalAction><InternalAction icon={RefreshCw} tone="purple" onClick={() => load().then(() => setNotice("Service pipeline refreshed")).catch(() => setNotice("Refresh failed"))}>Actualizar pipeline</InternalAction></section>
      </div>
      <section className="financePanel ledgerPanel"><div className="financePanelTitle"><div><span>PROPOSAL STREAM</span><h2>Recent commercial activity</h2></div><i>{data.proposals.length} DRAFTS</i></div><div className="ledgerTable ledgerHeader"><span>TIME</span><span>SERVICE</span><span>CLIENT</span><span>AMOUNT</span><span>STATUS</span></div>{(data.proposals.length ? data.proposals : [{ id: "empty", createdAt: new Date().toISOString(), service: "Waiting for first proposal", clientName: "—", amount: 0, status: "READY" }]).slice(0, 8).map((proposal) => <div className="ledgerTable ledgerEntry" key={proposal.id}><span>{new Date(proposal.createdAt).toLocaleTimeString("en-US", { hour12: false })}</span><b>{proposal.service}</b><span>{proposal.clientName}</span><strong className="gain">{money(proposal.amount)}</strong><i>{proposal.status}</i></div>)}</section>
      <div className="pageSafety servicesSafety"><Briefcase size={15} /><span><b>SERVICE SALES BOUNDARY</b> · Services Brain prepara ofertas, califica oportunidades y coordina delivery. Los precios y alcances quedan en PAPER hasta tu aprobación.</span></div>
    </section>
  );
}

function TreasuryMetaMaskPanel({ onNotice, onSubmitted }) {
  const [wallet, setWallet] = useState({ status: "DISCONNECTED", address: "", chainId: "", balance: "0.0000", error: "" });
  const [assignments, setAssignments] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem("aegis.treasury.accountAssignments") || "{}"); } catch { return {}; }
  });
  const [slot, setSlot] = useState(TREASURY_ACCOUNT_SLOTS[0].id);
  const [accountInput, setAccountInput] = useState("");
  const [defi, setDefi] = useState({ to: "", amount: "", data: "0x" });
  const [prepared, setPrepared] = useState(null);
  const [busy, setBusy] = useState(false);
  const provider = () => typeof window !== "undefined" ? window.ethereum : null;
  const refreshWallet = useCallback(async () => {
    const ethereum = provider();
    if (!ethereum) { setWallet(current => ({ ...current, status: "METAMASK NOT FOUND", error: "Instala MetaMask para conectar la tesorería." })); return; }
    try {
      const accounts = await ethereum.request({ method: "eth_accounts" });
      const chainId = await ethereum.request({ method: "eth_chainId" });
      const address = accounts?.[0] || "";
      const balance = address ? formatNativeBalance(await ethereum.request({ method: "eth_getBalance", params: [address, "latest"] })) : "0.0000";
      setWallet({ status: address ? "CONNECTED" : "DISCONNECTED", address, chainId, balance, error: "" });
    } catch (error) { setWallet(current => ({ ...current, status: "ERROR", error: error.message || "MetaMask no respondió." })); }
  }, []);
  useEffect(() => {
    refreshWallet();
    const ethereum = provider();
    if (!ethereum?.on) return undefined;
    const onAccounts = () => refreshWallet();
    const onChain = () => refreshWallet();
    ethereum.on("accountsChanged", onAccounts); ethereum.on("chainChanged", onChain);
    return () => { ethereum.removeListener?.("accountsChanged", onAccounts); ethereum.removeListener?.("chainChanged", onChain); };
  }, [refreshWallet]);
  async function connect() {
    const ethereum = provider();
    if (!ethereum) { onNotice?.("MetaMask no está instalado"); return; }
    try { await ethereum.request({ method: "eth_requestAccounts" }); await refreshWallet(); onNotice?.("MetaMask conectado · cuenta activa actualizada"); }
    catch (error) { onNotice?.(`MetaMask: ${error.message || "conexión cancelada"}`); }
  }
  function saveAssignment() {
    const address = String(accountInput || wallet.address).trim();
    if (!isWalletAddress(address)) { onNotice?.("Introduce una dirección EVM válida de 42 caracteres"); return; }
    const next = { ...assignments, [slot]: address };
    setAssignments(next); setAccountInput(address); window.localStorage.setItem("aegis.treasury.accountAssignments", JSON.stringify(next));
    onNotice?.(`${TREASURY_ACCOUNT_SLOTS.find(item => item.id === slot)?.label || slot} asignada a ${shortWallet(address)}`);
  }
  function prepareTransaction() {
    if (wallet.status !== "CONNECTED") { onNotice?.("Conecta MetaMask antes de preparar un movimiento"); return; }
    if (!isWalletAddress(defi.to)) { onNotice?.("El destino DeFi debe ser una dirección EVM válida"); return; }
    try {
      nativeToHex(defi.amount);
      if (!/^0x[0-9a-fA-F]*$/.test(defi.data || "0x")) throw new Error("El calldata debe comenzar por 0x y contener hexadecimal válido.");
      setPrepared({ ...defi, value: nativeToHex(defi.amount), chainId: wallet.chainId, from: wallet.address });
      onNotice?.("Movimiento DeFi preparado · revisa destino, red e importe antes de firmar");
    } catch (error) { onNotice?.(error.message); }
  }
  async function signTransaction() {
    const ethereum = provider();
    if (!ethereum || !prepared) return;
    setBusy(true);
    try {
      const hash = await ethereum.request({ method: "eth_sendTransaction", params: [{ from: prepared.from, to: prepared.to, value: prepared.value, data: prepared.data || "0x" }] });
      onSubmitted?.({ hash, amount: Number(prepared.amount || 0), network: EVM_CHAIN_NAMES[Number(prepared.chainId)] || `Chain ${Number(prepared.chainId)}` });
      onNotice?.(`Transacción enviada a MetaMask · ${String(hash).slice(0, 12)}…`); setPrepared(null); setDefi({ to: "", amount: "", data: "0x" }); await refreshWallet();
    } catch (error) { onNotice?.(`Firma no completada: ${error.message || "transacción rechazada"}`); }
    finally { setBusy(false); }
  }
  const chain = wallet.chainId ? (EVM_CHAIN_NAMES[Number(wallet.chainId)] || `Chain ${Number(wallet.chainId)}`) : "—";
  return <section className="financePanel treasuryWalletPanel" data-satellite-module="defi-wallet">
    <div className="financePanelTitle"><div><span>METAMASK · DEFI TREASURY</span><h2>Wallet control & account assignment</h2></div><i className={wallet.status === "CONNECTED" ? "liveLabel" : "guarded"}>{wallet.status}</i></div>
    <div className="treasuryWalletTop"><div className="treasuryWalletIdentity"><span className="treasuryWalletOrb"><WalletCards size={18} /></span><div><b>{wallet.address ? shortWallet(wallet.address) : "No wallet connected"}</b><small>{chain} · native balance {wallet.balance}</small></div></div><button className="internalAction" onClick={connect}><WalletCards size={14} /> {wallet.status === "CONNECTED" ? "REFRESH METAMASK" : "CONNECT METAMASK"}</button></div>
    {wallet.error && <div className="treasuryWalletError">{wallet.error}</div>}
    <div className="treasuryWalletColumns">
      <div className="treasuryAssignments"><div className="treasurySubhead"><span>ACCOUNT ASSIGNMENTS</span><small>{Object.keys(assignments).length}/{TREASURY_ACCOUNT_SLOTS.length} configured · local control</small></div><div className="treasuryAssignForm"><select value={slot} onChange={event => setSlot(event.target.value)}>{TREASURY_ACCOUNT_SLOTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input value={accountInput} onChange={event => setAccountInput(event.target.value)} placeholder={wallet.address || "0x… wallet address"} /><button onClick={saveAssignment}>ASSIGN</button></div><div className="treasuryAssignmentList">{TREASURY_ACCOUNT_SLOTS.map(item => <div key={item.id}><span><b>{item.label}</b><small>{item.detail}</small></span><strong>{shortWallet(assignments[item.id])}</strong></div>)}</div></div>
      <div className="treasuryDefiForm"><div className="treasurySubhead"><span>PREPARE DEFI MOVEMENT</span><small>explicit MetaMask signature required</small></div><label>DESTINATION CONTRACT / WALLET<input value={defi.to} onChange={event => setDefi(current => ({ ...current, to: event.target.value }))} placeholder="0x… verified protocol target" /></label><label>NATIVE AMOUNT<input inputMode="decimal" value={defi.amount} onChange={event => setDefi(current => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></label><label>CALLDATA <input value={defi.data} onChange={event => setDefi(current => ({ ...current, data: event.target.value }))} placeholder="0x" /></label><button className="internalAction" onClick={prepareTransaction}><Eye size={14} /> REVIEW TRANSACTION</button>{prepared && <div className="treasuryTxPreview"><b>{prepared.amount} native · {EVM_CHAIN_NAMES[Number(prepared.chainId)] || `Chain ${Number(prepared.chainId)}`}</b><small>{shortWallet(prepared.from)} → {shortWallet(prepared.to)}</small><button className="internalAction purple" disabled={busy} onClick={signTransaction}><Send size={14} /> {busy ? "WAITING FOR METAMASK" : "SIGN IN METAMASK"}</button></div>}</div>
    </div>
    <div className="treasuryWalletFoot"><ShieldCheck size={13} /> DeFi gateway guarded: no private keys stored, no autonomous signing, every movement is reviewed and signed in MetaMask.</div>
  </section>;
}

function BankingPage({ financeStatus, onTalk, onBack }) {
  const [notice, setNotice] = useState("Treasury reconciled · PAPER mode");
  const [ledger, setLedger] = useState([
    { date: "08:42:16", source: "FINANCE BRAIN", type: "Allocation", amount: 1850, status: "SETTLED", direction: "in" },
    { date: "08:21:04", source: "TAX RESERVE", type: "Reservation", amount: -370, status: "RESERVED", direction: "out" },
    { date: "07:55:32", source: "MANAGER BRAIN", type: "Liquidity route", amount: -620, status: "PAPER", direction: "out" },
    { date: "07:30:11", source: "ALPACA PAPER", type: "Broker sync", amount: 94.5, status: "SYNCED", direction: "in" },
  ]);
  const equity = numericStatus(financeStatus, ["ledger.equityUsd", "ledger.cashUsd", "equityUsd", "paperEquity", "account.equity", "account.equityUsd"], 10000);
  const reserved = 1780;
  const available = Math.max(0, equity - reserved);
  const riskBuffer = Math.max(0, Math.round(equity * 0.2));
  const accounts = [
    { name: "FINANCE BRAIN", detail: "Trading & DeFi · PAPER", amount: equity - 2400, color: "#57ef75" },
    { name: "OPERATIONS RESERVE", detail: "Cross-brain routing", amount: 2400, color: "#25e8ff" },
    { name: "TAX RESERVE", detail: "Estimated obligation", amount: 760, color: "#818cf8" },
    { name: "RISK BUFFER", detail: "Protected capital", amount: riskBuffer, color: "#ffc531" },
  ];
  function action(message) {
    setNotice(`${message} · propuesta registrada, sin movimiento real`);
  }
  function reconcile() {
    setLedger((items) => [
      { date: new Date().toLocaleTimeString("en-US", { hour12: false }), source: "BANKING BRAIN", type: "Reconciliation", amount: 0, status: "CHECKED", direction: "in" },
      ...items,
    ]);
    action("Treasury reconciliation complete");
  }
  return (
    <section className="brainPage bankingPage">
      <PageHeader
        eyebrow="BRAIN 08 · INTERNAL TREASURY"
        title="BANKING BRAIN"
        description="Centro de tesorería para organizar liquidez, reservas y movimientos entre los Brains con trazabilidad completa."
        color="#14b8a6"
        image={satelliteMeta.banking.image}
        onBack={onBack}
        onTalk={onTalk}
      />
      <SatelliteCommandChamber
        brain="BANKING BRAIN"
        color="#14b8a6"
        subtitle="Treasury command chamber"
        modules={[
          { id: "liquidity", label: "LIQUIDITY MAP", detail: "Distribución de cash y cuentas internas.", icon: WalletCards, target: "liquidity" },
          { id: "reserves", label: "RESERVES", detail: "Tax reserve y operating holds protegidos.", icon: ShieldCheck, target: "liquidity" },
          { id: "transfer", label: "TRANSFER QUEUE", detail: "Propuestas auditables entre Brains.", icon: ArrowUpRight, target: "controls" },
          { id: "risk", label: "RISK BUFFER", detail: "Floor de gobernanza para capital protegido.", icon: Activity, target: "controls" },
          { id: "reconcile", label: "RECONCILIATION", detail: "Verificación del ledger PAPER.", icon: RefreshCw, target: "ledger" },
          { id: "ledger", label: "PAPER LEDGER", detail: "Flujo de caja y trazabilidad de eventos.", icon: CircleDollarSign, target: "ledger" },
        ]}
      />
      <div className="pageNotice"><LockKeyhole size={14} /> {notice}</div>
      <TreasuryMetaMaskPanel onNotice={setNotice} onSubmitted={({ hash, amount, network }) => {
        setLedger((items) => [{ date: new Date().toLocaleTimeString("en-US", { hour12: false }), source: "METAMASK / DEFI", type: `Transaction submitted · ${network}`, amount: -(amount || 0), status: "SIGNED", direction: "out", hash }, ...items]);
      }} />
      <div className="financeMetrics">
        <MetricTile icon={Landmark} label="TOTAL TREASURY" value={money(equity)} sub="paper equity snapshot" color="#14b8a6" />
        <MetricTile icon={WalletCards} label="AVAILABLE CASH" value={money(available)} sub="unallocated liquidity" color="#25e8ff" />
        <MetricTile icon={ShieldCheck} label="RESERVED" value={money(reserved)} sub="tax + operating holds" color="#818cf8" />
        <MetricTile icon={Activity} label="RISK BUFFER" value={money(riskBuffer)} sub="governance floor 20%" color="#ffc531" />
      </div>
      <div className="financeColumns">
        <section className="financePanel treasuryAccounts" data-satellite-module="liquidity">
          <div className="financePanelTitle"><div><span>LIQUIDITY MAP</span><h2>Internal accounts</h2></div><i>4 LEDGERS</i></div>
          <div className="accountRows">
            {accounts.map((account) => (
              <div className="accountRow" key={account.name} style={{ "--account": account.color }}>
                <span className="accountOrb"><WalletCards size={15} /></span>
                <div><b>{account.name}</b><small>{account.detail}</small></div>
                <strong>{money(account.amount)}</strong>
                <i className="ledgerLive">TRACKED</i>
              </div>
            ))}
          </div>
          <div className="allocationBar" aria-label="Liquidity allocation">
            <i style={{ width: "58%", background: "#57ef75" }} /><i style={{ width: "17%", background: "#25e8ff" }} /><i style={{ width: "10%", background: "#818cf8" }} /><i style={{ width: "15%", background: "#ffc531" }} />
          </div>
          <div className="allocationLegend"><span><i /> deployed</span><span><i /> operations</span><span><i /> tax reserve</span><span><i /> risk buffer</span></div>
        </section>
        <section className="financePanel actionPanel" data-satellite-module="controls">
          <div className="financePanelTitle"><div><span>TREASURY CONTROLS</span><h2>Command queue</h2></div><i className="guarded">GUARDED</i></div>
          <p className="panelExplain">Las propuestas DeFi pasan por MetaMask. Banking no guarda claves ni firma automáticamente; cada movimiento requiere tu revisión y firma.</p>
          <InternalAction icon={ArrowUpRight} onClick={() => action("Transfer proposal created")}>Proponer transferencia</InternalAction>
          <InternalAction icon={ShieldCheck} onClick={() => action("Treasury lock requested")} tone="purple">Bloquear tesorería</InternalAction>
          <InternalAction icon={RefreshCw} onClick={reconcile}>Reconciliar ledger</InternalAction>
          <div className="controlFoot"><CheckCircle2 size={13} /> dual approval boundary · active</div>
        </section>
      </div>
      <section className="financePanel ledgerPanel" data-satellite-module="ledger">
        <div className="financePanelTitle"><div><span>REAL-TIME PAPER LEDGER</span><h2>Cash-flow activity</h2></div><i className="liveLabel"><em /> STREAMING</i></div>
        <div className="ledgerTable ledgerHeader"><span>TIME</span><span>SOURCE</span><span>EVENT</span><span>AMOUNT</span><span>STATUS</span></div>
        {ledger.map((entry, index) => (
          <div className="ledgerTable ledgerEntry" key={`${entry.date}-${index}`}>
            <span>{entry.date}</span><b>{entry.source}</b><span>{entry.type}</span><strong className={entry.amount >= 0 ? "gain" : "loss"}>{entry.amount >= 0 ? "+" : "−"}{money(Math.abs(entry.amount))}</strong><i>{entry.status}</i>
          </div>
        ))}
      </section>
      <div className="pageSafety"><ShieldCheck size={15} /><span><b>DEFI SIGNATURE GATE ACTIVE</b> · Banking Treasury puede preparar movimientos DeFi, pero solo MetaMask con tu firma explícita puede autorizar una transacción. No se almacenan claves privadas.</span></div>
    </section>
  );
}

function AccountPage({ report, financeStatus, onTalk, onBack }) {
  const [notice, setNotice] = useState("Books ready · review required before filing");
  const [entities, setEntities] = useState([
    { name: "AEGIS MASTER", type: "Parent operating structure", status: "DRAFT", children: ["Finance Operations", "Commerce Operations", "IP & Media"] },
    { name: "FINANCE OPERATIONS", type: "Trading & research ledger", status: "PAPER", children: ["Alpaca Paper", "DEX / DeFi research"] },
    { name: "IP & MEDIA", type: "Assets and content", status: "PLANNED", children: ["SaaS assets", "Media library"] },
  ]);
  const equity = numericStatus(financeStatus, ["equityUsd", "paperEquity", "account.equity", "account.equityUsd"], 10000);
  const realized = numericStatus(report, ["realizedPnl", "portfolio.realizedPnl", "pnl"], 0);
  const fees = 126.4;
  const taxReserve = Math.max(0, Math.round((Math.max(realized, equity - 10000) + fees) * 0.25));
  function action(message) {
    setNotice(`${message} · guardado como borrador`);
  }
  return (
    <section className="brainPage accountPage">
      <PageHeader
        eyebrow="BRAIN 09 · ACCOUNTS & STRUCTURE"
        title="ACCOUNT BRAIN"
        description="Libro maestro para compañías, cuentas, impuestos, documentos y estructura financiera. Todo queda separado por entidad y período."
        color="#818cf8"
        image={satelliteMeta.account.image}
        onBack={onBack}
        onTalk={onTalk}
      />
      <SatelliteCommandChamber
        brain="ACCOUNT BRAIN"
        color="#818cf8"
        subtitle="Books & structure command chamber"
        modules={[
          { id: "entities", label: "ENTITY GRAPH", detail: "Entidades, ownership y estructura operativa.", icon: Building2, target: "entities" },
          { id: "tax", label: "TAX CONTROL", detail: "Estimaciones por período y reservas fiscales.", icon: ReceiptText, target: "tax" },
          { id: "roles", label: "OWNERSHIP", detail: "Roles, miembros y aprobaciones controladas.", icon: Users, target: "books" },
          { id: "documents", label: "DOCUMENT VAULT", detail: "Recibos, invoices y statements preparados.", icon: FileText, target: "books" },
          { id: "audit", label: "AUDIT TRAIL", detail: "Historial inmutable de propuestas y cambios.", icon: LockKeyhole, target: "books" },
          { id: "reconcile", label: "RECONCILIATION", detail: "Matching entre broker y libros internos.", icon: RefreshCw, target: "books" },
        ]}
      />
      <div className="pageNotice"><ReceiptText size={14} /> {notice}</div>
      <div className="financeMetrics">
        <MetricTile icon={CircleDollarSign} label="PAPER EQUITY" value={money(equity)} sub="source: Finance Brain" color="#818cf8" />
        <MetricTile icon={ArrowUpRight} label="REALIZED PNL" value={money(realized)} sub="requires broker reconciliation" color="#57ef75" />
        <MetricTile icon={ReceiptText} label="TAX RESERVE" value={money(taxReserve)} sub="estimated 25% placeholder" color="#ffc531" />
        <MetricTile icon={FileText} label="OPEN REVIEWS" value={report?.openIncidents ?? 0} sub="items needing review" color="#ff6478" />
      </div>
      <div className="financeColumns accountColumns">
        <section className="financePanel entityPanel" data-satellite-module="entities">
          <div className="financePanelTitle"><div><span>ENTITY GRAPH</span><h2>Company structure</h2></div><i>3 NODES</i></div>
          <div className="entityTree">
            {entities.map((entity, index) => (
              <div className={`entityNode level${index}`} key={entity.name} style={{ "--entity": index ? "#25e8ff" : "#818cf8" }}>
                <div className="entityNodeTop"><Building2 size={15} /><b>{entity.name}</b><i>{entity.status}</i></div>
                <small>{entity.type}</small>
                <div className="entityChildren">{entity.children.map((child) => <span key={child}><i />{child}</span>)}</div>
              </div>
            ))}
          </div>
          <InternalAction icon={Plus} onClick={() => { setEntities((items) => [...items, { name: "NEW ENTITY", type: "Draft structure", status: "DRAFT", children: ["Needs configuration"] }]); action("New entity added"); }}>Añadir entidad</InternalAction>
        </section>
        <section className="financePanel taxPanel" data-satellite-module="tax">
          <div className="financePanelTitle"><div><span>TAX CONTROL ROOM</span><h2>Period summary</h2></div><i className="guarded">ESTIMATE</i></div>
          <div className="taxRows">
            <ReportRow label="Gross paper activity" value={money(equity)} up />
            <ReportRow label="Realized PnL" value={money(realized)} up={realized >= 0} />
            <ReportRow label="Broker & network fees" value={money(fees)} up={false} />
            <ReportRow label="Estimated reserve" value={money(taxReserve)} up={false} />
          </div>
          <div className="taxDisclaimer"><AlertTriangle size={14} /> Estimate only. No tax filing, legal entity or accounting treatment is considered final.</div>
          <InternalAction icon={CalendarDays} onClick={() => action("Tax period opened")}>Abrir período fiscal</InternalAction>
          <InternalAction icon={FileText} onClick={() => action("Accountant pack queued")} tone="purple">Preparar paquete para contador</InternalAction>
        </section>
      </div>
      <section className="financePanel booksPanel" data-satellite-module="books">
        <div className="financePanelTitle"><div><span>BOOKS & COMPLIANCE</span><h2>Account operations</h2></div><i>CONTROLLED ACCESS</i></div>
        <div className="bookCards">
          <div><Users size={16} /><b>Ownership & roles</b><small>Company members and approvals</small><strong>CONFIGURE</strong></div>
          <div><FileText size={16} /><b>Documents vault</b><small>Receipts, invoices and statements</small><strong>0 NEW</strong></div>
          <div><LockKeyhole size={16} /><b>Audit trail</b><small>Immutable proposal history</small><strong>ENABLED</strong></div>
          <div><RefreshCw size={16} /><b>Reconciliation</b><small>Broker to books matching</small><strong>READY</strong></div>
        </div>
      </section>
      <div className="pageSafety accountSafety"><ShieldCheck size={15} /><span><b>ACCOUNTING BOUNDARY</b> · Account Brain organiza datos y estimaciones. La validación fiscal y la estructura legal final deben revisarse con un contador o abogado.</span></div>
    </section>
  );
}

const branchOrder = ["finance", "commerce", "services", "saas", "media", "institutional"];
const branchX = { finance: 100, commerce: 300, services: 500, saas: 700, media: 900, institutional: 950 };
function ConnectionBranches({ active, hovered }) {
  return (
    <div className={`connectionBranches ${active ? "active" : ""}`}>
      <svg viewBox="0 0 1050 60" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="branchBeam" x1="0" x2="1" y1="0" y2="0">
            <stop stopColor="#bd58ff" />
            <stop offset=".45" stopColor="#38d7ff" />
            <stop offset="1" stopColor="#38d7ff" />
          </linearGradient>
        </defs>
        <path
          className="branchMain"
          d="M500 0 V17 H100 M500 17 H300 M500 17 H500 M500 17 H700 M500 17 H900 M500 17 H950"
        />
        {branchOrder.map((id) => (
          <path
            key={id}
            className={`branchDrop ${hovered === id ? "hot" : ""}`}
            style={{ "--drop": brainMeta[id].color }}
            d={`M${branchX[id]} 17 V53`}
          />
        ))}
      </svg>
      {branchOrder.map((id) => (
        <i
          key={id}
          className={`branchPulse ${hovered === id ? "hot" : ""}`}
          style={{ "--drop": brainMeta[id].color, left: `${branchX[id] / 10}%` }}
        />
      ))}
      {branchOrder.map((id, i) => (
        <i
          key={`travel-${id}`}
          className={`branchTravel ${hovered === id ? "hot" : ""}`}
          style={{
            "--drop": brainMeta[id].color,
            left: `${branchX[id] / 10}%`,
            animationDelay: `${i * 0.35}s`,
          }}
        />
      ))}
      {branchOrder.map((id, i) => <i key={`shock-${id}`} className={`branchShock ${hovered === id ? "hot" : ""}`} style={{ "--drop": brainMeta[id].color, left: `${branchX[id] / 10}%`, animationDelay: `${i * .42 + .2}s` }}><svg viewBox="0 0 20 48" preserveAspectRatio="none"><path d="M10 0 L7 9 L13 16 L6 25 L12 33 L8 42 L10 48" /></svg></i>)}
      <span className="branchLabel">INTER-BRAIN ROUTING · 50 SPECIALISTS</span>
    </div>
  );
}

function ElectricBrainRail({ hovered }) {
  const links = [[95, 285, "finance", "commerce"], [285, 475, "commerce", "services"], [525, 715, "services", "saas"], [715, 905, "saas", "media"]];
  return <svg className="brainRailElectricity" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">{links.map(([from, to, fromId, toId], index) => { const mid = (from + to) / 2; const path = `M${from} 50 L${from + 34} 44 L${from + 68} 57 L${mid - 26} 43 L${mid} 55 L${mid + 24} 42 L${to - 62} 56 L${to - 30} 44 L${to} 50`; const hot = hovered === fromId || hovered === toId; return <g className={hot ? "hot" : ""} key={`${fromId}-${toId}`} style={{ "--shock-color": brainMeta[hot ? hovered : fromId].color, animationDelay: `${index * .55}s` }}><path className="electricLinkGlow" d={path} /><path className="electricLinkCore" d={path} /></g>; })}</svg>;
}

function NetworkTopology({ active, online }) {
  const nodes = [
    {
      id: "finance",
      label: "FINANCE",
      sub: "10 agents · execution",
      x: 13,
      color: brainMeta.finance.color,
    },
    {
      id: "commerce",
      label: "COMMERCE",
      sub: "10 agents · revenue",
      x: 37,
      color: brainMeta.commerce.color,
    },
    {
      id: "services",
      label: "SERVICES",
      sub: "10 agents · service revenue",
      x: 49,
      color: brainMeta.services.color,
    },
    {
      id: "saas",
      label: "SAAS",
      sub: "10 agents · retention",
      x: 61,
      color: brainMeta.saas.color,
    },
    {
      id: "media",
      label: "MEDIA",
      sub: "10 agents · content",
      x: 85,
      color: brainMeta.media.color,
    },
  ];
  return (
    <section className={`networkSection ${active ? "active" : ""}`}>
      <div className="networkHeader">
        <div>
          <small>
            <Network size={12} /> LIVE AGENT TOPOLOGY
          </small>
          <h2>See the intelligence move.</h2>
          <p>
            CEO intent → Manager orchestration → specialized execution →
            telemetry return.
          </p>
        </div>
        <span>
          <i /> {active ? "SIGNAL FLOWING" : "NETWORK STANDBY"}
        </span>
      </div>
      <div className="networkCanvas">
        <svg
          viewBox="0 0 1000 280"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ceoBeam" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#c56bff" />
              <stop offset="1" stopColor="#25e8ff" />
            </linearGradient>
            <filter id="beamGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path className="topologyLine ceoManager" d="M500 54 V104" />
          <path className="topologyLine managerBrain" d="M500 145 V190" />
          {nodes.map((node) => (
            <g key={node.id}>
              <path
                className="topologyLine brainBranch"
                d={`M500 190 C500 214 ${node.x * 10} 190 ${node.x * 10} 224`}
                style={{ "--node-color": node.color }}
              />
              <path
                className="agentBranch"
                d={`M${node.x * 10} 242 V264`}
                style={{ "--node-color": node.color }}
              />
            </g>
          ))}
        </svg>
        <div className="topologyNode ceoNode">
          <Brain size={15} />
          <b>CEO</b>
          <small>intent router</small>
          <i />
        </div>
        <div className="topologyNode managerNode">
          <Cpu size={15} />
          <b>MANAGER</b>
          <small>orchestrator</small>
          <i />
        </div>
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`topologyNode brainNode ${online(node.id) ? "online" : "offline"}`}
            style={{ left: `${node.x}%`, "--node-color": node.color }}
          >
            <span>
              <Brain size={13} />
            </span>
            <b>{node.label}</b>
            <small>{node.sub}</small>
            <i />
          </div>
        ))}
        <div className="agentChip chipOne">
          <Terminal size={11} /> SIGNAL
        </div>
        <div className="agentChip chipTwo">
          <Eye size={11} /> TELEMETRY
        </div>
        <div className="agentChip chipThree">
          <Activity size={11} /> DECISIONS
        </div>
      </div>
      <div className="networkLegend">
        <span>
          <i className="legendDot cyan" /> connected
        </span>
        <span>
          <i className="legendDot pulseDotLegend" /> data in motion
        </span>
        <span>
          <i className="legendDot amber" /> waiting for input
        </span>
        <b>4 BRANCHES · 40 SPECIALISTS</b>
      </div>
    </section>
  );
}
function CommandModal({
  answer,
  command,
  setCommand,
  sendCommand,
  listen,
  onClose,
  active,
  thinking,
  talking,
  listening,
  brain,
  goalMode,
  setGoalMode,
  setGoal,
  goalBusy,
}) {
  const mode = listening
    ? "LISTENING"
    : talking
      ? "SPEAKING"
      : thinking
        ? "THINKING"
        : "ONLINE";
  const isCeo = brain.id === "ceo";
  return (
    <div
      className="commandOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={`AEGIS ${brain.name} command window`}
    >
      <div className="commandModal" style={{ "--brain-accent": brain.color }}>
        <div className="modalTop">
          <div>
            <small>
              <span className="liveDot" /> AEGIS / {brain.name} / PRIVATE CHANNEL
            </small>
            <h2>Neural command surface</h2>
          </div>
          <button onClick={onClose} aria-label="Close command window">
            <X size={18} />
          </button>
        </div>
        <div className="modalBody">
          <div className={`modalBrain ${active ? "active" : ""}`}>
            <div className="modalReticle" />
            <BrainImage src={brain.image} color={brain.color} size={305} active={active} />
            <div className="modalState">
              <b>{mode}</b>
              <span>
                {listening
                  ? "capturing voice signal"
                  : talking
                    ? "returning executive response"
                    : thinking
                      ? isCeo
                        ? "routing through manager"
                        : `querying ${brain.name.toLowerCase()}`
                      : "ready for your next command"}
              </span>
            </div>
          </div>
          <div className="modalTranscript">
            <div className="transcriptLabel">
              <Terminal size={14} /> LIVE TRANSCRIPT <span>ENCRYPTED</span>
            </div>
            <div className="transcriptLine system">
              <i /> {brain.name} <b>{mode}</b>
            </div>
            <div className="transcriptAnswer">{answer}</div>
            <div className="routeChain">
              {isCeo ? (
                <>
                  <span>CEO</span>
                  <i />
                  <span>MANAGER</span>
                  <i />
                  <span>AGENT MESH</span>
                </>
              ) : (
                <>
                  <span>YOU</span>
                  <i />
                  <span>CEO ROUTER</span>
                  <i />
                  <span>{brain.name}</span>
                </>
              )}
            </div>
            <div className="modalInput">
              <input
                autoFocus
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (goalMode ? setGoal(command) : sendCommand(undefined, brain.id))
                }
                placeholder={
                  goalMode
                    ? "Escribe el objetivo para el CEO..."
                    : `Escribe una instrucción para ${brain.name}...`
                }
              />
              {isCeo && (
                <button
                  className={goalMode ? "listening" : ""}
                  onClick={() => setGoalMode(!goalMode)}
                  aria-label="Toggle goal mode"
                  title="Fijar objetivo autónomo"
                >
                  <Target size={16} />
                </button>
              )}
              <button
                className={listening ? "listening" : ""}
                onClick={() => listen(brain.id)}
                aria-label="Speak command"
              >
                <Mic size={18} />
              </button>
              <button
                onClick={() =>
                  goalMode ? setGoal(command) : sendCommand(undefined, brain.id)
                }
                disabled={thinking || goalBusy}
                aria-label="Send command"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="modalQuick">
              {isCeo ? (
                <>
                  <button
                    onClick={() => sendCommand("¿Cuál es el estado del sistema?", "ceo")}
                  >
                    SYSTEM STATUS
                  </button>
                  <button
                    onClick={() => sendCommand("Prepara un informe ejecutivo", "ceo")}
                  >
                    EXECUTIVE REPORT
                  </button>
                  <button
                    onClick={() => sendCommand("Revisa finanzas y arbitraje", "ceo")}
                  >
                    FINANCE SCAN
                  </button>
                  <button onClick={() => setGoalMode(!goalMode)}>
                    {goalMode ? "CANCELAR OBJETIVO" : "FIJAR OBJETIVO"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => sendCommand(`Estado de ${brain.name}`, brain.id)}
                >
                  VER ESTADO
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="modalFooter">
          <span>
            <i /> VOICE + TEXT COMMANDS ACTIVE
          </span>
          <span>ESC TO CLOSE · PAPER SAFE</span>
        </div>
      </div>
    </div>
  );
}
function BrainImage({ src, color, size = 210, active = false, talking = false }) {
  return (
    <div
      className={`brainVisual brainImage ${active ? "active" : ""} ${talking ? "talking" : ""}`}
      style={{ width: size, height: size, "--brain-glow": color }}
    >
      <BrainEnergyField />
      <img src={src} alt="" draggable="false" />
    </div>
  );
}
function BrainEnergyField() {
  return <span className="brainEnergyField" aria-hidden="true">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <path className="brainRay rayOne" d="M6 55 L18 48 L28 54 L39 38 L49 45 L61 31 L73 39 L94 28" />
      <path className="brainRay rayTwo" d="M9 35 L22 42 L31 30 L44 48 L55 43 L66 61 L78 50 L91 58" />
      <path className="brainRay rayThree" d="M16 75 L27 65 L38 70 L48 56 L58 67 L70 54 L82 63 L95 50" />
      <path className="brainRay rayFour" d="M18 21 L31 34 L43 25 L54 37 L67 22 L80 35" />
    </svg>
    <i className="brainLight lightOne" /><i className="brainLight lightTwo" /><i className="brainLight lightThree" />
  </span>;
}
function BrainStation({
  label,
  name,
  subtitle,
  detail,
  tagline,
  color,
  image,
  big,
  active,
  talking,
  brainId,
  report,
  hoverBusy,
  onHover,
  onLeave,
  onAsk,
  manager,
  onTalk,
  onOpen,
  functionsTitle,
  functionsItems,
}) {
  return (
    <div
      className={`brainStation ${big ? "big" : ""} ${manager ? "manager" : ""}`}
      style={{ "--brain": color }}
    >
      <div className="stationCopy">
        <span>{label}</span>
        <h2>{name}</h2>
        <b>{subtitle}</b>
        <p>{detail}</p>
        {tagline && <small>{tagline}</small>}
      </div>
      <div className={`stationBrain brainHoverZone ${talking ? "talking" : ""}`} onMouseEnter={onHover} onMouseLeave={onLeave}>
          <span className="stationAura" />
          <span className="stationRing stationRingOne" />
          <span className="stationRing stationRingTwo" />
          <span className="stationRing stationRingThree" />
          <BrainImage src={image} color={color} size={big ? 410 : 250} active={active} talking={talking} />
        <i className="stationPulse" />
        <BrainHoverPanel
          wide
          name={name}
          role={subtitle}
          description={detail}
          color={color}
          brainId={brainId}
          report={report}
          hoverBusy={hoverBusy}
          speaking={talking}
          onAsk={onAsk}
          onLeave={onLeave}
          functionsTitle={functionsTitle}
          functionsItems={functionsItems}
          onTalk={onTalk}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}
function BrainHoverPanel({
  wide,
  satellite,
  name,
  role,
  description,
  color,
  functionsTitle,
  functionsItems,
  onTalk,
  onOpen,
  brainId,
  report,
  hoverBusy,
  speaking,
  onAsk,
  onLeave,
}) {
  const [question, setQuestion] = useState("");
  const greeting = `Hola Neiver soy tu ${name.replace(" BRAIN", " Brain")}. Estoy listo para revisar el estado del sistema.`;
  function submitQuestion(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!question.trim()) return;
    onAsk?.(question);
    setQuestion("");
  }
  return (
    <div
      className={`brainHoverPanel ${wide ? "wide" : ""} ${satellite ? "satellite" : ""} ${speaking ? "speaking" : ""}`}
      onMouseEnter={(event) => event.stopPropagation()}
      onMouseLeave={(event) => {
        event.stopPropagation();
        onLeave?.();
      }}
    >
      <div className="hoverTalkState"><span className="hoverTalkOrb"><Brain size={13} /></span><i />{speaking ? "HABLANDO AHORA" : hoverBusy ? "CONSULTANDO DATOS" : "LISTO PARA TI"}</div>
      <b>{name}</b>
      <span>{role}</span>
      <p className="hoverReport">{report || greeting} {report ? "" : description}</p>
      {functionsItems && (
        <FunctionPanel
          title={functionsTitle}
          color={color}
          items={functionsItems}
          embedded
        />
      )}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTalk?.();
        }}
      >
        <MessageCircle size={12} /> Hablar con este Brain
      </button>
      {brainId && (
        <form className="hoverQuestion" onSubmit={submitQuestion} onClick={(event) => event.stopPropagation()}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pregúntame algo…" aria-label={`Pregunta a ${name}`} />
          <button type="submit" disabled={hoverBusy} aria-label="Enviar pregunta"><Send size={12} /></button>
        </form>
      )}
      {onOpen && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpen();
          }}
        >
          <ArrowRight size={12} /> Abrir página operativa
        </button>
      )}
    </div>
  );
}
function ManagerSatellites({ onTalk, onOpenPage, onHover, onLeave, report, hoverVoiceBrain, hoverBusy, talking, onAsk }) {
  const ids = ["banking", "account"];
  return (
    <div className="managerSatellites">
      <i className="satelliteBus" />
      {ids.map((id) => {
        const meta = satelliteMeta[id];
        return (
          <div
            key={id}
            className="satelliteBrain brainHoverZone"
            style={{ "--brain": meta.color }}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onLeave(id)}
          >
            <i className="satelliteStub" />
            <BrainImage src={meta.image} color={meta.color} size={68} talking={talking && hoverVoiceBrain === id} />
            <b>{meta.name}</b>
            <i className="satelliteStatus">PAPER READY</i>
            <BrainHoverPanel
              satellite
              name={meta.name}
              role={meta.role}
              description={meta.detail}
              color={meta.color}
              brainId={id}
              report={hoverVoiceBrain === id ? report : ""}
              hoverBusy={hoverBusy && hoverVoiceBrain === id}
              speaking={talking && hoverVoiceBrain === id}
              onAsk={(question) => onAsk(id, question)}
              onLeave={() => onLeave(id)}
              onTalk={() => onTalk(id)}
              onOpen={() => onOpenPage(id)}
            />
          </div>
        );
      })}
    </div>
  );
}
function FunctionPanel({ title, items, color, embedded }) {
  const connected = title === "MANAGER FUNCTIONS",
    [liveItems, setLiveItems] = useState([]),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    fetch(`${MANAGER}/api/functions`)
      .then((r) => r.json())
      .then((data) => alive && setLiveItems(data))
      .catch(() => alive && setLiveItems([]));
    return () => {
      alive = false;
    };
  }, [connected]);
  const rows =
    connected && liveItems.length
      ? liveItems
      : items.map((label, i) => ({
          id: label,
          symbol: ["◈", "⌁", "△", "□", "◌", "◉", "◍", "◎", "◇", "▣"][i],
          label,
          status: connected ? "connecting" : "online",
        }));
  async function run(id) {
    if (!connected || busy) return;
    setBusy(id);
    setNotice("");
    try {
      const r = await fetch(`${MANAGER}/api/functions/${id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Function unavailable");
      setNotice(`${data.function.label} · CONNECTED`);
      setLiveItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, lastRunAt: data.function.finishedAt, status: "online" }
            : item,
        ),
      );
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div
      className={`functionPanel ${embedded ? "embedded" : ""}`}
      style={{ "--panel": color }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3>
        {title}
        <small>
          {connected ? notice || "MANAGER LINK · ONLINE" : "CORE LINK · ONLINE"}
        </small>
      </h3>
      {rows.map((item, i) =>
        connected ? (
          <button
            className="functionRow"
            key={item.id || item.label}
            onClick={() => run(item.id)}
            disabled={busy === item.id}
          >
            <span>
              {item.symbol ||
                ["◈", "⌁", "△", "□", "◌", "◉", "◍", "◎", "◇", "▣"][i]}
            </span>
            <b>{item.label}</b>
            <i>{busy === item.id ? "RUNNING" : item.status || "ONLINE"}</i>
          </button>
        ) : (
          <div key={item.id || item.label}>
            <span>
              {item.symbol ||
                ["◈", "⌁", "△", "□", "◌", "◉", "◍", "◎", "◇", "▣"][i]}
            </span>
            {item.label}
          </div>
        ),
      )}
    </div>
  );
}
function BrainCard({ id, meta, online: live, onHover, onLeave, onTalk, onAsk, onOpen, report, hoverBusy, talking }) {
  return (
    <a
      href="#"
      onClick={(event) => { event.preventDefault(); onOpen?.(); }}
      className={`brainCard ${live ? "" : "offline"}`}
      style={{ "--brain": meta.color }}
    >
      <div className="cardHeader">
        <span>{meta.label}</span>
        <i className={live ? "up" : "down"} />
      </div>
      <h2>{meta.name}</h2>
      <p>
        {meta.subtitle}
        <br />
        {meta.detail}
      </p>
      <div className={`cardBrain brainHoverZone ${talking ? "talking" : ""}`} onMouseEnter={onHover} onMouseLeave={onLeave}>
        <span className="stationAura" />
        <span className="stationRing stationRingOne" />
        <span className="stationRing stationRingTwo" />
        <BrainImage src={meta.image} color={meta.color} size={118} active={live} talking={talking} />
        <BrainHoverPanel
          name={meta.name}
          role={meta.subtitle}
          description={meta.detail}
          brainId={id}
          report={report}
          hoverBusy={hoverBusy}
          speaking={talking}
          onAsk={onAsk}
          onLeave={onLeave}
          onTalk={onTalk}
          onOpen={onOpen}
        />
      </div>
      <div className="cardStats">
        {meta.stats.map((stat, i) => (
          <span key={stat}>
            <b>{i === 0 ? meta.agentsActive : "—"}</b>
            <small>{stat}</small>
          </span>
        ))}
      </div>
    </a>
  );
}
function HierarchyItem({ icon: Icon, label, sub, color, active, onClick }) {
  return (
    <div
      className={`hierarchyItem ${active ? "active" : ""} ${onClick ? "hierarchyButton" : ""}`}
      style={{ "--item": color }}
      onClick={onClick}
      onKeyDown={(event) => onClick && event.key === "Enter" && onClick()}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <Icon size={18} />
      <span>
        <b>{label}</b>
        <small>{sub}</small>
      </span>
      <i />
    </div>
  );
}
function SectionLabel({ children, extra }) {
  return <div className={`sectionLabel ${extra || ""}`}>{children}</div>;
}
function Connection() {
  return (
    <div className="connection">
      <span />
      <i />
      <i />
      <i />
      <i />
      <span />
      <ElectricLink className="electricLinkTop" path="M55 31 L115 24 L172 35 L231 25 L289 33 L347 22 L405 32 L463 24 L521 35 L579 23 L637 32 L695 24 L753 34 L811 23 L869 32 L945 27" />
    </div>
  );
}

function ElectricLink({ className = "", path }) {
  return <svg className={`electricLink ${className}`} viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path className="electricLinkGlow" d={path} /><path className="electricLinkCore" d={path} /></svg>;
}
function Panel({ title, children, badge, accent }) {
  return (
    <section className="sidePanel" style={{ "--panel": accent }}>
      <div className="sideTitle">
        <h3>{title}</h3>
        {badge !== undefined && <b className="badge">{badge}</b>}
      </div>
      {children}
    </section>
  );
}
function StatusLine({ label, ok }) {
  return (
    <div className="statusLine">
      <CheckCircle2 size={13} className={ok ? "ok" : "bad"} />
      <span>{label}</span>
      <b className={ok ? "okText" : "badText"}>{ok ? "ONLINE" : "OFFLINE"}</b>
    </div>
  );
}
function ReportRow({ label, value, up }) {
  return (
    <div className="reportRow">
      <span>{label}</span>
      <b>{value}</b>
      <i className={up ? "positive" : "negative"}>{up ? "+" : "—"}</i>
    </div>
  );
}
function BottomMetric({ label, value, accent }) {
  return (
    <div className={`bottomMetric ${accent ? "accent" : ""}`}>
      <small>{label}</small>
      <b>{value}</b>
      {accent && <i>ACTIVE</i>}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
