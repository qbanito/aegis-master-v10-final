import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
try{process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../.env"));}catch{}
import {listPromptPresets} from "./promptLibrary.js";
import {getJob,listJobs,mediaProviderStatus,modelCatalog,submitGeneration,submitSpeech} from "./generationGateway.js";
import {completeBrainConversation} from "../../../packages/inter-brain-protocol/src/chat.js";

const app = express();
app.use(cors());
app.use(express.json({limit:"2mb"}));

const NAME = "AEGIS Media Brain";
const KIND = "media";
const PORT = Number(process.env.PORT || 8804);
const serviceUrl = (value, fallback) => { const url = String(value || fallback).trim().replace(/\/$/, ""); return /^https?:\/\//i.test(url) ? url : `http://${url}`; };

const agents = [
  {
    "id": "content-intel",
    "name": "Content Intelligence Agent",
    "enabled": true
  },
  {
    "id": "research",
    "name": "Research & Trend Agent",
    "enabled": true
  },
  {
    "id": "editorial",
    "name": "Editorial Strategy Agent",
    "enabled": true
  },
  {
    "id": "script",
    "name": "Script & Copy Agent",
    "enabled": true
  },
  {
    "id": "visual",
    "name": "Visual Creative Agent",
    "enabled": true
  },
  {
    "id": "video",
    "name": "Video Production Agent",
    "enabled": true
  },
  {
    "id": "repurpose",
    "name": "Repurpose Agent",
    "enabled": true
  },
  {
    "id": "publisher",
    "name": "Publishing & Distribution Agent",
    "enabled": true
  },
  {
    "id": "community",
    "name": "Community & Engagement Agent",
    "enabled": true
  },
  {
    "id": "growth",
    "name": "Media Strategy / Growth Allocator",
    "enabled": true
  }
];
const events = [];
const state = {
  startedAt: new Date().toISOString(),
  status: "online",
  processed: 0,
  alerts: [],
  metrics: {generation:mediaProviderStatus()}
};

const sourceUrls={
  commerce:[serviceUrl(process.env.COMMERCE_BRAIN_URL,"http://localhost:8802")],
  saas:[serviceUrl(process.env.SAAS_BRAIN_URL,"http://localhost:8790")]
};
const catalog=[];
const catalogSync={lastSyncAt:null,lastError:null,commerceCount:0,saasCount:0};
const automation={
  enabled:String(process.env.MEDIA_AUTOMATION_ENABLED||"true").toLowerCase()!=="false",
  cron:String(process.env.MEDIA_AUTOMATION_CRON||"0 */6 * * *"),
  assetMode:String(process.env.MEDIA_AUTOMATION_ASSET_MODE||"brief").toLowerCase(),
  maxItems:Math.max(1,Number(process.env.MEDIA_AUTOMATION_MAX_ITEMS||12)),
  lastRunAt:null,nextRunAt:null,lastRunReason:null,lastError:null,runs:0,busy:false
};
let automationTimer=null;
let automationRunPromise=null;

function emit(type, payload={}, priority=.5) {
  const e = {
    schema:"aegis.interbrain",
    version:"1.0",
    id:crypto.randomUUID(),
    correlation_id:crypto.randomUUID(),
    source:KIND,
    target:"manager",
    type,
    priority,
    timestamp:new Date().toISOString(),
    payload
  };
  events.unshift(e);
  if(events.length>300) events.pop();
  state.processed++;
  return e;
}

async function fetchSource(paths, source){
  for(const base of sourceUrls[source]||[]){
    for(const endpoint of paths){
      try{
        const response=await fetch(`${String(base).replace(/\/$/,"")}${endpoint}`,{signal:AbortSignal.timeout(2500)});
        if(response.ok)return await response.json();
      }catch{}
    }
  }
  return null;
}

function normalizeCatalogItem(source,item){
  const id=String(item?.id||item?.saasId||item?.name||crypto.randomUUID());
  const name=String(item?.name||item?.title||id);
  const detail=source==="saas"
    ? `${item.plan||"SaaS"} subscription · MRR $${Number(item.mrr||0).toLocaleString()}`
    : `${item.category||item.type||"Commerce opportunity"} · ${item.status||"available"}`;
  return {id:`${source}:${id}`,source,sourceId:id,name,detail,status:item?.status||"available",url:item?.url||item?.landingPage||null,metrics:{mrr:item?.mrr||null,score:item?.score||null,health:item?.health||null},updatedAt:new Date().toISOString()};
}

async function syncProductCatalog(){
  const [commerce,saas]=await Promise.all([
    fetchSource(["/api/opportunities","/api/summary"],"commerce"),
    fetchSource(["/api/summary"],"saas")
  ]);
  const commerceItems=Array.isArray(commerce)?commerce:(commerce?.opportunities||[]);
  const saasItems=Array.isArray(saas)?saas:(saas?.accounts||saas?.subscriptions||[]);
  const next=[...commerceItems.map(item=>normalizeCatalogItem("commerce",item)),...saasItems.map(item=>normalizeCatalogItem("saas",item))];
  catalog.splice(0,catalog.length,...next);
  catalogSync.lastSyncAt=new Date().toISOString();
  catalogSync.lastError=null;
  catalogSync.commerceCount=commerceItems.length;
  catalogSync.saasCount=saasItems.length;
  emit("product_catalog_synced",{eligibleProducts:catalog.length,commerce:catalogSync.commerceCount,saas:catalogSync.saasCount,excludedSources:["finance","trading-bots"]},.65);
  return catalog;
}

function cronFieldMatches(field,value){
  if(field==="*")return true;
  return field.split(",").some(part=>{
    if(part.startsWith("*/"))return value%Math.max(1,Number(part.slice(2)))===0;
    if(part.includes("-")){const [a,b]=part.split("-").map(Number);return value>=a&&value<=b;}
    return Number(part)===value;
  });
}
function cronMatches(date){
  const fields=automation.cron.trim().split(/\s+/);if(fields.length!==5)return false;
  return cronFieldMatches(fields[0],date.getMinutes())&&cronFieldMatches(fields[1],date.getHours())&&cronFieldMatches(fields[2],date.getDate())&&cronFieldMatches(fields[3],date.getMonth()+1)&&cronFieldMatches(fields[4],date.getDay());
}
function nextCronDate(from=new Date()){
  const next=new Date(from);next.setSeconds(0,0);next.setMinutes(next.getMinutes()+1);
  for(let i=0;i<525600;i++){if(cronMatches(next))return next.toISOString();next.setMinutes(next.getMinutes()+1);}
  return null;
}
function contentDraft(product,cycle,format){
  const title=`${product.name} · ${format.label}`;
  const hook=product.source==="saas"
    ? `Cómo ${product.name} convierte datos de operación en crecimiento medible.`
    : `Una nueva forma de mejorar la operación digital con ${product.name}.`;
  const prompt=`Create a premium Spanish ${format.kind} for the ${product.source} product ${product.name}. Product context: ${product.detail}. Audience: decision makers and potential customers. Do not mention trading bots, investment returns, or guaranteed results. Keep the brand precise, useful and conversion-oriented.`;
  return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:"draft",score:.78,source:"media-automation",automationCycle:cycle,productId:product.id,productSource:product.source,productName:product.name,format:format.id,title,hook,copy:`${hook} ${product.detail}. Descubre el caso de uso, el flujo y el siguiente paso recomendado.`,cta:"Conoce el producto y solicita una demostración.",prompt,channels:format.channels,generation:null};
}

async function runContentAutomation(reason="cron"){
  if(automationRunPromise)return {ok:false,skipped:true,reason:"AUTOMATION_BUSY"};
  automationRunPromise=(async()=>{
    automation.busy=true;automation.lastError=null;automation.lastRunReason=reason;
    try{
      await syncProductCatalog();
      const cycle=new Date().toISOString().slice(0,13);
      const formats=[
        {id:"social-campaign",label:"Social Campaign",kind:"social campaign",channels:["linkedin","instagram","x"]},
        {id:"product-story",label:"Product Story",kind:"product story",channels:["blog","newsletter"]},
        {id:"demo-script",label:"Demo Script",kind:"short demo video script",channels:["youtube","reels"]}
      ];
      const selected=catalog.slice(0,automation.maxItems);
      const created=[];
      for(let index=0;index<selected.length;index++){
        const product=selected[index];
        const format=formats[(automation.runs+index)%formats.length];
        if(content.some(item=>item.automationCycle===cycle&&item.productId===product.id))continue;
        const draft=contentDraft(product,cycle,format);
        if(automation.assetMode!=="brief"){
          const job=await submitGeneration("image",{prompt:draft.prompt,preset:"futuristic-brand"});
          draft.generation={jobId:job.id,status:job.status,model:job.model,outputUrl:job.outputUrl||null};
        }
        content.unshift(draft);created.push(draft);emit("content_candidate",draft,.78);
      }
      if(created.length)persistContent();
      automation.lastRunAt=new Date().toISOString();automation.nextRunAt=nextCronDate(new Date());automation.runs++;
      state.processed+=created.length;
      return {ok:true,created:created.length,eligibleProducts:catalog.length,excludedSources:["finance","trading-bots"],assetMode:automation.assetMode};
    }catch(error){automation.lastError=error?.message||"CONTENT_AUTOMATION_ERROR";return {ok:false,error:automation.lastError};}
    finally{automation.busy=false;automationRunPromise=null;}
  })();
  return automationRunPromise;
}
function startAutomationCron(){
  if(automationTimer)clearInterval(automationTimer);
  automation.nextRunAt=nextCronDate(new Date());
  automationTimer=setInterval(()=>{const now=new Date();if(automation.enabled&&cronMatches(now)&&automation.lastRunAt?.slice(0,16)!==now.toISOString().slice(0,16))runContentAutomation("cron");},30000);
}

app.get("/health", (req,res)=>res.json({
  name:NAME, kind:KIND, status:state.status, startedAt:state.startedAt,
  agentsOnline:agents.filter(a=>a.enabled).length,
  agentsTotal:agents.length, processed:state.processed,
  generation:mediaProviderStatus(), modelCount:modelCatalog().total
}));

app.get("/api/agents",(req,res)=>res.json(agents));
app.get("/api/events",(req,res)=>res.json(events.slice(0,100)));
app.get("/api/summary",(req,res)=>res.json({
  name:NAME, kind:KIND, state, agents, catalog, catalogSync, automation,
  latestEvents:events.slice(0,10)
}));

function mediaChatContext() {
  return {
    generatedAt: new Date().toISOString(), mode: "READ_ONLY",
    agents, state, automation, catalogSync, catalog: catalog.slice(0, 30),
    content: content.slice(0, 30), events: events.slice(0, 30),
    provider: mediaProviderStatus(), models: modelCatalog(), recentJobs: listJobs().slice(0, 20)
  };
}

function mediaFallback(message, context) {
  const query = message.toLowerCase();
  if (query.includes("contenido") || query.includes("pieza") || query.includes("editorial")) return `Media Brain tiene ${context.content.length} piezas en el contexto y ${context.automation.enabled ? "la automatización activa" : "la automatización pausada"}. Puedo priorizar ideas, estados, formatos y próximos pasos editoriales.`;
  if (query.includes("seo") || query.includes("tráfico") || query.includes("trafico") || query.includes("audiencia")) return "Puedo revisar señales de SEO, distribución, audiencia, catálogo de Commerce y las oportunidades que Media Brain tiene sincronizadas.";
  if (query.includes("imagen") || query.includes("video") || query.includes("voz") || query.includes("audio")) return `El proveedor de Media está en modo ${context.provider.mode}; puedo preparar briefs y consultar modelos sin afirmar que un asset remoto terminó si no existe un job confirmado.`;
  return "Puedo conversar sobre investigación, estrategia editorial, copy, imágenes, video, audio, publicación, distribución, SEO y crecimiento usando el estado actual de Media Brain.";
}

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({error: "MESSAGE_REQUIRED"});
  try {
    const context = mediaChatContext();
    const answer = await completeBrainConversation({
      brain: "media", name: "Media Brain", message, conversation: req.body?.conversation,
      context, scope: "investigación, estrategia editorial, copy, imágenes, video, audio, publicación, distribución, SEO y growth",
      fallback: mediaFallback
    });
    res.json({ok: true, ...answer, speak: true, brain: "media", contextAt: context.generatedAt});
  } catch (error) { res.status(502).json({error: "MEDIA_CHAT_ERROR", message: error.message}); }
});

