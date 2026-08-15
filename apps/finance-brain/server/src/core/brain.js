function clamp(n,min=0,max=1){ return Math.max(min, Math.min(max,n)); }

export function normalizeOpportunity(raw){
  return {
    id: raw.id ?? crypto.randomUUID(),
    strategyId: raw.strategyId,
    strategy: raw.strategy,
    network: raw.network ?? 'unknown',
    asset: raw.asset ?? 'N/A',
    confidence: clamp(Number(raw.confidence ?? 0)),
    expectedProfitUsd: Number(raw.expectedProfitUsd ?? 0),
    capitalRequiredUsd: Math.max(0, Number(raw.capitalRequiredUsd ?? 0)),
    estimatedSlippageBps: Math.max(0, Number(raw.estimatedSlippageBps ?? 0)),
    executionProbability: clamp(Number(raw.executionProbability ?? raw.confidence ?? 0)),
    direction: raw.direction ?? null,
    riskScore: clamp(Number(raw.riskScore ?? .5)),
    source: raw.source ?? 'unknown',
    synthetic: raw.synthetic !== false,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    expiresAt: raw.expiresAt ?? new Date(Date.now()+30000).toISOString(),
    metadata: raw.metadata ?? {}
  };
}

export function scoreOpportunity(o){
  const profitFactor = Math.min(1, Math.log10(Math.max(1,o.expectedProfitUsd)+1)/3);
  const capitalPenalty = o.capitalRequiredUsd > 0 ? Math.min(.25, o.capitalRequiredUsd/100000) : 0;
  const slippagePenalty = Math.min(.25, o.estimatedSlippageBps/1000);
  const quality = (.35*o.confidence)+(.25*o.executionProbability)+(.25*profitFactor)+(.15*(1-o.riskScore));
  return Math.round(clamp(quality-capitalPenalty-slippagePenalty)*1000)/10;
}

export function brainDecision(o){
  const score = scoreOpportunity(o);
  const decision = score >= 72 ? 'CANDIDATE' : score >= 55 ? 'WATCH' : 'REJECT';
  return { score, decision, decidedAt:new Date().toISOString() };
}
