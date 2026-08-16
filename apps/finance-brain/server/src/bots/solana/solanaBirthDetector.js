import WebSocket from 'ws';

const array=value=>Array.isArray(value)?value:[];
const uniq=value=>[...new Set(array(value).filter(Boolean))];
const iso=()=>new Date().toISOString();

export function extractBirthMints(tx){
  const pre=array(tx?.meta?.preTokenBalances).map(row=>row?.mint);
  const post=array(tx?.meta?.postTokenBalances).map(row=>row?.mint);
  const instructions=[
    ...array(tx?.transaction?.message?.instructions),
    ...array(tx?.meta?.innerInstructions).flatMap(row=>array(row?.instructions))
  ];
  const initialized=instructions
    .filter(row=>['initializeMint','initializeMint2'].includes(row?.parsed?.type))
    .map(row=>row?.parsed?.info?.mint);
  return uniq([...post.filter(mint=>!pre.includes(mint)),...initialized]);
}

function deriveWsUrl(rpcUrl){
  const value=String(rpcUrl||'').trim();
  if(!value)return '';
  return value.replace(/^https:/i,'wss:').replace(/^http:/i,'ws:');
}

export class SolanaBirthDetector{
  constructor({rpc,programs,onBirth=()=>{},onReorg=()=>{},onStatus=()=>{},WebSocketImpl=WebSocket}={}){
    this.rpc=rpc;this.programs=array(programs||String(process.env.SOLANA_LAUNCH_PROGRAMS||'').split(',').map(item=>item.trim())).filter(Boolean);
    this.explicitWsUrl=String(process.env.SOLANA_WS_URL||'').trim();this.wsUrl=String(this.explicitWsUrl||deriveWsUrl(rpc?.url)).trim();
    this.enabled=String(process.env.SOLANA_RADAR_BIRTH_DETECTOR_ENABLED||'true').toLowerCase()!=='false';
    this.commitment='processed';this.WebSocketImpl=WebSocketImpl;this.onBirth=onBirth;this.onReorg=onReorg;this.onStatus=onStatus;
    this.ws=null;this.timer=null;this.reconnectTimer=null;this.requestId=1;this.subscriptions=new Map();this.seenSignatures=new Set();this.pending=new Set();this.confirmationTimers=new Set();this.reconnectAttempt=0;this.stopped=true;this.maxPending=Math.max(4,Number(process.env.SOLANA_RADAR_BIRTH_MAX_PENDING||24));
    this.metrics={events:0,mints:0,duplicates:0,dropped:0,reorgs:0,processed:0,failed:0,lastBirthAt:null,lastError:null};
  }
  config(){return {enabled:this.enabled,configured:Boolean(this.enabled&&this.wsUrl&&this.programs.length),provider:'Solana logsSubscribe WebSocket',websocketUrl:this.wsUrl?this.wsUrl.replace(/([?&](?:api-key|apiKey)=)[^&]+/i,'$1REDACTED'):null,programs:this.programs,commitment:this.commitment,mode:'READ_ONLY',live:false,status:this.status(),pipeline:'logsSubscribe(processed) -> getTransaction(processed) -> mint extraction -> analyzer'};}
  status(){return {enabled:this.enabled,configured:Boolean(this.enabled&&this.wsUrl&&this.programs.length),connected:Boolean(this.ws&&this.ws.readyState===this.WebSocketImpl.OPEN),subscriptions:this.subscriptions.size,queued:this.pending.size,maxPending:this.maxPending,events:this.metrics.events,mints:this.metrics.mints,duplicates:this.metrics.duplicates,dropped:this.metrics.dropped,reorgs:this.metrics.reorgs,failed:this.metrics.failed,lastBirthAt:this.metrics.lastBirthAt,lastError:this.metrics.lastError,commitment:this.commitment,mode:'READ_ONLY',live:false};}
  emitStatus(){this.onStatus(this.status());}
  start(){if(this.timer||!this.enabled||!this.wsUrl||!this.programs.length){this.emitStatus();return this.status();}this.stopped=false;this.connect();this.timer=setInterval(()=>{if(!this.ws||this.ws.readyState!==this.WebSocketImpl.OPEN)this.connect();},Math.max(5000,Number(process.env.SOLANA_RADAR_WS_HEARTBEAT_MS||15000)));this.timer.unref?.();return this.status();}
  stop(){this.stopped=true;clearInterval(this.timer);this.timer=null;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;for(const timer of this.confirmationTimers)clearTimeout(timer);this.confirmationTimers.clear();this.subscriptions.clear();const ws=this.ws;this.ws=null;if(ws){ws.removeAllListeners?.();ws.close?.();}this.emitStatus();}
  connect(){if(!this.explicitWsUrl&&this.rpc?.url)this.wsUrl=deriveWsUrl(this.rpc.url);if(this.stopped||!this.enabled||!this.wsUrl||!this.programs.length||this.ws?.readyState===this.WebSocketImpl.OPEN||this.ws?.readyState===this.WebSocketImpl.CONNECTING)return;try{const ws=new this.WebSocketImpl(this.wsUrl);this.ws=ws;ws.on('open',()=>{if(this.stopped||this.ws!==ws)return;this.reconnectAttempt=0;this.subscribe(ws);this.emitStatus();});ws.on('message',data=>{if(!this.stopped&&this.ws===ws)this.handleMessage(data);});ws.on('error',error=>{if(this.stopped)return;this.metrics.lastError=error?.message||'SOLANA_WS_ERROR';this.emitStatus();});ws.on('close',()=>{if(this.ws===ws)this.ws=null;this.subscriptions.clear();this.emitStatus();if(!this.stopped&&this.timer){const delay=Math.min(30000,500*Math.pow(2,this.reconnectAttempt++));this.reconnectTimer=setTimeout(()=>this.connect(),delay);this.reconnectTimer.unref?.();}});}catch(error){this.metrics.lastError=error?.message||'SOLANA_WS_CONNECT_ERROR';this.emitStatus();}}
  subscribe(ws=this.ws){if(this.stopped||!ws||ws!==this.ws||ws.readyState!==this.WebSocketImpl.OPEN)return;for(const program of this.programs){if(this.stopped||ws!==this.ws||ws.readyState!==this.WebSocketImpl.OPEN)break;const id=this.requestId++;try{ws.send(JSON.stringify({jsonrpc:'2.0',id,method:'logsSubscribe',params:[{mentions:[program]},{commitment:this.commitment}]}));this.subscriptions.set(id,program);}catch(error){this.metrics.lastError=error?.message||'SOLANA_WS_SUBSCRIBE_ERROR';break;}}}
  handleMessage(raw){let message;try{message=JSON.parse(String(raw));}catch{return;}if(message.id&&message.result&&this.subscriptions.has(message.id)){const program=this.subscriptions.get(message.id);this.subscriptions.delete(message.id);this.subscriptions.set(message.result,program);return;}const params=message?.params;if(!params?.subscription)return;const value=params.result?.value;if(value?.err!=null||!value?.signature)return;const program=this.subscriptions.get(params.subscription)||null;this.enqueue({signature:value.signature,slot:params.result?.context?.slot||null,program,logs:array(value.logs),detectedAt:iso()});}
  enqueue(event){if(this.seenSignatures.has(event.signature)){this.metrics.duplicates++;return;}if(this.pending.size>=this.maxPending){this.metrics.dropped++;this.metrics.lastError='SOLANA_BIRTH_BACKPRESSURE';this.emitStatus();return;}this.seenSignatures.add(event.signature);if(this.seenSignatures.size>10000)this.seenSignatures=new Set([...this.seenSignatures].slice(-5000));this.pending.add(event.signature);this.process(event).catch(error=>{this.metrics.failed++;this.metrics.lastError=error?.message||'SOLANA_BIRTH_PROCESS_ERROR';}).finally(()=>{this.pending.delete(event.signature);this.emitStatus();});}
  async process(event){if(!this.rpc?.transaction)throw new Error('SOLANA_BIRTH_RPC_REQUIRED');const tx=await this.rpc.transaction(event.signature,this.commitment);if(!tx){this.metrics.failed++;return;}const mints=extractBirthMints(tx);if(!mints.length)return;const birth={type:'token-born',source:'SOLANA_LOGS_SUBSCRIBE',commitment:this.commitment,signature:event.signature,slot:event.slot||tx.slot||null,program:event.program,logs:event.logs.slice(0,40),mints,detectedAt:event.detectedAt,confirmedAt:null,detectedLatencyMs:Date.now()-Date.parse(event.detectedAt),transaction:tx};this.metrics.events++;this.metrics.mints+=mints.length;this.metrics.processed++;this.metrics.lastBirthAt=iso();this.onBirth(birth);this.scheduleConfirmation(birth);this.emitStatus();}
  scheduleConfirmation(birth){const delay=Math.max(1000,Number(process.env.SOLANA_RADAR_BIRTH_CONFIRMATION_DELAY_MS||5000));const timer=setTimeout(async()=>{this.confirmationTimers.delete(timer);try{const status=this.rpc.signatureStatus?await this.rpc.signatureStatus(birth.signature):await this.rpc.transaction(birth.signature,'confirmed');const valid=status?.value?status.value.err==null:status?.meta?status.meta.err==null:false;if(!valid){this.metrics.reorgs++;this.onReorg({...birth,type:'token-birth-reorged',reorgedAt:iso(),reason:'PROCESSED_SIGNATURE_NOT_CONFIRMED'});}else this.onBirth({...birth,type:'token-birth-confirmed',confirmedAt:iso(),commitment:'confirmed'});}catch(error){this.metrics.lastError=error?.message||'SOLANA_BIRTH_CONFIRMATION_ERROR';}this.emitStatus();},delay);timer.unref?.();this.confirmationTimers.add(timer);}
}
