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
 assert.deepEqual(wardrobe.normalize(JSON.parse(JSON.stringify(input))),{version:3,...input});
 assert.equal(wardrobe.restrict(input,false).collection,'classic');assert.equal(wardrobe.restrict(input,false).classic,2);
 assert.equal(wardrobe.restrict(input,true).collection,'studio');
 const invalid=wardrobe.normalize({collection:'studio',outfit:99,gender:'../bad',topColor:'" onload="evil'});
 assert.equal(invalid.outfit,0);assert.equal(invalid.gender,'male');assert.equal(invalid.topColor,'black');
});
