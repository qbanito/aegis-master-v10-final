const uniq=a=>[...new Set(a.filter(Boolean))];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class SolanaEarlyTokenScanner{
  constructor({rpc,bus,onStatus=()=>{},onScan=()=>{}}={}){
    this.rpc=rpc;this.bus=bus;this.onStatus=onStatus;this.onScan=onScan;this.timer=null;this.seen=new Set();
    this.programs=(process.env.SOLANA_LAUNCH_PROGRAMS||'').split(',').map(x=>x.trim()).filter(Boolean);
    this.limit=Number(process.env.SOLANA_SIGNATURE_LIMIT||25);this.scanEveryMs=Number(process.env.SOLANA_RADAR_SCAN_MS||20000);this.minConfidence=Number(process.env.SOLANA_RADAR_MIN_CONFIDENCE||0.68);
    this.maxTxPerCycle=Number(process.env.SOLANA_RADAR_MAX_TX_PER_CYCLE||20);this.paperNotionalUsd=Number(process.env.SOLANA_RADAR_PAPER_NOTIONAL_USD||300);
  }
  config(){return {configured:!!this.programs.length,programs:this.programs,signatureLimit:this.limit,scanEveryMs:this.scanEveryMs,minConfidence:this.minConfidence,maxTxPerCycle:this.maxTxPerCycle};}
  start(){if(this.timer)return;this.scanOnce().catch(()=>{});this.timer=setInterval(()=>this.scanOnce().catch(()=>{}),this.scanEveryMs);}
  stop(){clearInterval(this.timer);this.timer=null;}
  extractMints(tx){
    const pre=(tx?.meta?.preTokenBalances||[]).map(x=>x.mint),post=(tx?.meta?.postTokenBalances||[]).map(x=>x.mint);
    return uniq(post.filter(m=>!pre.includes(m)));
  }
  scoreTx(tx,mint){
    const logs=tx?.meta?.logMessages||[];const ok=tx?.meta?.err==null;const keys=tx?.transaction?.message?.accountKeys||[];
    const signerCount=keys.filter(k=>k?.signer).length;const tokenTouches=(tx?.meta?.postTokenBalances||[]).filter(x=>x.mint===mint).length;
    const logDepth=Math.min(logs.length,30)/30;const confidence=clamp(0.55+(ok?.08:0)+Math.min(.12,tokenTouches*.03)+Math.min(.08,signerCount*.02)+logDepth*.08,0,0.93);
    return {confidence:Number(confidence.toFixed(3)),tokenTouches,signerCount,logCount:logs.length};
  }
  async scanOnce(){
    if(!this.programs.length){this.onStatus('WAITING_CONFIG');const scan={at:new Date().toISOString(),configured:false,programs:0,discoveries:[]};this.onScan(scan);return scan;}
    this.onStatus('SCANNING');const discoveries=[];let processed=0;
    for(const program of this.programs){
      let sigs=[];try{sigs=await this.rpc.signatures(program,this.limit);}catch(error){discoveries.push({program,error:error.message});continue;}
      for(const s of sigs){if(processed>=this.maxTxPerCycle)break;if(this.seen.has(s.signature))continue;this.seen.add(s.signature);processed++;
        try{const tx=await this.rpc.transaction(s.signature);for(const mint of this.extractMints(tx)){const score=this.scoreTx(tx,mint);const item={program,signature:s.signature,mint,slot:s.slot,blockTime:s.blockTime?new Date(s.blockTime*1000).toISOString():null,...score,source:'SOLANA_RPC',createdAt:new Date().toISOString()};discoveries.push(item);
          if(score.confidence>=this.minConfidence)this.bus.emit('raw-opportunity',{strategyId:'solana-radar',strategy:'Solana Early Token Radar',network:'Solana',asset:mint,confidence:score.confidence,executionProbability:.5,expectedProfitUsd:0,capitalRequiredUsd:this.paperNotionalUsd,estimatedSlippageBps:75,riskScore:.65,source:'SOLANA_LAUNCH_PROGRAM_ACTIVITY',synthetic:false,metadata:{direction:'WATCH',program,signature:s.signature,mint,slot:s.slot,tokenTouches:score.tokenTouches,signerCount:score.signerCount}});
        }}catch(error){discoveries.push({program,signature:s.signature,error:error.message});}
      }
    }
    if(this.seen.size>5000)this.seen=new Set([...this.seen].slice(-2500));const scan={at:new Date().toISOString(),configured:true,programs:this.programs.length,processed,discoveries:discoveries.slice(0,100)};this.onScan(scan);this.onStatus('SCANNING');return scan;
  }
}
