import {z} from 'zod';
import {completeWithProvider,getProviderStatus} from './providerAdapter.js';

const nullableNumber={anyOf:[{type:'number'},{type:'null'}]};
const changesSchema={type:'object',additionalProperties:false,required:['maxAllocationPct','minConfidence','maxRiskScore','minExpectedProfitUsd','maxSlippageBps','notes'],properties:{maxAllocationPct:nullableNumber,minConfidence:nullableNumber,maxRiskScore:nullableNumber,minExpectedProfitUsd:nullableNumber,maxSlippageBps:nullableNumber,notes:{anyOf:[{type:'string'},{type:'null'}]}}};
export const BOT_COPILOT_RESPONSE_SCHEMA={
  name:'bot_copilot_response',
  schema:{
    type:'object',additionalProperties:false,
    required:['reply','confidence','dataFreshness','findings','recommendations','proposals'],
    properties:{
      reply:{type:'string'},
      confidence:{type:'number',minimum:0,maximum:1},
      dataFreshness:{type:'string',enum:['LIVE','FRESH','MIXED','STALE','INSUFFICIENT']},
      findings:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['severity','title','evidence'],properties:{severity:{type:'string',enum:['info','warning','critical']},title:{type:'string'},evidence:{type:'string'}}}},
      recommendations:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['priority','title','rationale','expectedImpact'],properties:{priority:{type:'string',enum:['low','medium','high']},title:{type:'string'},rationale:{type:'string'},expectedImpact:{type:'string'}}}},
      proposals:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['kind','title','rationale','confidence','changes','preset','evidence','risks'],properties:{kind:{type:'string',enum:['CONFIG_PATCH','NEW_PRESET']},title:{type:'string'},rationale:{type:'string'},confidence:{type:'number',minimum:0,maximum:1},changes:changesSchema,preset:{type:'object',additionalProperties:false,required:['name','description','parameters'],properties:{name:{type:'string'},description:{type:'string'},parameters:changesSchema}},evidence:{type:'array',items:{type:'string'},maxItems:8},risks:{type:'array',items:{type:'string'},maxItems:8}}}}
    }
  }
};

const nullable=z.number().nullable();
const changesZ=z.object({maxAllocationPct:nullable,minConfidence:nullable,maxRiskScore:nullable,minExpectedProfitUsd:nullable,maxSlippageBps:nullable,notes:z.string().nullable()});
const responseZ=z.object({reply:z.string().min(1),confidence:z.number().min(0).max(1),dataFreshness:z.enum(['LIVE','FRESH','MIXED','STALE','INSUFFICIENT']),findings:z.array(z.object({severity:z.enum(['info','warning','critical']),title:z.string(),evidence:z.string()})).max(8),recommendations:z.array(z.object({priority:z.enum(['low','medium','high']),title:z.string(),rationale:z.string(),expectedImpact:z.string()})).max(6),proposals:z.array(z.object({kind:z.enum(['CONFIG_PATCH','NEW_PRESET']),title:z.string(),rationale:z.string(),confidence:z.number().min(0).max(1),changes:changesZ,preset:z.object({name:z.string(),description:z.string(),parameters:changesZ}),evidence:z.array(z.string()).max(8),risks:z.array(z.string()).max(8)})).max(3)});
const cleanJson=text=>String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
const safeText=(value,max=600)=>String(value||'').trim().slice(0,max);
const allowedChanges=input=>Object.fromEntries(Object.entries(input||{}).filter(([key,value])=>['maxAllocationPct','minConfidence','maxRiskScore','minExpectedProfitUsd','maxSlippageBps','notes'].includes(key)&&value!==null&&value!==undefined));

const systemPrompt=`Eres el copiloto cuantitativo especializado de un único bot de AEGIS Finance Brain. Analiza exclusivamente los datos proporcionados, distingue evidencia real de simulaciones y no prometas rentabilidad. Responde en español claro y directo.

REGLAS INVIOLABLES:
- No puedes ejecutar operaciones, firmar transacciones, activar LIVE, desactivar circuit breakers ni alterar límites globales.
- Toda modificación es una PROPUESTA pendiente de aprobación humana y solamente puede aplicarse en PAPER.
- Nunca eleves riesgo para compensar pérdidas ni infieras métricas ausentes.
- Cita evidencia concreta del contexto en findings y explica riesgos.
- CONFIG_PATCH ajusta solo: maxAllocationPct, minConfidence, maxRiskScore, minExpectedProfitUsd, maxSlippageBps y notes.
- NEW_PRESET crea una configuración reutilizable, pero tampoco la activa.
- Si faltan muestras o datos frescos, recomienda recopilar evidencia y no propongas cambios agresivos.`;

