import {kronosForecast} from '../../infrastructure/models/kronosForecast.js';

function clamp(n,min=0,max=1){return Math.max(min,Math.min(max,n));}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function stdev(a){if(a.length<2)return 0; const m=mean(a); return Math.sqrt(mean(a.map(x=>(x-m)**2)));}

export class VolatilityScanner{
  constructor({marketData,bus,onStatus,onScan}){
    this.marketData=marketData;this.bus=bus;this.onStatus=onStatus;this.onScan=onScan;this.running=false;
    this.symbols=String(process.env.VOL_SYMBOLS||'BTCUSDT,ETHUSDT,SOLUSDT').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
    this.interval=process.env.VOL_INTERVAL||'1m'; this.lookback=Math.max(30,Number(process.env.VOL_LOOKBACK||120));
    this.scanEveryMs=Math.max(5000,Number(process.env.VOL_SCAN_MS||15000));
    this.zThreshold=Math.max(.5,Number(process.env.VOL_ZSCORE_THRESHOLD||2.0));
    this.volumeMultiplier=Math.max(1,Number(process.env.VOL_VOLUME_MULTIPLIER||1.8));
    this.minMovePct=Math.max(.05,Number(process.env.VOL_MIN_MOVE_PCT||.35));
  }
  config(){return {provider:'Binance Spot public market data',symbols:this.symbols,interval:this.interval,lookback:this.lookback,scanEveryMs:this.scanEveryMs,zThreshold:this.zThreshold,volumeMultiplier:this.volumeMultiplier,minMovePct:this.minMovePct,configured:this.symbols.length>0};}
  analyze(symbol,k){
    const closed=k.slice(0,-1); if(closed.length<20)throw new Error('NOT_ENOUGH_KLINES');
    const returns=[]; for(let i=1;i<closed.length;i++)returns.push((closed[i].close/closed[i-1].close)-1);
    const recent=returns.at(-1)||0, sigma=stdev(returns.slice(-60)); const z=sigma?recent/sigma:0;
    const vols=closed.map(x=>x.quoteVolume||x.volume); const baseline=mean(vols.slice(-31,-1)); const latestVol=vols.at(-1)||0; const volRatio=baseline?latestVol/baseline:0;
    const last=closed.at(-1), prev=closed.at(-2); const movePct=((last.close/prev.close)-1)*100;
    const atrLike=mean(closed.slice(-20).map(x=>((x.high-x.low)/x.close)*100));
    const direction=movePct>=0?'UP':'DOWN';
    const triggered=Math.abs(z)>=this.zThreshold && volRatio>=this.volumeMultiplier && Math.abs(movePct)>=this.minMovePct;
    const strength=clamp((Math.abs(z)/4)*.5+(Math.min(volRatio,4)/4)*.3+(Math.min(Math.abs(movePct),2)/2)*.2);
    return {symbol,price:last.close,movePct:Number(movePct.toFixed(4)),zScore:Number(z.toFixed(3)),volumeRatio:Number(volRatio.toFixed(2)),atrLikePct:Number(atrLike.toFixed(3)),direction,triggered,strength:Number(strength.toFixed(3)),scannedAt:new Date().toISOString()};
  }
  async scanOnce(){
    if(this.running)return; this.running=true; this.onStatus?.('SCANNING_REAL');
    try{
      for(const symbol of this.symbols){
        try{
          const k=await this.marketData.klines(symbol,this.interval,this.lookback); const baseScan=this.analyze(symbol,k); const kronos=await kronosForecast({symbol,interval:this.interval,candles:k,predLen:Math.min(12,Math.max(4,Math.floor(this.lookback/10)))}); const scan={...baseScan,kronos:kronos?.available?{summary:kronos.summary,model:kronos.model,generatedAt:kronos.generatedAt}:null}; this.onScan?.(scan);
          if(!scan.triggered)continue;
          const confidence=clamp(.62+scan.strength*.34); const executionProbability=clamp(.58+scan.strength*.3); const riskScore=clamp(.58-scan.strength*.28);
          const notional=Math.max(100,Number(process.env.VOL_PAPER_NOTIONAL_USD||1000));
          const expectedProfitUsd=notional*Math.min(.02,Math.abs(scan.movePct)/100)*(.35+.35*scan.strength);
          const kronosAgreement=!kronos?.available||kronos.summary?.direction==='LONG'&&scan.direction==='UP'||kronos.summary?.direction==='SHORT'&&scan.direction==='DOWN'; this.bus.emit('raw-opportunity',{strategyId:'volatility',strategy:'Volatility Hunter',network:'Binance Spot',asset:symbol,confidence:clamp(confidence+(kronos?.available?(kronosAgreement ? .03 : -.04):0)),executionProbability,expectedProfitUsd:Number(expectedProfitUsd.toFixed(2)),capitalRequiredUsd:notional,estimatedSlippageBps:Math.max(4,Math.round(8+scan.atrLikePct*7)),riskScore:clamp(riskScore+(kronos?.available && !kronosAgreement ? .06 : 0)),source:'BINANCE_SPOT_KLINES_REAL',synthetic:false,expiresAt:new Date(Date.now()+this.scanEveryMs*1.5).toISOString(),metadata:{...scan,kronosAgreement:kronos?.available?kronosAgreement:null,signalModel:'RETURN_ZSCORE_PLUS_VOLUME_PLUS_KRONOS',executionModel:'PAPER_ONLY'}});
        }catch(error){this.onScan?.({symbol,error:error?.message||'VOL_SCAN_ERROR',scannedAt:new Date().toISOString()});}
      }
      this.onStatus?.('SCANNING_REAL');
    }catch{this.onStatus?.('SCAN_ERROR');}
    finally{this.running=false;}
  }
  start(){this.scanOnce();this.timer=setInterval(()=>this.scanOnce(),this.scanEveryMs);return()=>clearInterval(this.timer);}
}
