import test from 'node:test';
import assert from 'node:assert/strict';
import {SignalFusionEngine} from '../src/core/signalFusion.js';
test('fuses independent signals for same root asset',()=>{const f=new SignalFusionEngine({windowMs:60000,minSources:2});const base={createdAt:new Date().toISOString(),brain:{decision:'CANDIDATE',score:80},confidence:.8,metadata:{direction:'LONG'}};assert.equal(f.ingest({...base,strategyId:'volatility',asset:'BTCUSDT'}),null);const out=f.ingest({...base,strategyId:'momentum',asset:'BTCUSDT'});assert.equal(out.assetRoot,'BTC');assert.equal(out.sourceCount,2);assert.ok(out.fusionScore>80);});
