const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const generations=require('./vehicle-generations'),studio=require('./vehicle-studio'),art=require('./vehicle-art'),catalog=require('./vehicle-catalog'),scene=require('./lobby-scene');
test('generation covers historical years and engine variants without inventing production years',()=>{
 for(const [car,code]of [[{brand:'BMW',model:'320d',year:2009},'E90'],[{vehicle:'BMW 530i',year:2001},'E39'],[{brand:'Mercedes-Benz',model:'C220d',year:2017},'W205'],[{brand:'BMW',model:'3er',year:1978},'E21'],[{brand:'BMW',model:'5er',year:1974},'E12'],[{brand:'Audi',model:'A4',year:2006},'B7'],[{brand:'Audi',model:'A6',year:2025},'C9']])assert.equal(studio.select(car)?.code,code);
 assert.equal(studio.select({brand:'BMW',model:'M2',year:2022}),null);
 assert.equal(studio.select({brand:'Audi',model:'A4',year:2026}),null);
 assert.equal(studio.select({brand:'Audi',model:'A6 e-tron',year:2025}),null);
 assert.equal(catalog.ranges('BMW','320d').length,7);
 assert.equal(catalog.ranges('Mercedes-Benz','C200').length,5);
});
test('explicit valid overlapping generation wins; incompatible series or body never gets a sedan illustration',()=>{
 assert.equal(studio.select({brand:'BMW',model:'3er',year:2019,series:'F30 · 2011–2019'}).code,'F30');
 for(const car of [{brand:'BMW',model:'3er',year:2022,series:'E46'},{brand:'BMW',model:'3er',year:2022,body:'Touring'},{vehicle:'Audi A4 Avant',year:2020},{brand:'Mercedes-Benz',model:'C-Klasse',year:2018,body:'Coupé'},{brand:'BMW',model:'3er',year:2022,series:'unknown'}])assert.equal(art.render(car),'');
});
test('each declared generation maps to an existing studio atlas and colors stay sanitized',()=>{
 const codes=new Set();for(const f of Object.values(generations.families))for(const [code,year]of f.rows){const markup=studio.render({brand:f.brand,model:f.model,series:code,year,color:'Weiß'});assert.ok(markup.includes('data-studio-generation="'+code+'"'));assert.ok(fs.existsSync(markup.match(/href="([^"]+)"/)[1]));codes.add(code);}
 assert.equal(codes.size,35);assert.notEqual(studio.color('Silber'),studio.color('Grau'));assert.notEqual(studio.color('Weiß'),studio.color('Schwarz'));assert.equal(studio.color('#123abc'),'#123abc');assert.equal(studio.color('"/><script>bad</script>'),'#bfc6cc');
});
test('three new host-selectable backgrounds exist and invalid values remain rejected',()=>{
 for(const id of ['skyline','alpine','hangar']){assert.equal(scene.background(id),id);assert.ok(fs.existsSync(scene.backgrounds.find(b=>b.id===id).image));}
 assert.equal(scene.backgrounds.length,6);assert.equal(scene.validBackground('../secret'),false);
});
