'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./account-ui.js'),'utf8');

function fixture(){
  const button={hidden:true,setAttribute(){this.hidden=true;}},pending=[],removed=[],timers=[];
  const context=vm.createContext({
    window:{},authSession:{user:{id:'first-account'}},pollTimer:41,gpsHeartbeat:42,gpsPhase:'ACTIVE',
    clearTimeout:id=>timers.push(['timeout',id]),clearInterval:id=>timers.push(['interval',id]),
    api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),
    document:{readyState:'loading',addEventListener(){},
      getElementById:id=>id==='adminMenuButton'?button:{remove:()=>removed.push(id)},
      createElement(){throw new Error('A stale response must not create a dialog');}}
  });
  vm.runInContext(source,context,{filename:'account-ui.js'});
  return {context,button,pending,removed,timers,ui:context.window.accountUI};
}
const accepted=admin=>({admin,banned:false,accepted:true,legal:{ready:true}});

test('a newer account check wins over an older response with admin rights',async()=>{
  const f=fixture(),older=f.ui.initialize(),newer=f.ui.initialize();
  f.pending[1].resolve(accepted(false));assert.equal(await newer,true);
  f.pending[0].resolve(accepted(true));assert.equal(await older,false);
  assert.equal(f.button.hidden,true);
});

test('logout discards delayed success and stops GPS and polling without reopening private views',async()=>{
  const f=fixture(),request=f.ui.initialize();
  f.ui.closePrivateViews();f.context.authSession=null;
  f.pending[0].resolve(accepted(true));assert.equal(await request,false);
  assert.equal(f.button.hidden,true);assert.equal(f.context.gpsHeartbeat,null);assert.equal(f.context.gpsPhase,'STOPPED');
  assert.deepEqual(f.timers,[['timeout',41],['interval',42]]);
  assert.deepEqual(f.removed,['adminDialog','wardrobeDialog','accountGate']);
});

test('a failed account check from the previous session cannot show a gate for the new account',async()=>{
  const f=fixture(),oldRequest=f.ui.initialize();
  f.context.authSession={user:{id:'second-account'}};
  const currentRequest=f.ui.initialize();f.pending[1].resolve(accepted(false));assert.equal(await currentRequest,true);
  f.pending[0].reject(new Error('Old session offline'));assert.equal(await oldRequest,false);
  assert.equal(f.button.hidden,true);
});
