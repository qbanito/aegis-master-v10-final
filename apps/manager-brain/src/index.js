import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import {completeBrainConversation} from "../../../packages/inter-brain-protocol/src/chat.js";

const app=express(); app.use(cors()); app.use(express.json());
const PORT=Number(process.env.PORT||8805);
const serviceUrl = (value, fallback) => { const url = String(value || fallback).trim().replace(/\/$/, ""); return /^https?:\/\//i.test(url) ? url : `http://${url}`; };

const targets=[
  {id:"finance",name:"Finance Brain",url:serviceUrl(process.env.FINANCE_BRAIN_URL,"http://localhost:8787")},
  {id:"commerce",name:"Commerce Brain",url:serviceUrl(process.env.COMMERCE_BRAIN_URL,"http://localhost:8802")},
  {id:"saas",name:"SaaS Brain",url:serviceUrl(process.env.SAAS_BRAIN_URL,"http://localhost:8790")},
  {id:"media",name:"Media Brain",url:serviceUrl(process.env.MEDIA_BRAIN_URL,"http://localhost:8804")}
  ,{id:"services",name:"Services Brain",url:serviceUrl(process.env.SERVICES_BRAIN_URL,"http://localhost:8808")}
];

const proposals=[], incidents=[], snapshots=[], goals=[];
const lastHealthy=new Map();
const agents=[
"Portfolio Observer","Performance Auditor","Opportunity Analyst","Problem Detector",
"Optimization Agent","Resource Allocator","Experiment Manager","Risk & Governance Agent",
"Strategy Agent","Executive Agent"
];

const functionCatalog=[
  {id:"performance-analysis",symbol:"◈",label:"Performance Analysis",agent:"Performance Auditor"},
  {id:"problem-detection",symbol:"⌁",label:"Problem Detection",agent:"Problem Detector"},
  {id:"opportunity-discovery",symbol:"△",label:"Opportunity Discovery",agent:"Opportunity Analyst"},
  {id:"improvement-proposals",symbol:"□",label:"Improvement Proposals",agent:"Optimization Agent"},
  {id:"resource-allocation",symbol:"◌",label:"Resource Allocation",agent:"Resource Allocator"},
  {id:"experiment-management",symbol:"◉",label:"Experiment Management",agent:"Experiment Manager"},
  {id:"risk-governance",symbol:"◍",label:"Risk & Governance",agent:"Risk & Governance Agent"},
  {id:"strategy-planning",symbol:"◎",label:"Strategy & Planning",agent:"Strategy Agent"},
  {id:"cross-brain-coordination",symbol:"◇",label:"Cross-Brain Coordination",agent:"Portfolio Observer"},
  {id:"executive-summary",symbol:"▣",label:"Executive Summary",agent:"Executive Agent"}
];
const functionRuns=new Map();

async function targetJson(url,path){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),2500);
      const response=await fetch(url+path,{signal:controller.signal}); clearTimeout(timer);
      if(!response.ok)throw new Error("HTTP "+response.status);
      return await response.json();
    }catch(error){
      lastError=error;
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350));
    }
  }
  return {error:lastError?.message||"TARGET_UNAVAILABLE"};
}
async function targetRequest(url, path, options = {}) {
  try {
    const controller = new AbortController(); setTimeout(() => controller.abort(), options.timeoutMs || 10000);
    const response = await fetch(url + path, {method: options.method || "GET", headers: {"content-type": "application/json", ...(options.headers || {})}, body: options.body ? JSON.stringify(options.body) : undefined, signal: controller.signal});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  } catch (error) { return {error: error?.message || "TARGET_UNAVAILABLE"}; }
}

