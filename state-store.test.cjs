'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('./state-store');
test('atomic restart recovery preserves roles, an already spent escape and server deadlines',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chs-state-'));
  try{
    const file=path.join(dir,'state.json');const store=createStore({file});
    const saved={version:1,lobbies:[{code:'ABC12',state:'ACTIVE',endsAt:123456,players:[{id:'p1',role:'HIDER',stats:{escapes:1},location:{lat:52,lng:13},meetupRoute:{pending:Promise.resolve()}}]}]};
    const write=store.save(saved);saved.lobbies[0].players[0].stats.escapes=0;await write;
    const restored=await createStore({file}).load();assert.equal(restored.lobbies[0].players[0].stats.escapes,1);assert.equal(restored.lobbies[0].endsAt,123456);
    assert.equal(restored.lobbies[0].players[0].meetupRoute,undefined);
    await Promise.all([store.save({version:1,value:1}),store.save({version:1,value:2})]);assert.equal((await store.load()).value,2);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Supabase backend keeps modern secrets out of JWT Authorization and rejects failed writes',async()=>{
  const calls=[];let fail=false;
  const store=createStore({url:'https://example.supabase.co',key:'sb_secret_test_only',fetchImpl:async(url,options)=>{
    calls.push({url,options});return {ok:!fail,status:fail?503:200,json:async()=>[{snapshot:{version:1},expires_at:new Date(Date.now()+60000).toISOString()}]};
  }});
  assert.deepEqual(await store.load(),{version:1});await store.save({version:1,value:3});
  assert.equal(calls[0].options.headers.apikey,'sb_secret_test_only');assert.equal(calls[0].options.headers.Authorization,undefined);
  assert.equal(calls[1].options.headers.Prefer,'resolution=merge-duplicates,return=minimal');
  fail=true;await assert.rejects(store.save({version:1,value:4}),/503/);
  fail=false;await store.save({version:1,value:5});assert.equal(JSON.parse(calls.at(-1).options.body).snapshot.value,5);
});
test('expired remote state is not restored',async()=>{
  const store=createStore({url:'https://example.supabase.co',key:'legacy-test-key',fetchImpl:async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer legacy-test-key');return {ok:true,json:async()=>[{snapshot:{version:1},expires_at:'2020-01-01T00:00:00Z'}]};
  }});
  assert.equal(await store.load(),null);
});

test('concurrent state writes coalesce to a bounded queue and the latest complete state',async()=>{
  let release;const calls=[];
  const store=createStore({url:'https://example.supabase.co',key:'sb_secret_test_only',fetchImpl:async(url,options)=>{
    calls.push(JSON.parse(options.body).snapshot);
    if(calls.length===1)await new Promise(resolve=>release=resolve);
    return {ok:true};
  }});
  const writes=Array.from({length:20},(_,i)=>store.save({version:1,value:i}));release();await Promise.all(writes);
  assert.equal(calls.length,2);assert.equal(calls.at(-1).value,19);
});
test('the real server restoration preserves escape usage and advances an interrupted start to its original active deadline',async()=>{
  const server=require('./server');const now=Date.now();server.lobbies.clear();
  const player=(id,role)=>({id,authId:id,name:id,vehicle:'Auto',mode:'PASSENGER',role,location:{lat:52,lng:13,accuracy:1,speed:0,at:now},lastSeen:now,joinedAt:now-130000,lastActivityAt:now,stats:{finds:0,escapes:role==='HIDER'?1:0,failedFinds:0,outsideMs:0}});
  const lobby={code:'REST1',hostId:'seeker',name:'Recovery',state:'COUNTDOWN',createdAt:now-130000,roundStartedAt:now-130000,countdownEndsAt:now-125000,headstart:120,duration:300,radius:500,escape:10,origin:{lat:52,lng:13},players:[player('seeker','SEEKER'),player('hider','HIDER')],messages:[]};
  try{
    await server.restore({load:async()=>({version:1,lobbies:[lobby]}),save:async()=>{}});
    const state=await server.route('state',{code:lobby.code,userId:'hider'},'hider');
    assert.equal(state.lobby.state,'ACTIVE');assert.equal(state.lobby.endsAt,now+295000);assert.equal(state.escapesUsed,1);
  }finally{server.lobbies.clear();await server.restore(createStore());}
});
