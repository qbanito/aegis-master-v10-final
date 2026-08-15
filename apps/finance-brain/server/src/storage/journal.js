import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const historyDir=path.resolve(here,'../../data/history');fs.mkdirSync(historyDir,{recursive:true});
function append(name,payload){const line=JSON.stringify({recordedAt:new Date().toISOString(),...payload})+'\n';fs.appendFile(path.join(historyDir,`${name}.jsonl`),line,()=>{});}
export const journal={
  opportunity:o=>append('opportunities',o),execution:e=>append('executions',e),rpc:r=>append('rpc-health',{rpc:r}),
  liquidation:l=>append('liquidation-scans',l),discovery:d=>append('borrower-discovery',d),arbitrage:a=>append('arbitrage-scans',a),
  volatility:v=>append('volatility-scans',v),marketData:m=>append('market-data-health',m),allocation:a=>append('capital-allocations',a),centralIncident:i=>append('central-incidents',i),centralReport:r=>append('central-reports',r),
  futuresMarketData:m=>append('futures-market-data-health',m),perpetuals:p=>append('perpetuals-scans',p),smartMoney:s=>append('smart-money-scans',s),momentum:m=>append('momentum-scans',m),yield:y=>append('yield-scans',y),yieldData:y=>append('yield-data-health',y),fusion:f=>append('signal-fusion',f),solana:s=>append('solana-radar-scans',s),solanaRpc:s=>append('solana-rpc-health',s),intelligence:i=>append('intelligence-signals',i),combo:c=>append('intelligence-combos',c),simulation:s=>append('simulations',s),performance:p=>append('strategy-performance',p),latencyRouter:r=>append('rpc-latency-router',{routes:r}),polymarket:p=>append('polymarket-scans',p),polymarketData:p=>append('polymarket-data-health',p)
};
