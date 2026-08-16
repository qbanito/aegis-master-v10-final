import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {aegisData} from "../../../packages/aegis-data/src/index.js";

try{process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../.env"));}catch{}

const app=express(); app.use(cors()); app.use(express.json());
const PORT=Number(process.env.PORT||8806);
const serviceUrl = (value, fallback) => { const url = String(value || fallback).trim().replace(/\/$/, ""); return /^https?:\/\//i.test(url) ? url : `http://${url}`; };
const MANAGER=serviceUrl(process.env.MANAGER_BRAIN_URL,"http://localhost:8805");
const RESEND_FROM_EMAIL=process.env.RESEND_FROM_EMAIL||"hello@boostifymusic.site";
const RESEND_FROM_NAME=process.env.RESEND_FROM_NAME||"BoostifyDev Services";
const brainUrls={
  finance:[serviceUrl(process.env.FINANCE_BRAIN_URL,"http://localhost:8787")],
  commerce:[serviceUrl(process.env.COMMERCE_BRAIN_URL,"http://localhost:8802")],
  saas:[serviceUrl(process.env.SAAS_BRAIN_URL,"http://localhost:8790")],
  media:[serviceUrl(process.env.MEDIA_BRAIN_URL,"http://localhost:8804")]
  ,services:[serviceUrl(process.env.SERVICES_BRAIN_URL,"http://localhost:8808")]
};
const chatRoutes={finance:brainUrls.finance[0],commerce:brainUrls.commerce[0],saas:brainUrls.saas[0],media:brainUrls.media[0],services:brainUrls.services[0],manager:MANAGER,banking:MANAGER,account:MANAGER};

const neonSnapshot = (await aegisData.readState("ceo")) || {};
const reports=Array.isArray(neonSnapshot.reports) ? neonSnapshot.reports : [], audit=Array.isArray(neonSnapshot.audit) ? neonSnapshot.audit : [];
const agents=[
"Executive Intake","Report Filter","Priority/Severity","Executive Summarizer","KPI/Goal Tracker",
"Incident Liaison","Report Composer","Delivery Router","Schedule/Briefing Manager","CEO Governance/Audit"
];

function persist() {
  void aegisData.writeState("ceo", {state: {status: "online"}, reports: reports.slice(0, 100), audit: audit.slice(0, 300)});
}

async function manager(path="/api/executive-report",timeoutMs=3000){
  const r=await fetch(MANAGER+path,{signal:AbortSignal.timeout(timeoutMs)});
  if(!r.ok) throw new Error("Manager "+r.status);
  return r.json();
}

function clean(raw){
  return {
    generatedAt:new Date().toISOString(),
    portfolioHealth:raw.portfolioHealth,
    brainsOnline:raw.brainsOnline,
    criticalProblems:raw.criticalProblems,
    openIncidents:raw.openIncidents,
    pendingProposals:raw.proposals,
    brains:raw.brains||[],
    headline:raw.criticalProblems>0 ? "ATTENTION REQUIRED" : "SYSTEMS OPERATIONAL",
    summary:raw.summary,
    priorities:(raw.brains||[]).filter(x=>x.status!=="online").map(x=>({brain:x.id,action:"Manager investigation required"}))
  };
}

app.get("/health",(req,res)=>res.json({name:"AEGIS CEO Brain",kind:"ceo",status:"online",manager:MANAGER,agentsOnline:10,agentsTotal:10}));
app.get("/api/agents",(req,res)=>res.json(agents.map((name,i)=>({id:i+1,name,status:"online"}))));
app.get("/api/report",async(req,res)=>{
  try{
    const raw=await manager("/api/executive-report",1500);
    const report=clean(raw); reports.unshift(report); if(reports.length>100)reports.pop();
    audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action:"report_generated"});
    persist();
    res.json(report);
  }catch(e){
    res.status(503).json({headline:"MANAGER UNAVAILABLE",summary:e.message,generatedAt:new Date().toISOString()});
  }
});
app.get("/api/reports",(req,res)=>res.json(reports));
app.get("/api/audit",(req,res)=>res.json(audit));
app.get("/api/goals",async(req,res)=>{
  try{const r=await fetch(MANAGER+"/api/goals");if(!r.ok)throw new Error("Manager "+r.status);res.json(await r.json());}
  catch(e){res.status(502).json({error:"MANAGER_UNAVAILABLE",message:e.message});}
});
app.post("/api/goals",async(req,res)=>{
  const objective=String(req.body?.objective||"").trim();
  if(!objective)return res.status(400).json({error:"OBJECTIVE_REQUIRED"});
  try{
    const r=await fetch(MANAGER+"/api/goals",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({objective,setBy:"ceo"})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data?.message||data?.error||`Manager ${r.status}`);
    audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action:"goal_delegated",objective,goalId:data?.goal?.id});
    persist();
    res.json(data);
  }catch(e){res.status(502).json({error:"GOAL_DELEGATION_ERROR",message:e.message});}
});
app.post("/api/goals/:id/:action",async(req,res)=>{
  const action=req.params.action;
  if(!["pause","resume","cancel"].includes(action))return res.status(400).json({error:"UNKNOWN_ACTION"});
  try{
    const r=await fetch(`${MANAGER}/api/goals/${req.params.id}/${action}`,{method:"POST"});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data?.message||data?.error||`Manager ${r.status}`);
    res.json(data);
  }catch(e){res.status(502).json({error:"GOAL_ACTION_ERROR",message:e.message});}
});
function describeBrain(id,b){
  if(!b)return `No tengo datos en vivo de ese Brain todavía.`;
  if(b.status!=="online")return `${b.name} está offline en este momento; Manager Brain ya lo tiene marcado para investigación.`;
  const h=b.health||{};
  if(id==="finance")return `Finance Brain está online en modo ${h.mode||"PAPER"}, ejecutando trading, DeFi y control de riesgo con capital simulado.`;
  if(id==="commerce")return `Commerce Brain está online con ${h.agentsOnline??"?"}/${h.agentsTotal??"?"} agentes activos y ${h.processed??0} eventos procesados, enfocado en e-commerce y generación de ingresos.`;
  if(id==="saas")return `SaaS Brain está online con ${h.agentsOnline??"?"}/${h.agentsTotal??"?"} agentes activos y ${h.processed??0} eventos procesados, optimizando MRR y retención.`;
  if(id==="media")return `Media Brain está online con ${h.agentsOnline??"?"}/${h.agentsTotal??"?"} agentes activos y ${h.processed??0} piezas procesadas, generando contenido, social y SEO.`;
  if(id==="services")return `Services Brain está online con ${h.agentsOnline??"?"}/${h.agentsTotal??"?"} agentes activos y ${h.serviceCount??12} servicios preparados para ventas, propuestas y delivery.`;
  return `${b.name} está online y operativo.`;
}

