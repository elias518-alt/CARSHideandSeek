'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createStore}=require('./state-store'),{createAccountService}=require('./account-service');
const token='1'.repeat(64),hash=crypto.createHash('sha256').update(token).digest('hex');
const owner='11111111-1111-4111-8111-111111111111',player='22222222-2222-4222-8222-222222222222';
async function fixture(){
  const {createGateway}=await import('./supabase/functions/chs-server-gateway/gateway.mjs');
  const calls=[];let snapshot=null,offline=false;
  const gateway=createGateway({url:'https://project.supabase.co',serviceKey:'sb_secret_internal',fetchImpl:async(url,options)=>{
    calls.push({url,options});if(offline)return new Response('',{status:503});
    if(url.includes('chs_backend_credentials'))return Response.json([{token_hash:hash}]);
    if(url.includes('chs_server_state')){
      if(options.method==='POST'){snapshot=JSON.parse(options.body);return new Response(null,{status:204});}
      return Response.json(snapshot?[snapshot]:[]);
    }
    return Response.json([]);
  }});
  const invoke=(data,credential=token,extra={})=>gateway(new Request('https://project.supabase.co/functions/v1/chs-server-gateway',{method:'POST',headers:{'Content-Type':'application/json','x-chs-backend-token':credential,...extra},body:JSON.stringify(data)}));
  return {gateway,invoke,calls,setOffline:value=>offline=value};
}
test('the gateway rejects missing credentials, invalid credentials and browser-origin requests',async()=>{
  const f=await fixture();assert.equal((await f.invoke({resource:'health'},'')).status,401);assert.equal(f.calls.length,0);
  assert.equal((await f.invoke({resource:'health'},'2'.repeat(64))).status,401);
  assert.equal((await f.invoke({resource:'health'},token,{Origin:'https://example.com'})).status,403);
  assert.equal((await f.invoke({resource:'health'})).status,200);
});
test('the gateway allows only required tables, columns, methods and retention deletes',async()=>{
  const f=await fixture();
  for(const resource of ['auth/users','rpc/chs_update_my_profile','../profiles','profiles?select=email','profiles?select=*','chs_backend_credentials?select=token_hash'])assert.equal((await f.invoke({resource})).status,403,resource);
  assert.equal((await f.invoke({resource:'profiles?select=id',method:'DELETE'})).status,403);
  assert.equal((await f.invoke({resource:'chs_admin_audit',method:'DELETE'})).status,403);
  assert.equal((await f.invoke({resource:'chs_admin_audit?created_at=lt.2099-01-01T00:00:00Z',method:'DELETE'})).status,403);
  assert.equal((await f.invoke({resource:'profiles?select=id,username'})).status,200);
  assert.equal(f.calls.at(-1).options.headers.apikey,'sb_secret_internal');assert.equal(f.calls.at(-1).options.headers.Authorization,undefined);
});
test('persistent state works through the gateway and failed writes are never acknowledged',async()=>{
  const f=await fixture(),fetchImpl=(url,options)=>f.gateway(new Request(url,options));
  const store=createStore({url:'https://project.supabase.co',gatewayToken:token,fetchImpl});
  assert.equal(store.durable,true);assert.equal(await store.load(),null);
  await store.save({version:1,value:9});assert.deepEqual(await store.load(),{version:1,value:9});
  f.setOffline(true);await assert.rejects(store.save({version:1,value:10}),/503/);
});
test('developer preview is restricted to configured admins, preserves bans and never forges legal acceptance',async()=>{
  const bans=new Map(),fetchImpl=async url=>({ok:true,status:200,json:async()=>url.includes('chs_account_bans')?[bans.get(url.split('user_id=eq.')[1]?.split('&')[0])].filter(Boolean):[]});
  const env={CHS_ADMIN_USER_IDS:owner,CHS_DEVELOPER_PREVIEW:'true'};
  const service=createAccountService({url:'https://project.supabase.co',key:'sb_secret_test',fetchImpl,env});
  const account=await service.requireAccess(owner);assert.equal(account.developerPreview,true);assert.equal(account.accepted,false);assert.equal(account.legal.ready,false);
  await assert.rejects(service.requireAccess(player),{status:428});await assert.rejects(service.accept(owner,{}),{status:503});
  bans.set(owner,{reason:'Test active ban',until_at:null,revoked_at:null});await assert.rejects(service.requireAccess(owner),{status:403});bans.clear();
  const released=createAccountService({url:'https://project.supabase.co',key:'sb_secret_test',fetchImpl,env:{...env,CHS_OPERATOR_NAME:'Test',CHS_OPERATOR_ADDRESS:'Testanschrift',CHS_OPERATOR_EMAIL:'test@example.com',CHS_LEGAL_REVIEWED:'true'}});
  await assert.rejects(released.requireAccess(owner),{status:428});
});
