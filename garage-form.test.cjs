const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const vehicleCatalog=require('./vehicle-catalog.js');
const vehicleSearch=require('./vehicle-search.js');

// A small form adapter exercises the real handlers without a browser or live account.
function formFixture(cars=[]){
  class Field {
    constructor(){this.value='';this.dataset={};this.attributes={};this.listeners={};this.children=[];this.classes=new Set();
      this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),contains:name=>this.classes.has(name),
        toggle:(name,on)=>{if(on===undefined)on=!this.classes.has(name);on?this.classes.add(name):this.classes.delete(name);}};
    }
    addEventListener(type,handler){(this.listeners[type]||=[]).push(handler);}
    dispatchEvent(event){for(const handler of this.listeners[event.type]||[])handler(event);}
    setAttribute(name,value){this.attributes[name]=String(value);}
    removeAttribute(name){delete this.attributes[name];}
    focus(){this.dispatchEvent({type:'focus'});}
    scrollIntoView(){}
    querySelectorAll(){return this.children;}
    set innerHTML(value){this.html=value;this.children=[...value.matchAll(/id="([^"]+)"[^>]*data-car-choice="(\d+)"/g)].map(match=>{
      const button=new Field();button.id=match[1];button.dataset.carChoice=match[2];return button;
    });}
    get innerHTML(){return this.html||'';}
  }
  const fields=new Map();
  const $=selector=>{if(!fields.has(selector))fields.set(selector,new Field());return fields.get(selector);};
  const colors=['Schwarz','Weiß','Blau','Grün'].map(color=>{const button=new Field();button.dataset.carColor=color;return button;});
  const writes=[],messages=[],uploads=[],activations=[];
  const context=vm.createContext({$,vehicleCatalog,vehicleSearch,Event,Date,
    document:{querySelectorAll:()=>colors,addEventListener(){}},
    esc:value=>String(value??''),carPhotoMarkup:car=>JSON.stringify(car),
    gameSession:null,authSession:{user:{id:'owner-id'}},localGarage:cars,
    pendingCarPhoto:'',carPhotoBusy:false,garageSyncBusy:false,
    crypto:{randomUUID:()=> 'new-vehicle-id'},toast:message=>messages.push(message),
    setupCarPhotoInput(){},resetCarPhotoInput(){},loadCloudGarage:async()=>{},
    activateCloudVehicle:async id=>activations.push(id),
    uploadVehiclePhoto:async(id,photo)=>{uploads.push({id,photo});return 'owner-id/'+id+'.webp';},
    supabaseClient:{from:table=>({
      insert:async values=>{writes.push({table,method:'insert',values});return {error:null};},
      update:values=>{const write={table,method:'update',values,filters:[]};writes.push(write);
        const query={eq:(key,value)=>{write.filters.push([key,value]);return query;},select:async()=>({data:[{id:write.filters[0][1]}],error:null})};return query;
      }
    })}
  });
  const read=path=>fs.readFileSync(__dirname+'/'+path,'utf8');
  const app=read('app.js');
  vm.runInContext(app.slice(app.indexOf('function openCarModal()'),app.indexOf('/* =========================================================\n   GAME API')),context);
  const actions=read('garage-actions.js');vm.runInContext(actions.slice(0,actions.indexOf('function askDeleteVehicle')),context);
  const social=read('social.js');vm.runInContext(social.slice(0,social.indexOf('let socialRows')),context);
  vm.runInContext('setupVehicleSearch()',context);
  const run=code=>vm.runInContext(code,context);
  const type=value=>{$('#newCarSearch').value=value;$('#newCarSearch').dispatchEvent({type:'input'});};
  const key=value=>$('#newCarSearch').dispatchEvent({type:'keydown',key:value,preventDefault(){}});
  const color=value=>{const button=colors.find(item=>item.dataset.carColor===value);
    $('#carModal .carColorChoices').dispatchEvent({type:'click',target:{closest:()=>button}});
  };
  return {$,context,writes,messages,uploads,activations,colors,run,type,key,color};
}

test('one query and a color create an owned vehicle with one year and inferred body',async()=>{
  const f=formFixture();f.run('openCarModal()');f.type('Ford Focus 2015');f.key('Enter');f.color('Blau');
  assert.equal(f.$('#newCarSearch').value,'Ford Focus');
  assert.equal(f.$('#newCarYear').value,'2015');
  assert.equal(f.$('#newCarBody').value,'Compact');
  assert.equal(f.colors[2].attributes['aria-pressed'],'true');
  await f.run('saveCar()');
  assert.equal(f.writes.length,1);
  const values=f.writes[0].values;
  assert.deepEqual([values.user_id,values.brand,values.model,values.model_year,values.color],['owner-id','Ford','Focus',2015,'Blau']);
  assert.equal(values.series,'III · 2011–2018');
  assert.deepEqual(f.activations,['new-vehicle-id']);
  assert.equal(f.$('#carModal').classList.contains('hidden'),true);
});