async function fetchJsonCandidates(urls,pathName){
  for(const base of urls){
    try{
      const r=await fetch(`${String(base).replace(/\/$/,"")}${pathName}`,{signal:AbortSignal.timeout(2500)});
      if(r.ok)return await r.json();
    }catch{}
  }
  return null;
}

async function currentBrainContext(brain,raw){
  const context={manager:raw};
  if(brain==="manager"||brain==="ceo")return context;
  const endpoint=brain==="finance"?"/api/agent/context":brain==="media"?"/api/summary":"/api/summary";
  context.brain=await fetchJsonCandidates(brainUrls[brain]||[],endpoint);
  return context;
}

function extractOpenAIText(payload){
  if(typeof payload?.output_text==="string")return payload.output_text.trim();
  return (payload?.output||[]).flatMap(item=>item?.content||[]).map(item=>item?.text||"").filter(Boolean).join("\n").trim();
}

async function chatWithOpenAI({message,brain,raw,conversation=[]}){
  if((process.env.AEGIS_AI_PROVIDER||"openai").toLowerCase()!=="openai"||!process.env.OPENAI_API_KEY)return null;
  const context=await currentBrainContext(brain,raw);
  const turns=Array.isArray(conversation)?conversation.filter(turn=>['user','assistant'].includes(turn?.role)&&String(turn?.content||'').trim()).slice(-10):[];
  const history=turns.length?` Conversación reciente: ${turns.map(turn=>`${turn.role==='user'?'Neiver':'AEGIS'}: ${String(turn.content).slice(0,1800)}`).join(' | ')}`:'';
  const system=`Eres ${brain.toUpperCase()} BRAIN dentro de AEGIS, un asistente conversacional de nivel ChatGPT. Habla en español natural, cálido, directo y humano, con ritmo ágil. Responde como en una conversación: primero la idea principal, después solo los datos útiles; usa frases cortas y conectadas, sin encabezados, markdown, listas largas ni lenguaje de informe salvo que el usuario lo pida. Mantén la respuesta en 2 a 6 frases y termina con una pregunta breve o una próxima opción cuando ayude a continuar la conversación. Usa únicamente el contexto de telemetría entregado, indica cuando un dato no está disponible y nunca inventes PnL, precios, operaciones o estados. El sistema está en PAPER/SAFE: no prometas rentabilidad ni afirmes que ejecutaste dinero real. Si el usuario pide actuar, explica primero el riesgo, la aprobación requerida y el modo actual. Contexto actual: ${JSON.stringify(context).slice(0,18000)}${history}`;
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_CHAT_MODEL||process.env.OPENAI_MODEL||"gpt-5",instructions:system,input:message,max_output_tokens:620}),signal:AbortSignal.timeout(Math.max(1500,Number(process.env.AEGIS_AI_TIMEOUT_MS||7000)))});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.error?.message||`OPENAI_HTTP_${r.status}`);
  return extractOpenAIText(data)||null;
}

