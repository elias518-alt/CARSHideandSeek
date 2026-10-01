'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('./round-engine');
const {route,lobbies,distance,blocks,reports}=require('./server');
const {assignRoundRoles}=require('./game-rules');
function fixture(count=5,now=Date.now()){
  const players=Array.from({length:count},(_,i)=>({id:'p'+i,authId:'a'+i,name:'Spieler '+i,vehicle:'Auto '+i,color:'Blau',mode:'PASSENGER',lastSeen:now,joinedAt:now+i,
    location:{lat:52,lng:13,accuracy:1,speed:0,at:now},fixes:Array.from({length:5},(_,j)=>({lat:52,lng:13,accuracy:1,at:now-8000+j*2000}))}));
  assignRoundRoles(players,()=>.9);
  const lobby={code:'ENG01',name:'Spiel',players,hostId:players[0].id,origin:{lat:52,lng:13},radius:500,duration:300,headstart:120,escape:10,
    state:'COUNTDOWN',countdownEndsAt:now+5000,createdAt:now,messages:[]};
  engine.startRound(lobby,now);lobby.state='ACTIVE';lobby.endsAt=now+300000;
  const seeker=players.find(p=>p.role==='SEEKER'),target=players.find(p=>p.role==='HIDER');
  return {lobby,seeker,target,now};
}
function fixes(f,now){for(const p of f.lobby.players)if(engine.active(p)){p.lastSeen=now;if(p.location)p.location.at=now;}}
test('one target reservation survives retry and blocks target switching and competing seekers',()=>{
  const f=fixture(10);const lock=engine.beginLock(f.lobby,f.seeker,f.target.id,f.now,distance);
  assert.equal(lock.status,'LOCKED');assert.equal(f.target.found,false);
  assert.equal(engine.beginLock(f.lobby,f.seeker,f.target.id,f.now+100,distance).id,lock.id);
  const other=f.lobby.players.find(p=>p.role==='SEEKER'&&p!==f.seeker),otherTarget=f.lobby.players.find(p=>p.role==='HIDER'&&p!==f.target);
  assert.equal(engine.beginLock(f.lobby,other,f.target.id,f.now,distance).status,409);
  assert.equal(engine.beginLock(f.lobby,f.seeker,otherTarget.id,f.now,distance).status,409);
});
test('first escape needs multiple fixes and only one escape is possible per round',()=>{
  const f=fixture();engine.beginLock(f.lobby,f.seeker,f.target.id,f.now,distance);
  f.target.location.lat+=.0005;fixes(f,f.now+2000);engine.tick(f.lobby,f.now+2000,distance);
  assert.equal(f.target.stats.escapes,0);
  fixes(f,f.now+4000);engine.tick(f.lobby,f.now+4000,distance);assert.equal(f.target.stats.escapes,1);assert.equal(Object.keys(f.lobby.locks).length,0);
  f.target.location.lat=52;fixes(f,f.now+20000);
  for(const p of [f.seeker,f.target])p.fixes=Array.from({length:5},(_,i)=>({lat:52,lng:13,accuracy:1,at:f.now+12000+i*2000}));
  const second=engine.beginLock(f.lobby,f.seeker,f.target.id,f.now+20000,distance);assert.equal(second.status,'LOCKED');
  f.target.location.lat+=.0005;fixes(f,f.now+22000);engine.tick(f.lobby,f.now+22000,distance);fixes(f,f.now+24000);engine.tick(f.lobby,f.now+24000,distance);
  assert.equal(f.target.stats.escapes,1);fixes(f,f.now+30000);engine.tick(f.lobby,f.now+30000,distance);
  assert.equal(f.target.found,true);assert.equal(f.seeker.stats.finds,1);assert.equal(f.target.location,null);
});
test('GPS interruption or unsafe seeker movement cancels a lock without granting an escape',()=>{
  for(const mutation of [f=>{f.target.location.at=f.now-8000;},f=>{f.seeker.mode='DRIVER';f.seeker.location.speed=4;}]){
    const f=fixture();engine.beginLock(f.lobby,f.seeker,f.target.id,f.now,distance);mutation(f);engine.tick(f.lobby,f.now+1000,distance);
    assert.equal(Object.keys(f.lobby.locks).length,0);assert.equal(f.target.found,false);assert.equal(f.target.stats.escapes,0);
  }
});
test('headstart departure requires repeated evidence, disqualifies and appoints an eligible replacement',()=>{
  const f=fixture();f.lobby.state='HEADSTART';f.lobby.headstartEndsAt=f.now+120000;f.seeker.location.lat+=.001;
  engine.tick(f.lobby,f.now,distance,()=>0);assert.equal(f.seeker.eliminated,false);
  fixes(f,f.now+4000);engine.tick(f.lobby,f.now+4000,distance,()=>0);
  assert.equal(f.seeker.eliminationReason,'EARLY_START');const replacement=f.lobby.players.find(p=>p.role==='SEEKER'&&!p.eliminated);
  assert.ok(replacement);assert.equal(replacement.replacementUntil,f.now+34000);
  assert.match(engine.eligibility({...f.lobby,state:'ACTIVE'},replacement,f.lobby.players.find(p=>p.role==='HIDER'),f.now+5000,distance),/Anhalten/);
});
test('two-player round ends clearly when the only seeker is disqualified and no replacement can preserve a hider',()=>{
  const f=fixture(2);f.lobby.state='HEADSTART';f.lobby.headstartEndsAt=f.now+120000;f.seeker.location.lat+=.001;
  engine.tick(f.lobby,f.now,distance);fixes(f,f.now+4000);engine.tick(f.lobby,f.now+4000,distance);
  assert.equal(f.lobby.state,'RESULT');assert.equal(f.lobby.result.reason,'NO_SEEKERS');assert.equal(f.lobby.result.seekersWin,false);
});
test('radius outliers do not eliminate; confirmed absence has a resettable two-minute grace',()=>{
  const f=fixture();f.target.location.accuracy=80;f.target.location.lat+=.01;engine.tick(f.lobby,f.now,distance);assert.equal(f.target.outsideSince,undefined);
  fixes(f,f.now+4000);engine.tick(f.lobby,f.now+4000,distance);assert.equal(f.target.outsideSince,f.now+4000);
  f.target.location.lat=52;fixes(f,f.now+8000);engine.tick(f.lobby,f.now+8000,distance);assert.equal(f.target.outsideSince,undefined);assert.equal(f.target.stats.outsideMs,4000);
  f.target.location.lat+=.01;fixes(f,f.now+10000);engine.tick(f.lobby,f.now+10000,distance);fixes(f,f.now+14000);engine.tick(f.lobby,f.now+14000,distance);
  fixes(f,f.now+134000);engine.tick(f.lobby,f.now+134000,distance);assert.equal(f.target.eliminationReason,'OUTSIDE');
});
test('restart advances deadlines from their original server times instead of granting extra headstart',()=>{
  const f=fixture();f.lobby.state='COUNTDOWN';fixes(f,f.now+140000);engine.tick(f.lobby,f.now+140000,distance);
  assert.equal(f.lobby.state,'ACTIVE');assert.equal(f.lobby.endsAt,f.now+425000);
});
test('height and accuracy uncertainty cannot confirm nearby cars on different floors',()=>{
  const f=fixture();f.seeker.location.altitude=0;f.target.location.altitude=20;
  for(const p of [f.seeker,f.target])p.location.altitudeAccuracy=1;
  assert.match(engine.eligibility(f.lobby,f.seeker,f.target,f.now,distance),/Höhenunterschied/);
  f.target.location.altitude=0;f.target.fixes=f.target.fixes.slice(-2);
  assert.match(engine.eligibility(f.lobby,f.seeker,f.target,f.now,distance),/mehrere stabile/);
});
test('active API hides opponents, grants only the selected target during a lock and purges all result positions',async()=>{
  const f=fixture(10);lobbies.set(f.lobby.code,f.lobby);const data={code:f.lobby.code,userId:f.seeker.id};
  try{
    let state=await route('state',data,f.seeker.authId);assert.ok(state.map.positions.every(p=>p.role==='SEEKER'));
    await route('found',{...data,targetId:f.target.id},f.seeker.authId);state=await route('state',data,f.seeker.authId);
    assert.deepEqual(state.map.positions.filter(p=>p.role==='HIDER').map(p=>p.id),[f.target.id]);
    const other=f.lobby.players.find(p=>p.role==='SEEKER'&&p!==f.seeker);
    const otherState=await route('state',{code:f.lobby.code,userId:other.id},other.authId);assert.ok(otherState.map.positions.every(p=>p.role==='SEEKER'));
    engine.finish(f.lobby,false,'TIME',f.now+15000);state=await route('state',data,f.seeker.authId);assert.deepEqual(state.map.positions,[]);
    assert.ok(f.lobby.players.every(p=>p.location===null));
  }finally{lobbies.delete(f.lobby.code);}
});
test('host migration preserves game and chooses the oldest connected remaining participant',()=>{
  const f=fixture();const old=f.lobby.players.find(p=>p.id===f.lobby.hostId);old.lastSeen=f.now-50000;
  engine.tick(f.lobby,f.now,distance);assert.equal(f.lobby.hostId,'p1');assert.equal(f.lobby.state,'ACTIVE');assert.equal(f.lobby.radius,500);
});
test('late reconnect cannot revive a player whose disconnect deadline has elapsed',async()=>{
  const f=fixture();f.target.lastSeen=f.now-181000;lobbies.set(f.lobby.code,f.lobby);
  try{const result=await route('join',{code:f.lobby.code,name:'Zurück'},f.target.authId);assert.equal(result.lobby.me.eliminated,true);assert.equal(f.target.eliminationReason,'DISCONNECT');assert.equal(f.target.eliminated,true);}
  finally{lobbies.delete(f.lobby.code);}
});
test('abort requires a strict majority, votes are idempotent, and an active host cannot kick a participant',async()=>{
  const f=fixture();lobbies.set(f.lobby.code,f.lobby);
  try{
    const credentials=p=>({code:f.lobby.code,userId:p.id});
    await assert.rejects(route('kick',{...credentials(f.lobby.players[0]),targetId:f.target.id},f.lobby.players[0].authId),/vor dem Start/);
    for(const p of f.lobby.players.slice(0,2)){await route('abort-vote',credentials(p),p.authId);await route('abort-vote',credentials(p),p.authId);}
    assert.equal(f.lobby.state,'ACTIVE');await route('abort-vote',credentials(f.lobby.players[2]),f.lobby.players[2].authId);assert.equal(f.lobby.result.reason,'ABORT_VOTE');
  }finally{lobbies.delete(f.lobby.code);}
});
test('restored blocking prevents private admission and invitations; invalid report identities fail closed',async()=>{
  const f=fixture();f.lobby.state='LOBBY';lobbies.set(f.lobby.code,f.lobby);
  try{
    blocks.set(f.seeker.authId,['new-account']);
    await assert.rejects(route('join',{code:f.lobby.code,name:'New',vehicle:'Auto'},'new-account'),/Blockierung/);
    await assert.rejects(route('invite',{code:f.lobby.code,userId:f.seeker.id,targetAuthId:'new-account'},f.seeker.authId),/Blockierung/);
    await assert.rejects(route('report',{code:f.lobby.code,userId:f.seeker.id,targetId:f.target.id,category:'cheating'},'outsider'),{status:403});
    await assert.rejects(route('report',{code:f.lobby.code,userId:f.seeker.id,targetId:f.target.id,category:'cheating'},f.seeker.authId),{status:400});
    assert.equal(reports.length,0);
  }finally{lobbies.delete(f.lobby.code);blocks.clear();reports.length=0;}
});
test('fair role rotation gives every participant a turn before repeating a seeker in equal-size rematches',()=>{
  const players=Array.from({length:5},(_,i)=>({id:i}));const selected=[];
  for(let round=0;round<5;round++){assignRoundRoles(players,()=>.9);selected.push(players.find(p=>p.role==='SEEKER').id);}
  assert.equal(new Set(selected).size,5);
});

