export class SolanaRpc {
  constructor(){
    this.urls=[process.env.SOLANA_RPC_URL,process.env.SOLANA_RPC_URL_2,process.env.SOLANA_RPC_URL_3].filter(Boolean);
    if(!this.urls.length)this.urls=['https://api.mainnet-beta.solana.com'];
    this.url=this.urls[0];this.timeoutMs=Number(process.env.SOLANA_RPC_TIMEOUT_MS||8000);this.id=1;this.endpointIndex=0;
  }
  async call(method,params=[]){
    let lastError=null;
    for(let attempt=0;attempt<this.urls.length;attempt++){
      const index=(this.endpointIndex+attempt)%this.urls.length,url=this.urls[index];
      const controller=new AbortController();const t=setTimeout(()=>controller.abort(),this.timeoutMs);
      try{
        const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:this.id++,method,params}),signal:controller.signal});
        if(!res.ok){const error=new Error(`SOLANA_RPC_HTTP_${res.status}`);if(![408,425,429,500,502,503,504].includes(res.status))throw error;lastError=error;continue;}
        const body=await res.json();if(body.error)throw new Error(body.error.message||'SOLANA_RPC_ERROR');
        this.endpointIndex=index;this.url=url;return body.result;
      }catch(error){lastError=error;if(attempt<this.urls.length-1)await new Promise(resolve=>setTimeout(resolve,Math.min(1000,150*(attempt+1))));}
      finally{clearTimeout(t);}
    }
    throw lastError||new Error('SOLANA_RPC_UNAVAILABLE');
  }
  async ping(){const started=Date.now();try{const [version,slot]=await Promise.all([this.call('getVersion'),this.call('getSlot',[{commitment:'processed'}])]);return {provider:'Solana RPC',online:true,url:this.url,endpoints:this.urls.length,slot,version:version?.['solana-core']||null,latencyMs:Date.now()-started,checkedAt:new Date().toISOString()};}catch(error){return {provider:'Solana RPC',online:false,url:this.url,endpoints:this.urls.length,error:error?.message||'SOLANA_RPC_ERROR',latencyMs:Date.now()-started,checkedAt:new Date().toISOString()};}}
  signatures(address,limit=30){return this.call('getSignaturesForAddress',[address,{limit,commitment:'confirmed'}]);}
  transaction(signature){return this.call('getTransaction',[signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}]);}
  accountInfo(address){return this.call('getAccountInfo',[address,{encoding:'jsonParsed',commitment:'confirmed'}]);}
  tokenSupply(address){return this.call('getTokenSupply',[address,{commitment:'confirmed'}]);}
  tokenLargestAccounts(address){return this.call('getTokenLargestAccounts',[address,{commitment:'confirmed'}]);}
}
export const solanaRpc=new SolanaRpc();
