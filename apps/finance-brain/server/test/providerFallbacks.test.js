import test from 'node:test';
import assert from 'node:assert/strict';
import {BinanceMarketData} from '../src/infrastructure/marketData/binanceMarketData.js';
import {SolanaRpc} from '../src/infrastructure/solana/solanaRpc.js';

test('Binance spot routes every market-data method to fallback provider',async()=>{
  const fallback={ping:async()=>({provider:'OKX Spot fallback',online:true}),klines:async()=>[{provider:'OKX Spot fallback',close:100}],bookTicker:async symbol=>({provider:'OKX Spot fallback',symbol,bid:99,ask:101}),depth:async symbol=>({provider:'OKX Spot fallback',symbol,bids:[[99,1]],asks:[[101,1]]})};
  const market=new BinanceMarketData({request:async()=>{throw new Error('BINANCE_451');},fallbacks:[fallback]});
  assert.equal((await market.ping()).provider,'OKX Spot fallback');
  assert.equal((await market.klines('BTCUSDT'))[0].close,100);
  assert.equal((await market.bookTicker('BTCUSDT')).bid,99);
  assert.equal((await market.depth('BTCUSDT')).asks[0][0],101);
  assert.equal(market.lastProvider,'OKX Spot fallback');
});

test('Solana RPC cools down a throttled endpoint and rotates to a healthy one',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push(url);
    if(url==='https://rpc-one.invalid')return {ok:false,status:429,json:async()=>({})};
    const method=JSON.parse(options.body).method;
    return {ok:true,status:200,json:async()=>({result:method==='getLatestBlockhash'?{context:{slot:12345},value:{blockhash:'hash'}}:null})};
  };
  const rpc=new SolanaRpc({urls:['https://rpc-one.invalid','https://rpc-two.invalid'],timeoutMs:100,fetchImpl});
  const ping=await rpc.ping();
  assert.equal(ping.online,true);
  assert.equal(ping.endpoint,'rpc-two.invalid');
  assert.equal(ping.slot,12345);
  assert.equal(ping.blockhashAvailable,true);
  assert.ok(rpc.health.get('https://rpc-one.invalid').cooldownUntil>Date.now());
  assert.equal(calls.filter(url=>url==='https://rpc-one.invalid').length,1);
});
