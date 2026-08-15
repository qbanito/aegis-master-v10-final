import {formatEther, isAddress} from 'ethers';
import {rpcManager} from './rpcManager.js';

const NETWORKS={
  ethereum:{chainId:1,nativeSymbol:'ETH'},
  arbitrum:{chainId:42161,nativeSymbol:'ETH'},
  polygon:{chainId:137,nativeSymbol:'POL'},
  base:{chainId:8453,nativeSymbol:'ETH'}
};

export class EvmNetworkRegistry {
  list(){
    return Object.entries(NETWORKS).map(([network,cfg])=>({
      network,...cfg,configured:Boolean(rpcManager.provider(network)),rpcOnline:rpcManager.health?.[network]?.online===true
    }));
  }

  async walletStatus(address){
    if(!isAddress(String(address||'')))throw new Error('INVALID_EVM_ADDRESS');
    const rows=[];
    for(const [network,cfg] of Object.entries(NETWORKS)){
      const provider=rpcManager.provider(network);
      if(!provider){rows.push({network,...cfg,configured:false,online:false,balanceWei:null,balanceNative:null,error:'RPC_NOT_CONFIGURED'});continue;}
      try{
        const balance=await provider.getBalance(address);
        rows.push({network,...cfg,configured:true,online:true,balanceWei:balance.toString(),balanceNative:formatEther(balance),error:null});
      }catch(error){rows.push({network,...cfg,configured:true,online:false,balanceWei:null,balanceNative:null,error:error?.shortMessage||error?.message||'BALANCE_READ_ERROR'});}
    }
    return {address,networks:rows,checkedAt:new Date().toISOString()};
  }
}

export const evmNetworkRegistry=new EvmNetworkRegistry();
