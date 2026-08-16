import {strategyConfigService} from './strategyConfigService.js';

export function evaluateRisk(opportunity,state){
  const r=state.risk,reasons=[];
  if(r.globalKillSwitch)reasons.push('GLOBAL_KILL_SWITCH');
  if(opportunity.simulation && !opportunity.simulation.passed)reasons.push('SIMULATION_REJECTED');
  if(opportunity.confidence<r.minConfidence)reasons.push('LOW_CONFIDENCE');
  const strategyConfig=strategyConfigService.get()[opportunity.strategyId];
  if(strategyConfig?.enabled===false)reasons.push('STRATEGY_DISABLED');
  if(strategyConfig?.minConfidence!=null&&opportunity.confidence<Number(strategyConfig.minConfidence))reasons.push('STRATEGY_MIN_CONFIDENCE');
  if(opportunity.expectedProfitUsd<r.minExpectedProfitUsd)reasons.push('LOW_EXPECTED_PROFIT');
  if(opportunity.estimatedSlippageBps>r.maxSlippageBps)reasons.push('SLIPPAGE_LIMIT');
  if(Date.now()-new Date(opportunity.createdAt).getTime()>r.maxOpportunityAgeMs)reasons.push('STALE_OPPORTUNITY');
  const bot=state.bots.find(b=>b.id===opportunity.strategyId); if(!bot?.active)reasons.push('BOT_PAUSED');
  return{approved:reasons.length===0,reasons,evaluatedAt:new Date().toISOString()};
}
