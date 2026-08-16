const PROFILES={
  liquidation:{baseSuccess:.92,costPct:.08,slippageMultiplier:.8},
  arbitrage:{baseSuccess:.86,costPct:.16,slippageMultiplier:1.25},
  // Early-token launches are adverse-selection heavy. This model is only a
  // conservative PAPER filter; promotion uses realized quote-backed outcomes.
  'solana-radar':{baseSuccess:.45,costPct:.30,slippageMultiplier:1.8},
  volatility:{baseSuccess:.76,costPct:.12,slippageMultiplier:1.15},
  momentum:{baseSuccess:.79,costPct:.10,slippageMultiplier:1.0},
  perpetuals:{baseSuccess:.83,costPct:.09,slippageMultiplier:.9},
  polymarket:{baseSuccess:.88,costPct:.05,slippageMultiplier:.7},
  'smart-money':{baseSuccess:.7,costPct:.12,slippageMultiplier:1.1},
  yield:{baseSuccess:.9,costPct:.03,slippageMultiplier:.5}
};
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export class UniversalSimulationEngine{
  simulate(opportunity,{routeLatencyMs=0}={}){
    const p=PROFILES[opportunity.strategyId]||{baseSuccess:.75,costPct:.12,slippageMultiplier:1};
    const gross=Math.max(0,Number(opportunity.expectedProfitUsd||0));
    const slippageBps=Math.max(0,Number(opportunity.estimatedSlippageBps||0))*p.slippageMultiplier;
    const slippageCost=gross*(slippageBps/10000);
    const modeledFees=Math.max(.01,gross*p.costPct);
    const latencyPenalty=Math.min(gross*.2,gross*(Math.max(0,routeLatencyMs)/10000));
    const net=Math.max(0,gross-modeledFees-slippageCost-latencyPenalty);
    const ageMs=Math.max(0,Date.now()-new Date(opportunity.createdAt||Date.now()).getTime());
    const freshness=clamp(1-ageMs/Math.max(1,Number(process.env.SIM_MAX_AGE_MS||60000)));
    const successProbability=clamp((Number(opportunity.executionProbability||.75)*.55)+(p.baseSuccess*.25)+(freshness*.20));
    const minNet=Number(process.env.SIM_MIN_NET_PROFIT_USD||2);
    const minProb=Number(process.env.SIM_MIN_SUCCESS_PROBABILITY||.65);
    const passed=net>=minNet&&successProbability>=minProb;
    return{
      id:crypto.randomUUID(),engine:'AEGIS_UNIVERSAL_SIM_V1',strategyId:opportunity.strategyId,opportunityId:opportunity.id,
      passed,grossExpectedProfitUsd:Number(gross.toFixed(2)),estimatedNetProfitUsd:Number(net.toFixed(2)),modeledFeesUsd:Number(modeledFees.toFixed(2)),
      modeledSlippageBps:Number(slippageBps.toFixed(2)),latencyPenaltyUsd:Number(latencyPenalty.toFixed(2)),routeLatencyMs:Number(routeLatencyMs||0),
      successProbability:Number(successProbability.toFixed(4)),freshness:Number(freshness.toFixed(4)),reasons:[...(net<minNet?['NET_PROFIT_BELOW_SIM_THRESHOLD']:[]),...(successProbability<minProb?['SIM_SUCCESS_PROBABILITY_LOW']:[])],simulatedAt:new Date().toISOString()
    };
  }
}
export const simulationEngine=new UniversalSimulationEngine();
