const {test}=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('./vehicle-catalog.js');
const {route,lobbies}=require('./server.js');

test('body selection takes precedence over model inference',()=>{
  assert.equal(catalog.shape({model:'Focus',body:'Touring / Kombi'}),'wagon');
  assert.equal(catalog.shape({model:'Focus'}),'hatch');
  assert.equal(catalog.shape({model:'Unknown',body:'Coupé'}),'coupe');
  assert.equal(catalog.shape({model:'Transit'}),'van');
});
test('generation validation accepts boundaries and leaves unknown models editable',()=>{
  const generation=catalog.ranges(' Ford ','Focus')[2];
  assert.equal(catalog.yearError('2011',generation),'');
  assert.equal(catalog.yearError('2018',generation),'');
  assert.notEqual(catalog.yearError('2010',generation),'');
  assert.notEqual(catalog.yearError('20x5',generation),'');
  assert.equal(catalog.yearError('1990',undefined),'');
  assert.deepEqual(catalog.ranges('Unknown','Custom'),[]);
});
test('lobby profile identifier comes from authenticated participant, without location disclosure',async()=>{
  const now=Date.now();
  const me={id:'player-session',authId:'authenticated-profile',profileId:'spoofed',name:'Test',vehicle:'Ford Focus',bodyType:'Compact',color:'Grey',lastSeen:now,location:{lat:52,lng:13,accuracy:5,at:now}};
  lobbies.set('GARA1',{code:'GARA1',state:'LOBBY',hostId:me.id,players:[me],messages:[],radius:500});
  try{
    const result=await route('state',{code:'GARA1',userId:me.id},me.authId);
    assert.equal(result.lobby.players[0].profileId,me.authId);
    assert.equal(result.lobby.players[0].bodyType,'Compact');
    assert.equal(result.lobby.players[0].location,undefined);
  }finally{lobbies.delete('GARA1');}
});
