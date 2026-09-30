const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const lobbyScene=require('./lobby-scene');

function lobbyFixture(phase='LOBBY',count=4){
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},classes:new Set(),writes:0,
    before(){},after(){},close(){this.open=false;},classList:{toggle(name,on){const classes=nodes.get(id).classes;on?classes.add(name):classes.delete(name);}},
    set innerHTML(value){this.html=value;this.writes++;},get innerHTML(){return this.html||'';}});return nodes.get(id);};
  const players=Array.from({length:count},(_,index)=>({id:'p'+index,profileId:'account'+index,name:'Player '+index,
    connected:true,ready:true,hasLocation:true,vehicle:'Ford Focus',color:'Blau',role:index===0?'SEEKER':'HIDER'}));
  const state={lobby:{settings:{radius:1000},code:'TEST1',state:phase,hostId:'p0',me:players[0],players}};
  node('roomHeader').nextElementSibling=node('result');
  node('targets').nextElementSibling=node('freshMapFold');
  node('crewBoard').nextElementSibling=node('freshMapFold');
  node('freshMapFold').nextElementSibling=node(phase==='LOBBY'?'targets':'crewBoard');
  const context=vm.createContext({lobbySettingsSaving:false,lobbyScene,state,freshLobbyPhase:'',ensureFreshLobby(){},updateFreshChat(){},
    document:{getElementById:id=>id==='lobbySettingsPanel'?null:node(id),querySelector:selector=>node(selector==='.freshRoomHeader'?'roomHeader':'crewBoard')},
    esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    vehiclePhotoSource:value=>value||'',profileImageSource:value=>value||'',activeCar:()=>null,
    vehicleIllustration:()=>'<figure class="vehicleIllustration"></figure>',initials:name=>name.slice(0,1)
  });
  const source=fs.readFileSync(__dirname+'/app.js','utf8');
  vm.runInContext(source.slice(source.indexOf('function freshPlayerColor(id)')),context);
  return {state,node,context,render:()=>vm.runInContext('renderFreshLobby()',context)};
}

test('all twenty players have a car and character, with a single foreground host',()=>{
  const f=lobbyFixture('LOBBY',20);f.render();const markup=f.node('players').innerHTML;
  assert.equal((markup.match(/<article/g)||[]).length,20);
  assert.equal((markup.match(/lobbyCrewPose--side/g)||[]).length,20);
  assert.doesNotMatch(markup,/lobbyCrewPose--[012]/);
  const center=markup.split('<div class="freshCrewLead">')[1].split('<div class="parkingNavigation"')[0];
  assert.match(center,/<strong>Player 0/);
  assert.equal((center.match(/<article/g)||[]).length,1);
  assert.equal((markup.match(/data-parking-player=/g)||[]).length,20);
  assert.match(markup,/--parking-pages:5/);
  assert.equal((markup.match(/data-lobby-card=/g)||[]).length,20);
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
  assert.match(f.node('players').innerHTML,/Wartet/);
});


test('legacy uploaded vehicle photos stay visible instead of falling back to the blue generic car',()=>{
  const f=lobbyFixture('LOBBY',2);
  f.state.lobby.players[0].photoUrl='https://example.com/user-car.jpg';
  f.render();
  const markup=f.node('players').innerHTML;
  assert.match(markup,/class="lobbyModelCar lobbyModelCar--raw"/);
  assert.match(markup,/https:\/\/example\.com\/user-car\.jpg/);
});


test('parking sections contain unique rear slots and preserve readable size for 1–20 players',()=>{
  for(const count of [1,5,10,20]){
    const f=lobbyFixture('LOBBY',count);
    const source=fs.readFileSync(__dirname+'/app.js','utf8');
    const layout=vm.runInNewContext(source.slice(source.indexOf('function parkingLayout'),source.indexOf('function parkingAvatarMarkup'))+'; parkingLayout(players)',{lobbyScene,players:f.state.lobby.players.slice(1)});
    assert.equal(layout.pages,Math.max(1,Math.ceil((count-1)/4)));
    assert.equal(new Set(layout.slots.map(slot=>slot.page+':'+slot.x+':'+slot.ground)).size,count-1);
    for(const slot of layout.slots){
      assert.ok(slot.x>=0&&slot.x<=100);
      assert.ok(slot.width*layout.pages>=40);
      assert.ok(slot.ground>0&&slot.ground<100);
    }
    f.render();
    assert.equal((f.node('players').innerHTML.match(/<article/g)||[]).length,count);
  }
});

test('peer photos and authenticated player profiles survive the new scene rendering',()=>{
  const f=lobbyFixture('LOBBY',5);
  f.state.lobby.players[1].photoUrl='https://example.com/peer.cutout.png';
  f.state.lobby.players[2].avatarUrl='https://example.com/avatar.jpg';
  f.state.lobby.players[3].name='<script>alert(1)</script>';
  f.render();const markup=f.node('players').innerHTML;
  assert.match(markup,/peer\.cutout\.png/);
  assert.match(markup,/avatar\.jpg/);
  assert.doesNotMatch(markup,/<script>/);
  assert.match(markup,/&lt;script&gt;/);
});

test('solo is centered, a pair shares its row, and larger crews keep the host in front',()=>{
  for(let count=1;count<=20;count++){
    const f=lobbyFixture('LOBBY',count);f.render();
    assert.equal((f.node('players').innerHTML.match(/<article/g)||[]).length,count);
    assert.equal(f.node('players').dataset.formation,count===1?'solo':count===2?'pair':'crew');
    if(count===2){
      assert.doesNotMatch(f.node('players').innerHTML,/freshCrewLead/);
      assert.equal((f.node('players').innerHTML.match(/--parking-ground:25%/g)||[]).length,2);
      assert.match(f.node('players').innerHTML,/--parking-x:26%/);
      assert.match(f.node('players').innerHTML,/--parking-x:74%/);
    }else assert.match(f.node('players').innerHTML,/freshCrewLead/);
  }
});
test('waiting guests see the map immediately, hosts can keep the scene open',()=>{
  const f=lobbyFixture('LOBBY',3);f.render();assert.equal(f.node('freshMapFold').open,false);
  f.state.lobby.me=f.state.lobby.players[1];f.render();assert.equal(f.node('freshMapFold').open,true);
});
test('background changes update every client without replacing unchanged player cards',()=>{
  const f=lobbyFixture();f.render();f.state.lobby.background='garage';f.render();
  assert.equal(f.node('players').dataset.background,'garage');assert.equal(f.node('players').writes,1);
});

test('polling cannot re-enable host settings while a save is pending',()=>{
  const f=lobbyFixture();f.context.lobbySettingsSaving=true;f.render();
  assert.equal(f.node('freshSettingsButton').disabled,true);
  f.context.lobbySettingsSaving=false;f.render();assert.equal(f.node('freshSettingsButton').disabled,false);
});
