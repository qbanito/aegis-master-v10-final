import {fetchJson} from '../httpClient.js';

const bool=(v,f=false)=>String(v??f).toLowerCase()==='true';

export class SolanaTradingConnector {
  constructor(){
    this.rpcUrls=[process.env.SOLANA_RPC_URL,process.env.SOLANA_RPC_URL_2,process.env.SOLANA_RPC_URL_3].filter(Boolean);if(!this.rpcUrls.length)this.rpcUrls=['https://api.mainnet-beta.solana.com'];this.rpc=this.rpcUrls[0];
    this.jupiter=(process.env.SOLANA_JUPITER_API_BASE||'https://lite-api.jup.ag').replace(/\/$/,'');
    this.jupiterApiKey=String(process.env.SOLANA_JUPITER_API_KEY||'');
    this.jitoUrl=process.env.JITO_TX_URL||'https://mainnet.block-engine.jito.wtf/api/v1/transactions';
    this.jitoAuth=String(process.env.JITO_AUTH||'');
    this.enabled=bool(process.env.SOLANA_LIVE_ENABLED,false);
    this.confirmation=String(process.env.SOLANA_LIVE_CONFIRM||'');
    this.walletAddress=String(process.env.SOLANA_WALLET_ADDRESS||'');
    this.maxPriorityFeeLamports=Math.max(0,Number(process.env.SOLANA_MAX_PRIORITY_FEE_LAMPORTS||1000000));
  }
  status(){return{provider:'Solana RPC + Jupiter + Jito',configured:Boolean(this.rpc),enabled:this.enabled,armed:this.enabled&&this.confirmation==='I_UNDERSTAND_REAL_FUNDS',walletAddress:this.walletAddress||null,privateKeyStoredInApp:false,jupiter:this.jupiter,jupiterRoute:'swap/v1 legacy with instructionVersion=V2',jito:this.jitoUrl,rpcEndpoints:this.rpcUrls.length,maxPriorityFeeLamports:this.maxPriorityFeeLamports};}
  async rpcCall(method,params=[]){let lastError=null;for(const url of this.rpcUrls){try{const body=await fetchJson(url,{timeoutMs:10000,retries:1,headers:{'content-type':'application/json'},errorPrefix:'SOLANA_RPC',method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params})});if(body.error)throw new Error(body.error.message||'SOLANA_RPC_ERROR');this.rpc=url;return body.result;}catch(error){lastError=error;}}throw lastError||new Error('SOLANA_RPC_UNAVAILABLE');}
  async ping(){const started=Date.now();const [version,slot]=await Promise.all([this.rpcCall('getVersion'),this.rpcCall('getSlot',[{commitment:'processed'}])]);return{provider:'Solana RPC',online:true,slot,version:version?.['solana-core']||null,latencyMs:Date.now()-started,checkedAt:new Date().toISOString(),error:null};}
  async quote({inputMint,outputMint,amount,slippageBps=100}){if(!inputMint||!outputMint||!amount)throw new Error('SOLANA_QUOTE_PARAMETERS_REQUIRED');const u=new URL(`${this.jupiter}/swap/v1/quote`);for(const [k,v]of Object.entries({inputMint,outputMint,amount,slippageBps,restrictIntermediateTokens:'true',instructionVersion:'V2'}))u.searchParams.set(k,String(v));const headers={accept:'application/json'};if(this.jupiterApiKey)headers['x-api-key']=this.jupiterApiKey;return fetchJson(u,{timeoutMs:10000,retries:2,headers,errorPrefix:'JUPITER_QUOTE'});}
  async prepareSwap({quoteResponse,userPublicKey}){if(!quoteResponse||!userPublicKey)throw new Error('SOLANA_SWAP_PARAMETERS_REQUIRED');const headers={'content-type':'application/json',accept:'application/json'};if(this.jupiterApiKey)headers['x-api-key']=this.jupiterApiKey;const body=await fetchJson(`${this.jupiter}/swap/v1/swap`,{method:'POST',timeoutMs:15000,retries:2,headers,errorPrefix:'JUPITER_SWAP',body:JSON.stringify({userPublicKey,quoteResponse,dynamicComputeUnitLimit:true,prioritizationFeeLamports:{priorityLevelWithMaxLamports:{priorityLevel:'high',maxLamports:this.maxPriorityFeeLamports,global:false}}})});if(!body.swapTransaction)throw new Error(body?.error||'JUPITER_SWAP_TRANSACTION_MISSING');return{swapTransaction:body.swapTransaction,lastValidBlockHeight:body.lastValidBlockHeight,prioritizationFeeLamports:body.prioritizationFeeLamports||null,simulationRequired:true};}
  async submitSignedTransaction(signedTransactionBase64){if(!this.status().armed)throw new Error('SOLANA_LIVE_TRADING_LOCKED');if(!signedTransactionBase64)throw new Error('SOLANA_SIGNED_TRANSACTION_REQUIRED');const auth=this.jitoAuth?{'x-jito-auth':this.jitoAuth}:{};try{const response=await fetch(this.jitoUrl,{method:'POST',headers:{'content-type':'application/json',...auth},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'sendTransaction',params:[signedTransactionBase64,{encoding:'base64'}]}),signal:AbortSignal.timeout(10000)});const body=await response.json().catch(()=>({}));if(response.ok&&body.result)return{path:'jito',signature:body.result};}catch{}
    const result=await this.rpcCall('sendTransaction',[signedTransactionBase64,{encoding:'base64',skipPreflight:false,maxRetries:2}]);return{path:'rpc',signature:result};
  }
}
export const solanaTrading=new SolanaTradingConnector();
