'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const server=require('./server');
const {createAccountService}=require('./account-service');
test('GPS and polling use bounded checkpoints while the latest fix remains recoverable',async()=>{
  const writes=[];const now=Date.now();
  await server.restore({load:async()=>null,save:async value=>writes.push(structuredClone(value))});
  const created=await server.route('create',{name:'Host',vehicle:'Auto'},'checkpoint-owner');
  const lobby=server.lobbies.get(created.lobby.code);
  try{
    await server.checkpoint(now);
    for(let i=0;i<20;i++){
      await server.route('location',{code:lobby.code,userId:created.userId,lat:52,lng:13,accuracy:i+1},'checkpoint-owner');
      await server.route('state',{code:lobby.code,userId:created.userId},'checkpoint-owner');
      await server.checkpoint(now+1000);
    }
    assert.equal(writes.length,1);
    await server.checkpoint(now+2000);assert.equal(writes.length,2);
    assert.equal(writes.at(-1).lobbies.find(l=>l.code===lobby.code).players[0].location.accuracy,20);
  }finally{server.lobbies.delete(lobby.code);await server.restore({load:async()=>null,save:async()=>{}});}
});
test('500m default and custom radii survive peer joins, rejoin, host migration and recovery',async()=>{
  for(const radius of [undefined,50,100,200,500,1000,150,350,650,750,1250,10000]){
    const owner='owner-'+radius,peer='peer-'+radius;
    const created=await server.route('create',{name:'Host',vehicle:'Auto',...(radius===undefined?{}:{radius})},owner);
    const lobby=server.lobbies.get(created.lobby.code),expected=radius??500;
    try{
      assert.equal(lobby.radius,expected);
      const joined=await server.route('join',{code:lobby.code,name:'Gast',vehicle:'Auto'},peer);
      assert.equal(joined.lobby.settings.radius,expected);
      assert.equal((await server.route('join',{code:lobby.code,name:'Gast',vehicle:'Auto'},peer)).lobby.settings.radius,expected);
      lobby.players[0].lastSeen=Date.now()-46000;
      const state=await server.route('state',{code:lobby.code,userId:joined.userId},peer);
      assert.equal(state.lobby.hostId,joined.userId);assert.equal(state.map.radius,expected);
      const saved=structuredClone(lobby);server.lobbies.delete(lobby.code);
      await server.restore({load:async()=>({version:1,lobbies:[saved]}),save:async()=>{}});
      assert.equal(server.lobbies.get(lobby.code).radius,expected);
    }finally{server.lobbies.delete(lobby.code);await server.restore({load:async()=>null,save:async()=>{}});}
  }
});
test('radius rejects invalid numbers and types without creating a lobby',async()=>{
  for(const radius of [null,'500','abc',-1,0,49,10001,1e9,NaN,Infinity,50.5]){
    const size=server.lobbies.size;
    await assert.rejects(server.route('create',{name:'Host',vehicle:'Auto',radius},'invalid-'+String(radius)),{status:400});
    assert.equal(server.lobbies.size,size);
  }
});
test('creation spam is bounded per authenticated account',async()=>{
  const codes=[];try{
    for(let i=0;i<5;i++)codes.push((await server.route('create',{name:'Host',vehicle:'Auto'},'spam-owner')).lobby.code);
    await assert.rejects(server.route('create',{name:'Host',vehicle:'Auto'},'spam-owner'),{status:429});
    const other=await server.route('create',{name:'Host',vehicle:'Auto'},'other-owner');codes.push(other.lobby.code);
  }finally{codes.forEach(code=>server.lobbies.delete(code));}
});
test('moving drivers cannot chat, change settings or remove their driver restriction on rejoin',async()=>{
  const created=await server.route('create',{name:'Host',vehicle:'Auto',mode:'DRIVER'},'driver-owner');
  const lobby=server.lobbies.get(created.lobby.code),p=lobby.players[0];
  p.location={lat:52,lng:13,accuracy:1,at:Date.now(),speed:4};
  try{
    const credentials={code:lobby.code,userId:p.id};
    await assert.rejects(server.route('chat',{...credentials,body:'Text'},p.authId),{status:409});
    await assert.rejects(server.route('settings',credentials,p.authId),{status:409});
    await assert.rejects(server.route('join',{code:lobby.code,name:'Changed',vehicle:'Auto',mode:'PASSENGER'},p.authId),{status:409});
    assert.equal(p.name,'Host');assert.equal(p.mode,'DRIVER');
    await server.route('join',{code:lobby.code,name:'Host',vehicle:'Auto'},p.authId);assert.equal(p.mode,'DRIVER');
    p.location.speed=0;await server.route('join',{code:lobby.code,name:'Host',vehicle:'Auto',mode:'PASSENGER'},p.authId);assert.equal(p.mode,'PASSENGER');
  }finally{server.lobbies.delete(lobby.code);}
});
test('server attestation takes the authenticated identity and coalesces retries without mutable results',async()=>{
  const calls=[];const id='11111111-1111-4111-8111-111111111111';
  const service=createAccountService({url:'https://example.supabase.co',key:'sb_secret_test',fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>[]};}});
  const reward={resultId:'22222222-2222-4222-8222-222222222222',role:'HIDER',won:true,finds:0,survived:true,user_id:'forged'};
  await Promise.all([service.attest(id,reward),service.attest(id,reward)]);
  assert.equal(calls.length,1);const body=JSON.parse(calls[0].options.body);
  assert.equal(body.user_id,id);assert.equal(body.result_id,reward.resultId);
  assert.equal(calls[0].options.headers.Prefer,'resolution=ignore-duplicates,return=representation');
});
test('headstart exposes no opponent proximity even when a hider is close',async()=>{
  const created=await server.route('create',{name:'Host',vehicle:'Auto'},'waiting-owner');
  const lobby=server.lobbies.get(created.lobby.code),now=Date.now();
  try{
    const joined=await server.route('join',{code:lobby.code,name:'Gast',vehicle:'Auto'},'waiting-peer');
    Object.assign(lobby,{state:'HEADSTART',roundStartedAt:now,countdownEndsAt:now,headstartEndsAt:now+120000,origin:{lat:52,lng:13}});
    for(const [i,p]of lobby.players.entries())Object.assign(p,{role:i?'HIDER':'SEEKER',location:{lat:52,lng:13,accuracy:1,at:now},lastActivityAt:now});
    const state=await server.route('state',{code:lobby.code,userId:created.userId},'waiting-owner');
    assert.equal(state.proximity,null);assert.equal(state.map.positions.some(p=>p.id===joined.userId),false);
  }finally{server.lobbies.delete(lobby.code);}
});
