'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const wardrobe=require('./wardrobe');
test('realistic appearance survives JSON storage and normalization without losing independent choices',()=>{
 const value={collection:'realistic',gender:'female',hair:2,hairColor:'auburn',top:2,topColor:'green',pants:0,pantsColor:'cream',jewelry:'silver',glasses:true,earrings:true,classic:2};
 const normalized=wardrobe.normalize(value);assert.equal(normalized.version,2);
 assert.deepEqual(wardrobe.normalize(JSON.parse(JSON.stringify(normalized))),normalized);
 for(const [key,v] of Object.entries(value))assert.equal(normalized[key],v,key);
 assert.equal(wardrobe.normalize({collection:'modular',character:5}).version,1);
 assert.match(wardrobe.markup({collection:'classic',classic:2}),/--2/);
});
test('realistic asset paths and filters are allowlisted against untrusted lobby metadata',()=>{
 const value={collection:'realistic',gender:'../../secret',hair:999,top:-2,pants:Infinity,topColor:'red; background:url(https://evil)',hairColor:'" onerror="alert(1)',jewelry:'evil',glasses:'true',earrings:'true'};
 const safe=wardrobe.normalize(value);assert.equal(safe.gender,'male');assert.equal(safe.hair,0);assert.equal(safe.glasses,false);
 assert.doesNotMatch(wardrobe.markup(value),/secret|evil|onerror|alert|Infinity/);
});
test('legacy customizable looks render a complete studio character without old low-resolution layers',()=>{
 for(const gender of ['male','female'])for(let hair=0;hair<3;hair++)for(let top=0;top<3;top++)for(let pants=0;pants<3;pants++){
  const html=wardrobe.markup({collection:'realistic',gender,hair,top,pants,jewelry:'gold',glasses:true,earrings:true});
  assert.match(html,/wardrobeStudio/);assert.doesNotMatch(html,/characters\/(noedge|quaternius)/);
  for(const match of html.matchAll(/href="(assets[^"]+)"/g)){
   const data=fs.readFileSync(path.join(__dirname,match[1]));assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');assert.ok(data.length>100);
  }
  if(gender==='male')assert.doesNotMatch(html,/earrings\.webp/);
 }
});

test('studio choices are normalized, allowlisted and restricted by membership',()=>{
 const input={collection:'studio',gender:'female',outfit:2,topColor:'cream',pantsColor:'black',classic:2};
 assert.deepEqual(wardrobe.normalize(JSON.parse(JSON.stringify(input))),{version:6,collection:'studio',figure:'maya',gender:'female',top:2,pants:2,shoes:0,topColor:'cream',pantsColor:'black',shoeColor:'white',pose:0,winPose:0,traits:require('./character-avatar').traits({},'female'),classic:2,face:null});
 assert.equal(wardrobe.restrict(input,false).collection,'classic');assert.equal(wardrobe.restrict(input,false).classic,2);
 assert.equal(wardrobe.restrict(input,true).collection,'studio');
 const invalid=wardrobe.normalize({collection:'studio',outfit:99,gender:'../bad',topColor:'" onload="evil'});
 assert.equal(invalid.top,0);assert.equal(invalid.gender,'male');assert.equal(invalid.topColor,'black');
});

const studio=require('./character-studio');
test('all restored independent garments survive v6 storage; legacy full outfits migrate',()=>{
 for(const gender of ['male','female'])for(let top=0;top<3;top++)for(let pants=0;pants<3;pants++){
  const look=studio.normalize({gender,top,pants});assert.deepEqual(studio.normalize(JSON.parse(JSON.stringify(look))),look);
  const html=studio.render(look);assert.match(html,new RegExp('data-top="'+top+'" data-pants="'+pants+'"'));
  assert.match(html,/wardrobeRealistic/);assert.match(html,/assets\/characters\/studio\/(alex|maya)\.webp/);assert.doesNotMatch(html,/wardrobeAvatar/);
 }
 for(let outfit=0;outfit<3;outfit++){const look=studio.normalize({version:3,outfit});assert.equal(look.top,outfit);assert.equal(look.pants,outfit);}
});
test('face paths are scoped image objects; URL injection, other paths and invalid transforms cannot render',()=>{
 const id='11111111-1111-4111-8111-111111111111',path=id+'/character-face-22222222-2222-4222-8222-222222222222.png';
 const v=studio.normalize({face:{path,x:100,y:-100,scale:Infinity}});assert.equal(v.face,null);
 assert.equal(studio.ownsFace({face:{path}},id),true);assert.equal(studio.ownsFace({face:{path}},'another-user'),false);
 assert.doesNotMatch(studio.render(v),/data-studio-face|character-face-/);
 for(const bad of ['https://evil.test/a.png','data:image/png;base64,AAA',path+'?x=1',path+'\n',path.replace('character-face-','avatar-'),path.replace(id,'../secret'),'" onload="evil'])assert.equal(studio.normalize({face:{path:bad}}).face,null);
 assert.doesNotMatch(studio.render({face:{path:'javascript:evil'},topColor:'__proto__'}),/evil|undefined/);
 assert.equal(wardrobe.restrict({...v,collection:'studio'},false).face,undefined);
});
