import test from 'node:test';
import assert from 'node:assert/strict';
import {EXECUTION_BOT_IDS,presetsForBot,routeForBot} from '../src/core/strategyPresetCatalog.js';
import {ExecutionControlService} from '../src/core/executionControlService.js';

const state=()=>({mode:'PAPER',risk:{globalKillSwitch:false},bots:EXECUTION_BOT_IDS.map(id=>({id,wallet:`wallet-${id}`})),infrastructure:{executionControl:{bots:{},pendingWalletSignatures:[]}}});

test('all sixteen bots have a route and three strategy presets',()=>{
  assert.equal(EXECUTION_BOT_IDS.length,16);
  for(const id of EXECUTION_BOT_IDS){assert.ok(routeForBot(id));assert.equal(presetsForBot(id,'LOW').length,3);assert.equal(presetsForBot(id,'MEDIUM').length,3);assert.equal(presetsForBot(id,'HIGH').length,3);}
});

test('global REAL requires confirmation and PAPER remains the default',()=>{
  const current=state(),service=new ExecutionControlService({state:current});
  assert.equal(service.snapshot().globalMode,'PAPER');
  assert.throws(()=>service.setGlobal('REAL'),/REAL_MODE_CONFIRMATION_REQUIRED/);
  const real=service.setGlobal('REAL',{confirmReal:true});assert.equal(real.globalMode,'REAL');assert.equal(current.mode,'REAL');
  const paper=service.setGlobal('PAPER');assert.equal(paper.globalMode,'PAPER');assert.equal(current.mode,'PAPER');
});

test('DEX controls retain only public wallet routing data',()=>{
  const current=state(),service=new ExecutionControlService({state:current});
  const control=service.setBot('polygon-meme-momentum',{mode:'REAL',confirmReal:true,wallet:{address:'0x1234',scope:'eip155:137',ecosystem:'EVM',privateKey:'must-not-persist'}});
  assert.deepEqual(control.wallet,{address:'0x1234',scope:'eip155:137',ecosystem:'EVM'});
  assert.equal(JSON.stringify(service.snapshot()).includes('must-not-persist'),false);
  assert.equal(service.snapshot().credentials.secretsExposed,false);
});

test('prepared wallet calldata is redacted from public snapshots',()=>{
  const current=state(),service=new ExecutionControlService({state:current});
  service.setBot('solana-radar',{mode:'REAL',confirmReal:true,wallet:{address:'SolanaPublicAddress',scope:'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',ecosystem:'SOLANA'}});
  const row=service.queueWalletSignature({id:'op-1',strategyId:'solana-radar',asset:'TEST',direction:'LONG',capitalRequiredUsd:5},{kind:'SOLANA',transactionBase64:'private-calldata-until-authenticated'});
  assert.equal(service.snapshot().pendingWalletSignatures[0].prepared,undefined);
  assert.equal(service.snapshot({includePrepared:true}).pendingWalletSignatures[0].prepared.transactionBase64,'private-calldata-until-authenticated');
  assert.equal(service.walletSignature(row.id).prepared.kind,'SOLANA');
});
