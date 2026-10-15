/* European generation ranges, representative body styles, not individual facelifts. */
(function(root){
 'use strict';
 const families={
  bmw3:{brand:'BMW',model:'3er',rows:[['E21',1975,1983],['E30',1982,1994],['E36',1990,2000],['E46',1997,2006],['E90',2005,2013],['F30',2011,2019],['G20',2019,null]]},
  bmw5:{brand:'BMW',model:'5er',rows:[['E12',1972,1981],['E28',1981,1988],['E34',1987,1996],['E39',1995,2004],['E60',2003,2010],['F10',2010,2017],['G30',2017,2023],['G60',2023,null]]},
  m2:{brand:'BMW',model:'M2',rows:[['F87',2016,2021],['G87',2023,null]]},
  mercedesc:{brand:'Mercedes-Benz',model:'C-Klasse',rows:[['W202',1993,2000],['W203',2000,2007],['W204',2007,2014],['W205',2014,2021],['W206',2021,null]]},
  mercedes190:{brand:'Mercedes-Benz',model:'190',rows:[['W201',1982,1993]]},
  audi4:{brand:'Audi',model:'A4',rows:[['B5',1994,2001],['B6',2000,2004],['B7',2004,2008],['B8',2007,2015],['B9',2015,2024]]},
  audi6:{brand:'Audi',model:'A6',rows:[['C4',1994,1997],['C5',1997,2004],['C6',2004,2011],['C7',2011,2018],['C8',2018,2025],['C9',2025,null]]},
  audi80:{brand:'Audi',model:'80',rows:[['B4',1991,1996]]}
 };
 // Additional body-specific ranges. Dates refer to European production, not registration.
 Object.assign(families,{
  bmw1:{"brand":"BMW","model":"1er","body":"Compact","rows":[["E87",2004,2011,["bmw-compact",0]],["F20",2011,2019,["bmw-compact",1]],["F40",2019,2024,["bmw-compact",2]],["F70",2024,null,["bmw-compact",3]]]},
  bmw1three:{"brand":"BMW","model":"1er 3-Türer","body":"Compact","rows":[["E81",2007,2012,["bmw-x-grand",10]],["F21",2012,2019,["bmw-x-grand",11]]]},
  bmw1coupe:{"brand":"BMW","model":"1er Coupé","body":"Coupé","rows":[["E82",2007,2013,["bmw-x-compact",11]]]},
  bmw1cabrio:{"brand":"BMW","model":"1er Cabrio","body":"Cabrio","rows":[["E88",2008,2013,["bmw-one-cabrio",0]]]},
  bmw2:{"brand":"BMW","model":"2er","body":"Coupé","rows":[["F22",2013,2021,["bmw-compact",4]],["G42",2021,null,["bmw-compact",5]]]},
  bmw2gc:{"brand":"BMW","model":"2er Gran Coupé","body":"Limousine","rows":[["F44",2019,2024,["bmw-compact",6]],["F74",2024,null,["bmw-compact",7]]]},
  bmw2active:{"brand":"BMW","model":"2er Active Tourer","body":"Van","rows":[["F45",2014,2021,["bmw-compact",8]],["U06",2021,null,["bmw-compact",9]]]},
  bmw2gran:{"brand":"BMW","model":"2er Gran Tourer","body":"Van","rows":[["F46",2015,2022,["bmw-compact",10]]]},
  bmw2cabrio:{"brand":"BMW","model":"2er Cabrio","body":"Cabrio","rows":[["F23",2014,2021,["bmw-compact",11]]]},
  bmw4:{"brand":"BMW","model":"4er","body":"Coupé","rows":[["F32",2013,2020,["bmw-grand",0]],["G22",2020,null,["bmw-grand",1]]]},
  bmw4gc:{"brand":"BMW","model":"4er Gran Coupé","body":"Limousine","rows":[["F36",2014,2021,["bmw-grand",2]],["G26",2021,null,["bmw-grand",3]]]},
  bmw4cabrio:{"brand":"BMW","model":"4er Cabrio","body":"Cabrio","rows":[["F33",2013,2020,["bmw-grand",4]],["G23",2020,null,["bmw-grand",5]]]},
  bmw6:{"brand":"BMW","model":"6er","body":"Coupé","rows":[["E24",1976,1989,["bmw-grand",6]],["E63",2003,2010,["bmw-grand",7]],["F13",2011,2018,["bmw-grand",8]]]},
  bmw6gc:{"brand":"BMW","model":"6er Gran Coupé","body":"Limousine","rows":[["F06",2012,2018,["bmw-grand",9]]]},
  bmw6gt:{"brand":"BMW","model":"6er Gran Turismo","body":"Limousine","rows":[["G32",2017,2023,["bmw-grand",10]]]},
  bmw6cabrio:{"brand":"BMW","model":"6er Cabrio","body":"Cabrio","rows":[["E64",2004,2010,["bmw-luxury",11]],["F12",2011,2018,["bmw-grand",11]]]},
  bmw7:{"brand":"BMW","model":"7er","body":"Limousine","rows":[["E23",1977,1986,["bmw-luxury",0]],["E32",1986,1994,["bmw-luxury",1]],["E38",1994,2001,["bmw-luxury",2]],["E65",2001,2008,["bmw-luxury",3]],["F01",2008,2015,["bmw-luxury",4]],["G11",2015,2022,["bmw-luxury",5]],["G70",2022,null,["bmw-luxury",6]]]},
  bmw8:{"brand":"BMW","model":"8er","body":"Coupé","rows":[["E31",1989,1999,["bmw-luxury",7]],["G15",2018,null,["bmw-luxury",8]]]},
  bmw8gc:{"brand":"BMW","model":"8er Gran Coupé","body":"Limousine","rows":[["G16",2019,null,["bmw-luxury",9]]]},
  bmw8cabrio:{"brand":"BMW","model":"8er Cabrio","body":"Cabrio","rows":[["G14",2018,null,["bmw-luxury",10]]]},
  bmwx1:{"brand":"BMW","model":"X1","body":"SUV","rows":[["E84",2009,2015,["bmw-x-compact",0]],["F48",2015,2022,["bmw-x-compact",1]],["U11",2022,null,["bmw-x-compact",2]]]},
  bmwx2:{"brand":"BMW","model":"X2","body":"SUV","rows":[["F39",2018,2023,["bmw-x-compact",3]],["U10",2023,null,["bmw-x-compact",4]]]},
  bmwx3:{"brand":"BMW","model":"X3","body":"SUV","rows":[["E83",2003,2010,["bmw-x-compact",5]],["F25",2010,2017,["bmw-x-compact",6]],["G01",2017,2024,["bmw-x-compact",7]],["G45",2024,null,["bmw-x-compact",8]]]},
  bmwx4:{"brand":"BMW","model":"X4","body":"SUV","rows":[["F26",2014,2018,["bmw-x-compact",9]],["G02",2018,2025,["bmw-x-compact",10]]]},
  bmwx5:{"brand":"BMW","model":"X5","body":"SUV","rows":[["E53",1999,2006,["bmw-x-grand",0]],["E70",2006,2013,["bmw-x-grand",1]],["F15",2013,2018,["bmw-x-grand",2]],["G05",2018,null,["bmw-x-grand",3]]]},
  bmwx6:{"brand":"BMW","model":"X6","body":"SUV","rows":[["E71",2008,2014,["bmw-x-grand",4]],["F16",2014,2019,["bmw-x-grand",5]],["G06",2019,null,["bmw-x-grand",6]]]},
  bmwx7:{"brand":"BMW","model":"X7","body":"SUV","rows":[["G07",2018,null,["bmw-x-grand",7]]]},
  bmwxm:{"brand":"BMW","model":"XM","body":"SUV","rows":[["G09",2022,null,["bmw-x-grand",8]]]},
  bmwix:{"brand":"BMW","model":"iX","body":"SUV","rows":[["I20",2021,null,["bmw-x-grand",9]]]},
  miniclassic:{"brand":"Mini","model":"Classic","body":"Compact","rows":[["Mk I",1959,1967,["mini-hatch",0]],["Mk II",1967,1969,["mini-hatch",1]],["Mk III–VI",1969,1996,["mini-hatch",2]],["Mk VII",1996,2000,["mini-hatch",3]]]},
  minicooper:{"brand":"Mini","model":"Cooper","body":"Compact","rows":[["R50",2001,2006,["mini-hatch",4]],["R56",2006,2013,["mini-hatch",5]],["F56",2013,2024,["mini-hatch",6]],["F66",2024,null,["mini-hatch",7]]]},
  minielectric:{"brand":"Mini","model":"Cooper Electric","body":"Compact","rows":[["J01",2023,null,["mini-hatch",8]]]},
  mini5door:{"brand":"Mini","model":"Cooper 5-Türer","body":"Compact","rows":[["F55",2014,2024,["mini-hatch",9]],["F65",2024,null,["mini-hatch",10]]]},
  minicabrio:{"brand":"Mini","model":"Cabrio","body":"Cabrio","rows":[["R52",2004,2008,["mini-hatch",11]],["R57",2009,2015,["mini-range",0]],["F57",2015,2024,["mini-range",1]],["F67",2024,null,["mini-range",2]]]},
  miniclubman:{"brand":"Mini","model":"Clubman","body":"Touring","rows":[["R55",2007,2014,["mini-range",3]],["F54",2015,2024,["mini-range",4]]]},
  minicountryman:{"brand":"Mini","model":"Countryman","body":"SUV","rows":[["R60",2010,2016,["mini-range",5]],["F60",2016,2023,["mini-range",6]],["U25",2023,null,["mini-range",7]]]},
  minicoupe:{"brand":"Mini","model":"Coupé","body":"Coupé","rows":[["R58",2011,2015,["mini-range",8]]]},
  miniroadster:{"brand":"Mini","model":"Roadster","body":"Roadster","rows":[["R59",2012,2015,["mini-range",9]]]},
  minipaceman:{"brand":"Mini","model":"Paceman","body":"SUV","rows":[["R61",2013,2016,["mini-range",10]]]},
  miniaceman:{"brand":"Mini","model":"Aceman","body":"SUV","rows":[["J05",2024,null,["mini-range",11]]]},
  audi1:{"brand":"Audi","model":"A1","body":"Compact","rows":[["8X",2010,2018,["audi-small",0]],["GB",2018,null,["audi-small",1]]]},
  audi2:{"brand":"Audi","model":"A2","body":"Compact","rows":[["8Z",1999,2005,["audi-small",2]]]},
  audi3:{"brand":"Audi","model":"A3","body":"Compact","rows":[["8L",1996,2003,["audi-small",3]],["8P",2003,2013,["audi-small",4]],["8V",2012,2020,["audi-small",5]],["8Y",2020,null,["audi-small",6]]]},
  audi5:{"brand":"Audi","model":"A5","body":"Coupé","rows":[["8T",2007,2016,["audi-small-detail",7]],["F5",2016,2024,["audi-small",8]]]},
  audi5sedan:{"brand":"Audi","model":"A5 Limousine","body":"Limousine","rows":[["B10",2024,null,["audi-small",9]]]},
  audi7:{"brand":"Audi","model":"A7","body":"Limousine","rows":[["4G",2010,2018,["audi-small",10]],["4K",2018,2025,["audi-small",11]]]},
  audi8:{"brand":"Audi","model":"A8","body":"Limousine","rows":[["D2",1994,2002,["audi-grand",0]],["D3",2002,2010,["audi-grand",1]],["D4",2010,2017,["audi-grand",2]],["D5",2017,null,["audi-grand",3]]]},
  audiq2:{"brand":"Audi","model":"Q2","body":"SUV","rows":[["GA",2016,null,["audi-suv",0]]]},
  audiq3:{"brand":"Audi","model":"Q3","body":"SUV","rows":[["8U",2011,2018,["audi-suv",1]],["F3",2018,2025,["audi-suv",2]],["FJ",2025,null,["audi-suv",3]]]},
  audiq4:{"brand":"Audi","model":"Q4 e-tron","body":"SUV","rows":[["F4",2021,null,["audi-suv",4]]]},
  audiq5:{"brand":"Audi","model":"Q5","body":"SUV","rows":[["8R",2008,2017,["audi-suv",5]],["FY",2017,2024,["audi-suv",6]],["GU",2024,null,["audi-suv",7]]]},
  audiq6:{"brand":"Audi","model":"Q6 e-tron","body":"SUV","rows":[["GF",2024,null,["audi-suv",8]]]},
  audiq7:{"brand":"Audi","model":"Q7","body":"SUV","rows":[["4L",2005,2015,["audi-suv",9]],["4M",2015,null,["audi-suv",10]]]},
  audiq8:{"brand":"Audi","model":"Q8","body":"SUV","rows":[["4M8",2018,null,["audi-suv",11]]]},
  audietron:{"brand":"Audi","model":"e-tron","body":"SUV","rows":[["GE",2018,2022,["audi-grand",4]]]},
  audiq8etron:{"brand":"Audi","model":"Q8 e-tron","body":"SUV","rows":[["GE",2022,2025,["audi-grand",5]]]},
  auditt:{"brand":"Audi","model":"TT","body":"Coupé","rows":[["8N",1998,2006,["audi-grand",6]],["8J",2006,2014,["audi-grand-detail",6]],["8S",2014,2023,["audi-grand",8]]]},
  audir8:{"brand":"Audi","model":"R8","body":"Coupé","rows":[["42",2006,2015,["audi-grand",9]],["4S",2015,2024,["audi-grand",10]]]},
  audigt:{"brand":"Audi","model":"e-tron GT","body":"Limousine","rows":[["FW",2021,null,["audi-grand",11]]]},
  audi6etron:{"brand":"Audi","model":"A6 e-tron","body":"Limousine","rows":[["GH",2024,null,["audi-more",11]]]},
  audi50:{"brand":"Audi","model":"50","body":"Compact","rows":[["86",1974,1978,["audi-classic",0]]]},
  audi80early:{"brand":"Audi","model":"80 Classic","body":"Limousine","rows":[["B1",1972,1978,["audi-classic",1]],["B2",1978,1986,["audi-classic",2]],["B3",1986,1991,["audi-classic",3]]]},
  audi90:{"brand":"Audi","model":"90","body":"Limousine","rows":[["81",1984,1986,["audi-classic",4]],["89",1987,1991,["audi-classic",5]]]},
  audi100:{"brand":"Audi","model":"100","body":"Limousine","rows":[["C1",1968,1976,["audi-classic",6]],["C2",1976,1982,["audi-classic",7]],["C3",1982,1991,["audi-classic",8]],["C4",1990,1994,["audi-classic",9]]]},
  audi200:{"brand":"Audi","model":"200","body":"Limousine","rows":[["43",1979,1982,["audi-classic",10]],["44",1983,1991,["audi-classic",11]]]},
  audiv8:{"brand":"Audi","model":"V8","body":"Limousine","rows":[["D1",1988,1994,["audi-more",0]]]},
  audiquattro:{"brand":"Audi","model":"quattro","body":"Coupé","rows":[["85",1980,1991,["audi-more",1]]]},
  audi3sedan:{"brand":"Audi","model":"A3 Limousine","body":"Limousine","rows":[["8V",2013,2020,["audi-more",2]],["8Y",2020,null,["audi-more",3]]]},
  audi5sportback:{"brand":"Audi","model":"A5 Sportback","body":"Limousine","rows":[["8T",2009,2016,["audi-more-detail",5]],["F5",2016,2024,["audi-more",5]]]},
  audi4avant:{"brand":"Audi","model":"A4 Avant","body":"Touring","rows":[["B9",2015,2024,["audi-more",6]]]},
  audi6avant:{"brand":"Audi","model":"A6 Avant","body":"Touring","rows":[["C8",2018,2025,["audi-more",7]]]},
  audiq3sportback:{"brand":"Audi","model":"Q3 Sportback","body":"SUV","rows":[["F3",2019,2025,["audi-more",8]]]},
  audiq5sportback:{"brand":"Audi","model":"Q5 Sportback","body":"SUV","rows":[["FY",2020,2024,["audi-more",9]]]},
  audi5cabrio:{"brand":"Audi","model":"A5 Cabrio","body":"Cabrio","rows":[["F5",2016,2024,["audi-more",10]]]}
 });
 const normalize=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const compact=value=>normalize(value).replace(/[^a-z0-9]/g,'');
 const codeMatch=(text,code)=>new RegExp('(?:^|[^a-z0-9])'+normalize(code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z0-9])').test(text);
 function bodyType(value){
  const text=normalize(value);
  if(/cabrio|convertible|roadster/.test(text))return 'open';
  if(/touring|kombi|estate|wagon|avant/.test(text))return 'wagon';
  if(/suv|crossover/.test(text))return 'suv';
  if(/van|mpv|tourer/.test(text))return 'van';
  if(/gran.?coupe|limousine|sedan|fastback/.test(text))return 'sedan';
  if(/coupe/.test(text))return 'coupe';
  if(/compact|kompakt|hatch|schragheck/.test(text))return 'hatch';
  return '';
 }
 function identify(car={}){
  const name=normalize(car.model||car.vehicle),brand=normalize(car.brand),year=Number(car.year||car.model_year);
  const make=/bmw/.test(brand+' '+name)?'BMW':/mercedes/.test(brand+' '+name)?'Mercedes-Benz':/audi/.test(brand+' '+name)?'Audi':/mini/.test(brand+' '+name)?'Mini':null;
  if(!make)return null;
  const model=name.replace(/^(?:bmw|audi|mini|mercedes(?:-benz)?)\s*/,'').trim();
  const entries=Object.entries(families).filter(([,f])=>f.brand===make);
  const direct=entries.find(([,f])=>f.rows.some(([code])=>compact(model)===compact(code)));
  if(direct)return direct[0];
  let canonical=model;
  if(make==='BMW'){
   // Engine badges belong to a series; keep derivative words such as Active Tourer.
   canonical=canonical.replace(/^([1-8])\d{2}[a-z]*(?=\s|$)/,'$1er');
   canonical=canonical.replace(/^([1-8])[- ]series\b/,'$1er');
   canonical=canonical.replace(/\bgran coupe\b/,'gran coupé').replace(/\b([35])-turer\b/,'$1-Türer');
  }
  if(make==='Mercedes-Benz'){
   if(/^(?:190[ed]?|w201)(?:\s|$)/.test(model))return 'mercedes190';
   if(/^c\s?\d{3}[a-z]*(?:\s|$)|^c[- ]?klasse/.test(model)||families.mercedesc.rows.some(([code])=>codeMatch(model,code)))return 'mercedesc';
  }
  if(make==='Mini'){
   canonical=canonical.replace(/^one\b/,'cooper').replace(/^cooper s\b/,'cooper');
   canonical=canonical.replace(/^(?:cooper )?(?:convertible|cabrio)\b/,'cabrio');
   canonical=canonical.replace(/\b5[- ]?(?:door|turer)\b/,'5-Türer');
  }
  // Longest explicit derivative wins before a base model (e.g. Q8 e-tron vs Q8).
  const found=entries.sort((a,b)=>b[1].model.length-a[1].model.length).find(([,f])=>{
   const m=normalize(f.model);return normalize(canonical)===m||normalize(canonical).startsWith(m+' ');
  });
  if(!found)return null;
  let key=found[0];
  const series=normalize(car.series);
  // An explicit chassis code can refine an otherwise generic model name.
  if(series&&normalize(canonical)===normalize(found[1].model)&&!found[1].rows.some(([code])=>codeMatch(series,code))){
   const base=found[1].model;
   const variant=entries.find(([,f])=>f.model.startsWith(base+' ')&&f.rows.some(([code])=>codeMatch(series,code)));
   if(variant)key=variant[0];
  }
  const body=bodyType(car.body||car.body_type||car.bodyType);
  const a5Sedan=codeMatch(series,'F5')||codeMatch(series,'8T')?'audi5sportback':codeMatch(series,'B10')||year>=2024?'audi5sedan':'audi5sportback';
  const derivatives={bmw1:{coupe:'bmw1coupe',open:'bmw1cabrio'},bmw2:{open:'bmw2cabrio',sedan:'bmw2gc'},bmw4:{open:'bmw4cabrio',sedan:'bmw4gc'},bmw6:{open:'bmw6cabrio',sedan:'bmw6gc'},bmw8:{open:'bmw8cabrio',sedan:'bmw8gc'},minicooper:{open:'minicabrio'},audi3:{sedan:'audi3sedan'},audi5:{open:'audi5cabrio',sedan:a5Sedan},audi4:{wagon:'audi4avant'},audi6:{wagon:'audi6avant'}};
  if(derivatives[key]?.[body])key=derivatives[key][body];
  // Historic Audi 80 is one model name across B1–B4.
  if(key==='audi80'&&(year&&year<1991||families.audi80early.rows.some(([code])=>codeMatch(series,code))))key='audi80early';
  return key;
 }
 function ranges(car){
  const family=identify(car);if(!family)return [];
  const f=families[family],model=normalize(car.model||car.vehicle);
  const exact=f.rows.filter(([code])=>codeMatch(model,code));
  const rows=family==='audi80'?[...families.audi80early.rows,...f.rows]:family==='audi5sportback'&&/^(?:audi )?a5$/.test(model)?[...f.rows,...families.audi5sedan.rows]:f.rows;
  return (exact.length?exact:rows).map(([name,from,to])=>({name,from,to,label:name+' · '+(to?from+'–'+to:'ab '+from)}));
 }
 function resolve(car={}){
  const family=identify(car);if(!family)return null;
  const f=families[family],series=normalize(car.series),model=normalize(car.model||car.vehicle),rawYear=car.year||car.model_year,year=Number(rawYear);
  const explicit=f.rows.find(([code])=>codeMatch(series,code))||f.rows.find(([code])=>codeMatch(model,code));
  if(series&&!explicit)return null;
  if(rawYear&&(!Number.isInteger(year)||year<1900||year>new Date().getFullYear()+1))return null;
  const row=explicit||f.rows.filter(([,from,to])=>year>=from&&(!to||year<=to)).at(-1);
  if(!row||year&&(year<row[1]||row[2]&&year>row[2]))return null;
  return {family,code:row[0],from:row[1],to:row[2],brand:f.brand,model:f.model,body:f.body||(family==='m2'||row[0]==='E21'?'Coupé':'Limousine'),asset:row[3]||null};
 }
 const api={families,identify,ranges,resolve,bodyType};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleGenerations=api;
})(typeof window==='undefined'?{}:window);
