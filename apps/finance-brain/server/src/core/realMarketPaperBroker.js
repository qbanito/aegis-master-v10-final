import {binanceMarketData} from '../infrastructure/marketData/binanceMarketData.js';
import {binanceFuturesMarketData} from '../infrastructure/marketData/binanceFuturesMarketData.js';
import {alpacaPaper} from '../infrastructure/brokers/demoBrokers.js';

const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const now=()=>new Date().toISOString();
const envNum=(key,fallback,min=0)=>Math.max(min,Number(process.env[key]||fallback));

function symbolFrom(asset){
  const raw=String(asset||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(raw.startsWith('POLY'))return null;
  if(raw.endsWith('USDT'))return raw;
  if(raw.endsWith('USD'))return `${raw.slice(0,-3)}USDT`;
  if(raw.endsWith('USDC'))return `${raw.slice(0,-4)}USDT`;
  return null;
}

function directionOf(opportunity){
  const value=String(opportunity.direction||opportunity.metadata?.direction||'').toUpperCase();
  if(['LONG','UP','BUY','LONG_YES'].includes(value))return 'LONG';
  if(['SHORT','DOWN','SELL'].includes(value))return 'SHORT';
  return null;
}

function vwap(levels,notional){
  let remaining=notional,spent=0,quantity=0;
  for(const [rawPrice,rawQty] of levels||[]){
    const price=num(rawPrice),qty=num(rawQty); if(price<=0||qty<=0)continue;
    const take=Math.min(qty,remaining/price); spent+=take*price; quantity+=take; remaining-=take*price;
    if(remaining<=.000001)break;
  }
  return {price:quantity?spent/quantity:0,quantity,filledNotional:spent,remainingNotional:Math.max(0,remaining)};
}

export class RealMarketPaperBroker{
  constructor({state,persist,onClose}={}){
    this.state=state;this.persist=persist;this.onClose=onClose;this.timers=new Map();this.contexts=new Map();
    this.feeBps=envNum('PAPER_FEE_BPS',10);
    this.maxSpreadBps=envNum('PAPER_MAX_SPREAD_BPS',75);
    this.maxOpenPositions=Math.max(1,Math.floor(envNum('PAPER_MAX_OPEN_POSITIONS',8,1)));
    this.holdMs=envNum('PAPER_HOLD_MS',30000,5000);
    this.markIntervalMs=envNum('PAPER_MARK_INTERVAL_MS',5000,1000);
    this.modelFallback=String(process.env.PAPER_MODEL_FALLBACK||'true').toLowerCase()!=='false';
    this.modelMaxTradesPerHour=Math.max(1,Math.floor(envNum('PAPER_MODEL_MAX_TRADES_PER_HOUR',25,1)));
  }
  status(){return {mode:'REAL_MARKET_PAPER',modelFallback:this.modelFallback,modelMaxTradesPerHour:this.modelMaxTradesPerHour,live:false,feeBps:this.feeBps,maxSpreadBps:this.maxSpreadBps,maxOpenPositions:this.maxOpenPositions,holdMs:this.holdMs,markIntervalMs:this.markIntervalMs,openPositions:this.state.paperLedger?.openPositions?.length||0};}
  async quote(opportunity){
    const network=String(opportunity.network||'').toLowerCase();
    const symbol=symbolFrom(opportunity.asset);
    if(network.includes('binance spot')&&symbol){
      const [ticker,depth]=await Promise.all([binanceMarketData.bookTicker(symbol),binanceMarketData.depth(symbol,20)]);
      return {...ticker,...depth,provider:'Binance Spot'};
    }
    if(network.includes('binance futures')&&symbol){
      const [ticker,depth]=await Promise.all([binanceFuturesMarketData.bookTicker(symbol),binanceFuturesMarketData.depth(symbol,20)]);
      return {...ticker,...depth,provider:ticker.provider||'Binance Futures'};
    }
    if(network.includes('polygon')&&String(opportunity.asset||'').startsWith('POLY:')){
      const bid=num(opportunity.metadata?.bid),ask=num(opportunity.metadata?.ask);
      if(bid>0&&ask>=bid)return {provider:'Polymarket CLOB snapshot',symbol:opportunity.asset,bid,ask,bids:[[bid,1e9]],asks:[[ask,1e9]],observedAt:now()};
    }
    if(network.includes('alpaca')||network.includes('nyse')||network.includes('energy')||network.includes('options')){
      const raw=String(opportunity.asset||'').split(':').pop().toUpperCase().replace(/[^A-Z0-9.]/g,'');
      if(raw)return alpacaPaper.latestQuote(raw);
    }
    return null;
  }
  blocked(opportunity,reason,extra={}){
    const execution={id:crypto.randomUUID(),opportunityId:opportunity.id,strategyId:opportunity.strategyId,mode:'PAPER',status:'BLOCKED',expectedProfitUsd:opportunity.expectedProfitUsd,simulatedNetProfitUsd:0,realizedProfitUsd:0,reason,createdAt:now(),paperQuality:'REAL_MARKET_REQUIRED',...extra};
    this.state.paperLedger.blockedTrades=(this.state.paperLedger.blockedTrades||0)+1;
    return execution;
  }
  modelTradesLastHour(){const cutoff=Date.now()-3600000;return (this.state.executions||[]).filter(item=>item.paperQuality==='MODEL_SIMULATED'&&Date.parse(item.createdAt||0)>=cutoff).length;}
  modelOpen(opportunity,simulation,reason='MODEL_FALLBACK'){
    if(opportunity.synthetic!==false)return this.blocked(opportunity,'SYNTHETIC_OPPORTUNITY_BLOCKED');
    if(!simulation?.passed)return this.blocked(opportunity,'SIMULATION_REJECTED');
    if(this.modelTradesLastHour()>=this.modelMaxTradesPerHour)return this.blocked(opportunity,'MODEL_PAPER_RATE_LIMIT');
    const ledger=this.state.paperLedger;
    const requested=Math.max(10,num(opportunity.capitalRequiredUsd));
    const available=Math.max(0,num(ledger.cashUsd)-num(ledger.reserveFloorUsd||0));
    const notional=Math.min(requested,available);
    if(notional<10)return this.blocked(opportunity,'INSUFFICIENT_PAPER_CASH',{availableUsd:available});
    const fee=notional*this.feeBps/10000;
    const expected= Math.max(0,num(simulation.estimatedNetProfitUsd||opportunity.expectedProfitUsd));
    const grossModeledProfit=expected*num(simulation.successProbability||opportunity.executionProbability||.75);
    const modeledProfit=Number(Math.max(0,grossModeledProfit-fee).toFixed(2));
    ledger.cashUsd=Number((num(ledger.cashUsd)+modeledProfit).toFixed(8));
    ledger.realizedPnlUsd=Number((num(ledger.realizedPnlUsd)+modeledProfit).toFixed(8));
    ledger.feesUsd=Number((num(ledger.feesUsd)+fee).toFixed(8));
    ledger.equityUsd=Number(num(ledger.cashUsd).toFixed(8));
    ledger.closedTrades=(ledger.closedTrades||0)+1;
    ledger.lastMarkAt=now();
    const execution={id:crypto.randomUUID(),opportunityId:opportunity.id,strategyId:opportunity.strategyId,mode:'PAPER',status:'CLOSED',expectedProfitUsd:opportunity.expectedProfitUsd,simulatedNetProfitUsd:expected,realizedProfitUsd:modeledProfit,modeledProfitUsd:modeledProfit,createdAt:now(),closedAt:now(),closeReason:'MODEL_PAPER_OUTCOME',paperQuality:'MODEL_SIMULATED',modelFallbackReason:reason,actualMarketFill:false,notionalUsd:notional,feeUsd:Number(fee.toFixed(4)),successProbability:simulation.successProbability};
    this.state.executions.unshift(execution);this.state.executions=this.state.executions.slice(0,250);
    const bot=this.state.bots.find(item=>item.id===opportunity.strategyId);if(bot)bot.pnl24h=Number((num(bot.pnl24h)+modeledProfit).toFixed(2));
    this.state.treasury.paperBalanceUsd=Number(ledger.equityUsd.toFixed(2));this.state.treasury.reservedUsd=Number(ledger.reservedUsd.toFixed(2));
    this.persist?.();
    return execution;
  }
  async open(opportunity,simulation){
    if(opportunity.synthetic!==false)return this.blocked(opportunity,'SYNTHETIC_OPPORTUNITY_BLOCKED');
    const direction=directionOf(opportunity);
    const modelAllocation=opportunity.strategyId==='yield'&&this.modelFallback;
    if(!direction&&!modelAllocation)return this.blocked(opportunity,'DIRECTION_REQUIRED');
    const ledger=this.state.paperLedger;
    if((ledger.openPositions||[]).length>=this.maxOpenPositions)return this.blocked(opportunity,'MAX_OPEN_POSITIONS');
    const quote=await this.quote(opportunity); if(!quote)return this.modelFallback?this.modelOpen(opportunity,simulation,modelAllocation?'YIELD_ALLOCATION_NO_REAL_MARKET_QUOTE':'NO_REAL_MARKET_QUOTE'):this.blocked(opportunity,'NO_REAL_MARKET_QUOTE');
    if(!direction)return this.blocked(opportunity,'DIRECTION_REQUIRED');
    const mid=(num(quote.bid)+num(quote.ask))/2,spreadBps=mid?((num(quote.ask)-num(quote.bid))/mid)*10000:Infinity;
    if(!(quote.bid>0&&quote.ask>=quote.bid))return this.blocked(opportunity,'INVALID_MARKET_QUOTE',{quote});
    if(spreadBps>this.maxSpreadBps)return this.blocked(opportunity,'SPREAD_LIMIT',{quote,spreadBps:Number(spreadBps.toFixed(2))});
    const requested=Math.max(10,num(opportunity.capitalRequiredUsd));
    const available=Math.max(0,num(ledger.cashUsd)-num(ledger.reserveFloorUsd||0));
    const notional=Math.min(requested,available);
    if(notional<10)return this.blocked(opportunity,'INSUFFICIENT_PAPER_CASH',{availableUsd:available});
    const levels=direction==='LONG'?quote.asks:quote.bids;
    const fill=vwap(levels,notional);
    const fillRatio=fill.filledNotional/notional;
    if(fill.quantity<=0||fillRatio<.95)return this.blocked(opportunity,'INSUFFICIENT_BOOK_LIQUIDITY',{quote,requestedNotionalUsd:notional,fillRatio:Number(fillRatio.toFixed(4))});
    const fee=fill.filledNotional*this.feeBps/10000;
    const slippage=Math.abs(fill.price-mid)*fill.quantity;
    const maxLossUsd=Math.max(.01,num(opportunity.metadata?.maxLossUsd||this.state.risk?.maxLossPerTradeUsd||50));
    const position={id:crypto.randomUUID(),opportunityId:opportunity.id,strategyId:opportunity.strategyId,asset:opportunity.asset,network:opportunity.network,direction,provider:quote.provider,quantity:fill.quantity,entryPrice:fill.price,entryNotional:fill.filledNotional,entryFeeUsd:fee,entrySlippageUsd:slippage,maxLossUsd,openedAt:now(),holdUntil:Date.now()+this.holdMs,markPrice:fill.price,unrealizedPnlUsd:0};
    ledger.cashUsd=Number((num(ledger.cashUsd)-fill.filledNotional-fee).toFixed(8));ledger.reservedUsd=Number((num(ledger.reservedUsd)+fill.filledNotional+fee).toFixed(8));ledger.openPositions=[...(ledger.openPositions||[]),position];
    const execution={id:crypto.randomUUID(),opportunityId:opportunity.id,strategyId:opportunity.strategyId,mode:'PAPER',status:'OPEN',expectedProfitUsd:opportunity.expectedProfitUsd,simulatedNetProfitUsd:simulation?.estimatedNetProfitUsd||0,realizedProfitUsd:0,createdAt:now(),paperQuality:'REAL_MARKET_QUOTE',positionId:position.id,maxLossUsd,quote:{provider:quote.provider,bid:quote.bid,ask:quote.ask,mid,spreadBps:Number(spreadBps.toFixed(2)),observedAt:quote.observedAt},entry:{price:fill.price,quantity:fill.quantity,notionalUsd:fill.filledNotional,feeUsd:fee,slippageUsd:slippage}};
    this.state.executions.unshift(execution);this.state.executions=this.state.executions.slice(0,250);this.contexts.set(position.id,{opportunity,simulation,executionId:execution.id});this.persist?.();
    const timer=setTimeout(()=>this.close(position.id,'TIME_HORIZON'),this.holdMs);this.timers.set(position.id,timer);
    return execution;
  }
  async close(positionId,reason='MANUAL'){const ledger=this.state.paperLedger;const position=(ledger.openPositions||[]).find(item=>item.id===positionId);if(!position)return null;
    const context=this.contexts.get(positionId)||{};const quote=await this.quote({network:position.network,asset:position.asset,metadata:context.opportunity?.metadata||{},direction:position.direction,synthetic:false});
    if(!quote){const retry=setTimeout(()=>this.close(positionId,'RETRY_NO_QUOTE'),Math.min(15000,this.markIntervalMs*2));this.timers.set(positionId,retry);return null;}
    const exitPrice=position.direction==='LONG'?num(quote.bid):num(quote.ask);if(exitPrice<=0)return null;
    const exitNotional=position.quantity*exitPrice,exitFee=exitNotional*this.feeBps/10000;
    const gross=position.direction==='LONG'?(exitPrice-position.entryPrice)*position.quantity:(position.entryPrice-exitPrice)*position.quantity;
    const realized=gross-position.entryFeeUsd-exitFee;
    ledger.cashUsd=Number((num(ledger.cashUsd)+position.entryNotional+gross-exitFee).toFixed(8));
    ledger.reservedUsd=Number(Math.max(num(ledger.reserveFloorUsd||0),num(ledger.reservedUsd)-position.entryNotional-position.entryFeeUsd).toFixed(8));ledger.realizedPnlUsd=Number((num(ledger.realizedPnlUsd)+realized).toFixed(8));ledger.feesUsd=Number((num(ledger.feesUsd)+position.entryFeeUsd+exitFee).toFixed(8));ledger.slippageUsd=Number((num(ledger.slippageUsd)+position.entrySlippageUsd+Math.abs(exitPrice-((quote.bid+quote.ask)/2))*position.quantity).toFixed(8));ledger.closedTrades=(ledger.closedTrades||0)+1;ledger.openPositions=ledger.openPositions.filter(item=>item.id!==positionId);ledger.equityUsd=Number(num(ledger.cashUsd).toFixed(8));
    const execution=this.state.executions.find(item=>item.id===context.executionId);if(execution){execution.status='CLOSED';execution.realizedProfitUsd=Number(realized.toFixed(2));execution.closedAt=now();execution.closeReason=reason;execution.exit={price:exitPrice,notionalUsd:exitNotional,feeUsd:exitFee,quote:{provider:quote.provider,bid:quote.bid,ask:quote.ask,observedAt:quote.observedAt}};}
    const bot=this.state.bots.find(item=>item.id===position.strategyId);if(bot)bot.pnl24h=Number((num(bot.pnl24h)+realized).toFixed(2));this.contexts.delete(positionId);const timer=this.timers.get(positionId);if(timer)clearTimeout(timer);this.timers.delete(positionId);this.persist?.();const result={...execution};this.onClose?.({execution:result,opportunity:context.opportunity,simulation:context.simulation});return result;
  }
  async markToMarket(){const ledger=this.state.paperLedger;let unrealized=0,positionValue=0,stopIds=[];await Promise.all((ledger.openPositions||[]).map(async position=>{const quote=await this.quote({network:position.network,asset:position.asset,metadata:this.contexts.get(position.id)?.opportunity?.metadata||{},direction:position.direction,synthetic:false});if(!quote)return;const mark=position.direction==='LONG'?quote.bid:quote.ask;position.markPrice=mark;position.unrealizedPnlUsd=Number(((position.direction==='LONG'?(mark-position.entryPrice):(position.entryPrice-mark))*position.quantity-position.entryFeeUsd).toFixed(8));if(position.unrealizedPnlUsd<=-num(position.maxLossUsd||this.state.risk?.maxLossPerTradeUsd||50)&&!position.exitPending){position.exitPending=true;stopIds.push(position.id);}unrealized+=position.unrealizedPnlUsd;positionValue+=position.direction==='LONG'?position.quantity*mark:position.entryNotional+position.unrealizedPnlUsd;}));ledger.unrealizedPnlUsd=Number(unrealized.toFixed(8));ledger.equityUsd=Number((num(ledger.cashUsd)+positionValue).toFixed(8));ledger.lastMarkAt=now();this.state.treasury.paperBalanceUsd=Number(ledger.equityUsd.toFixed(2));this.state.treasury.reservedUsd=Number(ledger.reservedUsd.toFixed(2));this.persist?.();for(const id of stopIds)this.close(id,'MAX_LOSS_STOP').catch(()=>{});}
  start(){this.markToMarket();this.interval=setInterval(()=>this.markToMarket().catch(()=>{}),this.markIntervalMs);return()=>clearInterval(this.interval);}
}