for(const count of [2,5,10,20])test(count+' participants complete the existing start/headstart/find/result flow',async()=>{
  const f=fixture(count);f.lobby.state='LOBBY';f.lobby.roundStartedAt=null;f.lobby.players.forEach(p=>p.ready=true);
  lobbies.set(f.lobby.code,f.lobby);const originalNow=Date.now;let now=f.now;Date.now=()=>now;
  try{
    const host=f.lobby.players[0];await route('start',{code:f.lobby.code,userId:host.id},host.authId);
    assert.equal(f.lobby.state,'COUNTDOWN');const firstStart=f.lobby.countdownEndsAt;
    await route('start',{code:f.lobby.code,userId:host.id},host.authId);assert.equal(f.lobby.countdownEndsAt,firstStart);
    now+=5000;fixes(f,now);engine.tick(f.lobby,now,distance);assert.equal(f.lobby.state,'HEADSTART');
    now+=120000;fixes(f,now);engine.tick(f.lobby,now,distance);assert.equal(f.lobby.state,'ACTIVE');
    const seekers=f.lobby.players.filter(p=>p.role==='SEEKER'),hiders=f.lobby.players.filter(p=>p.role==='HIDER');
    for(let offset=0;offset<hiders.length;offset+=seekers.length){
      fixes(f,now);for(const p of f.lobby.players)p.fixes=Array.from({length:5},(_,j)=>({lat:52,lng:13,accuracy:1,at:now-8000+j*2000}));
      const batch=hiders.slice(offset,offset+seekers.length);
      for(let index=0;index<batch.length;index++)assert.equal((await route('found',{code:f.lobby.code,userId:seekers[index].id,targetId:batch[index].id},seekers[index].authId)).status,'LOCKED');
      now+=10000;fixes(f,now);engine.tick(f.lobby,now,distance);
      assert.ok(batch.every(p=>p.found));now+=3000;
    }
    assert.equal(f.lobby.state,'RESULT');assert.equal(f.lobby.result.seekersWin,true);assert.equal(f.lobby.result.found,hiders.length);
    assert.ok(f.lobby.players.every(p=>!p.location));
  }finally{Date.now=originalNow;lobbies.delete(f.lobby.code);}
});
test('start requires the 50-metre checkpoint rather than merely being somewhere inside the game radius',async()=>{
  const f=fixture();f.lobby.state='LOBBY';f.lobby.roundStartedAt=null;f.lobby.players.forEach(p=>p.ready=true);f.target.location.lat+=.001;
  lobbies.set(f.lobby.code,f.lobby);
  try{await assert.rejects(route('start',{code:f.lobby.code,userId:f.lobby.hostId},f.lobby.players[0].authId),/50 m/);assert.equal(f.lobby.state,'LOBBY');}
  finally{lobbies.delete(f.lobby.code);}
});
test('three invalid find attempts have progressively enforced server cooldowns without spending an escape',()=>{
  const f=fixture();f.target.location.lat+=.001;let now=f.now;
  for(let index=1;index<=3;index++){
    fixes(f,now);assert.equal(engine.beginLock(f.lobby,f.seeker,f.target.id,now,distance).status,409);
    assert.equal(f.seeker.stats.failedFinds,index);assert.equal(f.seeker.cooldownUntil-now,index===3?30000:5000);
    assert.equal(engine.beginLock(f.lobby,f.seeker,f.target.id,now+1,distance).status,409);assert.equal(f.seeker.stats.failedFinds,index);
    now+=5001;
  }
  assert.equal(f.target.stats.escapes,0);
});
test('AFK warning is followed by grace rather than immediate elimination and explicit activity renews it',async()=>{
  const f=fixture();fixes(f,f.now+601000);engine.tick(f.lobby,f.now+601000,distance);
  // Use HEADSTART with an extended deadline to isolate AFK from the round timer.
  const g=fixture();g.lobby.state='HEADSTART';g.lobby.headstartEndsAt=g.now+1000000;fixes(g,g.now+601000);engine.tick(g.lobby,g.now+601000,distance);
  const state=engine.stateFor(g.lobby,g.target,g.now+601000,distance);assert.equal(state.afkDeadline,g.now+720000);assert.equal(g.target.eliminated,false);
  g.target.lastActivityAt=g.now+601000;fixes(g,g.now+721000);engine.tick(g.lobby,g.now+721000,distance);
  assert.equal(g.target.eliminated,false);assert.ok(g.lobby.players.some(p=>p.eliminationReason==='AFK'));
});
test('ordinary authenticated players cannot access debug timers or location diagnostics',async()=>{
  const f=fixture();lobbies.set(f.lobby.code,f.lobby);
  try{await assert.rejects(route('debug',{code:f.lobby.code,userId:f.seeker.id},f.seeker.authId),/Administrator/);}
  finally{lobbies.delete(f.lobby.code);}
});

