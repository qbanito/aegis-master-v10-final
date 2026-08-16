import {fetchJson} from '../httpClient.js';

const BASE=(process.env.DEFILLAMA_YIELDS_URL||'https://yields.llama.fi').replace(/\/$/,'');
const timeoutMs=Math.max(5000,Number(process.env.DEFI_DATA_TIMEOUT_MS||20000));
const getJson=url=>fetchJson(url,{timeoutMs,retries:2,errorPrefix:'DEFILLAMA'});
export class DefiLlamaYields{
  constructor(){this.cache=[];this.cachedAt=null;}
  async pools(){
    try{const j=await getJson(`${BASE}/pools`);const rows=Array.isArray(j?.data)?j.data:[];if(!rows.length)throw new Error('DEFILLAMA_EMPTY_POOL_SET');this.cache=rows;this.cachedAt=new Date().toISOString();return rows;}
    catch(error){if(this.cache.length)return this.cache;throw error;}
  }
  async ping(){const t=Date.now();const rows=await this.pools();return {provider:'DefiLlama Yields',online:true,latencyMs:Date.now()-t,pools:rows.length,cachedAt:this.cachedAt,checkedAt:new Date().toISOString()};}
}
export const defiLlamaYields=new DefiLlamaYields();
