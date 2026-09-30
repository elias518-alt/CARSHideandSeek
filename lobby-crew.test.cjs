const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function lobbyFixture(phase='LOBBY',count=4){
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},classes:new Set(),writes:0,
    before(){},after(){},close(){this.open=false;},classList:{toggle(name,on){const classes=nodes.get(id).classes;on?classes.add(name):classes.delete(name);}},
    set innerHTML(value){this.html=value;this.writes++;},get innerHTML(){return this.html||'';}});return nodes.get(id);};
  const players=Array.from({length:count},(_,index)=>({id:'p'+index,profileId:'account'+index,name:'Player '+index,
    connected:true,ready:true,hasLocation:true,vehicle:'Ford Focus',color:'Blau',role:index===0?'SEEKER':'HIDER'}));
  const state={lobby:{code:'TEST1',state:phase,hostId:'p0',me:players[0],players}};
  node('roomHeader').nextElementSibling=node('result');
  node('targets').nextElementSibling=node('freshMapFold');
  node('crewBoard').nextElementSibling=node('freshMapFold');
  node('freshMapFold').nextElementSibling=node(phase==='LOBBY'?'targets':'crewBoard');
  const context=vm.createContext({state,freshLobbyPhase:'',ensureFreshLobby(){},updateFreshChat(){},
    document:{getElementById:id=>id==='lobbySettingsPanel'?null:node(id),querySelector:selector=>node(selector==='.freshRoomHeader'?'roomHeader':'crewBoard')},
    esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    vehiclePhotoSource:value=>value||'',profileImageSource:value=>value||'',activeCar:()=>null,
    vehicleIllustration:()=>'<figure class="vehicleIllustration"></figure>',initials:name=>name.slice(0,1)
  });
  const source=fs.readFileSync(__dirname+'/app.js','utf8');
  vm.runInContext(source.slice(source.indexOf('function freshPlayerColor(id)')),context);
  return {state,node,render:()=>vm.runInContext('renderFreshLobby()',context)};
}

test('the waiting crew has one character per car and the host in the center group',()=>{
  const f=lobbyFixture('LOBBY',20);f.render();const markup=f.node('players').innerHTML;
  assert.equal((markup.match(/<article/g)||[]).length,20);
  assert.equal((markup.match(/aria-hidden="true"/g)||[]).length,20);
  assert.equal((markup.match(/lobbyCrewPose--side/g)||[]).length,20);
  assert.doesNotMatch(markup,/lobbyCrewPose--[012]/);
  const center=markup.split('<div class="freshCrewLead">')[1].split('<div class="freshCrewWing freshCrewWing--right">')[0];
  assert.match(center,/<h3>Player 0/);
  assert.equal((center.match(/<article/g)||[]).length,1);
  assert.equal((markup.match(/data-lobby-profile=/g)||[]).length,19);
  assert.equal(f.node('freshSettingsButton').hidden,false);
  assert.equal(f.node('freshSettingsButton').disabled,false);
});

test('the active round keeps the flat player cards and closes waiting-room settings',()=>{
  const f=lobbyFixture('ACTIVE');f.node('freshSettingsDialog').open=true;f.render();
  const markup=f.node('players').innerHTML;
  assert.equal((markup.match(/<article/g)||[]).length,4);
  assert.doesNotMatch(markup,/freshCrewLead|lobbyCrewCharacter/);
  assert.equal(f.node('freshSettingsButton').disabled,true);
  assert.equal(f.node('freshSettingsDialog').open,false);
  assert.equal(f.node('game').classes.has('liveRound'),true);
});

test('polling unchanged players preserves the existing crew nodes and invite action',()=>{
  const f=lobbyFixture('LOBBY',1);f.render();f.render();
  assert.equal(f.node('players').writes,1);
  assert.match(f.node('players').innerHTML,/data-open-lobby-invite/);
  f.state.lobby.players[0].ready=false;f.render();
  assert.equal(f.node('players').writes,2);
  assert.match(f.node('players').innerHTML,/WARTET/);
});


test('legacy uploaded vehicle photos stay visible instead of falling back to the blue generic car',()=>{
  const f=lobbyFixture('LOBBY',2);
  f.state.lobby.players[0].photoUrl='https://example.com/user-car.jpg';
  f.render();
  const markup=f.node('players').innerHTML;
  assert.match(markup,/class="lobbyModelCar lobbyModelCar--raw"/);
  assert.match(markup,/https:\/\/example\.com\/user-car\.jpg/);
});


test('waiting lobby uses the violet rooftop image instead of the old blue background',()=>{
  const css=fs.readFileSync(__dirname+'/crew-lobby.css','utf8');
  assert.match(css,/assets\/lobby-rooftop-violet\.webp/);
  assert.doesNotMatch(css,/lobby-bg\.png|night-hunt\.webp/);
});


test('violet rooftop background is a complete WebP asset',()=>{
  const image=fs.readFileSync(__dirname+'/assets/lobby-rooftop-violet.webp');
  assert.ok(image.length>6000,'Lobby background must not be truncated');
  assert.equal(image.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(image.subarray(8,12).toString('ascii'),'WEBP');
});
