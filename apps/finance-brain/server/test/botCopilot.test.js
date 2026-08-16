import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BotCopilotService} from '../src/agent/botCopilotService.js';
import {StrategyConfigService} from '../src/core/strategyConfigService.js';

const response=overrides=>({reply:'La evidencia permite un ajuste conservador.',confidence:.82,dataFreshness:'FRESH',findings:[{severity:'info',title:'Muestra observada',evidence:'12 ejecuciones PAPER con cotización real.'}],recommendations:[{priority:'medium',title:'Elevar confianza mínima',rationale:'Reduce señales débiles.',expectedImpact:'Menor frecuencia y mejor selectividad.'}],proposals:[{kind:'CONFIG_PATCH',title:'Filtro conservador',rationale:'Subir calidad mínima sin elevar exposición.',confidence:.81,changes:{maxAllocationPct:15,minConfidence:.78,maxRiskScore:.55,minExpectedProfitUsd:8,maxSlippageBps:55,notes:'Copilot conservative preset'},preset:{name:'',description:'',parameters:{maxAllocationPct:null,minConfidence:null,maxRiskScore:null,minExpectedProfitUsd:null,maxSlippageBps:null,notes:null}},evidence:['12 cierres validados'],risks:['Menor frecuencia']}],...overrides});

test('bot copilot creates an approval-gated PAPER proposal and applies it only after confirmation',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aegis-copilot-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const strategyConfigService=new StrategyConfigService({storageFile:path.join(dir,'strategy.json')});
  const state={mode:'PAPER',bots:[{id:'solana-radar',name:'Solana Radar'}],infrastructure:{}};let persisted=0;
  const service=new BotCopilotService({state,persist:()=>persisted++,journal:{copilot(){},strategyProposal(){},strategyPreset(){}},strategyConfigService,contextBuilder:()=>({coverage:{connected:8,total:9},data:{mode:'PAPER',samples:12}}),complete:async()=>({text:JSON.stringify(response()),provider:'openai',model:'gpt-5.6-sol',fallbacks:[]})});
  const analysis=await service.chat('solana-radar','Propón un ajuste',[]);
  assert.equal(analysis.proposals.length,1);assert.equal(analysis.proposals[0].status,'PENDING');assert.notEqual(strategyConfigService.get()['solana-radar'].minConfidence,.78);
  assert.throws(()=>service.approve('solana-radar',analysis.proposals[0].id,{}),/PAPER_CONFIRMATION_REQUIRED/);
  const approved=service.approve('solana-radar',analysis.proposals[0].id,{confirmPaper:true});
  assert.equal(approved.applied,true);assert.equal(strategyConfigService.get()['solana-radar'].minConfidence,.78);assert.equal(approved.proposal.status,'APPROVED');assert.ok(persisted>=2);
});

test('strategy policy enforces copilot-adjustable confidence, risk, profit and slippage gates',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aegis-policy-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const service=new StrategyConfigService({storageFile:path.join(dir,'strategy.json')});
  service.patch('arbitrage',{minConfidence:.8,maxRiskScore:.4,minExpectedProfitUsd:10,maxSlippageBps:40});
  const blocked=service.evaluate('arbitrage',{confidence:.75,riskScore:.5,expectedProfitUsd:6,estimatedSlippageBps:60});
  assert.equal(blocked.approved,false);assert.deepEqual(blocked.reasons,['BELOW_STRATEGY_MIN_CONFIDENCE','ABOVE_STRATEGY_MAX_RISK_SCORE','BELOW_STRATEGY_MIN_EXPECTED_PROFIT','ABOVE_STRATEGY_MAX_SLIPPAGE']);
  assert.equal(service.evaluate('arbitrage',{confidence:.85,riskScore:.3,expectedProfitUsd:12,estimatedSlippageBps:30}).approved,true);
});
