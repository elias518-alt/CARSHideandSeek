const {test}=require('node:test');
const assert=require('node:assert/strict');
const {route,lobbies}=require('./server.js');

function player(id,authId,now=Date.now()){
  return {
    id,authId,name:'Tester',vehicle:'BMW 420i',bodyType:'Coupé',color:'Orange',
    photoUrl:'',avatarUrl:'',characterStyle:2,mode:'PASSENGER',level:4,
    role:'HIDER',ready:true,found:false,roundFinds:0,lastSeen:now,cooldownUntil:0,
    location:{lat:50.8,lng:7.6,accuracy:8,at:now}
  };
}

test('authenticated player can rejoin an already active round without changing last GPS fix',async()=>{
  const now=Date.now();
  const me=player('session-1','auth-1',now-40000);
  const lobby={code:'REJ01',name:'REJOIN',visibility:'PRIVATE',origin:null,hostId:me.id,players:[me],
    state:'ACTIVE',result:null,radius:500,duration:900,headstart:180,escape:15,createdAt:now,
    countdownEndsAt:null,headstartEndsAt:null,endsAt:now+60000,messages:[]};
  lobbies.set(lobby.code,lobby);
  const oldLocation={...me.location};
  try{
    const result=await route('join',{
      code:lobby.code,name:'Tester',vehicle:'BMW 420i',bodyType:'Coupé',color:'Orange',
      characterStyle:0,mode:'PASSENGER',level:4
    },me.authId);
    assert.equal(result.userId,me.id);
    assert.equal(result.lobby.state,'ACTIVE');
    assert.deepEqual(me.location,oldLocation);
    assert.equal(me.characterStyle,0);
    assert.ok(me.lastSeen>now-5000);
  }finally{lobbies.delete(lobby.code);}
});

test('state keeps a disconnected players last coordinate on the map but not as fresh gameplay GPS',async()=>{
  const now=Date.now();
  const me=player('session-2','auth-2',now-60000);
  me.location.at=now-60000;
  const lobby={code:'REJ02',name:'LAST GPS',visibility:'PRIVATE',origin:{lat:50.8,lng:7.6},hostId:me.id,players:[me],
    state:'ACTIVE',result:null,radius:250,duration:900,headstart:180,escape:15,createdAt:now,
    countdownEndsAt:null,headstartEndsAt:null,endsAt:now+60000,messages:[]};
  lobbies.set(lobby.code,lobby);
  try{
    const result=await route('state',{code:lobby.code,userId:me.id},me.authId);
    assert.equal(result.map.positions.length,1);
    assert.equal(result.map.positions[0].stale,true);
    assert.equal(result.map.positions[0].connected,false);
    assert.equal(result.lobby.me.hasLocation,false);
    assert.equal(result.lobby.me.hasStoredLocation,true);
  }finally{lobbies.delete(lobby.code);}
});

test('host settings accept a 50 metre game radius',async()=>{
  const now=Date.now();
  const me=player('session-3','auth-3',now);
  const lobby={code:'REJ03',name:'SMALL',visibility:'PRIVATE',origin:null,hostId:me.id,players:[me],
    state:'LOBBY',result:null,radius:1000,duration:900,headstart:180,escape:15,settingsRevision:0,createdAt:now,
    countdownEndsAt:null,headstartEndsAt:null,endsAt:null,messages:[]};
  lobbies.set(lobby.code,lobby);
  try{
    await route('settings',{
      code:lobby.code,userId:me.id,revision:0,lobbyName:'SMALL',visibility:'PRIVATE',
      radius:50,duration:900,headstart:180,escape:15
    },me.authId);
    assert.equal(lobby.radius,50);
  }finally{lobbies.delete(lobby.code);}
});
