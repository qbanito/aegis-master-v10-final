import {JsonRpcProvider} from 'ethers';
const DEFINITIONS={
  arbitrum:{chainId:42161,envs:['ARBITRUM_RPC_URL','ARBITRUM_RPC_URL_2','ARBITRUM_RPC_URL_3'],publicUrls:['https://arbitrum-one.publicnode.com','https://arb1.arbitrum.io/rpc','https://1rpc.io/arb']},
  ethereum:{chainId:1,envs:['ETHEREUM_RPC_URL','ETHEREUM_RPC_URL_2','ETHEREUM_RPC_URL_3'],publicUrls:['https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com','https://1rpc.io/eth']},
  polygon:{chainId:137,envs:['POLYGON_RPC_URL','POLYGON_RPC_URL_2','POLYGON_RPC_URL_3'],publicUrls:['https://polygon-bor-rpc.publicnode.com','https://polygon-rpc.com','https://1rpc.io/matic']},
  base:{chainId:8453,envs:['BASE_RPC_URL','BASE_RPC_URL_2','BASE_RPC_URL_3'],publicUrls:['https://mainnet.base.org','https://base-rpc.publicnode.com','https://1rpc.io/base']}
};
const mask=url=>{try{const u=new URL(url);return `${u.protocol}//${u.host}${u.pathname.length>16?u.pathname.slice(0,12)+'…':u.pathname}`;}catch{return 'configured';}};
export class RpcLatencyRouter{
  constructor(){this.routes={};for(const [network,cfg] of Object.entries(DEFINITIONS)){const configured=cfg.envs.map(e=>process.env[e]).filter(Boolean);const publicUrls=process.env.RPC_ALLOW_PUBLIC_FALLBACK==='false'?[]:cfg.publicUrls;const urls=[...configured,...publicUrls].filter((url,index,all)=>all.indexOf(url)===index);this.routes[network]={network,chainId:cfg.chainId,candidates:urls.map((url,index)=>({id:`${network}-${index+1}`,url,provider:new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true}),latencyMs:null,online:false,blockNumber:null,error:null})),selectedId:null,checkedAt:null};}}
  async probeCandidate(c){const t=performance.now();try{const block=await c.provider.getBlockNumber();c.latencyMs=Math.round(performance.now()-t);c.blockNumber=block;c.online=true;c.error=null;}catch(e){c.latencyMs=Math.round(performance.now()-t);c.online=false;c.error=e?.shortMessage||e?.message||'RPC_ERROR';}return c;}
  async probe(network){const r=this.routes[network];if(!r)return null;await Promise.all(r.candidates.map(c=>this.probeCandidate(c)));const best=r.candidates.filter(c=>c.online).sort((a,b)=>a.latencyMs-b.latencyMs)[0];r.selectedId=best?.id||null;r.checkedAt=new Date().toISOString();return this.publicRoute(r);}
  async probeAll(){return Promise.all(Object.keys(this.routes).map(n=>this.probe(n)));}
  selectedLatency(network){const r=this.routes[String(network).toLowerCase()];return r?.candidates.find(c=>c.id===r.selectedId)?.latencyMs||0;}
  provider(network){const r=this.routes[String(network).toLowerCase()];return r?.candidates.find(c=>c.id===r.selectedId)?.provider||r?.candidates[0]?.provider||null;}
  publicRoute(r){return{network:r.network,chainId:r.chainId,selectedId:r.selectedId,checkedAt:r.checkedAt,candidates:r.candidates.map(c=>({id:c.id,endpoint:mask(c.url),latencyMs:c.latencyMs,online:c.online,blockNumber:c.blockNumber,error:c.error,selected:c.id===r.selectedId}))};}
  snapshot(){return Object.values(this.routes).map(r=>this.publicRoute(r));}
}
export const rpcLatencyRouter=new RpcLatencyRouter();