async function executeFunction(id){
  const finance=targets.find(t=>t.id==="finance")?.url||"http://localhost:8787";
  const commerce=targets.find(t=>t.id==="commerce")?.url||"http://localhost:8802";
  if(id==="performance-analysis")return Promise.all([targetJson(finance,"/api/performance"),targetJson(commerce,"/api/operations/summary")]).then(([financeData,commerceData])=>({finance:financeData,commerce:commerceData}));
  if(id==="problem-detection")return Promise.all([inspect(),targetJson(commerce,"/api/operations/summary")]).then(([snapshot,commerceData])=>({snapshot,commerce:commerceData}));
  if(id==="opportunity-discovery")return Promise.all([targetJson(finance,"/api/opportunities"),targetJson(commerce,"/api/products")]).then(([financeData,commerceData])=>({finance:financeData,commerce:commerceData}));
  if(id==="improvement-proposals")return {mode:"READ_ONLY",proposals:proposals.slice(0,20)};
  if(id==="resource-allocation")return Promise.all([targetJson(finance,"/api/state"),targetJson(commerce,"/api/operations/summary")]).then(([financeData,commerceData])=>({finance:financeData?.allocator||financeData,commerce:commerceData?.topProducts||commerceData}));
  if(id==="experiment-management")return targetJson(finance,"/api/simulation");
  if(id==="risk-governance")return targetJson(finance,"/api/state").then(data=>({risk:data?.risk,production:data?.infrastructure?.production}));
  if(id==="strategy-planning")return Promise.all([targetJson(finance,"/api/state"),targetJson(commerce,"/api/operations/summary")]).then(([financeData,commerceData])=>({allocator:financeData?.allocator,topOpportunities:(financeData?.opportunities||[]).slice(0,5),commerceTopProducts:(commerceData?.topProducts||[]).slice(0,5)}));
  if(id==="cross-brain-coordination")return inspect();
  if(id==="executive-summary")return targetJson(`http://localhost:${PORT}`,"/api/executive-report");
  throw new Error("FUNCTION_NOT_FOUND");
}

const GOAL_STEP_CATALOG=functionCatalog.map(fn=>fn.id);
function modelName(){return process.env.OPENAI_CHAT_MODEL||process.env.OPENAI_MODEL||"gpt-5";}
async function openaiJson(system,input){
  if((process.env.AEGIS_AI_PROVIDER||"openai").toLowerCase()!=="openai"||!process.env.OPENAI_API_KEY)return null;
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:modelName(),instructions:system,input,max_output_tokens:1500,reasoning:{effort:"low"}}),signal:AbortSignal.timeout(Math.max(1500,Number(process.env.AEGIS_AI_TIMEOUT_MS||7000)))});
  const payload=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(payload?.error?.message||`OPENAI_HTTP_${r.status}`);
  const text=typeof payload?.output_text==="string"?payload.output_text:(payload?.output||[]).flatMap(item=>item?.content||[]).map(item=>item?.text||"").filter(Boolean).join("\n");
  const match=text.match(/\{[\s\S]*\}/);
  if(!match)return null;
  try{return JSON.parse(match[0]);}catch{return null;}
}
function defaultGoalPlan(){return ["problem-detection","opportunity-discovery","strategy-planning","executive-summary"];}
async function planGoal(objective){
  const system=`Eres el planificador del Manager Brain de AEGIS. Los UNICOS ids validos son exactamente estos, cada uno entre comillas: ${JSON.stringify(GOAL_STEP_CATALOG)}. No inventes otros ids ni uses texto descriptivo como id. Dado el objetivo de negocio del usuario, elige entre 2 y 5 de esos ids exactos, en el orden en que deben ejecutarse para avanzar hacia el objetivo. Responde SOLO este JSON, sin texto antes ni despues: {"summary":"una frase","steps":["id_exacto_1","id_exacto_2"]}`;
  try{
    const result=await openaiJson(system,objective);
    const steps=(result?.steps||[]).filter(id=>GOAL_STEP_CATALOG.includes(id));
    if(steps.length)return {summary:result.summary||objective,steps};
  }catch{}
  return {summary:objective,steps:defaultGoalPlan()};
}
async function reflectGoal(goal){
  const system=`Eres el Manager Brain de AEGIS revisando el progreso de un objetivo. Objetivo: "${goal.objective}". Resumen del plan: "${goal.summary}". Historial de pasos ejecutados (mas reciente al final): ${JSON.stringify(goal.log.slice(-8))}. Decide si el objetivo esta razonablemente cumplido con la evidencia disponible, o si faltan pasos. Los UNICOS ids validos para nextSteps son exactamente estos, cada uno entre comillas: ${JSON.stringify(GOAL_STEP_CATALOG)}. No inventes otros ids. Responde SOLO este JSON, sin texto antes ni despues: {"achieved":true,"note":"una frase explicando por que","nextSteps":[]} — si achieved es false, nextSteps debe tener hasta 3 ids exactos de la lista.`;
  try{
    const result=await openaiJson(system,goal.objective);
    if(result&&typeof result.achieved==="boolean")return result;
  }catch{}
  return {achieved:true,note:"Ciclo de pasos completado; sin evaluador disponible se marca como logrado por defecto.",nextSteps:[]};
}
function summarizeStepResult(result){try{return JSON.stringify(result).slice(0,400);}catch{return "";}}
async function advanceGoal(goal){
  if(goal.status!=="active")return;
  goal.lastRunAt=new Date().toISOString();
  if(goal.cycles>=goal.maxCycles){
    goal.status="needs-review";
    goal.log.push({at:goal.lastRunAt,message:"Límite de ciclos alcanzado; requiere revisión humana."});
    return;
  }
  if(goal.cursor>=goal.steps.length){
    const reflection=await reflectGoal(goal);
    goal.log.push({at:goal.lastRunAt,message:`Reflexión: ${reflection.note}`});
    if(reflection.achieved||!reflection.nextSteps?.length){
      goal.status="achieved"; goal.achievedAt=goal.lastRunAt;
    }else{
      goal.steps.push(...reflection.nextSteps.filter(id=>GOAL_STEP_CATALOG.includes(id)));
    }
    goal.cycles+=1;
    return;
  }
  const stepId=goal.steps[goal.cursor];
  const fn=functionCatalog.find(item=>item.id===stepId);
  try{
    const result=await executeFunction(stepId);
    if(result?.error)throw new Error(result.error);
    functionRuns.set(stepId,{id:stepId,status:"completed",startedAt:goal.lastRunAt,finishedAt:new Date().toISOString()});
    goal.log.push({at:goal.lastRunAt,step:stepId,message:`${fn?.label||stepId} ejecutado.`,summary:summarizeStepResult(result)});
  }catch(error){
    goal.log.push({at:goal.lastRunAt,step:stepId,message:`${fn?.label||stepId} falló: ${error.message}`});
  }
  goal.cursor+=1;
  goal.cycles+=1;
}
setInterval(()=>{goals.forEach(goal=>{advanceGoal(goal).catch(()=>{});});},75000);

