export const BOT_DEFINITIONS = [
  { id:'liquidation', name:'Liquidation Hunter', domain:'Aave V3 borrower discovery · real RPC', network:'Arbitrum', wallet:'strategy-01' },
  { id:'arbitrage', name:'DEX Arbitrage Hunter', domain:'Router-v2 quotes · cross-DEX real RPC', network:'Ethereum', wallet:'strategy-02' },
  { id:'solana-radar', name:'Solana Early Token Radar', domain:'Real Solana launch-program activity · new mint discovery', network:'Solana', wallet:'strategy-03' },
  { id:'volatility', name:'Volatility Hunter', domain:'Real Binance klines · z-score · volume expansion', network:'Binance Spot', wallet:'strategy-04' },
  { id:'momentum', name:'Momentum / Trend Agent', domain:'Real Binance trend · SMA slope · momentum', network:'Binance Spot', wallet:'strategy-05' },
  { id:'perpetuals', name:'Perpetuals & Funding Hunter', domain:'Real funding · mark/index basis · open interest', network:'Binance Futures', wallet:'strategy-06' },
  { id:'polymarket', name:'Polymarket Intelligence', domain:'Real Gamma + CLOB orderbooks · read-only prediction intelligence', network:'Polygon', wallet:'strategy-07' },
  { id:'smart-money', name:'Whale & Smart-Money Tracker', domain:'Real ERC-20 transfer logs · watched wallets · exchange flows', network:'Ethereum', wallet:'strategy-08' },
  { id:'yield', name:'DeFi Yield / Pool Opportunity', domain:'Real yield pools · APY · TVL · IL risk', network:'Multi-DeFi', wallet:'strategy-09' },
  { id:'allocator', name:'Meta Strategy / Capital Allocator', domain:'Dynamic PAPER allocation · performance ranking', network:'Core', wallet:'strategy-10' }
];
export const DEFAULT_RISK={
  maxLossPerTradeUsd:50,
  maxDailyLossUsd:250,
  maxDrawdownUsd:250,
  maxStrategyExposurePct:20,
  maxAssetExposurePct:10,
  maxCorrelationExposurePct:45,
  maxSlippageBps:75,
  minConfidence:.72,
  minExpectedProfitUsd:5,
  maxOpportunityAgeMs:30000,
  maxDataAgeMs:120000,
  globalKillSwitch:false
};
