const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const configSource=source.slice(source.indexOf('function gpsConfigForState()'),source.indexOf('async function sendGameLocation'));
test('one GPS scheduler switches far/near/close accuracy and stops for results or eliminated participants',()=>{
  const state={lobby:{state:'ACTIVE',me:{}},proximity:null};const context=vm.createContext({state});vm.runInContext(configSource,context);
  const config=()=>vm.runInContext('gpsConfigForState()',context);
  assert.equal(config().interval,15000);assert.equal(config().options.enableHighAccuracy,false);
  state.proximity={level:'CLOSE'};assert.equal(config().interval,5000);assert.equal(config().options.enableHighAccuracy,true);
  state.proximity={level:'VERY_CLOSE'};assert.equal(config().interval,2000);
  state.proximity=null;state.locks=[{id:'lock'}];assert.equal(config().interval,2000);
  state.lobby.me.eliminated=true;assert.equal(config().phase,'STOPPED');
  state.lobby.me.eliminated=false;state.lobby.state='RESULT';assert.equal(config().phase,'STOPPED');
});

test('the scheduler makes no geolocation request after a result and cannot create overlapping intervals on polling',()=>{
  const state={lobby:{state:'RESULT',me:{}}};let requests=0,intervals=0;
  const node={disabled:false,textContent:'',classList:{remove(){}}};
  const context=vm.createContext({state,gameSession:{code:'TEST1',userId:'p1'},gpsStarting:false,gpsHeartbeat:null,gpsPhase:'',lastGpsRequestAt:0,Date,console,
    navigator:{geolocation:{getCurrentPosition(){requests++;}}},$:()=>node,toast(){},setInterval(){intervals++;return intervals;},clearInterval(){},document:{visibilityState:'visible'}});
  const block=source.slice(source.indexOf('function gpsConfigForState()'),source.indexOf('/* =========================================================\n   GAME ACTIONS'));
  vm.runInContext(block,context);vm.runInContext('startGpsSchedule()',context);assert.equal(requests,0);assert.equal(intervals,0);assert.equal(node.disabled,true);
  state.lobby.state='ACTIVE';vm.runInContext('startGpsSchedule();startGpsSchedule()',context);
  assert.equal(requests,1);assert.equal(intervals,1);
});