async function probe(t){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),2500);
      const probeUrl=`${t.url}/health?probe=${Date.now()}-${attempt}`;
      const r=await fetch(probeUrl,{signal:controller.signal,headers:{"cache-control":"no-cache"}}); clearTimeout(timer);
      if(!r.ok) throw new Error("HTTP "+r.status);
      const health=await r.json();
      lastHealthy.set(t.id,{at:Date.now(),health});
      return {id:t.id,name:t.name,url:t.url,status:"online",health};
    }catch(e){
      lastError=e;
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350));
    }
  }
  const cached=lastHealthy.get(t.id);
  if(cached&&Date.now()-cached.at<300000)return {id:t.id,name:t.name,url:t.url,status:"online",health:{...cached.health,stale:true},degraded:true};
  return {id:t.id,name:t.name,url:t.url,status:"offline",error:lastError?.message||"TARGET_UNAVAILABLE"};
}

async function inspect(){
  const brains=await Promise.all(targets.map(probe));
  const offline=brains.filter(x=>x.status!=="online");
  const snap={id:crypto.randomUUID(),at:new Date().toISOString(),brains,online:brains.length-offline.length,total:brains.length};
  snapshots.unshift(snap); if(snapshots.length>100)snapshots.pop();
  for(const b of offline){
    if(!incidents.some(i=>i.brain===b.id && i.status!=="resolved")){
      incidents.unshift({id:crypto.randomUUID(),brain:b.id,severity:"high",status:"open",createdAt:snap.at,reason:b.error||"offline"});
    }
  }
  return snap;
}

