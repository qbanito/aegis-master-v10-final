import {fetchJson} from '../httpClient.js';

const now=()=>new Date().toISOString();
const clean=value=>String(value||'').replace(/\/$/,'');

export class HeliusConnector{
  constructor(){
    this.key=process.env.HELIUS_API_KEY||'';
    this.base=clean(process.env.HELIUS_RPC_URL||'https://mainnet.helius-rpc.com');
    this.timeoutMs=Math.max(2000,Number(process.env.MARKET_DATA_TIMEOUT_MS||8000));
  }
  configured(){return Boolean(this.key);}
  endpoint(){return this.key?`${this.base}/?api-key=${encodeURIComponent(this.key)}`:this.base;}
  status(){return {id:'helius-solana',provider:'Helius',mode:'READ_ONLY',configured:this.configured(),enabled:true,online:null,live:false,liveExecutionReady:false,base:this.base,capabilities:['solana-rpc','asset-metadata','token-ownership'],credentialsStoredInApp:false,warning:'Solo lectura; no firma ni envía transacciones.'};}
  async rpc(method,params=[]){
    if(!this.configured())throw new Error('HELIUS_API_KEY_MISSING');
    const body=await fetchJson(this.endpoint(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params}),timeoutMs:this.timeoutMs,retries:1,errorPrefix:'HELIUS_RPC'});
    if(body?.error)throw new Error(body.error.message||'HELIUS_RPC_ERROR');
    return body?.result;
  }
  async probe(){
    if(!this.configured())return {...this.status(),online:false,readiness:'BLOCKED',error:'HELIUS_API_KEY_MISSING',checkedAt:now()};
    const started=Date.now();
    try{const result=await this.rpc('getHealth');return {...this.status(),online:true,readiness:'READY',health:result,latencyMs:Date.now()-started,checkedAt:now()};}
    catch(error){return {...this.status(),online:false,readiness:'DEGRADED',error:error?.message||'HELIUS_RPC_ERROR',latencyMs:Date.now()-started,checkedAt:now()};}
  }
  async asset(address){return this.rpc('getAsset',{id:address,displayOptions:{showFungible:true,showInscription:false}});}
}

export class GoPlusConnector{
  constructor(){
    this.base=clean(process.env.GOPLUS_API_URL||'https://api.gopluslabs.io');
    this.token=process.env.GOPLUS_ACCESS_TOKEN||'';
    this.enabled=process.env.GOPLUS_ENABLED!=='false';
  }
  configured(){return this.enabled;}
  headers(){return this.token?{Authorization:`Bearer ${this.token}`}:{};}
  status(){return {id:'goplus-token-security',provider:'GoPlus Token Security',mode:'READ_ONLY',configured:this.configured(),enabled:this.enabled,online:null,live:false,liveExecutionReady:false,base:this.base,capabilities:['solana-token-security','evm-token-security','honeypot/tax/owner checks'],credentialsStoredInApp:false,warning:'La respuesta de seguridad es un gate; no autoriza por sí sola una orden.'};}
  async tokenSecurity(chain,address){
    if(!this.enabled)throw new Error('GOPLUS_DISABLED');
    if(!address)throw new Error('TOKEN_ADDRESS_REQUIRED');
    const path=String(chain).toLowerCase()==='solana'?'/api/v1/solana/token_security':`/api/v1/token_security/${encodeURIComponent(chain)}`;
    const url=new URL(this.base+path);url.searchParams.set('contract_addresses',address);
    const body=await fetchJson(url,{headers:this.headers(),timeoutMs:8000,retries:1,errorPrefix:'GOPLUS_TOKEN_SECURITY'});
    if(body?.code!==undefined&&Number(body.code)!==1)throw new Error(body.message||'GOPLUS_TOKEN_SECURITY_ERROR');
    return body?.result||body;
  }
  async probe(){return {...this.status(),online:this.enabled,readiness:this.enabled?'READY':'BLOCKED',checkedAt:now()};}
}

export const helius=new HeliusConnector();
export const goPlus=new GoPlusConnector();