test('structured make-model picker infers BMW 420i as a coupe and repaints the preview',async()=>{
  const f=formFixture();f.run('openCarModal()');
  const brand=f.$('#newCarBrandPicker');brand.value='BMW';brand.dispatchEvent({type:'change'});
  const model=f.$('#newCarModelPicker');
  const index=model._vehicleChoices.findIndex(item=>item.model==='420i');
  assert.ok(index>=0);
  model.value=String(index+1);model.dispatchEvent({type:'change'});
  assert.equal(f.$('#newCarBrand').value,'BMW');
  assert.equal(f.$('#newCarModel').value,'420i');
  assert.equal(f.$('#newCarBody').value,'Coupé');
  f.color('Orange');
  assert.equal(JSON.parse(f.$('#newCarPhotoPreview').innerHTML).color,'Orange');
  await f.run('saveCar()');
  assert.equal(f.writes[0].values.body_type,'Coupé');
});

test('editing preserves an explicit series in overlapping years, body and existing photo',async()=>{
  const car={id:'old-id',brand:'BMW',model:'3er',year:'1999',series:'E36 · 1990–2000',body:'Coupé',color:'Weiß',photo:'https://example.test/old.webp'};
  const f=formFixture([car]);f.run('editVehicle("old-id")');
  assert.equal(f.$('#newCarSeries').value,car.series);
  assert.equal(f.$('#newCarBody').value,car.body);
  assert.equal(JSON.parse(f.$('#newCarPhotoPreview').innerHTML).photo,car.photo);
  f.color('Grün');await f.run('saveCar()');
  assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].method,'update');
  assert.deepEqual(f.writes[0].filters,[['id','old-id'],['user_id','owner-id']]);
  assert.equal(f.writes[0].values.series,car.series);
  assert.equal(f.writes[0].values.body_type,car.body);
  assert.equal('photo_path' in f.writes[0].values,false);
  assert.equal(f.uploads.length,0);
});

test('editing a vehicle without a year keeps its saved series',()=>{
  const f=formFixture([{id:'old-id',brand:'BMW',model:'3er',series:'E46 · 1997–2006',color:'Schwarz'}]);
  f.run('editVehicle("old-id")');
  assert.equal(f.$('#newCarSeries').value,'E46 · 1997–2006');
});

test('switching the searched model clears the old identity and infers the new series',()=>{
  const f=formFixture();f.run('openCarModal()');f.type('Ford Focus 2015');f.key('Enter');
  f.type('VW Golf');
  assert.equal(f.$('#newCarBrand').value,'');
  assert.equal(f.$('#newCarSeries').value,'');
  f.key('Enter');
  assert.equal(f.$('#newCarBrand').value,'Volkswagen');
  assert.equal(f.$('#newCarModel').value,'Golf');
  assert.equal(f.$('#newCarYear').value,'2015');
  assert.equal(f.$('#newCarSeries').value,'VII · 2012–2019');
});

test('saving a fully typed unlisted vehicle works without a separate suggestion click',async()=>{
  const f=formFixture();f.run('openCarModal()');f.type('AC Cobra 1990');f.color('Schwarz');await f.run('saveCar()');
  assert.deepEqual([f.writes[0].values.brand,f.writes[0].values.model,f.writes[0].values.model_year],['AC','Cobra',1990]);
});

test('a manufacturer alone does not save an arbitrary model',async()=>{
  const f=formFixture();f.run('openCarModal()');f.type('BMW');f.color('Schwarz');await f.run('saveCar()');
  assert.equal(f.writes.length,0);
  assert.match(f.messages.at(-1),/Fahrzeug auswählen/);
});

test('an explicit chassis with an incompatible year is rejected before cloud writes',async()=>{
  const f=formFixture();f.run('openCarModal()');f.type('BMW E36 2015');f.key('Enter');f.color('Schwarz');await f.run('saveCar()');
  assert.equal(f.writes.length,0);
  assert.match(f.messages.at(-1),/Baujahr passt nicht/);
});

test('an uploaded replacement photo keeps the same vehicle id and ownership filter',async()=>{
  const f=formFixture([{id:'old-id',brand:'Ford',model:'Focus',year:'2015',color:'Schwarz'}]);
  f.run('editVehicle("old-id");pendingCarPhoto="replacement-image"');await f.run('saveCar()');
  assert.deepEqual(f.uploads,[{id:'old-id',photo:'replacement-image'}]);
  assert.equal(f.writes[0].values.photo_path,'owner-id/old-id.webp');
  assert.deepEqual(f.writes[0].filters,[['id','old-id'],['user_id','owner-id']]);
});

test('ArrowUp from an unselected suggestion activates the last result',()=>{
  const f=formFixture();f.run('openCarModal()');f.type('BMW');f.key('ArrowUp');
  const last=f.$('#carSearchResults').children.at(-1);
  assert.equal(f.$('#newCarSearch').attributes['aria-activedescendant'],last.id);
});