app.get("/health",(req,res)=>res.json({name:"AEGIS Manager Brain",kind:"manager",status:"online",agentsOnline:10,agentsTotal:10}));
app.get("/api/agents",(req,res)=>res.json(agents.map((name,i)=>({id:i+1,name,status:"online"}))));
app.get("/api/functions",(req,res)=>res.json(functionCatalog.map(fn=>({...fn,status:"online",lastRunAt:functionRuns.get(fn.id)?.finishedAt||null}))));
app.post("/api/functions/:id/run",async(req,res)=>{
  const fn=functionCatalog.find(item=>item.id===req.params.id);if(!fn)return res.status(404).json({error:"FUNCTION_NOT_FOUND"});
  const startedAt=new Date().toISOString();
  try{const result=await executeFunction(fn.id);if(result?.error)throw new Error(result.error);const run={id:fn.id,status:"completed",startedAt,finishedAt:new Date().toISOString()};functionRuns.set(fn.id,run);res.json({ok:true,function:{...fn,...run},result});}
  catch(error){const run={id:fn.id,status:"failed",startedAt,finishedAt:new Date().toISOString(),error:error?.message||"FUNCTION_FAILED"};functionRuns.set(fn.id,run);res.status(502).json({ok:false,function:{...fn,...run},error:run.error});}
});
app.get("/api/inspect",async(req,res)=>res.json(await inspect()));
app.get("/api/state",async(req,res)=>{
  const snap=await inspect();
  const commerce=await targetJson(targets.find(t=>t.id==="commerce")?.url||"http://localhost:8802","/api/operations/summary");
  res.json({manager:{status:"online"},snapshot:snap,commerce,proposals:proposals.slice(0,20),incidents:incidents.slice(0,20)});
});
app.get("/api/commerce/summary",async(req,res)=>res.json(await targetJson(targets.find(t=>t.id==="commerce")?.url||"http://localhost:8802","/api/operations/summary")));
app.post("/api/commerce/command",async(req,res)=>{
  const commerce=targets.find(t=>t.id==="commerce")?.url||"http://localhost:8802";
  const result=await targetRequest(commerce,"/api/master/command",{method:"POST",body:req.body,timeoutMs:180000});
  res.status(result.error?502:200).json(result);
});
app.get("/api/incidents",(req,res)=>res.json(incidents));
app.post("/api/incidents/:id/resolve",(req,res)=>{
  const i=incidents.find(x=>x.id===req.params.id); if(!i)return res.status(404).json({error:"not found"});
  i.status="resolved"; i.resolvedAt=new Date().toISOString(); res.json({ok:true,incident:i});
});
app.get("/api/proposals",(req,res)=>res.json(proposals));
app.post("/api/proposals",(req,res)=>{
  const p={id:crypto.randomUUID(),status:"proposed",risk:req.body.risk||"low",impact:Number(req.body.impact||.5),confidence:Number(req.body.confidence||.5),createdAt:new Date().toISOString(),...req.body};
  proposals.unshift(p); res.json({ok:true,proposal:p});
});
app.post("/api/proposals/:id/decision",(req,res)=>{
  const p=proposals.find(x=>x.id===req.params.id); if(!p)return res.status(404).json({error:"not found"});
  p.status=req.body.status||p.status; p.updatedAt=new Date().toISOString(); res.json({ok:true,proposal:p});
});
app.get("/api/goals",(req,res)=>res.json(goals));
app.get("/api/goals/:id",(req,res)=>{
  const goal=goals.find(g=>g.id===req.params.id); if(!goal)return res.status(404).json({error:"not found"});
  res.json(goal);
});
app.post("/api/goals",async(req,res)=>{
  const objective=String(req.body?.objective||"").trim();
  if(!objective)return res.status(400).json({error:"OBJECTIVE_REQUIRED"});
  try{
    const plan=await planGoal(objective);
    const goal={
      id:crypto.randomUUID(),objective,summary:plan.summary,steps:plan.steps,cursor:0,
      status:"active",createdAt:new Date().toISOString(),lastRunAt:null,cycles:0,maxCycles:12,
      setBy:req.body?.setBy||"ceo",log:[{at:new Date().toISOString(),message:`Objetivo recibido. Plan: ${plan.steps.join(" → ")}.`}]
    };
    goals.unshift(goal);
    advanceGoal(goal).catch(()=>{});
    res.json({ok:true,goal});
  }catch(error){res.status(502).json({error:"GOAL_PLANNING_ERROR",message:error.message});}
});
app.post("/api/goals/:id/pause",(req,res)=>{
  const goal=goals.find(g=>g.id===req.params.id); if(!goal)return res.status(404).json({error:"not found"});
  goal.status="paused"; res.json({ok:true,goal});
});
app.post("/api/goals/:id/resume",(req,res)=>{
  const goal=goals.find(g=>g.id===req.params.id); if(!goal)return res.status(404).json({error:"not found"});
  goal.status="active"; res.json({ok:true,goal});
});
app.post("/api/goals/:id/cancel",(req,res)=>{
  const goal=goals.find(g=>g.id===req.params.id); if(!goal)return res.status(404).json({error:"not found"});
  goal.status="cancelled"; res.json({ok:true,goal});
});
app.get("/api/executive-report",async(req,res)=>{
  const snap=await inspect();
  const offline=snap.brains.filter(x=>x.status!=="online");
  res.json({
    generatedAt:new Date().toISOString(),
    portfolioHealth:Math.round((snap.online/snap.total)*100),
    brainsOnline:`${snap.online}/${snap.total}`,
    criticalProblems:offline.length,
    openIncidents:incidents.filter(x=>x.status==="open").length,
    proposals:proposals.filter(x=>x.status==="proposed").length,
    summary:offline.length?`${offline.length} Brain(s) require attention.`:"All operational Brains responding.",
    brains:snap.brains
  });
});

