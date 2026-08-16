export const STRATEGY_PROFILES={
  liquidation:{kind:'PROTOCOL',validationMode:'ONCHAIN_PROTOCOL_OBSERVATIONS',target:10,label:'Aave borrower + liquidation-state proofs'},
  arbitrage:{kind:'PROTOCOL',validationMode:'DEX_ROUND_TRIP_QUOTES',target:10,label:'Real router round-trip quote proofs'},
  'solana-radar':{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed Jupiter-quoted PAPER trades'},
  volatility:{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed spot-quoted PAPER trades'},
  momentum:{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed spot-quoted PAPER trades'},
  perpetuals:{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed derivatives-quoted PAPER trades'},
  polymarket:{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed CLOB-quoted PAPER trades'},
  'smart-money':{kind:'INTELLIGENCE',validationMode:'VERIFIED_CHAIN_SIGNALS',target:10,label:'Verified on-chain transfer signals'},
  yield:{kind:'YIELD',validationMode:'REAL_PROVIDER_OBSERVATIONS',target:10,label:'Verified DefiLlama pool observations'},
  allocator:{kind:'ALLOCATOR',validationMode:'NOT_REQUIRED',target:0,label:'Internal allocator — trade quota not applicable'},
  'solana-meme-momentum':{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed Jupiter-quoted PAPER trades'},
  'polygon-meme-momentum':{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed 0x-quoted PAPER trades'},
  'fx-macro-momentum':{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed practice-broker PAPER trades'},
  'options-defined-risk':{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed Alpaca PAPER trades'},
  'crude-oil-regime':{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed Alpaca PAPER trades'},
  'nyse-news-impact':{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed Alpaca PAPER trades'}
};

const EVIDENCE_SOURCES={
  liquidation:new Set(['AAVE_V3_BORROWER_DISCOVERY']),
  arbitrage:new Set(['DEX_ROUTER_REAL_QUOTES']),
  'smart-money':new Set(['ERC20_TRANSFER_LOGS_REAL']),
  yield:new Set(['DEFILLAMA_YIELDS_REAL'])
};

export function strategyProfile(id){return STRATEGY_PROFILES[id]||{kind:'EXECUTION',validationMode:'REAL_MARKET_QUOTE_CLOSES',target:25,label:'Closed real-quote PAPER trades'};}
export const requiresTradeEvidence=id=>strategyProfile(id).kind==='EXECUTION';

export function recordStrategyEvidence(state,opportunity,{simulation=null,risk=null}={}){
  const profile=strategyProfile(opportunity?.strategyId);
  const allowedSources=EVIDENCE_SOURCES[opportunity?.strategyId];
  if(profile.kind==='EXECUTION'||profile.kind==='ALLOCATOR'||opportunity?.synthetic!==false||!allowedSources?.has(opportunity?.source))return null;
  state.infrastructure??={};state.infrastructure.strategyEvidence??=[];
  if(state.infrastructure.strategyEvidence.some(row=>row.opportunityId===opportunity.id))return null;
  const observedAt=new Date().toISOString();
  const evidence={id:crypto.randomUUID(),opportunityId:opportunity.id,strategyId:opportunity.strategyId,kind:profile.kind,validationMode:profile.validationMode,source:opportunity.source,asset:opportunity.asset,network:opportunity.network,providerBacked:true,simulationPassed:simulation?.passed===true,riskApproved:risk?.approved===true,confidence:Number(opportunity.confidence||0),riskScore:Number(opportunity.riskScore||0),expectedProfitUsd:Number(opportunity.expectedProfitUsd||0),metadata:opportunity.metadata||{},observedAt,status:'OBSERVED_PAPER',paperOnly:true,mutatesPnl:false};
  state.infrastructure.strategyEvidence.unshift(evidence);state.infrastructure.strategyEvidence=state.infrastructure.strategyEvidence.slice(0,1000);return evidence;
}

export function strategyEvidenceSnapshot(state,id){
  const profile=strategyProfile(id),rows=(state?.infrastructure?.strategyEvidence||[]).filter(row=>row.strategyId===id&&row.providerBacked===true);
  return {profile,observations:rows.length,recent:rows.slice(0,20),lastObservedAt:rows[0]?.observedAt||null};
}
