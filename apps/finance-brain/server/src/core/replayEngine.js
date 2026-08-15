import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeOpportunity,brainDecision} from './brain.js';
import {evaluateRisk} from './riskEngine.js';
import {simulationEngine} from './simulationEngine.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const historyDir=path.resolve(here,'../../data/history');
function readJsonl(file,limit=1000){
  try{return fs.readFileSync(path.join(historyDir,file),'utf8').split('\n').filter(Boolean).slice(-limit).map(x=>JSON.parse(x));}catch{return [];}
}
export class ReplayEngine{
  run({limit=500,riskState,routeLatencyMs=25}={}){
    const source=readJsonl('opportunities.jsonl',limit);
    let accepted=0,rejected=0,totalExpected=0,totalSimulated=0;
    const byStrategy={};
    for(const raw of source){
      const o=normalizeOpportunity(raw);const brain=brainDecision(o);const simulation=simulationEngine.simulate({...o,brain},{routeLatencyMs});const risk=evaluateRisk({...o,brain,simulation},riskState);
      const pass=brain.decision==='CANDIDATE'&&simulation.passed&&risk.approved;pass?accepted++:rejected++;
      totalExpected+=Number(o.expectedProfitUsd||0);totalSimulated+=pass?Number(simulation.estimatedNetProfitUsd||0):0;
      const id=o.strategyId||'unknown';byStrategy[id]??={strategyId:id,samples:0,accepted:0,simulatedNetUsd:0};byStrategy[id].samples++;if(pass){byStrategy[id].accepted++;byStrategy[id].simulatedNetUsd+=Number(simulation.estimatedNetProfitUsd||0);}
    }
    return {id:`replay-${Date.now()}`,createdAt:new Date().toISOString(),sourceSamples:source.length,accepted,rejected,acceptRate:source.length?accepted/source.length:0,totalExpectedUsd:+totalExpected.toFixed(2),totalSimulatedNetUsd:+totalSimulated.toFixed(2),byStrategy:Object.values(byStrategy).sort((a,b)=>b.simulatedNetUsd-a.simulatedNetUsd)};
  }
}
export const replayEngine=new ReplayEngine();
