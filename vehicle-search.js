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
  'BMW':['1er','116i','118i','120i','128ti','2er','218i','220i','230i','M2','3er','318i','320i','320d','330i','330d','340i','M3','4er','420i','420d','430i','430d','440i','M4','5er','520d','530i','530d','540i','M5','6er','7er','740i','750i','8er','840i','E30','E36','E46','E90','F30','G20','G31','X1','X2','X3','X4','X5','X6','X7','Z3','Z4'],
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

  // Simplified default body styles for the picker. They are UI defaults only:
  // users can still correct an ambiguous derivative under "Fahrzeugdetails".
  const modelBodies = {
    'BMW|116i':'Compact','BMW|118i':'Compact','BMW|120i':'Compact','BMW|128ti':'Compact',
    'BMW|218i':'Coupé','BMW|220i':'Coupé','BMW|230i':'Coupé','BMW|M2':'Coupé',
    'BMW|318i':'Limousine','BMW|320i':'Limousine','BMW|320d':'Limousine','BMW|330i':'Limousine','BMW|330d':'Limousine','BMW|340i':'Limousine','BMW|M3':'Limousine',
    'BMW|420i':'Coupé','BMW|420d':'Coupé','BMW|430i':'Coupé','BMW|430d':'Coupé','BMW|440i':'Coupé','BMW|M4':'Coupé',
    'BMW|520d':'Limousine','BMW|530i':'Limousine','BMW|530d':'Limousine','BMW|540i':'Limousine','BMW|M5':'Limousine',
    'BMW|740i':'Limousine','BMW|750i':'Limousine','BMW|840i':'Coupé',
    'BMW|X1':'SUV','BMW|X2':'SUV','BMW|X3':'SUV','BMW|X4':'SUV','BMW|X5':'SUV','BMW|X6':'SUV','BMW|X7':'SUV',
    'BMW|Z3':'Roadster','BMW|Z4':'Roadster',
    'Audi|A1':'Compact','Audi|A3':'Compact','Audi|A4':'Limousine','Audi|A5':'Coupé','Audi|A6':'Limousine','Audi|A7':'Limousine','Audi|A8':'Limousine',
    'Audi|Q2':'SUV','Audi|Q3':'SUV','Audi|Q5':'SUV','Audi|Q7':'SUV','Audi|Q8':'SUV','Audi|TT':'Coupé',
    'Mercedes-Benz|A-Klasse':'Compact','Mercedes-Benz|B-Klasse':'Compact','Mercedes-Benz|C-Klasse':'Limousine','Mercedes-Benz|E-Klasse':'Limousine','Mercedes-Benz|S-Klasse':'Limousine',
    'Mercedes-Benz|CLA':'Coupé','Mercedes-Benz|CLS':'Coupé','Mercedes-Benz|GLA':'SUV','Mercedes-Benz|GLB':'SUV','Mercedes-Benz|GLC':'SUV','Mercedes-Benz|GLE':'SUV','Mercedes-Benz|GLS':'SUV','Mercedes-Benz|G-Klasse':'SUV','Mercedes-Benz|V-Klasse':'Van',
    'Volkswagen|up!':'Compact','Volkswagen|Polo':'Compact','Volkswagen|Golf':'Compact','Volkswagen|Passat':'Touring','Volkswagen|Arteon':'Limousine','Volkswagen|T-Cross':'SUV','Volkswagen|T-Roc':'SUV','Volkswagen|Tiguan':'SUV','Volkswagen|Touareg':'SUV','Volkswagen|Touran':'Van','Volkswagen|Caddy':'Van','Volkswagen|Transporter':'Van',
    'Porsche|911':'Coupé','Porsche|718 Cayman':'Coupé','Porsche|718 Boxster':'Roadster','Porsche|Panamera':'Limousine','Porsche|Macan':'SUV','Porsche|Cayenne':'SUV','Porsche|Taycan':'Limousine',
    'Cupra|Born':'Compact','Cupra|Formentor':'SUV','Cupra|Leon':'Compact','Cupra|Ateca':'SUV','Cupra|Tavascan':'SUV',
    'Dacia|Sandero':'Compact','Dacia|Duster':'SUV','Dacia|Jogger':'Van','Dacia|Spring':'Compact',
    'Volvo|V40':'Compact','Volvo|V60':'Touring','Volvo|V90':'Touring','Volvo|S60':'Limousine','Volvo|S90':'Limousine','Volvo|XC40':'SUV','Volvo|XC60':'SUV','Volvo|XC90':'SUV',
    'Toyota|Aygo':'Compact','Toyota|Yaris':'Compact','Toyota|Corolla':'Compact','Toyota|Prius':'Compact','Toyota|Camry':'Limousine','Toyota|RAV4':'SUV','Toyota|C-HR':'SUV','Toyota|Supra':'Coupé','Toyota|Land Cruiser':'SUV'
  };

  const normalize=value=>String(value||'').trim().toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const compact=value=>normalize(value).replace(/[^a-z0-9]/g,'');
  const brandAliases={'vw':'Volkswagen','mercedes':'Mercedes-Benz','skoda':'Škoda'};
  const bmwSeries={'E30':'3er','E36':'3er','E46':'3er','E90':'3er','F30':'3er','G20':'3er','G31':'5er'};
  function canonicalBrand(value) {
    const raw=String(value||'').trim();
    const alias=brandAliases[normalize(raw)];
    if(alias)return alias;
    return brands.find(item=>normalize(item)===normalize(raw))||raw;
  }

  function brandsList(){
    return [...brands];
  }

  function modelsForBrand(value){
    const brand=canonicalBrand(value);
    return (models[brand]||[]).map(model=>{
      const series=brand==='BMW'&&bmwSeries[model]?model:'';
      const normalizedModel=series?bmwSeries[model]:model;
      return {
        brand,
        model:normalizedModel,
        series,
        body:modelBodies[brand+'|'+normalizedModel]||modelBodies[brand+'|'+model]||'',
        label:series ? normalizedModel+' · '+series : normalizedModel,
        exact:true,
        manual:false
      };
    }).filter((item,index,array)=>array.findIndex(other=>other.label===item.label)===index);
  }

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
        output.push({brand,model,year,series:series||'',body:modelBodies[brand+'|'+model]||modelBodies[brand+'|'+entry]||'',exact:!!modelQuery&&(modelQuery===compact(entry)||(!named&&query===compact(model))),
          label:brand+' '+model+(series?' · '+series:''),manual:false});
      }
    }
    // Also let a model be found without knowing its manufacturer.
    if(!named&&query&&output.length===0){
      for(const [brand,entries]of Object.entries(models)){
        for(const model of entries){
          if(compact(model)!==query)continue;
          const series=brand==='BMW'&&bmwSeries[model]?model:'';
          const resolved=series?bmwSeries[model]:model;
          output.push({brand,model:resolved,year,series,body:modelBodies[brand+'|'+resolved]||modelBodies[brand+'|'+model]||'',exact:true,label:brand+' '+(series?bmwSeries[model]+' · '+series:model),manual:false});
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
  return {search,brands:brandsList,modelsForBrand,canonicalBrand};
});

