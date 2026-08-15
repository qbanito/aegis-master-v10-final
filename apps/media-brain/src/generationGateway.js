import fs from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {buildMediaPrompt,NEGATIVE_PROMPT} from "./promptLibrary.js";

const catalogPath=fileURLToPath(new URL("./modelCatalog.json",import.meta.url));
const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));
const CATEGORY_MAP={image:"t2i",image_edit:"i2i",video:"t2v",image_to_video:"i2v",video_to_video:"v2v",lipsync:"lipsync",recast:"recast",audio:"audio"};
const SPECIAL_MODELS={"3d":[{id:"meshy-6-image-to-3d",name:"Meshy 6 Image To 3D",endpoint:"meshy-6-image-to-3d",provider:"muapi",inputs:["image_url","should_texture","topology","target_polycount","should_remesh","symmetry_mode","texture_prompt"]}]};
const jobs=new Map();

// If the shared server-side MuAPI key exists, prefer the real provider unless
// the operator explicitly selected another mode (for example MEDIA_GENERATION_PROVIDER=mock).
const provider=()=>String(process.env.MEDIA_GENERATION_PROVIDER||(process.env.MUAPI_API_KEY?"muapi":"mock")).toLowerCase();
const baseUrl=()=>String(process.env.MUAPI_BASE_URL||"https://api.muapi.ai").replace(/\/$/,"");
const apiKey=()=>process.env.MUAPI_API_KEY||"";

export function mediaProviderStatus(){return {provider:provider(),configured:provider()==="mock"||Boolean(apiKey()),baseUrl:baseUrl(),mode:provider()==="mock"?"PAPER_MOCK":"REMOTE_API",jobs:jobs.size};}

export function modelCatalog(){return {source:catalog.source,license:catalog.license,categories:catalog.categories,counts:Object.fromEntries(Object.entries(catalog.categories).map(([key,items])=>[key,items.length])),total:Object.values(catalog.categories).reduce((sum,items)=>sum+items.length,0)};}

function findModel(kind,model){const models=SPECIAL_MODELS[kind]||catalog.categories[CATEGORY_MAP[kind]||kind]||[];return models.find(item=>item.id===model)||models[0]||null;}
function outputUrl(data){return data?.outputs?.[0]||data?.output?.url||data?.output_url||data?.url||null;}
function cleanPayload(kind,body,model){const payload={};for(const [key,value] of Object.entries(body||{})){if(["model","preset","avatarId","provider","negativePrompt","poll","apiKey"].includes(key))continue;if(value!==undefined&&value!==null&&value!=="")payload[key]=value;}if(body?.prompt||body?.preset)payload.prompt=buildMediaPrompt({kind,prompt:body.prompt,preset:body.preset,variables:body.variables});if((kind==="image"||kind==="video"||kind==="audio"||kind==="lipsync")&&!payload.negative_prompt)payload.negative_prompt=body?.negativePrompt||NEGATIVE_PROMPT;if(model?.endpoint)payload.__endpoint=model.endpoint;return payload;}

async function submitRemote(job){
  if(!apiKey())throw new Error("MUAPI_API_KEY_NOT_CONFIGURED");
  const endpoint=job.endpoint;const payload={...job.payload};delete payload.__endpoint;
  const response=await fetch(`${baseUrl()}/api/v1/${endpoint}`,{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey()},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error||data?.detail||`MUAPI_HTTP_${response.status}`);
  const requestId=data.request_id||data.id;
  if(requestId){job.requestId=requestId;job.status="processing";job.submitResponse=data;return job;}
  job.status="completed";job.outputUrl=outputUrl(data);job.result=data;return job;
}

export async function submitGeneration(kind,body={}){
  const model=findModel(kind,body.model);if(!model)throw new Error(`MODEL_NOT_FOUND:${kind}:${body.model||"default"}`);
  const job={id:`media_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,kind,model:model.id,endpoint:model.endpoint,prompt:buildMediaPrompt({kind,prompt:body.prompt,preset:body.preset,variables:body.variables}),payload:cleanPayload(kind,body,model),provider:provider(),status:"queued",createdAt:new Date().toISOString(),outputUrl:null};
  jobs.set(job.id,job);
  if(provider()==="mock"){job.status="mock_completed";job.message="Mock/PAPER job created. Configure MUAPI_API_KEY and MEDIA_GENERATION_PROVIDER=muapi for real generation.";return job;}
  try{return await submitRemote(job);}catch(error){job.status="failed";job.error=error.message;return job;}
}

export async function submitSpeech({text,voiceId,model,brain="finance"}={}){
  const value=String(text||'').trim();if(!value)throw new Error('SPEECH_TEXT_REQUIRED');
  const selected=model||process.env.MUAPI_TTS_MODEL||'minimax-speech-2.6-turbo';
  return submitGeneration('audio',{model:selected,prompt:`Natural conversational Spanish voice for the ${String(brain).toUpperCase()} Brain of AEGIS. Speak like a modern ChatGPT assistant: warm, realistic, direct and agile, with smooth connected phrasing and only short pauses at punctuation. Do not sound like a radio announcer. Speak this exact response: ${value}`,voice_id:voiceId||process.env.MUAPI_TTS_VOICE_ID||'female-calm',language:'es',speed:Number(process.env.MUAPI_TTS_SPEED||1.06),format:'mp3'});
}

export async function refreshJob(job){
  if(!job||job.status!=="processing"||!job.requestId)return job;
  if(Date.now()-Date.parse(job.createdAt)>Number(process.env.MEDIA_GENERATION_TIMEOUT_MS||900000)){job.status="timeout";return job;}
  const response=await fetch(`${baseUrl()}/api/v1/predictions/${job.requestId}/result`,{headers:{"content-type":"application/json","x-api-key":apiKey()}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){job.lastError=`MUAPI_HTTP_${response.status}`;return job;}
  const status=String(data.status||"").toLowerCase();job.lastPollAt=new Date().toISOString();job.result=data;
  if(["completed","succeeded","success"].includes(status)){job.status="completed";job.outputUrl=outputUrl(data);}
  if(["failed","error"].includes(status)){job.status="failed";job.error=data.error||"GENERATION_FAILED";}
  return job;
}

export async function getJob(id){const job=jobs.get(id);if(!job)return null;return refreshJob(job);}
export function listJobs(){return [...jobs.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,100);}
