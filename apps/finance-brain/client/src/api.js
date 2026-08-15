export const API=import.meta.env.VITE_CORE_URL||'http://localhost:8787';
async function call(path,options={}){const r=await fetch(API+path,{headers:{'content-type':'application/json',...(options.headers||{})},...options});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.message||body.error||`HTTP ${r.status}`);return body;}
export const getState=()=>call('/api/state');
export const toggleBot=id=>call(`/api/bots/${id}/toggle`,{method:'POST'});
export const setRisk=body=>call('/api/risk',{method:'POST',body:JSON.stringify(body)});
export const testOpportunity=()=>call('/api/opportunities/test',{method:'POST'});
export const probeRpc=()=>call('/api/infrastructure/rpc/probe',{method:'POST'});
export const probeMarketData=()=>call('/api/infrastructure/market-data/probe',{method:'POST'});
export const probeFuturesMarketData=()=>call('/api/infrastructure/futures-market-data/probe',{method:'POST'});
export const scanLiquidations=()=>call('/api/liquidation/scan',{method:'POST'});
export const discoverLiquidations=()=>call('/api/liquidation/discover',{method:'POST'});
export const scanArbitrage=()=>call('/api/arbitrage/scan',{method:'POST'});
export const scanVolatility=()=>call('/api/volatility/scan',{method:'POST'});
export const scanPerpetuals=()=>call('/api/perpetuals/scan',{method:'POST'});
export const scanSmartMoney=()=>call('/api/smart-money/scan',{method:'POST'});
export const rebalanceCapital=()=>call('/api/allocator/rebalance',{method:'POST'});

export const scanMomentum=()=>call('/api/momentum/scan',{method:'POST'});
export const scanYield=()=>call('/api/yield/scan',{method:'POST'});
export const probeYieldData=()=>call('/api/infrastructure/yield-data/probe',{method:'POST'});

export const probeSolana=()=>call('/api/infrastructure/solana/probe',{method:'POST'});
export const scanSolanaRadar=()=>call('/api/solana-radar/scan',{method:'POST'});
export const getIntelligence=()=>call('/api/intelligence');

export const probeLatencyRouter=()=>call('/api/infrastructure/rpc/latency-probe',{method:'POST'});
export const probePolymarket=()=>call('/api/infrastructure/polymarket/probe',{method:'POST'});
export const scanPolymarket=()=>call('/api/polymarket/scan',{method:'POST'});
export const getSimulation=()=>call('/api/simulation');
export const getPerformance=()=>call('/api/performance');
export const runReplay=(limit=500)=>call('/api/replay/run',{method:'POST',body:JSON.stringify({limit})});
export const getProductionStatus=()=>call('/api/production/status');
export const resetCircuitBreaker=id=>call(`/api/circuit-breakers/${id}/reset`,{method:'POST'});
export const getExecutionCapabilities=()=>call('/api/execution/capabilities');
export const getVaultStatus=()=>call('/api/vault/status');
export const getEvmNetworks=()=>call('/api/infrastructure/evm/networks');
export const getWalletStatus=address=>call(`/api/wallet/status?address=${encodeURIComponent(address)}`);
export const getBinanceIntegrationStatus=()=>call('/api/integrations/binance/status');
export const probeBinanceIntegration=market=>call('/api/integrations/binance/probe',{method:'POST',body:JSON.stringify({market})});
export const getSolanaIntegrationStatus=()=>call('/api/integrations/solana/status');
export const probeSolanaIntegration=()=>call('/api/integrations/solana/probe',{method:'POST'});
export const getPolymarketIntegrationStatus=()=>call('/api/integrations/polymarket/status');
export const connectPolymarketWallet=address=>call('/api/integrations/polymarket/wallet/connect',{method:'POST',body:JSON.stringify({address})});
export const getPolymarketPendingSignature=()=>call('/api/integrations/polymarket/pending-signature');
export const resolvePolymarketSignature=(id,body)=>call(`/api/integrations/polymarket/pending-signature/${id}`,{method:'POST',body:JSON.stringify(body)});

export const getAgentStatus=()=>call('/api/agent/status');
export const chatAgent=message=>call('/api/agent/chat',{method:'POST',body:JSON.stringify({message})});
export const getLiquidationLab=()=>call('/api/liquidation/lab');
export const rescoreLiquidationLab=()=>call('/api/liquidation/lab/rescore',{method:'POST'});
