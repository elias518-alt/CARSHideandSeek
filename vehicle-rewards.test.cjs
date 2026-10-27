const test=require('node:test'),assert=require('node:assert/strict');
const rewards=require('./vehicle-rewards'),{createVehicleRewardService}=require('./vehicle-reward-service');
const actor='11111111-1111-4111-8111-111111111111';
function fixture(){
 let level=1,metadata={},writes=0;
 const cars=[{id:'a',brand:'BMW',model:'3er',series:'E36',model_year:1996,body_type:'Limousine'},{id:'b',brand:'MINI',model:'Cooper S',model_year:2020}];
 const service=createVehicleRewardService({url:'https://fixture.invalid',key:'public',fetcher:async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer user');
  let value;
  if(url.includes('/rpc/'))value={level};
  else if(url.includes('/vehicles?')){assert.match(url,/user_id=eq\.11111111/);value=cars;}
  else {if(options.method==='PUT'){writes++;metadata={...metadata,...JSON.parse(options.body).data};}value={id:actor,user_metadata:metadata};}
  return {ok:true,json:async()=>structuredClone(value)};
 }});
 return {service,cars,setLevel(value){level=value;},tamper(value){metadata=value;},get metadata(){return metadata;},get writes(){return writes;}};
}
test('reward boundaries and unknown options fail closed',()=>{
 assert.deepEqual(rewards.restrict({rims:'silver',package:'sport',glow:'cyan'},1),rewards.defaults);
 assert.equal(rewards.restrict({rims:'silver'},2).rims,'silver');
 assert.equal(rewards.restrict({glow:'cyan'},3).glow,'cyan');
 assert.equal(rewards.restrict({package:'sport'},4).package,'stock');
 assert.equal(rewards.restrict({package:'sport'},5).package,'sport');
 assert.deepEqual(rewards.normalize({rims:'<script>',glow:'javascript:'}),rewards.defaults);
});
test('save requires ownership, authoritative level and supported model',async()=>{
 const f=fixture(),save=(vehicleId,loadout)=>f.service.save(actor,'Bearer user',{vehicleId,loadout});
 await assert.rejects(save('someone-elses-car',rewards.defaults),{status:403});
 await assert.rejects(save('a',{rims:'silver',package:'stock',glow:'off'}),{status:403});
 f.setLevel(8);
 await assert.rejects(save('b',{rims:'silver',package:'stock',glow:'off'}),{status:400});
 await assert.rejects(save('a',{rims:'wrong',package:'stock',glow:'off'}),{status:400});
 await assert.rejects(save('a',{...rewards.defaults,xp:90000}),{status:400});
 assert.equal(f.writes,0);
 await save('a',{rims:'silver',package:'sport',glow:'cyan'});
 await save('b',{rims:'stock',package:'stock',glow:'amber'});
 assert.deepEqual(Object.keys(f.metadata),['chs_vehicle_loadouts']);
 assert.equal(f.metadata.chs_vehicle_loadouts.a.rims,'silver');
 assert.equal(f.metadata.chs_vehicle_loadouts.b.glow,'amber');
});
test('user-editable metadata cannot unlock rewards and removed cars are discarded',async()=>{
 const f=fixture();f.tamper({chs_vehicle_loadouts:{a:{rims:'graphite',package:'sport',glow:'cyan'},removed:{rims:'silver'}}});
 const read=await f.service.read(actor,'Bearer user');
 assert.deepEqual(read.loadouts.a,rewards.defaults);assert.equal(read.loadouts.removed,undefined);
});
test('concurrent updates preserve both vehicles',async()=>{
 const f=fixture();f.setLevel(8);
 await Promise.all([f.service.save(actor,'Bearer user',{vehicleId:'a',loadout:{rims:'silver',package:'sport',glow:'cyan'}}),f.service.save(actor,'Bearer user',{vehicleId:'b',loadout:{rims:'stock',package:'stock',glow:'amber'}})]);
 assert.equal(f.metadata.chs_vehicle_loadouts.a.package,'sport');assert.equal(f.metadata.chs_vehicle_loadouts.b.glow,'amber');
});
test('backend failure grants nothing',async()=>{
 const service=createVehicleRewardService({url:'https://fixture.invalid',key:'public',fetcher:async()=>{throw Error('offline');}});
 await assert.rejects(service.read(actor,'Bearer user'),{status:503});
});
test('calibrated wheel rendering changes only the supported illustration',()=>{
 const studio=require('./vehicle-studio'),f=fixture(),car=f.cars[0];
 assert.equal(rewards.supports(car),true);assert.equal(rewards.supports(f.cars[1]),false);
 assert.match(studio.render({...car,cosmetics:{rims:'silver',package:'sport'}}),/data-fitted-rim="silver"/);
 const original=studio.render(car).replace(/studio-car-\d+/g,'id'),stock=studio.render({...car,cosmetics:rewards.defaults}).replace(/studio-car-\d+/g,'id');
 assert.equal(original,stock);
});
test('photo preference persists per owned car and a new session reads the same clamped transform',async()=>{
 const f=fixture();
 await f.service.save(actor,'Bearer user',{vehicleId:'a',loadout:rewards.defaults,presentation:{mode:'model',customVehicleTransform:{scale:1.1,translateX:.04,translateY:200}}});
 const read=await f.service.read(actor,'Bearer user');assert.equal(read.presentations.a.mode,'model');assert.equal(read.presentations.a.customVehicleTransform.scale,1.1);assert.equal(read.presentations.a.customVehicleTransform.translateX,.04);assert.equal(read.presentations.a.customVehicleTransform.translateY,0);assert.equal(read.presentations.b.mode,'photo');
 await f.service.save(actor,'Bearer user',{vehicleId:'b',loadout:rewards.defaults,presentation:{mode:'photo'}});
 assert.equal((await f.service.read(actor,'Bearer user')).presentations.a.mode,'model');
 await assert.rejects(f.service.save(actor,'Bearer user',{vehicleId:'unknown',loadout:rewards.defaults,presentation:{mode:'model'}}),{status:403});
});


