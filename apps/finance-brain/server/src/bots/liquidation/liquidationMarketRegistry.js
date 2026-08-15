import {isAddress} from 'ethers';

export function loadAaveMarkets(){
  let parsed=[];
  try{parsed=JSON.parse(process.env.AAVE_MARKETS_JSON||'[]');}catch{}
  const out=Array.isArray(parsed)?parsed.filter(x=>x&&x.network&&isAddress(x.poolAddress||'')):[];
  if(!out.length && isAddress(process.env.AAVE_V3_POOL_ADDRESS||'')) out.push({network:'arbitrum',poolAddress:process.env.AAVE_V3_POOL_ADDRESS,baseDecimals:Number(process.env.AAVE_BASE_DECIMALS||8),label:'Aave V3 Arbitrum'});
  return out.map(x=>({network:String(x.network).toLowerCase(),poolAddress:x.poolAddress,baseDecimals:Number(x.baseDecimals||8),label:x.label||`Aave V3 ${x.network}`}));
}
