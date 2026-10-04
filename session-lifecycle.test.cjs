const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const {route,lobbies}=require('./server');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const data={name:'Host',vehicle:'BMW E36',color:'Orange',visibility:'PRIVATE'};

test('leaving migrates the host, suppresses automatic rejoin and rejects delayed identity updates',async()=>{
 const host=await route('create',data,'leave-host'),code=host.lobby.code;
 try{
  const guest=await route('join',{...data,name:'Guest',code},'leave-guest');
  await route('leave',{code,userId:host.userId},'leave-host');
  assert.equal(lobbies.get(code).hostId,guest.userId);
  assert.equal((await route('rejoin-lookup',{},'leave-host')).code,null);
  await assert.rejects(route('identity',{...data,code,userId:host.userId},'leave-host'),/Session nicht gefunden/);
  await assert.rejects(route('join',{...data,code,rejoin:true},'leave-host'),/bewusst verlassen/);
  assert.equal(lobbies.get(code).players.length,1);
  const explicit=await route('join',{...data,code},'leave-host');
  assert.ok(explicit.userId);assert.equal(lobbies.get(code).players.length,2);
 }finally{lobbies.delete(code);}
});

test('the same shared background is returned to guests, new members and returning members',async()=>{
 const host=await route('create',data,'bg-host'),code=host.lobby.code;
 try{
  const guest=await route('join',{...data,code},'bg-guest');
  lobbies.get(code).players.forEach(p=>p.ready=true);
  await route('background',{code,userId:host.userId,background:'garage'},'bg-host');
  assert.equal((await route('state',{code,userId:guest.userId},'bg-guest')).lobby.background,'garage');
  assert.equal((await route('join',{...data,code,rejoin:true},'bg-guest')).lobby.background,'garage');
  assert.equal((await route('join',{...data,code},'bg-new')).lobby.background,'garage');
  assert.ok(lobbies.get(code).players.slice(0,2).every(p=>p.ready));
 }finally{lobbies.delete(code);}
});

function pollFixture(){
 let resolve,reject,renders=0,rejoins=0,timers=0;
 const c=vm.createContext({sessionEpoch:1,gameSession:{code:'ABCDE',userId:'p'},state:null,pollTimer:null,lobbyMissingPolls:0,
  gameCredentials:()=>({code:'ABCDE',userId:'p'}),api:()=>new Promise((a,b)=>{resolve=a;reject=b;}),
  clearTimeout(){},setTimeout(){timers++;},hideRejoin(){},showRejoin(){rejoins++;},renderGame(){renders++;},toast(){},console});
 const block=source.slice(source.indexOf('async function poll()'),source.indexOf('function renderGame()'));
 // Only the polling function, independent of the rendering implementation.
 const match=block.slice(0,block.indexOf('\n}\n')+3);vm.runInContext(match,c);
 return {c,run:()=>vm.runInContext('poll()',c),resolve:v=>resolve(v),reject:e=>reject(e),counts:()=>({renders,rejoins,timers})};
}
test('an old successful poll cannot restore a lobby after leave or overwrite a newer session',async()=>{
 const f=pollFixture(),pending=f.run();f.c.sessionEpoch++;f.c.gameSession=null;f.resolve({lobby:{code:'ABCDE'}});await pending;
 assert.equal(f.c.state,null);assert.deepEqual(f.counts(),{renders:0,rejoins:0,timers:0});
});
test('an old failed poll cannot display a rejoin overlay after leave',async()=>{
 const f=pollFixture(),pending=f.run();f.c.sessionEpoch++;f.c.gameSession=null;f.reject(new Error('Network'));await pending;
 assert.deepEqual(f.counts(),{renders:0,rejoins:0,timers:0});
});
test('failed leave stays account-bound and retries successfully without recovering the old lobby',async()=>{
 const saved=new Map();let fails=true,calls=0;
 const c=vm.createContext({authSession:{user:{id:'account-a'}},AbortSignal,gameSession:{code:'ABCDE',userId:'p'},gameCredentials:()=>({code:'ABCDE',userId:'p'}),
  localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},clearTimeout(){},setTimeout(){return 1;},
  resetGame(){c.gameSession=null;},api:async()=>{calls++;if(fails)throw new Error('offline');}});
 vm.runInContext(source.slice(source.indexOf('let leaveBusy ='),source.indexOf('function resetGame()')),c);
 await vm.runInContext('leave()',c);assert.equal(c.gameSession,null);assert.equal(vm.runInContext("hasPendingLeave('ABCDE')",c),true);
 c.authSession.user.id='account-b';await vm.runInContext('flushPendingLeaves()',c);assert.equal(calls,1);
 c.authSession.user.id='account-a';fails=false;await vm.runInContext('flushPendingLeaves()',c);assert.equal(calls,2);assert.equal(vm.runInContext("hasPendingLeave('ABCDE')",c),false);
});
