const ROUTES={
  liquidation:{executionKind:'DEX',venue:'Aave V3 / DEX',ecosystem:'EVM',chain:'Arbitrum',chainId:42161,scope:'eip155:42161',wallet:'METAMASK',presetNames:['Health Factor Fortress','Balanced Liquidator','Fast Auction Capture']},
  arbitrage:{executionKind:'DEX',venue:'DEX Routers',ecosystem:'EVM',chain:'Arbitrum',chainId:42161,scope:'eip155:42161',wallet:'METAMASK',presetNames:['Net Edge Guard','Cross-DEX Balanced','Latency Edge Hunter']},
  'solana-radar':{executionKind:'DEX',venue:'Jupiter / Jito',ecosystem:'SOLANA',chain:'Solana',chainId:null,scope:'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',wallet:'METAMASK',presetNames:['Verified Births','Early Quality','Zero-Block Hunter']},
  volatility:{executionKind:'CEX',venue:'Binance Spot',ecosystem:'CEX',chain:'Binance Spot',chainId:null,scope:null,wallet:'ENV_CREDENTIALS',presetNames:['Volatility Compression','Expansion Confirmed','Breakout Acceleration']},
  momentum:{executionKind:'CEX',venue:'Binance Spot',ecosystem:'CEX',chain:'Binance Spot',chainId:null,scope:null,wallet:'ENV_CREDENTIALS',presetNames:['Trend Confirmation','Multi-Timeframe Trend','Momentum Acceleration']},
  perpetuals:{executionKind:'CEX',venue:'Binance Futures',ecosystem:'CEX',chain:'Binance Futures',chainId:null,scope:null,wallet:'ENV_CREDENTIALS',presetNames:['Funding Neutral','Basis + Funding','Funding Dislocation']},
  polymarket:{executionKind:'DEX',venue:'Polymarket CLOB',ecosystem:'EVM',chain:'Polygon',chainId:137,scope:'eip155:137',wallet:'METAMASK',presetNames:['Deep Liquidity Only','Probability Dislocation','Event Catalyst']},
  'smart-money':{executionKind:'INTELLIGENCE',venue:'On-chain Intelligence',ecosystem:'EVM',chain:'Ethereum',chainId:1,scope:'eip155:1',wallet:'NONE',presetNames:['Confirmed Whale Flow','Cluster Consensus','Early Wallet Rotation']},
  yield:{executionKind:'DEX',venue:'DeFi Protocols',ecosystem:'MULTICHAIN',chain:'Dynamic',chainId:null,scope:null,wallet:'METAMASK',presetNames:['Stable Yield Shield','Risk-Adjusted Yield','Incentive Rotation']},
  allocator:{executionKind:'INTELLIGENCE',venue:'AEGIS Core',ecosystem:'CORE',chain:'Internal',chainId:null,scope:null,wallet:'NONE',presetNames:['Capital Preservation','Risk Parity','Opportunity Weighted']},
  'solana-meme-momentum':{executionKind:'DEX',venue:'Jupiter / Solana DEX',ecosystem:'SOLANA',chain:'Solana',chainId:null,scope:'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',wallet:'METAMASK',presetNames:['Rug Shield','Liquidity Momentum','Meme Velocity']},
  'polygon-meme-momentum':{executionKind:'DEX',venue:'0x / Polygon DEX',ecosystem:'EVM',chain:'Polygon',chainId:137,scope:'eip155:137',wallet:'METAMASK',presetNames:['Contract Shield','Liquidity Momentum','Meme Velocity']},
  'fx-macro-momentum':{executionKind:'BROKER',venue:'OANDA',ecosystem:'BROKER',chain:'Forex',chainId:null,scope:null,wallet:'ENV_CREDENTIALS',presetNames:['Macro Defensive','Session Trend','Event Momentum']},
  'options-defined-risk':{executionKind:'BROKER',venue:'Alpaca / IBKR',ecosystem:'BROKER',chain:'US Options',chainId:null,scope:null,wallet:'ENV_CREDENTIALS',presetNames:['Defined Risk Core','IV + Liquidity','Catalyst Spreads']},
  'crude-oil-regime':{executionKind:'BROKER',venue:'Alpaca / IBKR',ecosystem:'BROKER',chain:'Energy',chainId:null,scope:null,wallet:'ENV_CREDENTIALS',presetNames:['Event Protected','Regime Balanced','Trend Expansion']},
  'nyse-news-impact':{executionKind:'BROKER',venue:'Alpaca / IBKR',ecosystem:'BROKER',chain:'NYSE',chainId:null,scope:null,wallet:'ENV_CREDENTIALS',presetNames:['Verified News','Impact + Volume','Opening Catalyst']}
};

