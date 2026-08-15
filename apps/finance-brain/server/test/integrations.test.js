import test from 'node:test';
import assert from 'node:assert/strict';
import {BinanceTradingConnector} from '../src/infrastructure/binance/binanceTrading.js';
import {SolanaTradingConnector} from '../src/infrastructure/solana/solanaTrading.js';
import {PolymarketTradingConnector} from '../src/infrastructure/polymarket/polymarketTrading.js';

test('Binance connector blocks live orders until explicitly armed',async()=>{
  const connector=new BinanceTradingConnector();
  connector.enabled=false;
  await assert.rejects(()=>connector.order({symbol:'BTCUSDT',side:'BUY',type:'MARKET',quoteOrderQty:5}),/BINANCE_LIVE_TRADING_LOCKED/);
});

test('Solana connector blocks broadcast until explicitly armed',async()=>{
  const connector=new SolanaTradingConnector();
  connector.enabled=false;
  await assert.rejects(()=>connector.submitSignedTransaction('signed-tx'),/SOLANA_LIVE_TRADING_LOCKED/);
});

test('Polymarket connector keeps MetaMask bridge disabled by default',async()=>{
  const connector=new PolymarketTradingConnector({data:null});
  connector.enabled=false;
  await assert.rejects(()=>connector.connect('0x0000000000000000000000000000000000000001'),/POLYMARKET_LIVE_TRADING_LOCKED/);
});
