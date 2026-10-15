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
 const normalize=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const codeMatch=(text,code)=>new RegExp('(?:^|[^a-z0-9])'+code.toLowerCase()+'(?:$|[^a-z0-9])').test(text);
 function identify(car={}){
  const brand=normalize(car.brand),model=normalize(car.model||car.vehicle),name=brand+' '+model;
  if(/bmw/.test(name)){
   if(/\bm2\b/.test(model))return 'm2';
   if(/\b(?:3er|3.series|3[0-9]{2}[a-z]*)\b/.test(model))return 'bmw3';
   if(/\b(?:5er|5.series|5[0-9]{2}[a-z]*)\b/.test(model))return 'bmw5';
   for(const key of ['bmw3','bmw5'])if(families[key].rows.some(([code])=>codeMatch(model,code)))return key;
  }
  if(/mercedes/.test(name)){
   if(/\b190(?:e|d)?\b|\bw201\b/.test(model))return 'mercedes190';
   if(/\bc[- ]?klasse\b|\bc\s?\d{3}[a-z]*\b/.test(model)||families.mercedesc.rows.some(([code])=>codeMatch(model,code)))return 'mercedesc';
  }
  if(/audi/.test(name)){
   if(/\ba4\b/.test(model))return 'audi4';
   if(/\ba6\b/.test(model)&&!/e.tron/.test(model))return 'audi6';
   if(/\b80\b/.test(model))return 'audi80';
  }
  return null;
 }
 function ranges(car){const family=identify(car);if(!family)return [];const f=families[family],model=normalize(car.model||car.vehicle);const exact=f.rows.filter(([code])=>codeMatch(model,code));return (exact.length?exact:f.rows).map(([name,from,to])=>({name,from,to,label:name+' · '+(to?from+'–'+to:'ab '+from)}));}
 function resolve(car={}){
  const family=identify(car);if(!family)return null;
  const f=families[family],series=normalize(car.series),model=normalize(car.model||car.vehicle),year=Number(car.year||car.model_year);
  const explicit=f.rows.find(([code])=>codeMatch(series,code))||f.rows.find(([code])=>codeMatch(model,code));
  // A typed conflicting generation must not silently become another car.
  if(series&&!explicit)return null;
  if(year&&(!Number.isInteger(year)||year>new Date().getFullYear()+1))return null;
  const row=explicit||f.rows.filter(([,from,to])=>year>=from&&(!to||year<=to)).at(-1);
  if(!row||year&&(year<row[1]||row[2]&&year>row[2]))return null;
  return {family,code:row[0],from:row[1],to:row[2],brand:f.brand,model:f.model};
 }
 const api={families,identify,ranges,resolve};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.vehicleGenerations=api;
})(typeof window==='undefined'?{}:window);
