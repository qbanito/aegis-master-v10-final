import test from 'node:test';
import assert from 'node:assert/strict';
import {computeAllocations} from '../src/core/capitalAllocator.js';

test('allocator preserves reserve and max exposure',()=>{
  const bots=['a','b','c','d','e','f','g','h','i','allocator'].map(id=>({id}));
  const state={bots,risk:{maxStrategyExposurePct:20},allocator:{reservePct:10},executions:[],opportunities:[],treasury:{paperBalanceUsd:10000}};
  const r=computeAllocations(state);
  const sum=r.strategies.reduce((a,x)=>a+x.allocationPct,0);
  assert.ok(sum<=90.1 && sum>=89.8);
  assert.ok(r.strategies.every(x=>x.allocationPct<=20));
  assert.equal(r.reservePct,10);
});
