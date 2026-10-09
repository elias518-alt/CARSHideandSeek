const {test}=require('node:test');
const assert=require('node:assert/strict');
const ui=require('./round-presentation');
test('ordinary players can vote, duplicate votes do not count, and every participant sees the abort',async()=>{
  const {route,lobbies}=require('./server'),engine=require('./round-engine');
  const now=Date.now(),players=Array.from({length:5},(_,i)=>({id:'abort-p'+i,authId:'abort-a'+i,name:'Spieler '+i,role:i===0?'SEEKER':'HIDER',mode:'PASSENGER',lastSeen:now,location:{lat:52,lng:13,accuracy:1,at:now}}));
  const lobby={code:'ABQA1',name:'Abbruchtest',hostId:players[0].id,players,state:'ACTIVE',endsAt:now+60000,createdAt:now,origin:{lat:52,lng:13},radius:500,duration:300,headstart:120,escape:10,messages:[]};
  engine.initialize(lobby,now);lobbies.set(lobby.code,lobby);
  const call=(action,p)=>route(action,{code:lobby.code,userId:p.id},p.authId);
  try{
    assert.equal((await call('abort-vote',players[1])).votes,1);
    assert.equal((await call('abort-vote',players[1])).votes,1);
    await call('abort-vote',players[2]);assert.equal(lobby.state,'ACTIVE');
    await call('abort-vote',players[3]);assert.equal(lobby.state,'RESULT');
    for(const player of players){const view=await call('state',player);assert.equal(view.lobby.result.reason,'ABORT_VOTE');assert.equal(view.lobby.result.aborted,true);assert.equal(view.reward,null);assert.equal(view.debugAvailable,false);}
  }finally{lobbies.delete(lobby.code);}
});
test('disconnect never labels an otherwise active player as eliminated',()=>{
  assert.equal(ui.status({connected:false}),'Verbindung verloren');
  assert.equal(ui.status({connected:false,found:true}),'Gefunden');
  assert.equal(ui.status({connected:false,eliminated:true}),'Ausgeschieden');
  assert.equal(ui.status({left:true}),'Runde verlassen');
  assert.equal(ui.role({role:'SEEKER',eliminated:true}),'Sucher');
});
test('server deadlines select the phase and clamp expired timers',()=>{
  const state={lobby:{state:'COUNTDOWN',countdownEndsAt:5000,headstartEndsAt:65000,endsAt:965000,me:{role:'HIDER'}}};
  assert.deepEqual(ui.clock(state,1000),{label:'Rundenstart',seconds:4});
  state.lobby.state='HEADSTART';assert.equal(ui.clock(state,1000).seconds,64);
  state.lobby.state='ACTIVE';assert.equal(ui.clock(state,965010).seconds,0);
  state.escapeUntil=15000;assert.deepEqual(ui.clock(state,10000),{label:'Fund-Countdown / Flucht',seconds:5});
  state.lobby.me.role='SEEKER';assert.equal(ui.clock(state,10000).label,'Suchphase');
});
test('aborted results explain all public reasons and never print unknown internal values',()=>{
  for(const reason of ['ABORT_VOTE','TOO_FEW_PLAYERS','NO_PLAYERS','ADMIN_CLOSED'])assert.ok(ui.abortReason({aborted:true,reason}).length>30);
  assert.equal(ui.abortReason({aborted:false,reason:'TIME'}),'');
  assert.equal(ui.abortReason({aborted:true,reason:'secret backend stack'}).includes('secret'),false);
});
test('lobby readiness identifies the blocking players without treating host as unready',()=>{
  const lobby={hostId:'a',me:{id:'a'},players:[{id:'a',name:'Host',connected:true,hasLocation:true},{id:'b',name:'Lea',connected:true,hasLocation:true,ready:false}]};
  assert.equal(ui.startReason(lobby),'Noch nicht bereit: Lea');
  lobby.players[1].ready=true;assert.match(ui.startReason(lobby),/Alle bereit/);
  lobby.players[1].hasLocation=false;assert.match(ui.startReason(lobby),/Standort fehlt: Lea/);
  lobby.players[1].connected=false;assert.match(ui.startReason(lobby),/Verbindung fehlt: Lea/);
});
