'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
test('real HTTP admin lab rejects forged rights, isolates solo tests and never issues XP',async()=>{
  const nativeFetch=global.fetch,oldEnv={...process.env};
  const ids={owner:'11111111-1111-4111-8111-111111111111',user:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',mod:'44444444-4444-4444-8444-444444444444'};
  const roles={[ids.admin]:'admin',[ids.mod]:'moderator'};
  Object.assign(process.env,{SUPABASE_SECRET_KEY:'sb_secret_fixture',CHS_ADMIN_USER_IDS:ids.owner,CHS_OPERATOR_NAME:'QA',CHS_OPERATOR_ADDRESS:'QA address',CHS_OPERATOR_EMAIL:'qa@example.invalid',CHS_LEGAL_REVIEWED:'true'});
  global.fetch=async(url,options={})=>{
    const parsed=new URL(url),name=parsed.pathname.split('/').pop();let data=[];
    if(name==='user')data={id:ids[options.headers.Authorization.split(' ').at(-1)],user_metadata:{is_admin:true,role:'super_admin'}};
    if(name==='chs_legal_acceptances')data=[{accepted_at:new Date().toISOString()}];
    if(name==='chs_onboarding')data=[{version:'beta-2026-10-01'}];
    if(name==='chs_staff_roles'){const role=roles[parsed.searchParams.get('user_id')?.slice(3)];data=role?[{role}]:[];}
    return {ok:true,status:200,json:async()=>data};
  };
  const app=require('./server'),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  async function request(token,action,data={},method='POST'){
    const r=await nativeFetch('http://127.0.0.1:'+server.address().port+'/api/'+action+(method==='GET'?'?'+new URLSearchParams(data):''),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(data):undefined});return {status:r.status,body:await r.json()};
  }
  try{
    const created=await request('admin','create',{name:'Admin',vehicle:'QA',visibility:'PRIVATE'});assert.equal(created.status,200);
    const credentials={code:created.body.lobby.code,userId:created.body.userId};
    assert.equal((await request('user','admin-test',{...credentials,command:'start',is_admin:true})).status,403);
    assert.equal((await request('mod','admin-test',{...credentials,command:'start'})).status,403);
    assert.equal((await request('admin','admin-test',{...credentials,command:'start'},'GET')).status,405);
    assert.equal((await request('admin','admin-test',{...credentials,command:'start'})).status,409);
    await request('admin','location',{...credentials,lat:52,lng:13,accuracy:5,speed:0});
    assert.equal((await request('admin','admin-test',{...credentials,command:'start'})).status,200);
    assert.equal((await request('user','join',{code:credentials.code,name:'Normal',vehicle:'QA'})).status,403);
    let state=await request('admin','state',credentials,'GET');assert.equal(state.body.lobby.state,'COUNTDOWN');assert.equal(state.body.adminTestAvailable,true);assert.equal(state.body.reward,null);
    await request('admin','admin-test',{...credentials,command:'headstart'});state=await request('admin','state',credentials,'GET');assert.equal(state.body.lobby.state,'HEADSTART');
    await request('admin','admin-test',{...credentials,command:'active'});state=await request('admin','state',credentials,'GET');assert.equal(state.body.lobby.state,'ACTIVE');
    roles[ids.admin]='user';assert.equal((await request('admin','admin-test',{...credentials,command:'finish'})).status,403);roles[ids.admin]='admin';
    await request('admin','admin-test',{...credentials,command:'finish'});state=await request('admin','state',credentials,'GET');assert.equal(state.body.lobby.result.aborted,true);assert.equal(state.body.reward,null);assert.equal(app.roundHistory.size,0);
    const normal=await request('user','create',{name:'User',vehicle:'QA',testMode:true});const session={code:normal.body.lobby.code,userId:normal.body.userId};
    state=await request('user','state',session,'GET');assert.equal(state.body.adminTestAvailable,false);assert.equal(state.body.lobby.testMode,false);assert.equal((await request('user','start',session)).status,409);
    const settings={...session,revision:0,lobbyName:'Normal',visibility:'PRIVATE',radius:500,duration:900,headstart:120,escape:15,maxPlayers:2};assert.equal((await request('user','settings',settings)).status,200);
    assert.equal((await request('mod','join',{code:session.code,name:'Mod',vehicle:'QA'})).status,200);assert.equal((await request('owner','join',{code:session.code,name:'Owner',vehicle:'QA'})).status,409);
    for(const file of ['admin-lab.js','scripts/reference-ui-qa.mjs'])assert.equal((await nativeFetch('http://127.0.0.1:'+server.address().port+'/'+file)).status,404);
  }finally{await new Promise(r=>server.close(r));global.fetch=nativeFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);app.lobbies.clear();app.roundHistory.clear();}
});
