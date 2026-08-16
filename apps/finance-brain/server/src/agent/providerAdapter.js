const clean=value=>String(value||'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function extractOpenAIText(payload){
  if(typeof payload?.output_text==='string')return payload.output_text;
  const parts=[];
  for(const item of payload?.output||[])for(const content of item?.content||[])if(typeof content?.text==='string')parts.push(content.text);
  return parts.join('\n').trim();
}
function extractAnthropicText(payload){return (payload?.content||[]).filter(item=>item?.type==='text').map(item=>item.text).join('\n').trim();}
function extractMuapiText(payload){
  const candidates=[payload?.output_text,payload?.text,payload?.response,payload?.result,payload?.output,payload?.data?.output_text,payload?.data?.text,payload?.data?.response,payload?.data?.result,payload?.data?.output];
  for(const value of candidates){
    if(typeof value==='string'&&value.trim())return value.trim();
    if(Array.isArray(value)){const text=value.map(item=>typeof item==='string'?item:item?.text||item?.content||'').filter(Boolean).join('\n').trim();if(text)return text;}
    if(value&&typeof value==='object'){const text=value.text||value.content||value.output_text||value.response;if(typeof text==='string'&&text.trim())return text.trim();}
  }
  return '';
}

const providerOrder=()=>[...new Set(clean(process.env.AEGIS_COPILOT_PROVIDER_ORDER||'openai,muapi,anthropic,local').toLowerCase().split(',').map(clean).filter(Boolean))];
export function getProviderStatus(){
  const order=providerOrder(),providers={
    openai:{configured:Boolean(process.env.OPENAI_API_KEY),model:process.env.AEGIS_COPILOT_MODEL||'gpt-5.6-sol'},
    muapi:{configured:Boolean(process.env.MUAPI_API_KEY),model:process.env.MUAPI_COPILOT_MODEL||'gpt-5-6-sol'},
    anthropic:{configured:Boolean(process.env.ANTHROPIC_API_KEY),model:process.env.ANTHROPIC_MODEL||'claude-opus-4-6'},
    local:{configured:true,model:'AEGIS deterministic fallback'}
  };
  const primary=order.find(name=>providers[name]?.configured)||'local';
  return {provider:primary,model:providers[primary].model,configured:primary!=='local',order,providers};
}

async function completeOpenAI({system,user,responseSchema,maxOutputTokens,reasoningEffort,timeoutMs}){
  if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  const model=process.env.AEGIS_COPILOT_MODEL||'gpt-5.6-sol';
  const body={model,instructions:system,input:user,max_output_tokens:maxOutputTokens,reasoning:{effort:reasoningEffort}};
  if(responseSchema)body.text={format:{type:'json_schema',name:responseSchema.name||'aegis_response',strict:true,schema:responseSchema.schema}};
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error?.message||`OPENAI_HTTP_${response.status}`);
  const text=extractOpenAIText(data);if(!text)throw new Error('OPENAI_EMPTY_RESPONSE');return {text,provider:'openai',model,raw:data};
}
async function completeMuapi({system,user,responseSchema,reasoningEffort,timeoutMs}){
  if(!process.env.MUAPI_API_KEY)throw new Error('MUAPI_API_KEY_NOT_CONFIGURED');
  const base=clean(process.env.MUAPI_BASE_URL||'https://api.muapi.ai').replace(/\/$/,''),model=process.env.MUAPI_COPILOT_MODEL||'gpt-5-6-sol';
  const schemaInstruction=responseSchema?`\n\nDevuelve solamente JSON válido que cumpla este JSON Schema:\n${JSON.stringify(responseSchema.schema)}`:'';
  const submit=await fetch(`${base}/api/v1/${model}`,{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.MUAPI_API_KEY},body:JSON.stringify({prompt:user,system_prompt:`${system}${schemaInstruction}`,reasoning_effort:['low','medium','high','xhigh'].includes(reasoningEffort)?reasoningEffort:'high',web_search_switch:false}),signal:AbortSignal.timeout(Math.min(timeoutMs,30000))});
  const submitted=await submit.json().catch(()=>({}));if(!submit.ok)throw new Error(submitted?.message||submitted?.error||`MUAPI_HTTP_${submit.status}`);
  let result=submitted;const requestId=submitted?.request_id||submitted?.id||submitted?.data?.request_id;
  if(requestId){
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){
      await sleep(Math.min(1500,Math.max(250,Number(process.env.MUAPI_POLL_MS||900))));
      const response=await fetch(`${base}/api/v1/predictions/${encodeURIComponent(requestId)}/result`,{headers:{'x-api-key':process.env.MUAPI_API_KEY},signal:AbortSignal.timeout(Math.min(15000,Math.max(1500,deadline-Date.now())))});
      result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result?.message||result?.error||`MUAPI_RESULT_HTTP_${response.status}`);
      const status=clean(result?.status||result?.data?.status).toLowerCase();if(['failed','error','cancelled'].includes(status))throw new Error(result?.error||result?.message||`MUAPI_${status.toUpperCase()}`);
      const text=extractMuapiText(result);if(text)return {text,provider:'muapi',model,raw:result};if(['completed','succeeded','success'].includes(status))break;
    }
  }
  const text=extractMuapiText(result);if(!text)throw new Error(requestId?'MUAPI_RESULT_TIMEOUT_OR_EMPTY':'MUAPI_EMPTY_RESPONSE');return {text,provider:'muapi',model,raw:result};
}
async function completeAnthropic({system,user,maxOutputTokens,timeoutMs}){
  if(!process.env.ANTHROPIC_API_KEY)throw new Error('ANTHROPIC_API_KEY_NOT_CONFIGURED');
  const model=process.env.ANTHROPIC_MODEL||'claude-opus-4-6';
  const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:maxOutputTokens,system,messages:[{role:'user',content:user}]}),signal:AbortSignal.timeout(timeoutMs)});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error?.message||`ANTHROPIC_HTTP_${response.status}`);
  const text=extractAnthropicText(data);if(!text)throw new Error('ANTHROPIC_EMPTY_RESPONSE');return {text,provider:'anthropic',model,raw:data};
}

