import { JsonRpcProvider } from 'ethers';

class ResilientJsonRpcProvider extends JsonRpcProvider {
  constructor(urls, chainId){
    super(urls[0],chainId,{staticNetwork:true});
    this.urls=urls;
    this.activeUrl=urls[0];
  }
  async _send(payload){
    let lastError=null;
    const candidates=[this.activeUrl,...this.urls.filter(url=>url!==this.activeUrl)];
    for(const url of candidates){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),Number(process.env.RPC_REQUEST_TIMEOUT_MS||10000));
      try{
        const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
        const text=await response.text();
        if(!response.ok)throw new Error(`${url} HTTP ${response.status}`);
        const body=JSON.parse(text);
        const rows=Array.isArray(body)?body:[body];
        const rpcError=rows.find(row=>row?.error)?.error;
        if(rpcError)throw new Error(`${url} RPC ${rpcError.code||'ERROR'}: ${rpcError.message||'request failed'}`);
        this.activeUrl=url;
        return rows;
      }catch(error){lastError=error;}
      finally{clearTimeout(timer);}
    }
    throw lastError||new Error('RPC_UNAVAILABLE');
  }
}

const NETWORKS = {
  arbitrum: { chainId: 42161, env: 'ARBITRUM_RPC_URL', publicUrls:['https://arbitrum-one.publicnode.com','https://arb1.arbitrum.io/rpc','https://1rpc.io/arb'] },
  ethereum: { chainId: 1, env: 'ETHEREUM_RPC_URL', publicUrls:['https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com','https://1rpc.io/eth'] },
  polygon: { chainId: 137, env: 'POLYGON_RPC_URL', publicUrls:['https://polygon-bor-rpc.publicnode.com','https://polygon-rpc.com','https://1rpc.io/matic'] },
  base: { chainId: 8453, env: 'BASE_RPC_URL', publicUrls:['https://mainnet.base.org','https://base-rpc.publicnode.com','https://1rpc.io/base'] }
};

export class RpcManager {
  constructor(){
    this.providers = new Map();
    this.candidates = new Map();
    this.health = {};
    for (const [name, cfg] of Object.entries(NETWORKS)) {
      const configuredUrls=[process.env[cfg.env],process.env[`${cfg.env}_2`],process.env[`${cfg.env}_3`]].filter(Boolean);
      const allowPublicFallback=process.env.RPC_ALLOW_PUBLIC_FALLBACK!=='false';
      const appendPublicFallback=process.env.RPC_APPEND_PUBLIC_FALLBACK!=='false';
      const publicUrls=allowPublicFallback?cfg.publicUrls:[];
      const usingPublicFallback=!configuredUrls.length&&publicUrls.length>0;
      const urls=[...configuredUrls,...(appendPublicFallback?publicUrls:[])].filter((url,index,all)=>all.indexOf(url)===index);
      const hasFallback=urls.length>configuredUrls.length;
      this.health[name] = { network:name, configured:Boolean(urls.length), source:usingPublicFallback?'public-fallback':hasFallback?'configured+public-fallback':'configured', online:false, latencyMs:null, blockNumber:null, chainId:cfg.chainId, lastCheckedAt:null, error:null, warning:hasFallback?'RPC failover activo; los endpoints públicos son solo lectura y tienen límites variables.':null };
      if (urls.length) {
        const candidates=urls.map(url=>new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true}));
        this.candidates.set(name,candidates);
        // Read-only scanners need sequential failover: public RPCs can reject the same
        // eth_getLogs request for different reasons (archive policy or range limits).
        this.providers.set(name,new ResilientJsonRpcProvider(urls,cfg.chainId));
      }
      this.health[name].endpointCount=urls.length;
    }
  }

  provider(network){ return this.providers.get(String(network).toLowerCase()) ?? null; }
  snapshot(){ return Object.values(this.health); }

  async probe(network){
    const key=String(network).toLowerCase();
    const status=this.health[key];
    if(!status) throw new Error(`UNKNOWN_NETWORK:${network}`);
    const provider=this.provider(key);
    status.lastCheckedAt=new Date().toISOString();
    if(!provider){ status.online=false; status.error='RPC_NOT_CONFIGURED'; return {...status}; }
    const start=performance.now();
    try{
      const blockNumber=await provider.getBlockNumber();
      status.latencyMs=Math.round(performance.now()-start);
      status.blockNumber=blockNumber;
      status.online=true;
      status.error=null;
    }catch(error){
      status.latencyMs=Math.round(performance.now()-start);
      status.online=false;
      status.error=error?.shortMessage || error?.message || 'RPC_ERROR';
    }
    return {...status};
  }

  async probeAll(){
    await Promise.all(Object.keys(NETWORKS).map(n=>this.probe(n)));
    return this.snapshot();
  }
}

export const rpcManager = new RpcManager();
