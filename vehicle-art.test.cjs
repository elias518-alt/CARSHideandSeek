const {test}=require('node:test');const assert=require('node:assert/strict');
const art=require('./vehicle-art');const catalog=require('./vehicle-catalog');
test('M2 generation follows explicit series or valid production year',()=>{
 assert.equal(art.select({brand:'BMW',model:'M2',year:2018}),'f87');
 assert.equal(art.select({vehicle:'BMW M2',year:2024}),'g87');
 assert.equal(art.select({brand:'BMW',model:'M2',year:2022}),null);
 assert.equal(art.select({brand:'BMW',model:'M2'}),null);
 assert.equal(art.select({vehicle:'BMW M2',series:'F87 · 2016–2021'}),'f87');
 assert.match(catalog.yearError(2022,catalog.ranges('BMW','M2')[0]),/Baujahr/);
});
test('original illustrations have distinct geometry and reject injected paint',()=>{
 const old=art.render({vehicle:'BMW M2',year:2018,color:'red'}),current=art.render({vehicle:'BMW M2',year:2024,color:'red'});
 assert.notEqual(old.replace(/original-car-\d+/g,'id'),current.replace(/original-car-\d+/g,'id'));
 assert.match(old,/#df454f/);assert.doesNotMatch(art.render({vehicle:'BMW M2',year:2024,color:'"><script>alert(1)</script>'}),/<script|alert/);
 assert.equal(art.render({vehicle:'Unbekannt'}),'');
});
