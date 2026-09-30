/* European model generations. Sources and regional limits: DESIGN-NOTES.md. */
(function(root) {
  'use strict';
  const generations = {
    'ford|focus': [['I',1998,2004],['II',2004,2011],['III',2011,2018],['IV',2018,null]],
    'volkswagen|golf': [['VI',2008,2012],['VII',2012,2019],['VIII',2019,null]],
    'bmw|3er': [['E36',1990,2000],['E46',1997,2006]],
    'bmw|e36': [['E36',1990,2000]],
    'bmw|e46': [['E46',1997,2006]]
  };
  const normalize = value => String(value || '').trim().toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function ranges(brand, model) {
    return (generations[normalize(brand)+'|'+normalize(model)] || []).map(([name,from,to]) => ({
      name,from,to,label:name+' · '+(to ? from+'–'+to : 'ab '+from)
    }));
  }
  function shape(car={}) {
    const body=normalize(car.body || car.bodyType || car.body_type);
    if (/touring|kombi|estate|wagon/.test(body)) return 'wagon';
    if (/suv|pickup/.test(body)) return 'suv';
    if (/van|bus/.test(body)) return 'van';
    if (/coupe|cabrio|roadster/.test(body)) return 'coupe';
    if (/compact|kompakt|schragheck/.test(body)) return 'hatch';
    if (/limousine|sedan/.test(body)) return 'sedan';
    const name=normalize((car.brand||'')+' '+(car.model||car.vehicle||''));
    if (/touring|variant|turnier|avant|kombi|\bv[69]0\b/.test(name)) return 'wagon';
    if (/transit|caddy|transporter|touran|zafira|berlingo|v-klasse|ducato/.test(name)) return 'van';
    if (/\bx[1-7]\b|\bq[2-8]\b|suv|tiguan|touareg|kuga|puma|tucson|sportage|qashqai|duster|xc[469]0|range rover|defender|model [xy]|gl[abces]|rav4|kodiaq|karoq|captur|juke|t-roc|kamiq|crossover/.test(name)) return 'suv';
    if (/911|cayman|boxster|mustang|\btt\b|\bz[34]\b|mx-5|supra|coupe|cabrio/.test(name)) return 'coupe';
    if (/focus|fiesta|golf|polo|corsa|astra|a[13]\b|1er|clio|megane|i[123]0|yaris|civic|cooper|leon|ibiza|fabia|208|308|500|sandero|id.3|smart|twingo|aygo|\bup\b/.test(name)) return 'hatch';
    return 'sedan';
  }

  // Reuse the existing transparent twelve-car atlas. Ground points are measured
  // per row so every car's tyres finish on the same rendering baseline.
  const templates=[
    ['Kleinwagen',0,54],['Kompaktwagen',384,54],['Klassische Limousine',768,54],['Moderne Limousine',1152,54],
    ['Sportwagen',0,374],['Sportcoupé',384,374],['Kombi',768,374],['SUV',1152,374],
    ['Crossover',0,687],['Van',384,687],['Stadtauto',768,687],['Roadster',1152,687]
  ].map(([label,x,y],index)=>({label,x,y,index}));
  function illustration(car={}) {
    const name=normalize([car.brand,car.model,car.vehicle,car.series].filter(Boolean).join(' '));
    const type=shape(car);
    if(type==='wagon')return templates[6];
    if(type==='van')return templates[9];
    if(type==='suv')return templates[/puma|juke|captur|t-roc|kamiq|crossover/.test(name)?8:7];
    if(type==='coupe')return templates[/boxster|cabrio|roadster|mx-5|\bz[34]\b/.test(name)?11:/911|cayman/.test(name)?4:5];
    if(type==='hatch')return templates[/smart|twingo|aygo|up!?\b|\b500\b/.test(name)?10:/corsa|fiesta|polo|clio|yaris|208|ibiza|fabia|sandero/.test(name)?0:1];
    return templates[/e36|e46|199[0-9]/.test(name)?2:3];
  }

  function yearError(year, generation, now=new Date().getFullYear()) {
    if (!year) return '';
    if (!/^\d{4}$/.test(String(year)) || Number(year)<1900 || Number(year)>now+1) return 'Bitte ein gültiges Baujahr angeben.';
    if (generation && (Number(year)<generation.from || (generation.to && Number(year)>generation.to))) return 'Das Baujahr passt nicht zur gewählten Baureihe. Bitte Auswahl prüfen.';
    return '';
  }
  const api={ranges,shape,illustration,yearError};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.vehicleCatalog=api;
})(typeof window==='undefined'?{}:window);
