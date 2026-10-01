'use strict';
// Server-to-server transport. No credentials or function access are sent to
// the browser. A direct Supabase secret remains supported when configured.
function createBackend({url,key,gatewayUrl,gatewayToken,fetchImpl=fetch}={}) {
  if(!gatewayUrl&&gatewayToken&&url)gatewayUrl=url+'/functions/v1/chs-server-gateway';
  const configured=!!key||!!(gatewayUrl&&gatewayToken);
  async function request(resource,{method='GET',body,prefer,timeout=10000}={}){
    if(!configured)throw new Error('Server backend is not configured');
    const headers={'Content-Type':'application/json'};
    if(key){
      headers.apikey=key;
      if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
      if(prefer)headers.Prefer=prefer;
      return fetchImpl(url+'/rest/v1/'+resource,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)});
    }
    headers['x-chs-backend-token']=gatewayToken;
    return fetchImpl(gatewayUrl,{method:'POST',headers,body:JSON.stringify({resource,method,body,prefer}),signal:AbortSignal.timeout(timeout)});
  }
  return {configured,request};
}
module.exports={createBackend};
