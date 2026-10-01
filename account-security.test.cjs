'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createAccountService}=require('./account-service');
const {documents}=require('./legal');
const wardrobe=require('./wardrobe');
const owner='11111111-1111-4111-8111-111111111111',player='22222222-2222-4222-8222-222222222222';
const env={CHS_ADMIN_USER_IDS:owner,CHS_OPERATOR_NAME:'Testanbieter',CHS_OPERATOR_ADDRESS:'Teststraße 1, 12345 Testort',CHS_OPERATOR_EMAIL:'test@example.com',CHS_LEGAL_REVIEWED:'true'};
function fixture(){
  const bans=new Map(),acceptances=new Map(),calls=[],actions=[];
  let offline=false;
  async function fetchImpl(url,options={}){
    calls.push({url,options});if(offline)return {ok:false,status:503};
    const parsed=new URL(url),resource=parsed.pathname.split('/').pop(),params=parsed.searchParams;
    const json=options.body?JSON.parse(options.body):{};
    let value=[];
    if(resource==='user')value={id:options.headers.Authorization==='Bearer owner-token'?owner:player,user_metadata:{is_admin:true}};
    if(resource==='chs_account_bans')value=[...(params.get('user_id')?.startsWith('eq.')?[bans.get(params.get('user_id').slice(3))]:bans.values())].filter(Boolean);
    if(resource==='chs_legal_acceptances'){
      if(options.method==='POST'){acceptances.set(json.user_id,json);value=[json];}
      else {const row=acceptances.get(params.get('user_id')?.slice(3));value=row&&row.version===params.get('version')?.slice(3)&&row.document_hash===params.get('document_hash')?.slice(3)?[row]:[];}
    }
    if(resource==='profiles')value=[{id:player,username:'Testspieler',player_tag:'TEST',level:1,rounds_played:0,wins:0}];
    if(resource==='chs_admin_set_ban'){
      bans.set(json.p_target,{user_id:json.p_target,reason:json.p_reason,until_at:json.p_until,revoked_at:json.p_revoke?new Date().toISOString():null});
      actions.push({...json,created_at:new Date().toISOString()});value=null;
    }
    if(resource==='chs_admin_audit')value=actions;
    return {ok:true,status:200,json:async()=>value};
  }
  return {service:createAccountService({url:'https://example.supabase.co',key:'sb_secret_test',fetchImpl,env}),fetchImpl,bans,acceptances,calls,setOffline:value=>offline=value};
}
test('admin rights cannot be forged; non-admin requests fail before data access',async()=>{
  const f=fixture();await assert.rejects(f.service.players(player,{is_admin:true}),{status:403});assert.equal(f.calls.length,0);
  await assert.rejects(f.service.ban(owner,{targetId:owner,hours:0,reason:'Eigenes Konto sperren'}),{status:400});
  await assert.rejects(f.service.ban(owner,{targetId:player,hours:-1,reason:'Regelverstoß'}),{status:400});
});
test('server-issued consent is strict, versioned and tied to the complete document hash',async()=>{
  const f=fixture(),legal=documents(env),payload={version:legal.version,hash:legal.hash,terms:true,safety:true,adult:true,privacyRead:true};
  await assert.rejects(f.service.requireAccess(player),{status:428});
  await assert.rejects(f.service.accept(player,{...payload,adult:'true'}),{status:400});
  await assert.rejects(f.service.accept(player,{...payload,hash:'forged'}),{status:409});
  await f.service.accept(player,{...payload,user_id:owner,accepted_at:'2000-01-01'});
  assert.equal(f.acceptances.has(owner),false);assert.ok(Date.parse(f.acceptances.get(player).accepted_at)>Date.now()-10000);
  assert.equal((await f.service.requireAccess(player)).accepted,true);
  assert.notEqual(documents({...env,CHS_OPERATOR_ADDRESS:'Andere Anschrift'}).hash,legal.hash);
});
test('permanent bans, expiry, revocation and backend failures are enforced without trusting cached tokens',async()=>{
  const f=fixture();await f.service.ban(owner,{targetId:player,hours:0,reason:'Nachgewiesener Regelverstoß'});
  await assert.rejects(f.service.requireAccess(player,{consent:false}),error=>error.status===403&&error.extra.code==='ACCOUNT_BANNED');
  await f.service.ban(owner,{targetId:player,unban:true,reason:'Sperre nach Prüfung aufgehoben'});
  assert.equal((await f.service.requireAccess(player,{consent:false})).banned,false);
  f.bans.set(player,{user_id:player,reason:'Abgelaufen',until_at:new Date(Date.now()-1).toISOString()});
  assert.equal((await f.service.requireAccess(player,{consent:false})).banned,false);
  f.setOffline(true);await assert.rejects(f.service.requireAccess(player),{status:503});
  assert.equal(f.calls[0].options.headers.Authorization,undefined);
});
test('incomplete legal setup does not accept users or claim a full waiver',async()=>{
  const legal=documents({});assert.equal(legal.ready,false);assert.match(legal.terms.find(s=>s[0]==='Haftung')[1],/Leben, Körper oder Gesundheit/);
  assert.match(legal.privacy.at(-1)[1],/keine pauschale Einwilligung/);
});
test('all modular parts are real local assets and invalid cosmetic values cannot inject markup',()=>{
  const fs=require('node:fs'),path=require('node:path');
  for(let character=0;character<6;character++)for(let i=0;i<3;i++){
    const value={collection:'modular',character,hair:i,top:i,pants:i,shoes:i};
    for(const [part,model]of Object.entries(wardrobe.parts(value)))assert.ok(fs.statSync(path.join(__dirname,'assets/characters/quaternius',model+'-'+part+'.webp')).size>100);
  }
  const safe=wardrobe.normalize({collection:'modular',character:999,hair:'<script>',jewelry:'" onerror="alert(1)'});
  assert.equal(safe.character,0);assert.equal(safe.hair,0);assert.equal(safe.jewelry,'none');assert.doesNotMatch(wardrobe.markup(safe),/onerror|script/);
});
test('HTTP entry points enforce legal acceptance and admin bans, including existing authenticated sessions',async()=>{
  const oldFetch=global.fetch,oldEnv={...process.env},f=fixture();Object.assign(process.env,env,{SUPABASE_SECRET_KEY:'sb_secret_test'});global.fetch=f.fetchImpl;
  delete require.cache[require.resolve('./server')];const server=require('./server');server.lobbies.clear();
  const app=http.createServer(server.handler);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  async function request(action,data={},token='player-token',method='POST'){
    const response=await oldFetch('http://127.0.0.1:'+app.address().port+'/api/'+action+(method==='GET'?'?'+new URLSearchParams(data):''),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(data):undefined});
    return {status:response.status,data:await response.json()};
  }
  try{
    assert.equal((await request('admin-players',{},'player-token','GET')).status,403);
    assert.equal((await request('create',{name:'Testspieler',vehicle:'Testauto'})).status,428);
    const legal=documents(process.env);assert.equal((await request('legal-accept',{version:legal.version,hash:legal.hash,terms:true,safety:true,adult:true,privacyRead:true})).status,200);
    const created=await request('create',{name:'Testspieler',vehicle:'Testauto',appearance:{collection:'modular',character:5}});assert.equal(created.status,200);
    assert.equal(created.data.lobby.players[0].appearance.character,5);
    await request('legal-accept',{version:legal.version,hash:legal.hash,terms:true,safety:true,adult:true,privacyRead:true},'owner-token');
    const joined=await request('join',{code:created.data.lobby.code,name:'Zweiter Spieler',vehicle:'Zweites Auto'},'owner-token');assert.equal(joined.status,200);
    const look={collection:'realistic',gender:'female',hair:2,hairColor:'blonde',top:2,topColor:'green',pants:1,pantsColor:'navy',glasses:true,earrings:true,jewelry:'silver'};
    const updated=await request('join',{code:created.data.lobby.code,appearance:look});assert.equal(updated.status,200);
    const seen=await request('state',{code:created.data.lobby.code,userId:joined.data.userId},'owner-token','GET');assert.equal(seen.status,200);
    assert.deepEqual(seen.data.lobby.players.find(p=>p.id===created.data.userId).appearance,wardrobe.normalize(look));
    const rejoined=await request('join',{code:created.data.lobby.code});assert.deepEqual(rejoined.data.lobby.players.find(p=>p.id===created.data.userId).appearance,wardrobe.normalize(look));
    await request('leave',{code:created.data.lobby.code,userId:joined.data.userId},'owner-token');

    assert.equal((await request('admin-ban',{targetId:player,hours:24,reason:'Nachgewiesener Testverstoß'},'owner-token')).status,200);
    assert.equal(server.lobbies.size,0);
    const blocked=await request('create',{name:'Testspieler',vehicle:'Testauto'});assert.equal(blocked.status,403);assert.equal(blocked.data.code,'ACCOUNT_BANNED');
    assert.equal((await request('legal-accept',{...legal,terms:true,safety:true,adult:true,privacyRead:true})).status,403);
    const source=await oldFetch('http://127.0.0.1:'+app.address().port+'/account-service.js');assert.equal(source.status,404);
  }finally{await new Promise(resolve=>app.close(resolve));global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);server.lobbies.clear();}
});
