function clamp(n,min=0,max=1){return Math.max(min,Math.min(max,n));}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
export class FundingScanner{
  constructor({marketData,bus,onStatus,onScan}){
    this.marketData=marketData;this.bus=bus;this.onStatus=onStatus;this.onScan=onScan;this.running=false;
    this.symbols=String(process.env.PERP_SYMBOLS||'BTCUSDT,ETHUSDT,SOLUSDT').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
    this.scanEveryMs=Math.max(8000,Number(process.env.PERP_SCAN_MS||20000));
    this.minAbsFundingBps=Math.max(.1,Number(process.env.PERP_MIN_ABS_FUNDING_BPS||1.5));
    this.minAbsBasisBps=Math.max(.5,Number(process.env.PERP_MIN_ABS_BASIS_BPS||8));
    this.paperNotionalUsd=Math.max(100,Number(process.env.PERP_PAPER_NOTIONAL_USD||2000));this.minOpenInterestContracts=Math.max(0,Number(process.env.PERP_MIN_OPEN_INTEREST_CONTRACTS||0));
  }
  config(){return {provider:'Binance USDⓈ-M Futures public market data',symbols:this.symbols,scanEveryMs:this.scanEveryMs,minAbsFundingBps:this.minAbsFundingBps,minAbsBasisBps:this.minAbsBasisBps,minOpenInterestContracts:this.minOpenInterestContracts,paperNotionalUsd:this.paperNotionalUsd,configured:this.symbols.length>0};}
  async analyze(symbol){
    const [p,oi,h]=await Promise.all([this.marketData.premiumIndex(symbol),this.marketData.openInterest(symbol),this.marketData.fundingHistory(symbol,8)]);
    const mark=Number(p.markPrice),index=Number(p.indexPrice),funding=Number(p.lastFundingRate||0),fundingBps=funding*10000,basisBps=index?((mark/index)-1)*10000:0;
    const hist=(Array.isArray(h)?h:[]).map(x=>Number(x.fundingRate||0)*10000);const avgFundingBps=avg(hist);
    const oiContracts=Number(oi.openInterest||0);const absFunding=Math.abs(fundingBps),absBasis=Math.abs(basisBps);const liquidityReady=oiContracts>=this.minOpenInterestContracts;const triggered=liquidityReady&&(absFunding>=this.minAbsFundingBps||absBasis>=this.minAbsBasisBps);
    const strength=clamp((Math.min(absFunding,8)/8)*.55+(Math.min(absBasis,40)/40)*.35+(Math.min(Math.abs(avgFundingBps),5)/5)*.1);
    const bias=fundingBps>0?'SHORT_PERP_LONG_SPOT':fundingBps<0?'LONG_PERP_SHORT_SPOT':basisBps>0?'SHORT_PERP':'LONG_PERP';
    return {symbol,markPrice:mark,indexPrice:index,fundingRate:funding,fundingBps:Number(fundingBps.toFixed(4)),avgFundingBps:Number(avgFundingBps.toFixed(4)),basisBps:Number(basisBps.toFixed(3)),openInterestContracts:oiContracts,liquidityReady,nextFundingTime:Number(p.nextFundingTime||0),bias,triggered,strength:Number(strength.toFixed(3)),scannedAt:new Date().toISOString()};
  }
  async scanOnce(){if(this.running)return;this.running=true;this.onStatus?.('SCANNING_REAL');try{for(const symbol of this.symbols){try{const scan=await this.analyze(symbol);this.onScan?.(scan);if(!scan.triggered)continue;const confidence=clamp(.64+scan.strength*.3),executionProbability=clamp(.62+scan.strength*.26),riskScore=clamp(.52-scan.strength*.22);const carryUsd=this.paperNotionalUsd*Math.abs(scan.fundingRate);const basisEdgeUsd=this.paperNotionalUsd*Math.min(.01,Math.abs(scan.basisBps)/10000)*.25;const expectedProfitUsd=Math.max(0,carryUsd+basisEdgeUsd);this.bus.emit('raw-opportunity',{strategyId:'perpetuals',strategy:'Perpetuals & Funding Hunter',network:'Binance USDⓈ-M Futures',asset:symbol,confidence,executionProbability,expectedProfitUsd:Number(expectedProfitUsd.toFixed(2)),capitalRequiredUsd:this.paperNotionalUsd,estimatedSlippageBps:10,riskScore,source:'BINANCE_FUTURES_PUBLIC_REAL',synthetic:false,expiresAt:new Date(Date.now()+this.scanEveryMs*1.5).toISOString(),metadata:{...scan,signalModel:'FUNDING_PLUS_MARK_INDEX_BASIS',executionModel:'PAPER_ONLY',note:'Expected profit is a paper estimate, not guaranteed.'}});}catch(error){this.onScan?.({symbol,error:error?.message||'PERP_SCAN_ERROR',scannedAt:new Date().toISOString()});}}this.onStatus?.('SCANNING_REAL');}catch{this.onStatus?.('SCAN_ERROR');}finally{this.running=false;}}
  start(){this.scanOnce();this.timer=setInterval(()=>this.scanOnce(),this.scanEveryMs);return()=>clearInterval(this.timer);}
}
