'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createAccountService}=require('./account-service'),{documents}=require('./legal');
test('explicit beta access requires real versioned acceptance, retains bans and never grants admin',async()=>{
 const user='22222222-2222-4222-8222-222222222222',env={CHS_BETA_ACCESS:'true'},rows=new Map();let banned=false,offline=false;
 const fetchImpl=async(url,options={})=>{if(offline)return {ok:false,status:503};const u=new URL(url),table=u.pathname.split('/').pop();let data=[];
  if(table==='chs_legal_acceptances'){if(options.method==='POST'){const row=JSON.parse(options.body);rows.set(row.user_id,row);data=[row];}else{const row=rows.get(user);if(row&&row.document_hash===u.searchParams.get('document_hash')?.slice(3))data=[row];}}
  if(table==='chs_account_bans'&&banned)data=[{reason:'Active ban',until_at:null,revoked_at:null}];
  if(table==='chs_onboarding')data=[{version:'beta-2026-10-01'}];return {ok:true,status:200,json:async()=>data};
 };
 const service=createAccountService({url:'https://fixture.supabase.co',key:'sb_secret_fixture',fetchImpl,env}),legal=documents(env),payload={version:legal.version,hash:legal.hash,terms:true,safety:true,adult:true,privacyRead:true};
 assert.equal(legal.ready,false);assert.equal(legal.canAccept,true);assert.equal(documents({CHS_BETA_ACCESS:'false'}).canAccept,false);
 await assert.rejects(service.requireAccess(user,{cached:true}),{status:428});
 await assert.rejects(service.accept(user,{...payload,adult:'true'}),{status:400});
 await assert.rejects(service.accept(user,{...payload,hash:'forged'}),{status:409});
 await service.accept(user,{...payload,user_id:'forged',is_admin:true});
 const account=await service.requireAccess(user,{cached:true,onboarding:true});assert.equal(account.accepted,true);assert.equal(account.admin,false);assert.equal(account.developerPreview,false);assert.equal(rows.get(user).document_snapshot.betaAccess,true);
 env.CHS_BETA_ACCESS='false';await assert.rejects(service.requireAccess(user),{status:428});env.CHS_BETA_ACCESS='true';
 banned=true;await assert.rejects(service.accept(user,payload),{status:403});await assert.rejects(service.requireAccess(user),{status:403});banned=false;offline=true;await assert.rejects(service.requireAccess(user),{status:503});
});
