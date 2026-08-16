import test from 'node:test';
import assert from 'node:assert/strict';
import {RealMarketPaperBroker} from '../src/core/realMarketPaperBroker.js';

function testState(){return {mode:'PAPER',paperLedger:{version:2,mode:'REAL_MARKET_PAPER',startingEquityUsd:10000,reserveFloorUsd:1000,cashUsd:10000,reservedUsd:1000,equityUsd:10000,realizedPnlUsd:0,unrealizedPnlUsd:0,feesUsd:0,slippageUsd:0,openPositions:[],closedTrades:0,blockedTrades:0,lastMarkAt:null},treasury:{paperBalanceUsd:10000,reservedUsd:1000},bots:[{id:'momentum',pnl24h:0}] ,executions:[]};}

test('real-market paper blocks synthetic opportunities',async()=>{
  const state=testState();const broker=new RealMarketPaperBroker({state});
  const result=await broker.open({id:'synthetic-1',strategyId:'momentum',asset:'BTCUSDT',network:'Binance Spot',direction:'LONG',synthetic:true,capitalRequiredUsd:100,expectedProfitUsd:10});
  assert.equal(result.status,'BLOCKED');assert.equal(result.reason,'SYNTHETIC_OPPORTUNITY_BLOCKED');assert.equal(state.paperLedger.realizedPnlUsd,0);
});

test('paper model fallback records yield allocations and modeled pnl',async()=>{
  const state=testState();state.bots.push({id:'yield',pnl24h:0});const broker=new RealMarketPaperBroker({state});broker.quote=async()=>null;
  const result=await broker.open({id:'yield-1',strategyId:'yield',asset:'USDC-AERO',network:'Base',synthetic:false,capitalRequiredUsd:1000,expectedProfitUsd:20},{passed:true,estimatedNetProfitUsd:20,successProbability:.75});
  assert.equal(result.status,'CLOSED');assert.equal(result.paperQuality,'MODEL_SIMULATED');assert.equal(result.actualMarketFill,false);assert.equal(state.paperLedger.closedTrades,1);assert.equal(state.paperLedger.realizedPnlUsd,14);assert.equal(state.paperLedger.cashUsd,10014);assert.equal(state.paperLedger.feesUsd,1);assert.equal(state.executions.length,1);
});

test('real-market paper uses bid ask depth and closes with mark price',async()=>{
  const state=testState();let closeResult=null;const broker=new RealMarketPaperBroker({state,onClose:({execution})=>{closeResult=execution;}});
  let phase='open';broker.quote=async()=>phase==='open'?{provider:'TEST_REAL_QUOTE',bid:99.9,ask:100.1,bids:[[99.9,20]],asks:[[100.1,20]],observedAt:new Date().toISOString()}:{provider:'TEST_REAL_QUOTE',bid:110,ask:110.1,bids:[[110,20]],asks:[[110.1,20]],observedAt:new Date().toISOString()};
  const opened=await broker.open({id:'real-1',strategyId:'momentum',asset:'BTCUSDT',network:'Binance Spot',direction:'LONG',synthetic:false,capitalRequiredUsd:1000,expectedProfitUsd:20,simulation:{estimatedNetProfitUsd:15}});
  assert.equal(opened.status,'OPEN');assert.equal(state.paperLedger.openPositions.length,1);assert.equal(state.paperLedger.equityUsd,10000);
  phase='close';await broker.close(state.paperLedger.openPositions[0].id,'TEST');
  assert.equal(closeResult.status,'CLOSED');assert.ok(closeResult.realizedProfitUsd>0);assert.equal(state.paperLedger.openPositions.length,0);assert.ok(state.paperLedger.equityUsd>10000);
});

