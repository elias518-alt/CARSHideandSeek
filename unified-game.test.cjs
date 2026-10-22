const {test}=require('node:test'),assert=require('node:assert/strict');
const config=require('./vehicle-configuration'),studio=require('./vehicle-studio'),rewards=require('./vehicle-rewards'),scene=require('./scene-layout'),outfit=require('./crew-outfit'),character=require('./character-studio'),style=require('./game-map-style');
test('legacy and public E36 share Madeira paint, tuning, photo preference and generation',()=>{
 const local={brand:'BMW',model:'328i',series:'E36',year:1996,body:'Coupé',color:'Madeira Violett',photo:'owned.webp',cosmetics:{rims:'silver',package:'sport',glow:'cyan'}};
 const remote={...local,year:undefined,body:undefined,photo:undefined,vehicleYear:1996,bodyType:'Coupé',photoUrl:'owned.webp'};
 for(const v of [local,remote]){const c=config.normalize(v);assert.equal(c.paintColor,'#51364f');assert.equal(c.photo,'owned.webp');assert.equal(c.presentation.mode,'photo');assert.equal(c.wheelId,'silver');assert.equal(c.bodyKitId,'sport');assert.equal(c.generation,'E36');}
 assert.equal(config.normalize({...local,presentation:{mode:'model'}}).presentation.mode,'model');
 assert.equal(studio.color('Madeira Violett'),studio.color('madeira-violett'));
});
test('custom photo transforms cannot lift a car or move it outside its lane',()=>{
 assert.deepEqual(config.presentation(null),config.presentation());
 const t=config.transform({scale:100,translateX:-100,translateY:900,groundY:900});assert.equal(t.scale,1.15);assert.equal(t.translateX,-.08);assert.equal(t.translateY,0);assert.equal(t.groundY,0);
 for(const width of [320,360,390,568,1000])for(const ratio of [.4,1,2,5])for(const pet of Object.keys(scene.petAnchors))for(const translateX of [-.08,.08]){
  const p=scene.layout({width,ratio,pet,scale:1.15,translateX});assert.ok(p.center-p.carWidth/2>=0);assert.ok(p.center+p.carWidth/2<=p.personLeft);assert.ok(p.personLeft+p.personHeight*.4<=width);assert.equal(p.ground,18);
  if(p.petKind==='ground'){assert.equal(p.petBottom,p.ground);assert.ok(p.petLeft>p.center+p.carWidth/2);}else assert.ok(p.petBottom>p.ground);
 }
});
test('BMW 2er wheel coordinates are generation-specific and unsupported cars have none',()=>{
 const f=rewards.anchors({brand:'BMW',model:'2er',series:'F22',year:2015}),g=rewards.anchors({brand:'BMW',model:'2er',series:'G42',year:2023});assert.ok(f);assert.ok(g);assert.notDeepEqual(f,g);assert.equal(rewards.anchors({brand:'MINI',model:'Cooper S',year:2020}),null);
});
test('crew clothes match semantic garments across genders, without changing saved outfits',()=>{
 const rule={top:'halfzip',pants:'baggy',topColor:'black',pantsColor:'gray'};
 for(const gender of ['male','female']){const a=character.normalize({figure:gender==='male'?'luca':'mia'}),before=structuredClone(a),draft=outfit.draft(rule,a);assert.deepEqual(a,before);assert.ok(outfit.matches(rule,draft));assert.equal(draft.top,gender==='male'?6:8);assert.equal(draft.pants,gender==='male'?4:3);assert.ok(!outfit.matches(rule,{collection:'classic',classic:0}));}
});
test('map restyling keeps sources, attribution, controls and layer layout intact',()=>{
 const original={sources:{roads:{attribution:'Map contributors'}},layers:[{id:'water',type:'fill'},{id:'road-primary',type:'line'},{id:'labels',type:'symbol',layout:{'text-field':'name'}},{id:'custom',type:'circle'}]},before=structuredClone(original),paint=[];
 style.apply({getStyle:()=>original,setPaintProperty:(...args)=>paint.push(args)});assert.deepEqual(original,before);assert.ok(paint.some(x=>x[1]==='fill-color'));assert.ok(paint.some(x=>x[1]==='text-halo-color'));assert.ok(!paint.some(x=>x[0]==='custom'));
});

test('E36 coupe has its own logo-free asset and wheel anchors rather than sedan or generic art',()=>{const car={brand:'BMW',model:'328i',series:'E36',year:1996,body:'Coupé',color:'Madeira Violett'};assert.equal(studio.select(car).asset[0],'bmwe36coupe');assert.match(studio.render(car),/bmw-e36-coupe\.webp/);assert.notDeepEqual(rewards.anchors(car),rewards.anchors({...car,body:'Limousine'}));assert.equal(rewards.supports(car),true);});
