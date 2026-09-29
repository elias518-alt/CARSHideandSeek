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
    const body=normalize(car.body || car.bodyType);
    if (/touring|kombi|estate|wagon/.test(body)) return 'wagon';
    if (/suv|pickup/.test(body)) return 'suv';
    if (/van|bus/.test(body)) return 'van';
    if (/coupe|cabrio|roadster/.test(body)) return 'coupe';
    if (/compact|kompakt|schragheck/.test(body)) return 'hatch';
    if (/limousine|sedan/.test(body)) return 'sedan';
    const name=normalize((car.brand||'')+' '+(car.model||car.vehicle||''));
    if (/touring|variant|turnier|avant|kombi|\bv[69]0\b/.test(name)) return 'wagon';
    if (/transit|caddy|transporter|touran|zafira|berlingo|v-klasse|ducato/.test(name)) return 'van';
    if (/\bx[1-7]\b|\bq[2-8]\b|suv|tiguan|touareg|kuga|puma|tucson|sportage|qashqai|duster|xc[469]0|range rover|defender|model [xy]|gl[abces]|rav4|kodiaq|karoq/.test(name)) return 'suv';
    if (/911|cayman|boxster|mustang|\btt\b|\bz[34]\b|mx-5|supra|coupe|cabrio/.test(name)) return 'coupe';
    if (/focus|fiesta|golf|polo|corsa|astra|a[13]\b|1er|clio|megane|i[123]0|yaris|civic|cooper|leon|ibiza|fabia|208|308|500|sandero|id.3/.test(name)) return 'hatch';
    return 'sedan';
  }
  function yearError(year, generation, now=new Date().getFullYear()) {
    if (!year) return '';
    if (!/^\d{4}$/.test(String(year)) || Number(year)<1900 || Number(year)>now+1) return 'Bitte ein gültiges Baujahr angeben.';
    if (generation && (Number(year)<generation.from || (generation.to && Number(year)>generation.to))) return 'Das Baujahr passt nicht zur gewählten Baureihe. Bitte Auswahl prüfen.';
    return '';
  }
  const api={ranges,shape,yearError};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.vehicleCatalog=api;
})(typeof window==='undefined'?{}:window);