function fallbackPayload(text,providerResult){
  let reply='El modelo principal no produjo una respuesta estructurada. El bot permanece sin cambios y en PAPER.';
  try{reply=JSON.parse(cleanJson(text))?.reply||reply;}catch{if(String(text||'').trim())reply=String(text).trim();}
  return {reply,confidence:0,dataFreshness:'INSUFFICIENT',findings:[{severity:'warning',title:'Análisis estructurado no disponible',evidence:`Proveedor ${providerResult.provider} no entregó el contrato completo.`}],recommendations:[{priority:'high',title:'Mantener configuración actual',rationale:'No existe evidencia estructurada suficiente para proponer un cambio seguro.',expectedImpact:'Evita cambios no auditables.'}],proposals:[]};
}

export class BotCopilotService{
  constructor({state,persist,journal,strategyConfigService,contextBuilder,complete=completeWithProvider}){this.state=state;this.persist=persist;this.journal=journal;this.strategyConfigService=strategyConfigService;this.contextBuilder=contextBuilder;this.complete=complete;this.ensureStore();}
  ensureStore(){this.state.infrastructure.botCopilot??={version:1,presets:[],proposals:[],history:[],lastAnalysisByBot:{}};return this.state.infrastructure.botCopilot;}
  status(){const store=this.ensureStore();return {...getProviderStatus(),paperOnly:true,humanApprovalRequired:true,presets:store.presets.length,pendingProposals:store.proposals.filter(row=>row.status==='PENDING').length};}
  snapshot(botId){const store=this.ensureStore(),context=this.contextBuilder(botId);return {botId,status:this.status(),contextCoverage:context.coverage,activeConfig:this.strategyConfigService.get()[botId]||null,presets:store.presets.filter(row=>row.botId===botId).slice(0,30),proposals:store.proposals.filter(row=>row.botId===botId).slice(0,30),history:store.history.filter(row=>row.botId===botId).slice(0,20),lastAnalysis:store.lastAnalysisByBot[botId]||null,updatedAt:new Date().toISOString()};}
  async chat(botId,message,conversation=[]){
    const bot=this.state.bots.find(row=>row.id===botId);if(!bot)throw new Error('BOT_NOT_FOUND');if(!String(message||'').trim())throw new Error('MESSAGE_REQUIRED');
    const context=this.contextBuilder(botId),turns=(Array.isArray(conversation)?conversation:[]).slice(-10).map(row=>({role:row?.role==='assistant'?'assistant':'user',content:safeText(row?.content,2000)}));
    const user=JSON.stringify({request:safeText(message,4000),conversation:turns,botContext:context.data});
    const providerResult=await this.complete({system:systemPrompt,user,responseSchema:BOT_COPILOT_RESPONSE_SCHEMA,maxOutputTokens:3200,reasoningEffort:process.env.AEGIS_COPILOT_REASONING_EFFORT||'medium',timeoutMs:Number(process.env.AEGIS_COPILOT_TIMEOUT_MS||65000)});
    let payload;try{payload=responseZ.parse(JSON.parse(cleanJson(providerResult.text)));}catch{payload=fallbackPayload(providerResult.text,providerResult);}
    const createdAt=new Date().toISOString(),proposalRows=[];
    for(const suggestion of payload.proposals){
      const proposal={id:crypto.randomUUID(),botId,status:'PENDING',kind:suggestion.kind,title:safeText(suggestion.title,180),rationale:safeText(suggestion.rationale,1200),confidence:suggestion.confidence,changes:allowedChanges(suggestion.kind==='NEW_PRESET'?suggestion.preset.parameters:suggestion.changes),preset:suggestion.kind==='NEW_PRESET'?{name:safeText(suggestion.preset.name,100),description:safeText(suggestion.preset.description,600)}:null,evidence:suggestion.evidence.map(value=>safeText(value,400)),risks:suggestion.risks.map(value=>safeText(value,400)),provider:providerResult.provider,model:providerResult.model,createdAt,reviewedAt:null};
      this.ensureStore().proposals.unshift(proposal);proposalRows.push(proposal);this.journal.strategyProposal?.(proposal);
    }
    const analysis={id:crypto.randomUUID(),botId,reply:payload.reply,confidence:payload.confidence,dataFreshness:payload.dataFreshness,findings:payload.findings,recommendations:payload.recommendations,proposalIds:proposalRows.map(row=>row.id),provider:providerResult.provider,model:providerResult.model,fallbacks:providerResult.fallbacks||[],contextCoverage:context.coverage,createdAt};
    const store=this.ensureStore();store.history.unshift({id:analysis.id,botId,request:safeText(message,500),reply:safeText(payload.reply,1200),provider:analysis.provider,model:analysis.model,createdAt});store.history=store.history.slice(0,300);store.proposals=store.proposals.slice(0,300);store.lastAnalysisByBot[botId]=analysis;this.journal.copilot?.(analysis);this.persist();
    return {...analysis,proposals:proposalRows,paperOnly:true,approvalRequired:true};
  }
  approve(botId,proposalId,{confirmPaper=false,actor='OPERATOR'}={}){
    if(confirmPaper!==true)throw new Error('PAPER_CONFIRMATION_REQUIRED');if(this.state.mode!=='PAPER')throw new Error('COPILOT_CHANGES_REQUIRE_PAPER_MODE');
    const proposal=this.ensureStore().proposals.find(row=>row.id===proposalId&&row.botId===botId);if(!proposal)throw new Error('PROPOSAL_NOT_FOUND');if(proposal.status!=='PENDING')throw new Error('PROPOSAL_ALREADY_REVIEWED');
    let result;if(proposal.kind==='CONFIG_PATCH')result=this.strategyConfigService.patch(botId,proposal.changes);else result=this.createPreset(botId,{name:proposal.preset?.name||proposal.title,description:proposal.preset?.description||proposal.rationale,parameters:proposal.changes,sourceProposalId:proposal.id});
    proposal.status='APPROVED';proposal.reviewedAt=new Date().toISOString();proposal.reviewedBy=actor;proposal.result=result;this.journal.strategyProposal?.(proposal);this.persist();return {proposal,result,applied:proposal.kind==='CONFIG_PATCH',paperOnly:true};
  }
  reject(botId,proposalId,{actor='OPERATOR'}={}){const proposal=this.ensureStore().proposals.find(row=>row.id===proposalId&&row.botId===botId);if(!proposal)throw new Error('PROPOSAL_NOT_FOUND');if(proposal.status!=='PENDING')throw new Error('PROPOSAL_ALREADY_REVIEWED');proposal.status='REJECTED';proposal.reviewedAt=new Date().toISOString();proposal.reviewedBy=actor;this.journal.strategyProposal?.(proposal);this.persist();return proposal;}
  createPreset(botId,{name,description='',parameters={},sourceProposalId=null}){if(!this.state.bots.some(row=>row.id===botId))throw new Error('BOT_NOT_FOUND');const preset={id:crypto.randomUUID(),botId,name:safeText(name||'Untitled preset',100),description:safeText(description,600),parameters:allowedChanges(parameters),sourceProposalId,createdAt:new Date().toISOString(),active:false};this.ensureStore().presets.unshift(preset);this.journal.strategyPreset?.(preset);this.persist();return preset;}
  activatePreset(botId,presetId,{confirmPaper=false,actor='OPERATOR'}={}){if(confirmPaper!==true)throw new Error('PAPER_CONFIRMATION_REQUIRED');if(this.state.mode!=='PAPER')throw new Error('COPILOT_CHANGES_REQUIRE_PAPER_MODE');const store=this.ensureStore(),preset=store.presets.find(row=>row.id===presetId&&row.botId===botId);if(!preset)throw new Error('PRESET_NOT_FOUND');const config=this.strategyConfigService.patch(botId,{...preset.parameters,activePresetId:preset.id});for(const row of store.presets.filter(row=>row.botId===botId))row.active=row.id===preset.id;preset.activatedAt=new Date().toISOString();preset.activatedBy=actor;this.journal.strategyPreset?.(preset);this.persist();return {preset,config,paperOnly:true};}
}