app.post("/api/event",(req,res)=>{
  const e=emit(req.body.type||"external_event",req.body.payload||{},Number(req.body.priority||.5));
  res.json({ok:true,event:e});
});


const contentFile=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../data/content.json");
function loadContent(){try{const value=JSON.parse(fs.readFileSync(contentFile,"utf8"));return Array.isArray(value)?value:[];}catch{return [];}}
function persistContent(){fs.mkdirSync(path.dirname(contentFile),{recursive:true});fs.writeFileSync(contentFile,JSON.stringify(content.slice(0,500),null,2));}
const content = loadContent();
app.get("/api/content",(req,res)=>res.json(content));
app.post("/api/content",(req,res)=>{
  const c={id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:"draft",score:Number(req.body.score||0.5),...req.body};
  content.unshift(c);persistContent();emit("content_candidate",c,c.score); res.json({ok:true,content:c});
});
app.post("/api/content/:id/status",(req,res)=>{
  const c=content.find(x=>x.id===req.params.id); if(!c)return res.status(404).json({error:"not found"});
  c.status=req.body.status||c.status;persistContent();emit("content_status",{id:c.id,status:c.status},.5); res.json({ok:true,content:c});
});
app.get("/api/kpis",(req,res)=>res.json({
  queued:content.length,
  drafts:content.filter(x=>x.status==="draft").length,
  scheduled:content.filter(x=>x.status==="scheduled").length,
  published:content.filter(x=>x.status==="published").length
}));
app.get("/api/content/catalog",(req,res)=>res.json({items:catalog,sync:catalogSync,excludedSources:["finance","trading-bots"]}));
app.post("/api/content/catalog/sync",async(req,res)=>{try{const items=await syncProductCatalog();res.json({ok:true,items,sync:catalogSync});}catch(error){res.status(502).json({ok:false,error:error.message});}});
app.get("/api/content/automation/status",(req,res)=>res.json({ok:true,automation,catalog:catalogSync,content:{total:content.length,drafts:content.filter(x=>x.status==="draft").length,scheduled:content.filter(x=>x.status==="scheduled").length,published:content.filter(x=>x.status==="published").length}}));
app.post("/api/content/automation/run",async(req,res)=>{const result=await runContentAutomation(req.body?.reason||"manual");res.status(result.ok?200:409).json(result);});
app.post("/api/content/automation/config",(req,res)=>{
  if(req.body?.enabled!==undefined)automation.enabled=Boolean(req.body.enabled);
  if(req.body?.cron)automation.cron=String(req.body.cron);
  if(req.body?.assetMode&&["brief","mock","remote"].includes(String(req.body.assetMode)))automation.assetMode=String(req.body.assetMode);
  if(req.body?.maxItems)automation.maxItems=Math.max(1,Math.min(100,Number(req.body.maxItems)));
  startAutomationCron();res.json({ok:true,automation});
});