test('solana paper uses a Jupiter quote and never falls back to invented PNL',async()=>{
  const state=testState();let received=null;const broker=new RealMarketPaperBroker({state,solanaTrading:{quote:async input=>{received=input;return {outAmount:'1000000000',routePlan:[{swapInfo:{label:'TEST'}}]};}}});
  const quote=await broker.quote({asset:'TEST',network:'Solana',capitalRequiredUsd:100,metadata:{inputMint:'USDC',outputMint:'MINT',inputDecimals:6,tokenDecimals:6,notionalUsd:100,slippageBps:50}});
  assert.equal(received.inputMint,'USDC');assert.equal(received.outputMint,'MINT');assert.equal(received.amount,100000000);assert.equal(quote.provider,'Jupiter quote');assert.ok(quote.bid>0&&quote.ask>quote.bid);
});

test('solana paper converts Jupiter output into token depth and can open a real-market paper fill',async()=>{
  const state=testState();const broker=new RealMarketPaperBroker({state,solanaTrading:{quote:async input=>({outAmount:input.inputMint==='USDC'?'1000000000':'100000000',routePlan:[]})}});
  const opened=await broker.open({id:'solana-fill-1',strategyId:'solana-radar',asset:'TEST',network:'Solana',direction:'LONG',synthetic:false,capitalRequiredUsd:100,expectedProfitUsd:10,metadata:{inputMint:'USDC',outputMint:'MINT',inputDecimals:6,tokenDecimals:6,notionalUsd:100,slippageBps:50,maxLossUsd:8,paperPlan:{stopLossPct:8,takeProfitPct:18}}},{passed:true,estimatedNetProfitUsd:5});
  assert.equal(opened.status,'OPEN');assert.equal(state.paperLedger.openPositions.length,1);assert.ok(state.paperLedger.openPositions[0].quantity>0);await broker.close(state.paperLedger.openPositions[0].id,'TEST_FILL');assert.equal(state.paperLedger.closedTrades,1);
});

test('solana paper never invents PNL when Jupiter has no quote',async()=>{
  const state=testState();const broker=new RealMarketPaperBroker({state,solanaTrading:{quote:async()=>null}});
  const result=await broker.open({id:'solana-no-quote',strategyId:'solana-radar',asset:'TEST',network:'Solana',direction:'LONG',synthetic:false,capitalRequiredUsd:100,expectedProfitUsd:10},{passed:true,estimatedNetProfitUsd:5,successProbability:.8});
  assert.equal(result.status,'BLOCKED');assert.equal(result.reason,'NO_REAL_MARKET_QUOTE');assert.equal(state.paperLedger.realizedPnlUsd,0);
});

test('polygon paper uses a 0x quote and never falls back to invented PNL',async()=>{
  const state=testState();let received=null;const broker=new RealMarketPaperBroker({state,polygonTrading:{quote:async input=>{received=input;return {buyAmount:input.outputToken==='TOKEN'?'100000000000000000000':'100000000',observedAt:new Date().toISOString()};}}});
  const quote=await broker.quote({asset:'MOMO:0xToken',network:'Polygon',capitalRequiredUsd:100,metadata:{inputToken:'USDC',outputToken:'TOKEN',inputDecimals:6,tokenDecimals:18,notionalUsd:100,slippageBps:50}});
  assert.equal(received.inputToken,'USDC');assert.equal(received.outputToken,'TOKEN');assert.equal(received.amount,'100000000');assert.equal(quote.provider,'0x Polygon quote');assert.ok(quote.bid>0&&quote.ask>quote.bid);
});

test('polygon paper blocks without a real quote',async()=>{
  const state=testState();const broker=new RealMarketPaperBroker({state,polygonTrading:{quote:async()=>null}});const result=await broker.open({id:'polygon-no-quote',strategyId:'polygon-meme-momentum',asset:'MOMO:0xToken',network:'Polygon',direction:'LONG',synthetic:false,capitalRequiredUsd:100,expectedProfitUsd:10,metadata:{inputToken:'USDC',outputToken:'TOKEN',inputDecimals:6,tokenDecimals:18,notionalUsd:100}},{passed:true,estimatedNetProfitUsd:5,successProbability:.8});
  assert.equal(result.status,'BLOCKED');assert.equal(result.reason,'NO_REAL_MARKET_QUOTE');assert.equal(state.paperLedger.realizedPnlUsd,0);
});
