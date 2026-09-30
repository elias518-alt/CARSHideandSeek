/* Local vehicle suggestions; no external search or account data is sent. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.vehicleSearch=api;
})(typeof window==='undefined'?{}:window,function(){
  'use strict';
const brands = `Abarth|Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|BYD|Cadillac|Chevrolet|Chrysler|Citroën|Cupra|Dacia|Daewoo|Daihatsu|Dodge|DS|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hyundai|Infiniti|Isuzu|Jaguar|Jeep|Kia|Lada|Lamborghini|Lancia|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|MG|Mini|Mitsubishi|Nissan|Opel|Peugeot|Polestar|Porsche|Ram|Renault|Rolls-Royce|Saab|Seat|Škoda|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|Volvo`.split('|');
const models = {
  'Audi':['A1','A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','TT','e-tron'],
  'BMW':['1er','2er','3er','4er','5er','6er','7er','8er','E30','E36','E46','E90','F30','G20','G31','M2','M3','M4','M5','X1','X3','X5','X6','X7','Z3','Z4'],
  'Mercedes-Benz':['A-Klasse','B-Klasse','C-Klasse','E-Klasse','S-Klasse','CLA','CLS','GLA','GLB','GLC','GLE','GLS','G-Klasse','V-Klasse','AMG GT'],
  'Volkswagen':['up!','Polo','Golf','Passat','Arteon','T-Cross','T-Roc','Tiguan','Touareg','Touran','Caddy','Transporter','ID.3','ID.4','ID.5','ID.7'],
  'Porsche':['911','718 Cayman','718 Boxster','Panamera','Macan','Cayenne','Taycan'],
  'Opel':['Corsa','Astra','Insignia','Mokka','Crossland','Grandland','Zafira'],
  'Ford':['Fiesta','Focus','Mondeo','Kuga','Puma','Mustang','Ranger','Transit'],
  'Toyota':['Aygo','Yaris','Corolla','Prius','Camry','RAV4','C-HR','Supra','Land Cruiser'],
  'Škoda':['Fabia','Scala','Octavia','Superb','Kamiq','Karoq','Kodiaq','Enyaq'],
  'Seat':['Ibiza','Leon','Arona','Ateca','Tarraco'],
  'Cupra':['Born','Formentor','Leon','Ateca','Tavascan'],
  'Hyundai':['i10','i20','i30','Kona','Tucson','Santa Fe','Ioniq 5','Ioniq 6'],
  'Kia':['Picanto','Rio','Ceed','XCeed','Sportage','Sorento','EV3','EV6','EV9'],
  'Renault':['Clio','Megane','Captur','Austral','Scenic','Twingo','R5'],
  'Peugeot':['208','308','408','508','2008','3008','5008'],
  'Fiat':['500','Panda','Tipo','Punto','Ducato'],
  'Honda':['Civic','Jazz','Accord','HR-V','CR-V','e'],
  'Mazda':['2','3','6','CX-3','CX-5','CX-30','MX-5'],
  'Nissan':['Micra','Juke','Qashqai','X-Trail','Leaf','GT-R'],
  'Volvo':['V40','V60','V90','S60','S90','XC40','XC60','XC90'],
  'Tesla':['Model 3','Model Y','Model S','Model X'],
  'Dacia':['Sandero','Duster','Jogger','Spring'],
  'Citroën':['C1','C3','C4','C5','Berlingo'],
  'Mini':['Cooper','Clubman','Countryman'],
  'Land Rover':['Defender','Discovery','Range Rover','Range Rover Sport','Evoque']
};

  const normalize=value=>String(value||'').trim().toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const compact=value=>normalize(value).replace(/[^a-z0-9]/g,'');
  const brandAliases={'vw':'Volkswagen','mercedes':'Mercedes-Benz','skoda':'Škoda'};
  const bmwSeries={'E30':'3er','E36':'3er','E46':'3er','E90':'3er','F30':'3er','G20':'3er','G31':'5er'};
  function search(value){
    const text=String(value||'').trim();
    const yearMatch=text.match(/(?:^|\D)((?:19|20)\d{2})(?=$|\D)/);
    const year=yearMatch?.[1]||'';
    const vehicleText=(year?text.replace(year,''):text).replace(/\b(?:baujahr|jahr|bj\.?)[\s:]*/ig,'').trim();
    const query=compact(vehicleText);
    const names=[...brands.map(brand=>({name:brand,brand})),...Object.entries(brandAliases).map(([name,brand])=>({name,brand}))]
      .sort((a,b)=>compact(b.name).length-compact(a.name).length);
    const named=names.find(item=>query.startsWith(compact(item.name)));
    const modelQuery=named?query.slice(compact(named.name).length):query;
    const output=[],seen=new Set();
    for(const brand of brands){
      if(named&&brand!==named.brand)continue;
      for(const entry of models[brand]||[]){
        const series=brand==='BMW'?Object.keys(bmwSeries).find(name=>name.toLowerCase()===entry.toLowerCase()):'';
        if(series&&!modelQuery.includes(series.toLowerCase()))continue;
        const model=series?bmwSeries[series]:entry;
        const candidate=named?compact(entry):compact(brand+' '+entry);
        if(query&&!candidate.includes(named?modelQuery:query)&&!(series&&modelQuery===compact(series)))continue;
        const key=brand+'|'+model+'|'+(series||'');
        if(seen.has(key))continue;seen.add(key);
        output.push({brand,model,year,series:series||'',exact:!!modelQuery&&(modelQuery===compact(entry)||(!named&&query===compact(model))),
          label:brand+' '+model+(series?' · '+series:''),manual:false});
      }
    }
    // Also let a model be found without knowing its manufacturer.
    if(!named&&query&&output.length===0){
      for(const [brand,entries]of Object.entries(models)){
        for(const model of entries){
          if(compact(model)!==query)continue;
          const series=brand==='BMW'&&bmwSeries[model]?model:'';
          output.push({brand,model:series?bmwSeries[model]:model,year,series,exact:true,label:brand+' '+(series?bmwSeries[model]+' · '+series:model),manual:false});
        }
      }
    }
    if(output.length===0&&vehicleText){
      let brand='',model='';
      if(named){
        brand=named.brand;
        const nameLength=normalize(named.name).length;
        model=vehicleText.slice(nameLength).trim().replace(/^[\s-]+/,'');
      }else{
        const parts=vehicleText.split(/\s+/);brand=parts.shift();model=parts.join(' ');
      }
      if(brand&&model)output.push({brand,model,year,series:'',exact:true,label:brand+' '+model,manual:true});
    }
    return output.sort((a,b)=>Number(b.exact)-Number(a.exact)).slice(0,8);
  }
  return {search};
});

