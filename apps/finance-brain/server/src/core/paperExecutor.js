let broker=null;
export function configurePaperBroker(value){broker=value;}
export async function executePaper(opportunity,state){
  if(!broker)throw new Error('REAL_MARKET_PAPER_BROKER_NOT_CONFIGURED');
  return broker.open(opportunity,opportunity.simulation);
}
