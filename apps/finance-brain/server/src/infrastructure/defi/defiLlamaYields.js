import {fetchJson} from '../httpClient.js';

const BASE=(process.env.DEFILLAMA_YIELDS_URL||'https://yields.llama.fi').replace(/\/$/,'');
const timeoutMs=Math.max(2000,Number(process.env.DEFI_DATA_TIMEOUT_MS||8000));
const getJson=url=>fetchJson(url,{timeoutMs,retries:2,errorPrefix:'DEFILLAMA'});
export class DefiLlamaYields{async pools(){const j=await getJson(`${BASE}/pools`);return Array.isArray(j?.data)?j.data:[];}async ping(){const t=Date.now();const rows=await this.pools();return {provider:'DefiLlama Yields',online:true,latencyMs:Date.now()-t,pools:rows.length,checkedAt:new Date().toISOString()};}}
export const defiLlamaYields=new DefiLlamaYields();
