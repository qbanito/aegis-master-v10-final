const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function fetchJson(url,{timeoutMs=8000,retries=2,headers={},errorPrefix='HTTP',method='GET',body}={}){
  let lastError=null;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{method,headers,body,signal:controller.signal});
      if(response.ok)return await response.json();
      const retryable=[408,425,429,500,502,503,504].includes(response.status);
      const error=new Error(`${errorPrefix}_${response.status}`);lastError=error;
      if(!retryable||attempt>=retries)throw error;
      const retryAfter=Number(response.headers.get('retry-after')||0)*1000;
      await sleep(Math.max(retryAfter,Math.min(2500,250*(2**attempt))));
    }catch(error){
      lastError=error;
      if(attempt>=retries)throw error;
      await sleep(Math.min(2500,250*(2**attempt)));
    }finally{clearTimeout(timer);}
  }
  throw lastError||new Error(`${errorPrefix}_UNAVAILABLE`);
}
