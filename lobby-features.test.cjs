const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const http=require('node:http');
const {route,lobbies,handler}=require('./server');
const {roadRoute}=require('./meetup-route');
const lobbyScene=require('./lobby-scene');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const player={name:'Host',vehicle:'BMW E36',lat:52,lng:13,accuracy:5,visibility:'PUBLIC'};

test('public discovery and joining use 1 km independently of the play radius',async()=>{
  const created=await route('create',{...player,radius:50},'range-host');
  const near={lat:52.004,lng:13,accuracy:5};
  assert.ok((await route('public',near,'range-guest')).lobbies.some(l=>l.code===created.lobby.code));
  await route('join',{...player,...near,code:created.lobby.code},'range-guest');
  lobbies.get(created.lobby.code).radius=10000;
  const far={lat:52.012,lng:13,accuracy:5};
  assert.ok(!(await route('public',far,'range-far')).lobbies.some(l=>l.code===created.lobby.code));
  await assert.rejects(route('join',{...player,...far,code:created.lobby.code},'range-far'),/weit entfernt/);
  lobbies.delete(created.lobby.code);
});

test('discovery follows a moving or replacement host while the game origin stays fixed',async()=>{
  const created=await route('create',player,'moving-host');
  const lobby=lobbies.get(created.lobby.code),host=lobby.players[0];
  host.location={...host.location,lat:52.03};
  const query={lat:52.03,lng:13,accuracy:5};
  assert.ok((await route('public',query,'guest')).lobbies.some(l=>l.code===lobby.code));
  const state=await route('state',{code:lobby.code,userId:host.id},host.authId);
  assert.equal(state.map.meetup.lat,52.03);assert.equal(state.map.center.lat,52);
  lobby.state='ACTIVE';lobby.endsAt=Date.now()+60000;
  assert.equal((await route('state',{code:lobby.code,userId:host.id},host.authId)).map.meetup,null);
  lobbies.delete(lobby.code);
});

test('only the waiting host can change a whitelisted background and readiness stays intact',async()=>{
  const created=await route('create',{...player,background:'wet'},'design-host');
  const joined=await route('join',{...player,code:created.lobby.code},'design-guest');
  const lobby=lobbies.get(created.lobby.code);lobby.players.forEach(p=>p.ready=true);
  const hostData={code:lobby.code,userId:created.userId,background:'garage'};
  await assert.rejects(route('background',{...hostData,userId:joined.userId},'design-guest'),/Nur der Host/);
  await assert.rejects(route('background',hostData,'design-guest'),/nicht gefunden|ungültig|Sitzung/i);
  const result=await route('background',hostData,'design-host');
  assert.equal(result.lobby.background,'garage');assert.ok(lobby.players.every(p=>p.ready));
  await assert.rejects(route('background',{...hostData,background:'https://evil.test/picture'},'design-host'),/Unbekannter Hintergrund/);
  lobby.state='ACTIVE';lobby.endsAt=Date.now()+60000;
  await assert.rejects(route('background',hostData,'design-host'),/Warteraum/);
  lobbies.delete(lobby.code);
});

test('route endpoint refuses outsiders and handles missing GPS without external calls',async()=>{
  const created=await route('create',{...player,visibility:'PRIVATE'},'route-host');
  const joined=await route('join',{...player,code:created.lobby.code},'route-guest');
  const data={code:created.lobby.code,userId:joined.userId};
  await assert.rejects(route('meetup-route',data,'outsider'));
  assert.equal((await route('meetup-route',data,'route-guest')).route,null);
  assert.match((await route('meetup-route',data,'route-guest')).message,/GPS/);
  lobbies.delete(created.lobby.code);
});

test('road routing uses longitude first and rejects missing, invalid or failed routes',async()=>{
  const from={lat:52,lng:13},to={lat:52.001,lng:13.002};
  const route={geometry:{type:'LineString',coordinates:[[13,52],[13.002,52.001]]},distance:320,duration:90};
  const result=await roadRoute(from,to,async url=>{
    assert.equal(url.pathname,'/route/v1/driving/13,52;13.002,52.001');
    assert.equal(url.searchParams.get('geometries'),'geojson');
    return {ok:true,json:async()=>({code:'Ok',routes:[route]})};
  });
  assert.deepEqual(result,route);
  for(const response of [{code:'NoRoute',routes:[]},{code:'Ok',routes:[{...route,geometry:{type:'LineString',coordinates:[[13,52],[181,52]]}}]}]){
    await assert.rejects(roadRoute(from,to,async()=>({ok:true,json:async()=>response})),/Keine Straßenroute/);
  }
  await assert.rejects(roadRoute(from,to,async()=>({ok:false})),/nicht erreichbar/);
});

test('profile background preferences are account-scoped and never accept arbitrary images',()=>{
  const saved=new Map([['chsLobbyBackground:a','wet']]);
  const context=vm.createContext({lobbyScene,authSession:{user:{id:'a',user_metadata:{lobby_background:'garage'}}},localStorage:{getItem:key=>saved.get(key)}});
  vm.runInContext(source.slice(source.indexOf('function lobbyBackgroundKey()'),source.indexOf('async function changeLobbyBackground')),context);
  assert.equal(vm.runInContext('getLobbyBackground()',context),'wet');
  context.authSession={user:{id:'b',user_metadata:{lobby_background:'garage'}}};
  assert.equal(vm.runInContext('getLobbyBackground()',context),'garage');
  context.authSession.user.user_metadata.lobby_background='javascript:bad';
  assert.equal(vm.runInContext('getLobbyBackground()',context),'violet');
});

test('static HTTP serving exposes frontend assets but hides tests and server/database source',async()=>{
  const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    for(const path of ['/found.test.cjs','/meetup-route.js','/game-rules.js','/supabase/migrations/20260929_profile_image_storage.sql','/package.json']){
      const response=await fetch(base+path);assert.equal(response.status,404,path);
    }
    assert.equal((await fetch(base+'/lobby-scene.js')).status,200);
    assert.equal((await fetch(base+'/assets/lobby-meetup.webp')).status,200);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
