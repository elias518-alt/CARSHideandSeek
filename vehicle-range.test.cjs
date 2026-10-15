const {test}=require('node:test');const assert=require('node:assert/strict');
const generations=require('./vehicle-generations'),studio=require('./vehicle-studio'),search=require('./vehicle-search'),catalog=require('./vehicle-catalog');
test('BMW engine badges, body variants and all X models resolve to their own generations',()=>{
 const examples=[['118d',2017,'','F20'],['1er',2010,'Coupé','E82'],['1er',2011,'Cabrio','E88'],['218i',2017,'Coupé','F22'],['218i Active Tourer',2017,'Van','F45'],['2er Gran Coupé',2025,'Limousine','F74'],['2er Gran Tourer',2018,'Van','F46'],['420d',2022,'Coupé','G22'],['4er Gran Coupé',2022,'Limousine','G26'],['4er Cabrio',2018,'Cabrio','F33'],['530d',2018,'Limousine','G30'],['6er Gran Turismo',2020,'Limousine','G32'],['740i',1998,'Limousine','E38'],['840i',2021,'Coupé','G15']];
 for(const [model,year,body,code]of examples)assert.equal(studio.select({brand:'BMW',model,year,body})?.code,code,model);
 for(let n=1;n<=7;n++)assert.equal(studio.select({brand:'BMW',model:'X'+n,year:2022,body:'SUV'})?.family,'bmwx'+n);
 assert.equal(catalog.shape({brand:'BMW',model:'118d'}),'hatch');
 assert.equal(studio.select({brand:'BMW',model:'2er',year:2018,body:'Van'}),null,'unknown Tourer derivative must remain ambiguous');
 assert.equal(studio.select({brand:'BMW',model:'X5',year:2020,body:'Limousine'}),null);
});
test('MINI production gaps, classic, electric, open and long bodies stay distinct',()=>{
 for(const [model,year,code]of [['Classic',1963,'Mk I'],['Classic',1999,'Mk VII'],['Cooper',2004,'R50'],['Cooper',2025,'F66'],['Cooper Electric',2025,'J01'],['Cooper 5-Türer',2019,'F55'],['Cabrio',2019,'F57'],['Clubman',2019,'F54'],['Countryman',2025,'U25'],['Coupé',2013,'R58'],['Roadster',2013,'R59'],['Paceman',2014,'R61'],['Aceman',2025,'J05']])assert.equal(studio.select({brand:'MINI',model,year})?.code,code,model);
 assert.equal(studio.select({brand:'Mini',model:'Paceman',year:2020}),null);
 assert.equal(studio.select({brand:'Mini',model:'Clubman',year:2025}),null);
 assert.equal(studio.select({brand:'Mini',model:'Cooper',year:1998}),null);
});
test('Audi shared generation codes never confuse model, body or powertrain',()=>{
 const cars=[['A3',2017,'Compact','audi3','8V'],['A3',2017,'Limousine','audi3sedan','8V'],['A5',2025,'Limousine','audi5sedan','B10'],['A4 Avant',2020,'Touring','audi4avant','B9'],['A6 e-tron',2025,'Limousine','audi6etron','GH'],['Q8',2023,'SUV','audiq8','4M8'],['Q8 e-tron',2023,'SUV','audiq8etron','GE'],['TT',2001,'Coupé','auditt','8N'],['R8',2019,'Coupé','audir8','4S'],['80',1989,'Limousine','audi80early','B3'],['100',1992,'Limousine','audi100','C4']];
 for(const [model,year,body,family,code]of cars){const result=studio.select({brand:'Audi',model,year,body});assert.equal(result?.family,family,model);assert.equal(result?.code,code,model);}
 assert.notDeepEqual(studio.select({brand:'Audi',model:'A3',year:2017,body:'Limousine'}).asset,studio.select({brand:'Audi',model:'A3',year:2017,body:'Compact'}).asset);
 assert.equal(studio.select({brand:'Audi',model:'A4 Avant',year:2005}),null,'unillustrated older wagon does not become sedan');
});
test('new model and chassis choices appear in the actual search and make/model picker',()=>{
 for(const [query,model,code]of [['BMW F44 2021','2er Gran Coupé','F44'],['BMW X5 E70 2009','X5','E70'],['Mini R59 2014','Roadster','R59'],['Audi A3 Limousine 2018','A3 Limousine','']]){const choice=search.search(query).find(c=>c.exact);assert.equal(choice?.model,model,query);assert.equal(choice?.series,code,query);}
 for(const brand of ['BMW','Mini','Audi']){
  const choices=search.modelsForBrand(brand);
  for(const family of Object.values(generations.families).filter(f=>f.brand===brand)){
   assert.ok(choices.some(c=>c.model===family.model),family.model);
   for(const [series]of family.rows)assert.ok(choices.some(c=>c.model===family.model&&c.series===series),family.model+' '+series);
  }
 }
});
test('invalid year and conflicting explicit series cannot select an unrelated illustration',()=>{
 for(const car of [{brand:'BMW',model:'X3',year:'NaN'},{brand:'BMW',model:'7er',year:1990,series:'G70'},{brand:'Mini',model:'Cabrio',year:2010,series:'U25'},{brand:'Audi',model:'Q3',year:2020,series:'FY'}])assert.equal(studio.select(car),null);
 assert.equal(studio.select({brand:'BMW',model:'4er',year:2020,series:'F32'})?.code,'F32');
 assert.equal(studio.select({brand:'BMW',model:'4er',year:2020,series:'G22'})?.code,'G22');
});

test('an explicit A5 Sportback remains valid in the B10 transition year',()=>{
 assert.equal(studio.select({brand:'Audi',model:'A5',year:2024,body:'Limousine',series:'F5'})?.family,'audi5sportback');
 assert.equal(studio.select({brand:'Audi',model:'A5',year:2024,body:'Limousine',series:'B10'})?.family,'audi5sedan');
 assert.ok(catalog.ranges('Audi','A5','Limousine').some(r=>r.name==='B10'));
 assert.equal(studio.select({brand:'Audi',model:'80',model_year:1989})?.code,'B3');
});
