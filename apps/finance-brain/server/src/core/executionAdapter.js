export class ExecutionAdapter {
  constructor(){
    this.liveEnabled=String(process.env.AEGIS_LIVE_EXECUTION_ENABLED||'false').toLowerCase()==='true';
    this.signerProvider=String(process.env.AEGIS_SIGNER_PROVIDER||'none').toLowerCase();
    this.allowedNetworks=String(process.env.AEGIS_EXECUTION_NETWORKS||'arbitrum,ethereum,polygon,base').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  }
  capabilities(){return {
    paper:true,
    live:this.liveEnabled&&this.signerProvider!=='none',
    autonomous:false,
    signer:this.signerProvider==='none'?'NONE':this.signerProvider.toUpperCase(),
    metamask:'BROWSER_MANUAL_APPROVAL',
    storesPrivateKeys:false,
    allowedNetworks:this.allowedNetworks,
    message:this.signerProvider==='none'
      ?'PAPER activo. MetaMask solo puede aprobar transacciones desde el navegador; no firma procesos 24/7.'
      :'Firmante externo declarado; requiere adaptador específico, límites y pruebas antes de habilitar LIVE.'
  };}
  async execute(opportunity,state,{paperExecutor}){
    if(state.mode!=='LIVE')return paperExecutor(opportunity,state);
    if(!this.liveEnabled)throw new Error('LIVE_EXECUTION_LOCKED');
    if(this.signerProvider==='none')throw new Error('LIVE_SIGNER_NOT_CONFIGURED');
    if(!this.allowedNetworks.includes(String(opportunity.network||'').toLowerCase()))throw new Error('NETWORK_NOT_ALLOWED');
    throw new Error('LIVE_EXECUTOR_NOT_IMPLEMENTED_FOR_STRATEGY');
  }
}
export const executionAdapter=new ExecutionAdapter();
