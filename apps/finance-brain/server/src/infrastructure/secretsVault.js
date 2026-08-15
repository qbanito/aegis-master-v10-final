export class SecretsVaultInterface{
  status(){
    const configured=Boolean(process.env.AEGIS_VAULT_PROVIDER);
    return {configured,provider:configured?process.env.AEGIS_VAULT_PROVIDER:'NONE',mode:'REFERENCE_ONLY',storesSecretsInApp:false,message:configured?'External vault interface declared.':'No vault configured. Private keys are never stored by AEGIS.'};
  }
}
export const secretsVault=new SecretsVaultInterface();