test('ground light follows calibrated tyre contacts and renders behind the body',()=>{
 const studio=require('./vehicle-studio');
 const car={brand:'BMW',model:'3er',series:'E36',year:1996,body:'Limousine'};
 for(const glow of ['cyan','amber','pink','violet','green','red','white']){
  const html=studio.render({...car,cosmetics:{glow}});
  assert.ok(html.indexOf('data-ground-light')<html.indexOf('<image'));
  assert.match(html,/transform="rotate\(-/);assert.match(html,/data-front-ground-light="true"/);
  assert.doesNotMatch(html,/NaN|undefined/);
 }
 assert.doesNotMatch(studio.render({...car,cosmetics:{glow:'off'}}),/data-ground-light/);
 assert.doesNotMatch(studio.render({...car,cosmetics:{glow:'invalid'}}),/data-ground-light/);
});

test('all rim styles keep the same model-specific mounting perspective',()=>{
 for(const [code,mounts] of Object.entries(rewards.mounts)){
  const transforms=['silver','graphite','mesh'].map(rims=>[...rewards.overlay(code,[0,0,1536,1024],{rims}).matchAll(/data-fitted-rim="[^"]+" transform="([^"]+)"/g)].map(m=>m[1]));
  assert.equal(transforms[0].length,2,code);assert.deepEqual(transforms[1],transforms[0]);assert.deepEqual(transforms[2],transforms[0]);
  assert.ok(mounts.every(p=>p.every(Number.isFinite)));
 }
});
test('package detail previews use the selected car and include only the advertised sill',()=>{
 const car={brand:'BMW',model:'3er',series:'E36',year:1996,body:'Limousine'};
 for(const value of ['stock','clean','sport','track']){
  const html=rewards.preview('package',value,car);assert.match(html,/data-part-detail="sill"/);assert.match(html,/data-studio-generation="E36"/);
  if(value==='stock')assert.doesNotMatch(html,/data-fitted-package/);else assert.ok(html.includes('data-fitted-package="'+value+'"'));
  assert.doesNotMatch(html,/NaN|undefined/);
 }
});
