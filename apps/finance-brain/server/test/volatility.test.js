import test from 'node:test';
import assert from 'node:assert/strict';
import {VolatilityScanner} from '../src/bots/volatility/volatilityScanner.js';

test('volatility scanner recognizes expansion',()=>{
  const scanner=new VolatilityScanner({marketData:null,bus:null});
  scanner.zThreshold=1; scanner.volumeMultiplier=1.2; scanner.minMovePct=.2;
  const k=[]; let p=100;
  for(let i=0;i<50;i++){const close=p*(1+(i===49?.01:.0001));k.push({open:p,high:close*1.001,low:p*.999,close,volume:100,quoteVolume:i===49?300:100});p=close;}
  k.push({...k.at(-1),openTime:Date.now()}); // current unfinished candle ignored
  const r=scanner.analyze('TEST',k);
  assert.equal(r.triggered,true);
  assert.equal(r.direction,'UP');
});
