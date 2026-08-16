import { Contract, Interface, formatUnits, isAddress } from 'ethers';

const POOL_ABI=[
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase,uint256 totalDebtBase,uint256 availableBorrowsBase,uint256 currentLiquidationThreshold,uint256 ltv,uint256 healthFactor)',
  'event Borrow(address indexed reserve,address user,address indexed onBehalfOf,uint256 amount,uint8 interestRateMode,uint256 borrowRate,uint16 indexed referralCode)'
];
const poolInterface=new Interface(POOL_ABI);

function addressesFromEnv(){ return String(process.env.AAVE_WATCHLIST||'').split(',').map(v=>v.trim()).filter(isAddress); }
function num(value, decimals){ return Number(formatUnits(value,decimals)); }
function clamp(n,min=0,max=1){ return Math.max(min,Math.min(max,n)); }

export class AaveV3LiquidationScanner {
  constructor({rpcManager,bus,onStatus,onScan,onDiscovery}){
    this.rpcManager=rpcManager; this.bus=bus; this.onStatus=onStatus; this.onScan=onScan; this.onDiscovery=onDiscovery;
    this.interval=null; this.running=false;
    this.poolAddress=process.env.AAVE_V3_POOL_ADDRESS||'';
    this.baseDecimals=Number(process.env.AAVE_BASE_DECIMALS||8);
    this.scanEveryMs=Math.max(3000,Number(process.env.LIQUIDATION_SCAN_MS||12000));
    this.watchlist=addressesFromEnv(); this.discovered=new Set(this.watchlist);
    this.discoveryEnabled=String(process.env.AAVE_DISCOVERY_ENABLED||'true').toLowerCase()!=='false';
    this.discoveryLookbackBlocks=Math.max(50,Number(process.env.AAVE_DISCOVERY_LOOKBACK_BLOCKS||3000));
    this.discoveryMaxBorrowers=Math.max(10,Number(process.env.AAVE_DISCOVERY_MAX_BORROWERS||250));
    this.discoveryEveryMs=Math.max(30000,Number(process.env.AAVE_DISCOVERY_MS||120000));
    this.lastDiscoveryAt=0;
    this.bonusBps=Math.max(0,Number(process.env.LIQUIDATION_BONUS_ESTIMATE_BPS||500));this.gasEstimateUsd=Math.max(0,Number(process.env.LIQUIDATION_GAS_ESTIMATE_USD||3));this.minNetProfitUsd=Math.max(0,Number(process.env.LIQUIDATION_MIN_NET_PROFIT_USD||5));
  }
  targets(){ return [...this.discovered].slice(-this.discoveryMaxBorrowers); }
  config(){
    return {network:'arbitrum',poolAddress:this.poolAddress||null,watchlistCount:this.watchlist.length,discoveredBorrowers:this.discovered.size,discoveryEnabled:this.discoveryEnabled,
      discoveryLookbackBlocks:this.discoveryLookbackBlocks,scanEveryMs:this.scanEveryMs,baseDecimals:this.baseDecimals,bonusBps:this.bonusBps,gasEstimateUsd:this.gasEstimateUsd,minNetProfitUsd:this.minNetProfitUsd,configured:Boolean(this.poolAddress&&(this.watchlist.length||this.discoveryEnabled))};
  }
  async discoverBorrowers(){
    if(!this.discoveryEnabled || !isAddress(this.poolAddress)) return;
    const provider=this.rpcManager.provider('arbitrum'); if(!provider) return;
    const latest=await provider.getBlockNumber(); const fromBlock=Math.max(0,latest-this.discoveryLookbackBlocks);
    const event=poolInterface.getEvent('Borrow');
    const logs=await provider.getLogs({address:this.poolAddress,topics:[event.topicHash],fromBlock,toBlock:latest});
    let added=0;
    for(const log of logs){
      try{const parsed=poolInterface.parseLog(log); const borrower=String(parsed.args.onBehalfOf); if(isAddress(borrower)&&!this.discovered.has(borrower)){this.discovered.add(borrower);added++;}}
      catch{}
    }
    while(this.discovered.size>this.discoveryMaxBorrowers){const first=this.discovered.values().next().value; if(this.watchlist.includes(first)) break; this.discovered.delete(first);}
    this.lastDiscoveryAt=Date.now(); this.onDiscovery?.({fromBlock,toBlock:latest,logs:logs.length,added,total:this.discovered.size,discoveredAt:new Date().toISOString()});
  }
  async scanOnce(){
    const provider=this.rpcManager.provider('arbitrum'); if(!provider) return this.onStatus?.('WAITING_RPC');
    if(!isAddress(this.poolAddress)) return this.onStatus?.('WAITING_POOL_ADDRESS');
    if(this.running) return; this.running=true; this.onStatus?.('SCANNING_REAL');
    try{
      if(this.discoveryEnabled && (Date.now()-this.lastDiscoveryAt>this.discoveryEveryMs)){
        try{await this.discoverBorrowers();}catch(error){this.onDiscovery?.({error:error?.shortMessage||error?.message||'DISCOVERY_ERROR',discoveredAt:new Date().toISOString()});}
      }
      const targets=this.targets(); if(!targets.length){this.onStatus?.('WAITING_BORROWERS');return;}
      const contract=new Contract(this.poolAddress,POOL_ABI,provider);
      for(const address of targets){
        try{
          const data=await contract.getUserAccountData(address);
          const healthFactor=Number(formatUnits(data.healthFactor,18)); const totalDebtUsd=num(data.totalDebtBase,this.baseDecimals); const totalCollateralUsd=num(data.totalCollateralBase,this.baseDecimals);
          const scan={address,healthFactor,totalDebtUsd,totalCollateralUsd,liquidationThresholdBps:Number(data.currentLiquidationThreshold),source:this.watchlist.includes(address)?'MANUAL_WATCHLIST':'BORROW_EVENT_DISCOVERY',scannedAt:new Date().toISOString()};
          this.onScan?.(scan); if(totalDebtUsd<=0 || healthFactor>=1.08) continue;
          const proximity=clamp((1.08-healthFactor)/0.08); const executionProbability=healthFactor<1?.96:.55+proximity*.35; const confidence=.68+proximity*.30;
          const estimatedGrossBonus=totalDebtUsd*(this.bonusBps/10000)*Math.min(.5,healthFactor<1?.5:.15); const netBeforeProbability=estimatedGrossBonus-this.gasEstimateUsd; const expectedProfitUsd=Math.max(0,netBeforeProbability*.55);
          if(expectedProfitUsd<this.minNetProfitUsd)continue;
          this.bus.emit('raw-opportunity',{strategyId:'liquidation',strategy:'Liquidation Hunter',network:'Arbitrum',asset:'AAVE-V3 POSITION',confidence,executionProbability,
            expectedProfitUsd:Number(expectedProfitUsd.toFixed(2)),capitalRequiredUsd:0,estimatedSlippageBps:20,riskScore:clamp(.42-(proximity*.22)),source:'AAVE_V3_BORROWER_DISCOVERY',synthetic:false,
            expiresAt:new Date(Date.now()+this.scanEveryMs*1.5).toISOString(),metadata:{borrower:address,healthFactor,totalDebtUsd,totalCollateralUsd,poolAddress:this.poolAddress,discoverySource:scan.source,estimatedGrossBonus:Number(estimatedGrossBonus.toFixed(2)),gasEstimateUsd:this.gasEstimateUsd,netBeforeProbability:Number(netBeforeProbability.toFixed(2)),profitModel:'ESTIMATE_AFTER_GAS_PAPER'}});
        }catch(error){this.onScan?.({address,error:error?.shortMessage||error?.message||'AAVE_READ_ERROR',scannedAt:new Date().toISOString()});}
      }
      this.onStatus?.('SCANNING_REAL');
    }catch(error){
      this.onScan?.({network:'arbitrum',error:error?.shortMessage||error?.message||'LIQUIDATION_SCAN_ERROR',scannedAt:new Date().toISOString()});
      this.onStatus?.('SCAN_ERROR');
    }finally{this.running=false;}
  }
  start(){this.scanOnce().catch(()=>this.onStatus?.('SCAN_ERROR'));this.interval=setInterval(()=>this.scanOnce().catch(()=>this.onStatus?.('SCAN_ERROR')),this.scanEveryMs);return()=>clearInterval(this.interval);}
}