async function managerChatContext() {
  const paths = {finance: "/api/agent/context", commerce: "/api/summary", saas: "/api/summary", media: "/api/summary", services: "/api/summary"};
  const entries = await Promise.all(targets.map(async target => [target.id, await targetJson(target.url, paths[target.id])]));
  return {generatedAt: new Date().toISOString(), manager: {status: "online", proposals: proposals.slice(0, 20), incidents: incidents.slice(0, 20)}, inspection: await inspect(), brains: Object.fromEntries(entries)};
}

function managerFallback(message, context) {
  const query = message.toLowerCase();
  const online = context.inspection.online;
  const total = context.inspection.total;
  if (query.includes("estado") || query.includes("salud") || query.includes("online")) return `Manager Brain ve ${online}/${total} Brains operativos en la última inspección. Puedo bajar al detalle de Finance, Commerce, SaaS, Media o Services y señalar qué conector o agente necesita atención.`;
  if (query.includes("banca") || query.includes("banking") || query.includes("tesorería") || query.includes("tesoreria")) return "Banking Brain coordina tesorería, reservas y liquidez DeFi con MetaMask. Puede preparar movimientos, pero cada transacción requiere revisión y firma explícita; no hay firma autónoma.";
  if (query.includes("cuenta") || query.includes("account") || query.includes("impuesto")) return "Account Brain organiza entidades, cuentas, impuestos estimados y auditoría. Cualquier decisión fiscal requiere revisión profesional.";
  return "Puedo coordinar los cinco Brains operativos, revisar incidencias, comparar rendimiento, detectar problemas, proponer mejoras y mantener conectadas las capas Banking y Account.";
}

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const brain = String(req.body?.brain || "manager").toLowerCase();
  if (!message) return res.status(400).json({error: "MESSAGE_REQUIRED"});
  try {
    const context = await managerChatContext();
    const answer = await completeBrainConversation({
      brain, name: brain === "banking" ? "Banking Brain" : brain === "account" ? "Account Brain" : "Manager Brain",
      message, conversation: req.body?.conversation, context,
      scope: brain === "banking" ? "tesorería interna, liquidez, reservas y ledger PAPER" : brain === "account" ? "cuentas, entidades, estructura fiscal estimada y auditoría" : "coordinación, salud, rendimiento, riesgos, incidencias y estrategia de los cinco Brains",
      fallback: managerFallback
    });
    res.json({ok: true, ...answer, speak: true, brain, contextAt: context.generatedAt});
  } catch (error) { res.status(502).json({error: "MANAGER_CHAT_ERROR", message: error.message}); }
});

app.listen(PORT,()=>console.log("AEGIS Manager Brain listening on "+PORT));
