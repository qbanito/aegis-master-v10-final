import {getExecutionControl} from './executionControlService.js';
import {binanceTrading} from '../infrastructure/binance/binanceTrading.js';
import {solanaTrading} from '../infrastructure/solana/solanaTrading.js';
import {polygonPaperQuotes} from '../infrastructure/brokers/demoBrokers.js';

export class ExecutionAdapter {
  constructor(){
    this.liveEnabled=String(process.env.AEGIS_LIVE_EXECUTION_ENABLED||'false').toLowerCase()==='true';
    this.signerProvider=String(process.env.AEGIS_SIGNER_PROVIDER||'none').toLowerCase();
    this.allowedNetworks=String(process.env.AEGIS_EXECUTION_NETWORKS||'arbitrum,ethereum,polygon,base').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  }
  capabilities(){return {
    paper:true,
    live:this.liveEnabled,
    autonomous:false,
    signer:'ROUTE_SPECIFIC',
    metamask:'EVM_AND_SOLANA_BROWSER_MANUAL_APPROVAL',
    cex:'SERVER_ENV_WITH_EXPLICIT_ARMING',
    storesPrivateKeys:false,
    allowedNetworks:this.allowedNetworks,
    message:'PAPER es el valor inicial. DEX requiere aprobación visible en MetaMask; CEX requiere claves server-side, allowlist, límite y doble armado.'
  };}
  async execute(opportunity,state,{paperExecutor}){
    const service=getExecutionControl(),control=service.bot(opportunity.strategyId);
    if(!control||control.effectiveMode!=='REAL')return paperExecutor(opportunity,state);
    const createdAt=new Date().toISOString(),base={id:crypto.randomUUID(),opportunityId:opportunity.id,strategyId:opportunity.strategyId,asset:opportunity.asset,mode:'REAL',createdAt};
    if(control.route.executionKind==='INTELLIGENCE')return{...base,status:'REAL_DATA_ONLY',reason:'This bot observes real data but does not place orders.'};
    if(!control.readiness.ready)throw new Error(control.readiness.blockers.join('|')||'REAL_EXECUTION_NOT_READY');
    if(control.route.executionKind==='DEX'){
      const metadata=opportunity.metadata||{};let prepared=null;
      if(control.route.ecosystem==='SOLANA'&&metadata.inputMint&&metadata.outputMint&&control.wallet?.address){const inputDecimals=Math.max(0,Number(metadata.inputDecimals||6)),amount=String(Math.round(Number(opportunity.capitalRequiredUsd||metadata.paperPlan?.notionalUsd||0)*(10**inputDecimals)));const quoteResponse=await solanaTrading.quote({inputMint:metadata.inputMint,outputMint:metadata.outputMint,amount,slippageBps:Math.round(Number(opportunity.estimatedSlippageBps||metadata.slippageBps||100))});const swap=await solanaTrading.prepareSwap({quoteResponse,userPublicKey:control.wallet.address});prepared={kind:'SOLANA',transactionBase64:swap.swapTransaction,lastValidBlockHeight:swap.lastValidBlockHeight,quote:{inputMint:metadata.inputMint,outputMint:metadata.outputMint,amount,outAmount:quoteResponse.outAmount,priceImpactPct:quoteResponse.priceImpactPct}};}
      if(opportunity.strategyId==='polygon-meme-momentum'&&metadata.inputToken&&metadata.outputToken&&control.wallet?.address){const inputDecimals=Math.max(0,Number(metadata.inputDecimals||6)),amount=String(Math.round(Number(opportunity.capitalRequiredUsd||metadata.paperPlan?.notionalUsd||0)*(10**inputDecimals)));prepared={kind:'EVM',...await polygonPaperQuotes.prepareSwap({inputToken:metadata.inputToken,outputToken:metadata.outputToken,amount,taker:control.wallet.address,slippageBps:Math.round(Number(opportunity.estimatedSlippageBps||metadata.slippageBps||100))})};}
      const request=service.queueWalletSignature(opportunity,prepared);
      return{...base,status:'AWAITING_WALLET_SIGNATURE',signingRequestId:request.id,route:control.route,reason:'MetaMask must review and sign the prepared transaction in the browser.'};
    }
    if(control.route.executionKind==='CEX'){
      const order=opportunity.metadata?.cexOrder;
      if(!order)return{...base,status:'AWAITING_ORDER_PAYLOAD',route:control.route,reason:'Scanner must provide a normalized CEX order payload before submission.'};
      if(String(process.env.AEGIS_CEX_AUTO_EXECUTION_ENABLED||'false').toLowerCase()!=='true')return{...base,status:'READY_FOR_OPERATOR',route:control.route,orderPreview:{...order,credentials:'SERVER_ENV'},reason:'CEX auto execution is disabled; submit after operator review.'};
      const result=await binanceTrading.order({...order,notionalUsd:Number(order.notionalUsd||opportunity.capitalRequiredUsd||0)});
      return{...base,status:'SUBMITTED',route:control.route,provider:'Binance',orderId:result.orderId||result.clientOrderId||null,result};
    }
    throw new Error('REAL_BROKER_EXECUTION_NOT_AVAILABLE');
  }
}
export const executionAdapter=new ExecutionAdapter();
