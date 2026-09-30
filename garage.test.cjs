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

test('existing car atlas distinguishes small cars, classic saloons and sports cars',()=>{
  const corsa=catalog.illustration({vehicle:'Opel Corsa'});
  const bmw=catalog.illustration({brand:'BMW',model:'3er',series:'E36'});
  const porsche=catalog.illustration({vehicle:'Porsche 911'});
  assert.equal(new Set([corsa.index,bmw.index,porsche.index]).size,3);
  assert.equal(catalog.illustration({vehicle:'Audi A4 Avant'}).index,6);
  assert.equal(catalog.illustration({vehicle:'VW Caddy'}).index,9);
  assert.equal(catalog.illustration({vehicle:'BMW Z4 Roadster'}).index,11);
  assert.equal(catalog.illustration({vehicle:'Porsche 911',body:'SUV'}).index,7);
  assert.equal(catalog.illustration({vehicle:'Volkswagen Golf'}).index,1);
  assert.equal(catalog.illustration({vehicle:'Smart Fortwo'}).index,10);
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

const vehicleSearch=require('./vehicle-search.js');
test('one search parses make, model and year without duplicating a generation choice',()=>{
  const car=vehicleSearch.search('BMW3er2015').find(item=>item.exact);
  assert.deepEqual([car.brand,car.model,car.year],['BMW','3er','2015']);
  assert.equal(car.series,'');
});
test('model-only search and manufacturer aliases resolve usable vehicles',()=>{
  const focus=vehicleSearch.search('Focus 2015').find(item=>item.exact);
  const golf=vehicleSearch.search('VW Golf 2011').find(item=>item.exact);
  assert.deepEqual([focus.brand,focus.model,focus.year],['Ford','Focus','2015']);
  assert.deepEqual([golf.brand,golf.model,golf.year],['Volkswagen','Golf','2011']);
});
test('explicit BMW chassis keeps the series while using a single model field',()=>{
  const car=vehicleSearch.search('BMW E36 1996').find(item=>item.exact);
  assert.deepEqual([car.brand,car.model,car.year,car.series],['BMW','3er','1996','E36']);
});
test('unlisted vehicles remain available as explicit user entries',()=>{
  const car=vehicleSearch.search('AC Cobra 1990').find(item=>item.exact);
  assert.deepEqual([car.brand,car.model,car.year,car.manual],['AC','Cobra','1990',true]);
  assert.equal(vehicleSearch.search('BMW 320i 2015')[0].model,'320i');
});
test('entering only a manufacturer does not silently select its first model',()=>{
  const cars=vehicleSearch.search('BMW');
  assert.ok(cars.length>1);
  assert.equal(cars.some(item=>item.exact),false);
});