async function routeBrainChat({brain,message,conversation}){
  const base=chatRoutes[brain];
  if(!base)return null;
  try{
    const endpoint=brain==='finance'?'/api/agent/chat':'/api/chat';
    const response=await fetch(`${String(base).replace(/\/$/,"")}${endpoint}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,brain,conversation}),signal:AbortSignal.timeout(Math.max(4000,Number(process.env.AEGIS_BRAIN_CHAT_TIMEOUT_MS||6000)))});
    const data=await response.json().catch(()=>({}));
    return response.ok?data:null;
  }catch{return null;}
}

function legacyReply(message,brain,raw){
  const lower=message.toLowerCase();
  const offline=(raw.brains||[]).filter(x=>x.status!=="online");
  if(brain==="manager")return `Manager Brain coordina las ${raw.brains?.length??4} unidades operativas. ${raw.brainsOnline} brains conectados, ${raw.proposals??0} propuestas pendientes y ${raw.openIncidents??0} incidentes abiertos.`;
  if(brain==="banking")return `Banking Brain coordina tesorería, reservas y liquidez DeFi mediante MetaMask. Puede preparar movimientos, pero cada transacción exige revisión y firma explícita; no firma de forma autónoma.`;
  if(brain==="account")return `Account Brain está operativo en modo PAPER: organiza cuentas, entidades, impuestos estimados y auditoría. Las decisiones fiscales requieren revisión profesional.`;
  if(["finance","commerce","saas","media","services"].includes(brain))return describeBrain(brain,(raw.brains||[]).find(x=>x.id===brain));
  if(/estado|status|salud|health|operativo|online/.test(lower))return offline.length?`El sistema está al ${Math.round((raw.brainsOnline?.split("/")[0]||0)/(raw.brainsOnline?.split("/")[1]||1)*100)}%. Necesitan atención: ${offline.map(x=>x.name).join(", ")}.`:`Todos los Brains están operativos. Portfolio health ${raw.portfolioHealth}%, ${raw.brainsOnline} conectados y sin incidentes críticos.`;
  if(/reporte|informe|resumen|briefing/.test(lower))return `Informe ejecutivo: ${raw.summary} Portfolio health ${raw.portfolioHealth}%, ${raw.brainsOnline} Brains online y ${raw.openIncidents} incidentes abiertos.`;
  if(/alerta|incidente|problema|riesgo/.test(lower))return raw.openIncidents?`Hay ${raw.openIncidents} incidentes abiertos. Prioridad actual: ${offline.map(x=>x.name).join(", ")||"revisión preventiva"}.`:`No hay incidentes abiertos. El sistema opera dentro de las políticas actuales.`;
  return `He recibido: “${message}”. Puedo consultar estado global, finanzas, tesorería, cuentas, alertas o preparar un informe ejecutivo.`;
}

function assistantGreeting(brain){
  const label={ceo:"CEO",manager:"Manager",finance:"Finance",commerce:"Commerce",saas:"SaaS",media:"Media",services:"Services",banking:"Banking",account:"Account"}[brain]||String(brain).replace(/\s*brain$/i,"");
  return `Hola Neiver soy tu ${label} asistente.`;
}
function normalizeReply(brain,value){
  const greeting=assistantGreeting(brain);
  const body=String(value||"").trim().replace(/^hola\s+neiver,?\s*soy\s+tu\s+[^.!?]+[.!?]\s*/i,"").trim();
  return body?`${greeting} ${body}`:greeting;
}
function cleanSpeechText(value){
  return String(value||"").replace(/```[\s\S]*?```/g," ").replace(/[*_#>`]/g,"").replace(/\s*[-•]\s+/g," ").replace(/[\r\n]+/g," ").replace(/\s{2,}/g," ").trim().slice(0,900);
}