test('a drive-by with only one close sample cannot replace sustained paired proximity confirmation',()=>{
  const f=fixture();for(const fix of f.target.fixes.slice(0,-1))fix.lat+=.001;
  assert.match(engine.eligibility(f.lobby,f.seeker,f.target,f.now,distance),/mehrere stabile/);
});
test('replacement activation waits for actual stationary fixes after the thirty-second grace',()=>{
  const f=fixture();const replacement=engine.replacement(f.lobby,f.now,()=>0);
  fixes(f,f.now+31000);replacement.location.speed=5;
  replacement.fixes=Array.from({length:5},(_,i)=>({lat:52,lng:13,accuracy:1,speed:5,at:f.now+23000+i*2000}));
  engine.tick(f.lobby,f.now+31000,distance);assert.equal(replacement.replacementNeedsStop,true);
  replacement.location.speed=0;replacement.fixes=Array.from({length:3},(_,i)=>({lat:52,lng:13,accuracy:1,speed:0,at:f.now+31000+i*2000}));
  fixes(f,f.now+35000);engine.tick(f.lobby,f.now+35000,distance);assert.equal(replacement.replacementNeedsStop,false);
});

test('measurement age is preserved and a repeated cached GPS fix cannot extend freshness',async()=>{
  const f=fixture();lobbies.set(f.lobby.code,f.lobby);const originalNow=Date.now;let now=f.now;Date.now=()=>now;
  try{
    const data={code:f.lobby.code,userId:f.target.id,lat:52,lng:13,accuracy:1,timestamp:now-10000};
    f.target.location=null;await route('location',data,f.target.authId);assert.equal(f.target.location.at,now-10000);
    now+=2000;await route('location',data,f.target.authId);assert.equal(f.target.location.at,f.now-10000);
    assert.equal(engine.fresh(f.target,now,7000),false);
  }finally{Date.now=originalNow;lobbies.delete(f.lobby.code);}
});
test('kicked players cannot immediately rejoin the waiting lobby',async()=>{
  const f=fixture();f.lobby.state='LOBBY';lobbies.set(f.lobby.code,f.lobby);const host=f.lobby.players[0],target=f.lobby.players.find(p=>p!==host);
  try{
    await route('kick',{code:f.lobby.code,userId:host.id,targetId:target.id},host.authId);
    await assert.rejects(route('join',{code:f.lobby.code,name:target.name,vehicle:target.vehicle},target.authId),/entfernt/);
    await route('invite',{code:f.lobby.code,userId:host.id,targetAuthId:target.authId},host.authId);
    const joined=await route('join',{code:f.lobby.code,name:target.name,vehicle:target.vehicle},target.authId);assert.ok(joined.userId);
  }finally{lobbies.delete(f.lobby.code);}
});