const avatarFile=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../data/avatars.json");
function loadAvatars(){try{return JSON.parse(fs.readFileSync(avatarFile,"utf8"));}catch{return [];}}
function persistAvatars(){fs.mkdirSync(path.dirname(avatarFile),{recursive:true});fs.writeFileSync(avatarFile,JSON.stringify(avatars,null,2));}
const avatars=loadAvatars();
app.get("/api/media/status",(req,res)=>res.json({ok:true,provider:mediaProviderStatus(),models:modelCatalog().total,avatars:avatars.length,jobs:listJobs().length}));
app.get("/api/models",(req,res)=>res.json(modelCatalog()));
app.get("/api/prompts",(req,res)=>res.json({presets:listPromptPresets()}));
app.get("/api/generations",(req,res)=>res.json(listJobs()));
app.get("/api/generations/:id",async(req,res)=>{const job=await getJob(req.params.id);if(!job)return res.status(404).json({error:"GENERATION_NOT_FOUND"});res.json(job);});
app.post("/api/generate/:kind",async(req,res)=>{
  const allowed=new Set(["image","image_edit","video","image_to_video","video_to_video","audio","lipsync","recast","3d"]);
  if(!allowed.has(req.params.kind))return res.status(400).json({error:"GENERATION_KIND_NOT_SUPPORTED"});
  const body={...req.body};
  if(body.avatarId){const avatar=avatars.find(item=>item.id===body.avatarId);if(!avatar)return res.status(404).json({error:"AVATAR_NOT_FOUND"});body.image_url=body.image_url||avatar.imageUrl;body.audio_url=body.audio_url||avatar.audioUrl;body.prompt=body.prompt||avatar.prompt;body.model=body.model||avatar.lipSyncModel;}
  try{const job=await submitGeneration(req.params.kind,body);state.metrics.generation=mediaProviderStatus();emit("media_generation",{jobId:job.id,kind:job.kind,model:job.model,status:job.status},.7);res.status(job.status==="failed"?502:202).json({ok:job.status!=="failed",job});}
  catch(error){res.status(400).json({error:error.message});}
});
app.post("/api/speech",async(req,res)=>{try{const job=await submitSpeech(req.body||{});state.metrics.generation=mediaProviderStatus();emit("brain_speech",{jobId:job.id,model:job.model,status:job.status,brain:req.body?.brain||"finance"},.8);res.status(job.status==="failed"?502:202).json({ok:job.status!=="failed",job});}catch(error){res.status(400).json({error:error.message});}});
app.get("/api/avatars",(req,res)=>res.json(avatars));
app.post("/api/avatars",(req,res)=>{const avatar={id:crypto.randomUUID(),createdAt:new Date().toISOString(),name:String(req.body.name||"AEGIS Avatar"),imageUrl:req.body.imageUrl||null,audioUrl:req.body.audioUrl||null,voiceId:req.body.voiceId||null,lipSyncModel:req.body.lipSyncModel||"kling-v2-avatar-pro",prompt:req.body.prompt||"natural presenter performance, accurate lip sync",metadata:req.body.metadata||{},enabled:true};avatars.unshift(avatar);persistAvatars();emit("avatar_created",avatar,.6);res.status(201).json({ok:true,avatar});});
app.patch("/api/avatars/:id",(req,res)=>{const avatar=avatars.find(item=>item.id===req.params.id);if(!avatar)return res.status(404).json({error:"AVATAR_NOT_FOUND"});Object.assign(avatar,req.body,{id:avatar.id,updatedAt:new Date().toISOString()});persistAvatars();res.json({ok:true,avatar});});

startAutomationCron();
setTimeout(()=>syncProductCatalog().catch(error=>{catalogSync.lastError=error?.message||"CATALOG_SYNC_ERROR";}),1200);
app.listen(PORT,()=>console.log(`${NAME} listening on ${PORT}`));