app.post("/api/chat",async(req,res)=>{
  const message=String(req.body?.message||"").trim();
  const brain=String(req.body?.brain||"ceo").toLowerCase();
  if(!message)return res.status(400).json({error:"MESSAGE_REQUIRED"});
  try{
    if(brain!=="ceo"){
      const routed=await routeBrainChat({brain,message,conversation:req.body?.conversation});
      if(routed){
        audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action:"command_routed",brain,message});
        persist();
        return res.json({...routed,routedBy:"CEO Brain"});
      }
    }
    const raw=await manager("/api/executive-report",1500);
    let reply;
    let provider="fallback";
    if(brain==="ceo"){
      try{reply=await chatWithOpenAI({message,brain,raw,conversation:req.body?.conversation});provider=reply?"openai":"fallback";}catch(error){reply=legacyReply(message,brain,raw);provider="fallback";}
    }else{
      reply=legacyReply(message,brain,raw);
      provider="local-fallback-routing";
    }
    if(!reply)reply=legacyReply(message,brain,raw);
    reply=normalizeReply(brain,reply);
    audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action:"command_processed",message});
    persist();
    res.json({ok:true,reply,speak:true,provider,brain,generatedAt:new Date().toISOString(),report:clean(raw)});
  }catch(e){res.status(503).json({error:"CEO_COMMAND_ERROR",message:e.message});}
});
const VOICES=new Set(["alloy","ash","ballad","coral","echo","fable","onyx","nova","sage","shimmer","verse"]);
app.post("/api/tts",async(req,res)=>{
  const text=cleanSpeechText(req.body?.text||"");
  const voice=VOICES.has(req.body?.voice)?req.body.voice:"coral";
  const brain=String(req.body?.brain||"ceo").toLowerCase();
  if(!text)return res.status(400).json({error:"TEXT_REQUIRED"});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"TTS_NOT_CONFIGURED"});
  try{
    const r=await fetch("https://api.openai.com/v1/audio/speech",{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({model:process.env.OPENAI_TTS_MODEL||"gpt-4o-mini-tts",input:text,voice,response_format:"mp3",instructions:`Speak in natural conversational Spanish as the ${brain} Brain assistant of AEGIS. Use a warm, realistic, confident voice with an agile pace around 1.06x. Connect phrases smoothly, use only short natural pauses at punctuation, and do not insert dramatic pauses between clauses. Sound like a modern ChatGPT assistant speaking directly to Neiver, never like a radio announcer, audiobook narrator or robotic IVR.`})
    });
    if(!r.ok){const detail=await r.text();return res.status(502).json({error:"TTS_UPSTREAM_ERROR",detail:detail.slice(0,300)});}
    res.set("content-type","audio/mpeg");
    res.send(Buffer.from(await r.arrayBuffer()));
  }catch(e){res.status(502).json({error:"TTS_ERROR",message:e.message});}
});
app.post("/api/deliver/email",async(req,res)=>{
  const raw=await manager(); const report=clean(raw);
  if(!process.env.RESEND_API_KEY || !process.env.CEO_REPORT_EMAIL){
    return res.json({ok:false,mode:"mock",reason:"RESEND_API_KEY/CEO_REPORT_EMAIL not configured",report});
  }
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${process.env.RESEND_API_KEY}`},body:JSON.stringify({
    from:req.body.from||`${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to:[process.env.CEO_REPORT_EMAIL],
    subject:`AEGIS CEO Report — ${report.headline}`,
    html:`<h1>${report.headline}</h1><p>${report.summary}</p><p>Portfolio health: ${report.portfolioHealth}%</p><p>Brains online: ${report.brainsOnline}</p>`
  })});
  const data=await r.json(); res.status(r.ok?200:502).json({ok:r.ok,data,report});
});
app.post("/api/deliver/whatsapp",async(req,res)=>{
  const raw=await manager(); const report=clean(raw);
  if(!process.env.WHATSAPP_API_URL || !process.env.WHATSAPP_API_TOKEN){
    return res.json({ok:false,mode:"mock",reason:"WhatsApp provider not configured",report});
  }
  const r=await fetch(process.env.WHATSAPP_API_URL,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${process.env.WHATSAPP_API_TOKEN}`},body:JSON.stringify({to:process.env.WHATSAPP_TO,text:`${report.headline}\n${report.summary}\nHealth ${report.portfolioHealth}%`})});
  res.status(r.ok?200:502).json({ok:r.ok,status:r.status,report});
});
app.post("/api/deliver/telegram",async(req,res)=>{
  const raw=await manager(); const report=clean(raw);
  if(!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID){
    return res.json({ok:false,mode:"mock",reason:"TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured",report});
  }
  const text=`AEGIS CEO REPORT\n${report.headline}\n${report.summary}\nPortfolio health: ${report.portfolioHealth}%\nBrains online: ${report.brainsOnline}\nOpen incidents: ${report.openIncidents}`;
  const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text})});
  const data=await r.json().catch(()=>({}));
  res.status(r.ok&&data.ok?200:502).json({ok:r.ok&&data.ok,status:r.status,data,report});
});

app.listen(PORT,()=>console.log("AEGIS CEO Brain listening on "+PORT));
