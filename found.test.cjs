const {test} = require('node:test');
const assert = require('node:assert/strict');
const {route,lobbies} = require('./server.js');
function fixture() {
  const now=Date.now();
  const player=(id,role)=>({id,authId:id,name:id,vehicle:'BMW',color:'Schwarz',role,found:false,cooldownUntil:0,lastSeen:now,location:{lat:52,lng:13,accuracy:5,at:now}});
  const me=player('seeker','SEEKER'),target=player('hider','HIDER');
  const lobby={code:'TEST1',state:'ACTIVE',hostId:me.id,endsAt:now+60000,players:[me,target],messages:[],radius:500};
  lobbies.set(lobby.code,lobby);
  return {me,target,lobby,data:{code:lobby.code,userId:me.id,targetId:target.id}};
}
test('nearby precise fix confirms a fund and finishes the round',async()=>{
  const f=fixture(); const result=await route('found',f.data,f.me.authId);
  assert.equal(result.ok,true);assert.equal(f.target.found,true);assert.equal(f.lobby.state,'RESULT');
});
for(const [name,mutate,message] of [
  ['missing own GPS', f=>f.me.location=null,/Dein GPS fehlt/],
  ['stale target GPS', f=>f.target.location.at-=16000,/GPS-Position des Versteckers/],
  ['inaccurate own GPS',f=>f.me.location.accuracy=30,/Dein GPS ist noch zu ungenau/],
  ['inaccurate target GPS',f=>f.target.location.accuracy=30,/GPS des Versteckers ist noch zu ungenau/],
  ['combined uncertainty',f=>{f.me.location.accuracy=20;f.target.location.accuracy=20;},/höchstens 35 m/],
  ['far target',f=>f.target.location.lat+=0.001,/höchstens 35 m/],
  ['cooldown',f=>f.me.cooldownUntil=Date.now()+5000,/warten/],
  ['wrong phase',f=>f.lobby.state='LOBBY',/derzeit nicht möglich/],
  ['wrong role',f=>f.me.role='HIDER',/derzeit nicht möglich/],
])test(name+' returns a reason and leaves the target unfound',async()=>{
  const f=fixture();mutate(f);
  await assert.rejects(route('found',f.data,f.me.authId),message);
  assert.equal(f.target.found,false);
});
test('state readiness agrees with find validation',async()=>{
  const f=fixture();
  assert.deepEqual((await route('state',f.data,f.me.authId)).nearbyTargets,[f.target.id]);
  f.me.location.accuracy=20;f.target.location.accuracy=20;
  assert.deepEqual((await route('state',f.data,f.me.authId)).nearbyTargets,[]);
});
