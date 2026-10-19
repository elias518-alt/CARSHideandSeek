'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const pets=require('./pets'),studio=require('./character-studio');
test('all requested companions have independent bounded coat, eye, size and direction choices',()=>{
 assert.deepEqual(Object.keys(pets.breeds),['shepherd','husky','doberman','bengal','shorthair','parrot','fish','hamster','horse','monkey','donkey']);
 for(const [breed,b] of Object.entries(pets.breeds))for(const coat of b.coats)for(const eyes of b.eyes){const p=pets.normalize({breed,coat,eyes,size:2,flip:true});assert.equal(p.coat,coat);assert.equal(p.eyes,eyes);assert.deepEqual(pets.normalize(JSON.parse(JSON.stringify(p))),p);const html=pets.render(p);assert.match(html,new RegExp('data-pet="'+breed+'"'));assert.match(html,/assets\/pets\//);assert.doesNotMatch(html,/undefined|NaN/);}
 for(const file of ['dogs-cats','small-pets','large-pets'])assert.ok(fs.statSync('assets/pets/'+file+'.webp').size>10000);
});
test('pet metadata cannot inject paths, markup or grant PLUS; empty selection remains empty',()=>{
 for(const v of [null,undefined,'husky',{breed:'__proto__'},{breed:'constructor'},{breed:'../secret'}]){assert.equal(pets.normalize(v),null);assert.equal(pets.render(v),'');}
 const v={breed:'husky',coat:'" onerror="evil',eyes:'https://evil.invalid',size:Infinity,flip:'true',stance:999,image:'evil',plus:true};
 const p=pets.normalize(v);assert.equal(p.size,1);assert.equal(p.flip,false);assert.equal(p.stance,0);assert.equal(p.image,undefined);assert.equal(p.plus,undefined);assert.doesNotMatch(pets.render(v),/evil|onerror|Infinity/);
 assert.equal(pets.restrict(v,false),null);assert.equal(pets.restrict(v,'true'),null);assert.equal(pets.restrict(v,true).breed,'husky');
});
test('British shorthair can sit or stand while retaining gray or brown coats',()=>{
 for(const coat of ['gray','chocolate'])for(const stance of [0,1]){const p=pets.normalize({breed:'shorthair',coat,stance});assert.equal(p.stance,stance);assert.equal(p.coat,coat);assert.match(pets.render(p),/Britisch Kurzhaar/);}
});
test('old studio accounts migrate back to the original realistic figures, with new figures strictly allowlisted',()=>{
 assert.equal(studio.normalize({version:5,gender:'male',traits:{skin:4}}).figure,'alex');assert.equal(studio.normalize({version:4,gender:'female'}).figure,'maya');assert.equal(studio.normalize({figure:'lea',gender:'male'}).gender,'female');assert.equal(studio.normalize({figure:'../evil'}).figure,'alex');
 for(const figure of ['alex','maya','nico','lea']){const v=studio.normalize({figure,top:2,pants:1,face:{path:'private'}});assert.deepEqual(studio.normalize(JSON.parse(JSON.stringify(v))),v);assert.equal(v.face,null);assert.doesNotMatch(studio.render(v),/private|wardrobeAvatar/);}
});