export async function completeWithProvider({system,user,responseSchema=null,maxOutputTokens=1200,reasoningEffort='high',timeoutMs=Number(process.env.AEGIS_AI_TIMEOUT_MS||90000),providerOrderOverride=null}){
  const order=providerOrderOverride||providerOrder(),failures=[],deadline=Date.now()+timeoutMs;
  for(const provider of order){
    const remainingMs=deadline-Date.now();
    if(remainingMs<1500){failures.push({provider,error:'AI_TOTAL_TIMEOUT'});break;}
    const providerTimeoutMs=Math.min(remainingMs,Math.max(5000,Number(process.env.AEGIS_AI_PROVIDER_TIMEOUT_MS||45000)));
    try{
      if(provider==='openai')return {...await completeOpenAI({system,user,responseSchema,maxOutputTokens,reasoningEffort,timeoutMs:providerTimeoutMs}),fallbacks:failures};
      if(provider==='muapi')return {...await completeMuapi({system,user,responseSchema,reasoningEffort,timeoutMs:providerTimeoutMs}),fallbacks:failures};
      if(provider==='anthropic')return {...await completeAnthropic({system,user,maxOutputTokens,timeoutMs:providerTimeoutMs}),fallbacks:failures};
      if(provider==='local')return {text:mockReply(user),provider:'local',model:'AEGIS deterministic fallback',raw:null,fallbacks:failures};
    }catch(error){failures.push({provider,error:clean(error?.message||error).slice(0,240)});}
  }
  return {text:mockReply(user),provider:'local',model:'AEGIS deterministic fallback',raw:null,fallbacks:failures};
}

function mockReply(user){
  const q=clean(user).toLowerCase();
  if(q.includes('incidencia')||q.includes('fallo')||q.includes('supervisor')||q.includes('control central'))return JSON.stringify({reply:'Reviso el reporte del Finance Brain central, la salud de los bots y las incidencias persistidas.',toolCalls:['central_report']});
  if(q.includes('rendimiento')||q.includes('performance')||q.includes('desempe'))return JSON.stringify({reply:'Consulto el rendimiento validado de las estrategias.',toolCalls:['performance_snapshot']});
  if(q.includes('liquid'))return JSON.stringify({reply:'Voy a revisar Liquidation Hunter y sus filtros de riesgo.',toolCalls:['scan_liquidations']});
  if(q.includes('arbit'))return JSON.stringify({reply:'Voy a comparar los DEX configurados y el spread neto simulado.',toolCalls:['scan_arbitrage']});
  if(q.includes('solana'))return JSON.stringify({reply:'Activo el radar de Solana en modo read-only.',toolCalls:['scan_solana']});
  if(q.includes('rebalance')||q.includes('capital'))return JSON.stringify({reply:'Recalculo la asignación PAPER entre estrategias.',toolCalls:['rebalance']});
  return JSON.stringify({reply:'Estoy conectado al AEGIS Brain. Puedo analizar evidencia, riesgo y rendimiento en PAPER.',toolCalls:[]});
}
