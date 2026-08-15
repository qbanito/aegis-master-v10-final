const clean=s=>String(s||'').trim();

function extractOpenAIText(payload){
  if(typeof payload?.output_text==='string') return payload.output_text;
  const parts=[];
  for(const item of payload?.output||[]){
    for(const c of item?.content||[]){
      if(c?.type==='output_text' && typeof c?.text==='string') parts.push(c.text);
      else if(typeof c?.text==='string') parts.push(c.text);
    }
  }
  return parts.join('\n').trim();
}

function extractAnthropicText(payload){
  return (payload?.content||[]).filter(x=>x?.type==='text').map(x=>x.text).join('\n').trim();
}

export function getProviderStatus(){
  const provider=(process.env.AEGIS_AI_PROVIDER||'mock').toLowerCase();
  const model=provider==='openai'
    ? (process.env.OPENAI_MODEL||'CONFIGURE_OPENAI_MODEL')
    : provider==='anthropic'
      ? (process.env.ANTHROPIC_MODEL||'CONFIGURE_ANTHROPIC_MODEL')
      : (process.env.AEGIS_AI_MODEL||'AEGIS local demo');
  const configured=provider==='openai'?!!process.env.OPENAI_API_KEY:provider==='anthropic'?!!process.env.ANTHROPIC_API_KEY:true;
  return {provider,model,configured};
}

export async function completeWithProvider({system,user}){
  const status=getProviderStatus();
  const timeoutMs=Math.max(1500,Number(process.env.AEGIS_AI_TIMEOUT_MS||7000));
  if(status.provider==='openai'){
    if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
    try{
      const response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',
        headers:{'content-type':'application/json','authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
        body:JSON.stringify({model:status.model,instructions:system,input:user,max_output_tokens:900}),
        signal:AbortSignal.timeout(timeoutMs)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data?.error?.message||`OPENAI_HTTP_${response.status}`);
      return {text:extractOpenAIText(data),provider:status.provider,model:status.model,raw:data};
    }catch(error){return {text:mockReply(user),provider:'local-fallback-timeout',model:`${status.model} · fallback`,raw:{warning:error?.name==='TimeoutError'?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_UNAVAILABLE'}};}
  }
  if(status.provider==='anthropic'){
    if(!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY_NOT_CONFIGURED');
    try{
      const response=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
        body:JSON.stringify({model:status.model,max_tokens:900,system,messages:[{role:'user',content:user}]}),
        signal:AbortSignal.timeout(timeoutMs)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data?.error?.message||`ANTHROPIC_HTTP_${response.status}`);
      return {text:extractAnthropicText(data),provider:status.provider,model:status.model,raw:data};
    }catch(error){return {text:mockReply(user),provider:'local-fallback-timeout',model:`${status.model} · fallback`,raw:{warning:error?.name==='TimeoutError'?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_UNAVAILABLE'}};}
  }
  return {text:mockReply(user),provider:'mock',model:status.model,raw:null};
}

function mockReply(user){
  const q=clean(user).toLowerCase();
  if(q.includes('incidencia')||q.includes('fallo')||q.includes('supervisor')||q.includes('control central')||q.includes('reporte central')||q.includes('brain central')) return JSON.stringify({reply:'Reviso el reporte del Finance Brain central, la salud de los diez bots y las incidencias persistidas.',toolCalls:['central_report']});
  if((q.includes('descubr')||q.includes('prestatari')||q.includes('borrower')) && q.includes('liquid')) return JSON.stringify({reply:'Voy a descubrir prestatarios y revisar el riesgo de liquidación en modo read-only.',toolCalls:['discover_borrowers']});
  if((q.includes('recal')||q.includes('re-score')||q.includes('rescore')||q.includes('puntua')) && q.includes('liquid')) return JSON.stringify({reply:'Voy a recalcular el ranking del Liquidation Strategy Lab sin ejecutar operaciones.',toolCalls:['rescore_liquidations']});
  if(q.includes('producci')||q.includes('vault')||q.includes('bóveda')||q.includes('boveda')) return JSON.stringify({reply:'Consulto el estado de producción, supervisor, vault y circuit breakers.',toolCalls:['production_status']});
  if(q.includes('rendimiento')||q.includes('performance')||q.includes('desempeño')||q.includes('desempeno')) return JSON.stringify({reply:'Consulto el snapshot de rendimiento de las estrategias.',toolCalls:['performance_snapshot']});
  if(q.includes('liquid')) return JSON.stringify({reply:'Voy a revisar Liquidation Hunter y comparar sus candidatos con el Risk Engine.',toolCalls:['scan_liquidations']});
  if(q.includes('arbit')) return JSON.stringify({reply:'Voy a comparar los DEX configurados y devolver el spread neto simulado.',toolCalls:['scan_arbitrage']});
  if(q.includes('volatil')) return JSON.stringify({reply:'Activo Volatility Hunter para revisar BTC, ETH y SOL.',toolCalls:['scan_volatility']});
  if(q.includes('perpet')||q.includes('funding')) return JSON.stringify({reply:'Consulto funding, basis y open interest.',toolCalls:['scan_perpetuals']});
  if(q.includes('solana')) return JSON.stringify({reply:'Activo el radar de Solana en modo read-only.',toolCalls:['scan_solana']});
  if(q.includes('polymarket')) return JSON.stringify({reply:'Reviso los mercados de Polymarket y sus dislocaciones.',toolCalls:['scan_polymarket']});
  if(q.includes('rebalance')||q.includes('capital')) return JSON.stringify({reply:'Recalculo la asignación PAPER entre estrategias.',toolCalls:['rebalance']});
  if(q.includes('mejor')||q.includes('oportunidad')) return JSON.stringify({reply:'Voy a comparar el Opportunity Bus, scores del Brain y filtros de riesgo para priorizar la mejor oportunidad.',toolCalls:[]});
  return JSON.stringify({reply:'Estoy conectado al AEGIS Brain. Puedo revisar oportunidades, lanzar scanners read-only, comparar estrategias, rebalancear PAPER y explicar el estado del sistema.',toolCalls:[]});
}
