const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(api){
  const sources=new Map(),elements=[],status={hidden:true,textContent:''};
  let fits=0;
  const map={resize(){},getSource:name=>({setData:data=>sources.set(name,data)}),fitBounds(){fits++;}};
  const nodes={mapStatus:status,game:{classList:{contains:()=>false}},liveMap:{}};
  class Marker{
    constructor({element}){this.element=element;elements.push(element);}
    setLngLat(point){this.point=point;return this;}
    addTo(){assert.ok(this.point,'Marker needs coordinates before mounting');return this;}
    getElement(){return this.element;}
    remove(){this.element.removed=true;}
    setPopup(){return this;}
  }
  class Bounds{extend(){return this;}}
  const context=vm.createContext({console,Date,setTimeout,clearTimeout,api,gameCredentials:()=>({code:'TEST1',userId:'guest'}),
    document:{getElementById:id=>nodes[id],querySelector:()=>({}),createElement:()=>({classes:new Set(),setAttribute(name,value){this[name]=value;},classList:{toggle(){}}})},
    window:{},MutationObserver:class{observe(){}},fakeMap:map,fakeLibrary:{Marker,LngLatBounds:Bounds}
  });
  vm.runInContext(fs.readFileSync(__dirname+'/map.js','utf8')+'\nmap=fakeMap;maplibregl=fakeLibrary;ready=true;',context);
  const state={lobby:{code:'TEST1',state:'LOBBY',hostId:'host',me:{id:'guest',hasLocation:true}},map:{meetup:{name:'Elias',lat:52,lng:13,stale:false}}};
  return {context,state,sources,elements,status,get fits(){return fits;},update:()=>{context.fixtureState=state;return vm.runInContext('latest=fixtureState;updateMeetup(fixtureState)',context);},reset:()=>vm.runInContext('window.chsMapReset()',context)};
}
test('meetup marker and real road geometry appear together and polling preserves manual map movement',async()=>{
  let calls=0;
  const geometry={type:'LineString',coordinates:[[13,52],[13.001,52.001]]};
  const f=fixture(async()=>{calls++;return {hostId:'host',route:{geometry,distance:400,duration:90}};});
  await f.update();assert.equal(f.elements[0]['aria-label'],'Treffpunkt bei Elias');
  assert.deepEqual(f.sources.get('meetup-route').geometry,geometry);assert.match(f.status.textContent,/0.4 km/);
  assert.equal(f.fits,1);await f.update();assert.equal(f.fits,1);assert.equal(calls,1);
  f.reset();assert.equal(f.elements[0].removed,true);assert.equal(f.sources.get('meetup-route').features.length,0);
});
test('stale GPS and unavailable roads show the meeting point without a misleading straight route',async()=>{
  let calls=0;const f=fixture(async()=>{calls++;return {route:null,message:'Keine Straßenroute verfügbar.'};});
  f.state.map.meetup.stale=true;await f.update();assert.equal(calls,0);assert.match(f.status.textContent,/aktuelles GPS/);
  f.state.map.meetup.stale=false;await f.update();assert.equal(calls,1);
  assert.equal(f.sources.get('meetup-route').features.length,0);assert.match(f.status.textContent,/Keine Straßenroute/);
});
test('a delayed routing reply cannot reappear after the game starts',async()=>{
  let resolve;const f=fixture(()=>new Promise(done=>resolve=done));const pending=f.update();
  f.state.lobby.state='ACTIVE';await f.update();
  resolve({hostId:'host',route:{geometry:{type:'LineString',coordinates:[[13,52],[14,53]]},distance:400,duration:90}});
  await pending;assert.equal(f.sources.get('meetup-route').features.length,0);assert.equal(f.elements[0].removed,true);
});
