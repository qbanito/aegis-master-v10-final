const assets={
  arbitrage:['WETH/USDC','USDC/USDT','WBTC/WETH'],
  'solana-radar':['SOL/USDC','NEW/SOL'], volatility:['BTC/USDT','ETH/USDT','SOL/USDT'], momentum:['BTC/USD','ETH/USD'],
  perpetuals:['ETH-PERP','SOL-PERP'], polymarket:['EVENT-MARKET'], 'smart-money':['WETH','SOL'], yield:['USDC/USDT LP','WETH/USDC LP']
};
function pick(a){ return a[Math.floor(Math.random()*a.length)] }
function opportunity(bot){
  const base=8+Math.random()*210;
  return {strategyId:bot.id,strategy:bot.name,network:bot.network,asset:pick(assets[bot.id]||['N/A']),confidence:.62+Math.random()*.36,
    executionProbability:.65+Math.random()*.3,expectedProfitUsd:Number(base.toFixed(2)),capitalRequiredUsd:Math.round(250+Math.random()*2500),
    estimatedSlippageBps:Math.round(5+Math.random()*85),riskScore:.15+Math.random()*.65,source:'V8_SYNTHETIC_SCANNER',synthetic:true,
    expiresAt:new Date(Date.now()+30000).toISOString()};
}
export function startSyntheticAgents(state,bus,onHeartbeat){
  const intervals=[];
  for(const bot of state.bots){
    // Every finance bot must be backed by its real connector. The fallback
    // generator is reserved for non-finance demo surfaces and must never
    // inflate a market bot's opportunities or PAPER PnL.
    if(bot.marketBotId||['allocator','liquidation','arbitrage','volatility','perpetuals','polymarket','smart-money','momentum','yield','solana-radar'].includes(bot.id)) continue;
    bot.status=bot.active?'SCANNING':'PAUSED';
    intervals.push(setInterval(()=>{
      bot.heartbeat=new Date().toISOString(); bot.status=bot.active?'SCANNING':'PAUSED'; onHeartbeat(bot);
      if(bot.active && Math.random()<.28) bus.emit('raw-opportunity',opportunity(bot));
    },3500+Math.floor(Math.random()*3000)));
  }
  return()=>intervals.forEach(clearInterval);
}
