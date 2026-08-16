const trim=value=>String(value||'').replace(/\/$/,'');

export class SolanaWorkerClient {
  constructor(){this.baseUrl=trim(process.env.SOLANA_MARKET_WORKER_URL);this.timeoutMs=Math.max(1000,Number(process.env.SOLANA_WORKER_TIMEOUT_MS||10000));}
  status(){return {configured:Boolean(this.baseUrl),baseUrl:this.baseUrl||null,mode:'READ_ONLY_PAPER',signing:false};}
  async request(path,{method='GET',body}={}){
    if(!this.baseUrl)throw new Error('SOLANA_MARKET_WORKER_NOT_CONFIGURED');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const response=await fetch(`${this.baseUrl}${path}`,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:controller.signal});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||payload.rpc?.error||`SOLANA_WORKER_HTTP_${response.status}`);
      return payload;
    }finally{clearTimeout(timer);}
  }
  health(){return this.request('/health');}
  analyze(candidates){return this.request('/analyze',{method:'POST',body:{candidates}});}
  simulate(transactionBase64){return this.request('/simulate',{method:'POST',body:{transactionBase64}});}
}

export const solanaWorkerClient=new SolanaWorkerClient();