export const RISK_PROFILES={
  LOW:{label:'BAJO',description:'Prioriza preservación de capital y confirmación.',config:{maxAllocationPct:5,minConfidence:.82,maxRiskScore:.35,minExpectedProfitUsd:10,maxSlippageBps:35},positionScale:.35},
  MEDIUM:{label:'MEDIO',description:'Balance entre frecuencia, calidad y exposición.',config:{maxAllocationPct:10,minConfidence:.75,maxRiskScore:.55,minExpectedProfitUsd:5,maxSlippageBps:75},positionScale:.65},
  HIGH:{label:'ALTO',description:'Mayor frecuencia y exposición dentro de límites duros.',config:{maxAllocationPct:20,minConfidence:.70,maxRiskScore:.72,minExpectedProfitUsd:2,maxSlippageBps:125},positionScale:1}
};

const STYLES=[
  {slug:'defensive',description:'Filtro estricto, menor frecuencia y mejor protección frente a ruido.',adjust:{allocation:.7,confidence:.03,risk:-.08,profit:1.3,slippage:.7}},
  {slug:'balanced',description:'Configuración principal equilibrada para operación continua.',adjust:{allocation:1,confidence:0,risk:0,profit:1,slippage:1}},
  {slug:'opportunistic',description:'Captura más señales sin superar los límites del nivel de riesgo.',adjust:{allocation:1.2,confidence:-.02,risk:.08,profit:.8,slippage:1.25}}
];
const round=(value,digits=2)=>Number(Number(value).toFixed(digits));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function routeForBot(id){return ROUTES[id]?{...ROUTES[id],presetNames:undefined}:null;}
export function allExecutionRoutes(){return Object.fromEntries(Object.entries(ROUTES).map(([id])=>[id,routeForBot(id)]));}
export function presetsForBot(id,riskLevel='MEDIUM'){
  const route=ROUTES[id];if(!route)return[];const risk=RISK_PROFILES[String(riskLevel).toUpperCase()]||RISK_PROFILES.MEDIUM;
  return STYLES.map((style,index)=>({
    id:`${id}-${style.slug}`,name:route.presetNames[index],riskLevel:String(riskLevel).toUpperCase(),description:style.description,
    config:{maxAllocationPct:round(clamp(risk.config.maxAllocationPct*style.adjust.allocation,0,50),1),minConfidence:round(clamp(risk.config.minConfidence+style.adjust.confidence,.5,.99)),maxRiskScore:round(clamp(risk.config.maxRiskScore+style.adjust.risk,.05,.9)),minExpectedProfitUsd:round(Math.max(0,risk.config.minExpectedProfitUsd*style.adjust.profit),2),maxSlippageBps:Math.round(clamp(risk.config.maxSlippageBps*style.adjust.slippage,1,500))}
  }));
}
export function presetForBot(id,presetId,riskLevel='MEDIUM'){return presetsForBot(id,riskLevel).find(item=>item.id===presetId)||null;}
export const EXECUTION_BOT_IDS=Object.freeze(Object.keys(ROUTES));
