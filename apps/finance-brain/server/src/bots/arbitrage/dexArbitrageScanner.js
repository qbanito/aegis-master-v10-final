import { Contract, formatUnits, isAddress, parseUnits } from 'ethers';

const ROUTER_ABI=['function getAmountsOut(uint256 amountIn,address[] path) view returns (uint256[] amounts)'];

function clamp(n,min=0,max=1){ return Math.max(min,Math.min(max,n)); }
function clean(v){ return String(v||'').trim(); }
function configuredAddress(v){ return isAddress(clean(v)) ? clean(v) : null; }

export class DexArbitrageScanner {
  constructor({rpcManager,bus,onStatus,onScan}){
    this.rpcManager=rpcManager; this.bus=bus; this.onStatus=onStatus; this.onScan=onScan;
    this.running=false; this.interval=null;
    this.network=clean(process.env.ARB_NETWORK||'arbitrum').toLowerCase();
    this.routerA=configuredAddress(process.env.ARB_ROUTER_A);
    this.routerB=configuredAddress(process.env.ARB_ROUTER_B);
    this.routerAName=clean(process.env.ARB_ROUTER_A_NAME||'DEX_A');
    this.routerBName=clean(process.env.ARB_ROUTER_B_NAME||'DEX_B');
    this.tokenIn=configuredAddress(process.env.ARB_TOKEN_IN);
    this.tokenOut=configuredAddress(process.env.ARB_TOKEN_OUT);
    this.tokenInSymbol=clean(process.env.ARB_TOKEN_IN_SYMBOL||'TOKEN_IN');
    this.tokenOutSymbol=clean(process.env.ARB_TOKEN_OUT_SYMBOL||'TOKEN_OUT');
    this.tokenInDecimals=Math.max(0,Number(process.env.ARB_TOKEN_IN_DECIMALS||6));
    this.tokenOutDecimals=Math.max(0,Number(process.env.ARB_TOKEN_OUT_DECIMALS||18));
    this.tradeSize=Math.max(0.000001,Number(process.env.ARB_TRADE_SIZE||1000));
    this.scanEveryMs=Math.max(3000,Number(process.env.ARB_SCAN_MS||10000));
    this.feeBps=Math.max(0,Number(process.env.ARB_TOTAL_FEE_BPS||60));
    this.gasEstimateUsd=Math.max(0,Number(process.env.ARB_GAS_ESTIMATE_USD||2.5));
    this.minNetProfitUsd=Math.max(0,Number(process.env.ARB_MIN_NET_PROFIT_USD||5));
    this.maxSanitySpreadBps=Math.max(50,Number(process.env.ARB_MAX_SANITY_SPREAD_BPS||500));
  }
  config(){
    return {network:this.network,routerA:this.routerA,routerB:this.routerB,routerAName:this.routerAName,routerBName:this.routerBName,
      tokenIn:this.tokenIn,tokenOut:this.tokenOut,pair:`${this.tokenInSymbol}/${this.tokenOutSymbol}`,tradeSize:this.tradeSize,scanEveryMs:this.scanEveryMs,
      feeBps:this.feeBps,gasEstimateUsd:this.gasEstimateUsd,minNetProfitUsd:this.minNetProfitUsd,
      configured:Boolean(this.routerA&&this.routerB&&this.tokenIn&&this.tokenOut)};
  }
  async quote(routerAddress,amountIn,path){
    const provider=this.rpcManager.provider(this.network); if(!provider) throw new Error('RPC_NOT_CONFIGURED');
    const router=new Contract(routerAddress,ROUTER_ABI,provider);
    const amounts=await router.getAmountsOut(amountIn,path); return amounts[amounts.length-1];
  }
  async scanOnce(){
    if(this.running) return; const provider=this.rpcManager.provider(this.network);
    if(!provider) return this.onStatus?.('WAITING_RPC');
    if(!this.config().configured) return this.onStatus?.('WAITING_CONFIG');
    this.running=true; this.onStatus?.('SCANNING_REAL');
    const amountIn=parseUnits(String(this.tradeSize),this.tokenInDecimals);
    try{
      const path=[this.tokenIn,this.tokenOut];
      const [outA,outB]=await Promise.all([this.quote(this.routerA,amountIn,path),this.quote(this.routerB,amountIn,path)]);
      const qa=Number(formatUnits(outA,this.tokenOutDecimals)); const qb=Number(formatUnits(outB,this.tokenOutDecimals));
      const high=Math.max(qa,qb),low=Math.min(qa,qb),mid=(high+low)/2;
      const spreadBps=mid>0?((high-low)/mid)*10000:0;
      const grossSpreadPct=mid>0?((high-low)/mid)*100:0;
      const grossProfitUsd=this.tradeSize*(spreadBps/10000);
      const feeUsd=this.tradeSize*(this.feeBps/10000);
      const netProfitUsd=grossProfitUsd-feeUsd-this.gasEstimateUsd;const quoteGuard=spreadBps>this.maxSanitySpreadBps;
      const buyDex=qa<=qb?this.routerAName:this.routerBName; const sellDex=qa<=qb?this.routerBName:this.routerAName;
      const scan={network:this.network,pair:`${this.tokenInSymbol}/${this.tokenOutSymbol}`,tradeSize:this.tradeSize,quoteA:qa,quoteB:qb,routerAName:this.routerAName,routerBName:this.routerBName,
        spreadBps:Number(spreadBps.toFixed(2)),grossSpreadPct:Number(grossSpreadPct.toFixed(4)),grossProfitUsd:quoteGuard?null:Number(grossProfitUsd.toFixed(2)),feeUsd:Number(feeUsd.toFixed(2)),gasEstimateUsd:this.gasEstimateUsd,netProfitUsd:quoteGuard?null:Number(netProfitUsd.toFixed(2)),quoteGuard:quoteGuard?'REJECTED_SUSPICIOUS_SPREAD':null,maxSanitySpreadBps:this.maxSanitySpreadBps,buyDex,sellDex,scannedAt:new Date().toISOString()};
      this.onScan?.(scan);
      if(quoteGuard) return this.onStatus?.('QUOTE_GUARD');
      if(netProfitUsd < this.minNetProfitUsd) return this.onStatus?.('SCANNING_REAL');
      const confidence=clamp(.58+Math.min(.38,spreadBps/1000));
      const executionProbability=clamp(.55+Math.min(.38,spreadBps/1200));
      const riskScore=clamp(.52-Math.min(.28,spreadBps/1400));
      this.bus.emit('raw-opportunity',{strategyId:'arbitrage',strategy:'DEX Arbitrage Hunter',network:this.network,asset:`${this.tokenInSymbol}/${this.tokenOutSymbol}`,
        confidence,executionProbability,expectedProfitUsd:Number(netProfitUsd.toFixed(2)),capitalRequiredUsd:this.tradeSize,estimatedSlippageBps:Math.max(3,Math.round(spreadBps*.08)),riskScore,
        source:'DEX_ROUTER_REAL_QUOTES',synthetic:false,expiresAt:new Date(Date.now()+this.scanEveryMs).toISOString(),metadata:{routerA:this.routerA,routerB:this.routerB,routerAName:this.routerAName,routerBName:this.routerBName,
          quoteA:qa,quoteB:qb,spreadBps:Number(spreadBps.toFixed(2)),buyDex,sellDex,feeUsd:Number(feeUsd.toFixed(2)),gasEstimateUsd:this.gasEstimateUsd,model:'QUOTE_COMPARISON_ONLY_NO_EXECUTION'}});
      this.onStatus?.('SCANNING_REAL');
    }catch(error){ this.onScan?.({network:this.network,error:error?.shortMessage||error?.message||'ARB_SCAN_ERROR',scannedAt:new Date().toISOString()}); this.onStatus?.('SCAN_ERROR'); }
    finally{this.running=false;}
  }
  start(){ this.scanOnce(); this.interval=setInterval(()=>this.scanOnce(),this.scanEveryMs); return()=>clearInterval(this.interval); }
}
