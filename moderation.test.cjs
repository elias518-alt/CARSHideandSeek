'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createAccountService}=require('./account-service');
const rules=require('./moderation-rules'),{createMonitor}=require('./beta-monitor');
const actor='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
function fixture(role='user'){
 const calls=[];let offline=false,onboarded=false;
 const service=createAccountService({url:'https://test.invalid',key:'sb_secret_test',env:{CHS_ADMIN_USER_IDS:role==='super_admin'?actor:''},fetchImpl:async(url,o={})=>{
 const path=new URL(url).pathname.split('/').pop(),body=o.body?JSON.parse(o.body):{};calls.push({path,body,url,method:o.method});if(offline)return {ok:false,status:503};
 let result=[];if(path==='chs_staff_roles')result=[{user_id:actor,role}];if(path==='profiles')result=[{id:target}];if(path==='chs_onboarding'){if(o.method==='POST')onboarded=true;result=onboarded?[{version:rules.ONBOARDING_VERSION}]:[];}
 if(path==='chs_personal_beta_stats')result={recordedRounds:3000,seekerRounds:1000,hiderRounds:2000};
 return {ok:true,status:200,json:async()=>result};}});
 return {service,calls,offline:v=>offline=v};
}
for(const role of rules.ROLES)for(const permission of ['reports','players','bans','lobbies','stats','audit','roles'])test(role+' permission '+permission,async()=>{
 const f=fixture(role);if(rules.permitted(role,permission))assert.equal(await f.service.requirePermission(actor,permission),role);else{await assert.rejects(f.service.requirePermission(actor,permission),{status:403});assert.equal(f.calls.some(c=>!['chs_staff_roles'].includes(c.path)),false);}
});
test('report category is mandatory, comments are optional and hostile input is bounded',()=>{
 assert.deepEqual(rules.reportInput({category:'privacy'}),{category:'privacy',comment:''});
 for(const payload of [{category:'admin'},{category:'other',comment:'x'.repeat(501)},{category:'other',comment:'\u0000'}])assert.throws(()=>rules.reportInput(payload),{status:400});
});
test('lobby moderation serializes only allowed fields, never GPS or chat',()=>{
 const now=Date.now(),s=rules.lobbySummary({code:'ABCDE',players:[{id:'p',authId:actor,lastSeen:now,joinedAt:now,location:{lat:52,lng:13},fixes:[{lat:52}],privateMessages:['secret']}],origin:{lat:52},messages:['secret'],createdAt:now});
 assert.equal(s.connected,1);assert.doesNotMatch(JSON.stringify(s),/lat|lng|location|fixes|secret/);assert.equal(s.participants[0].lastSeen,now);
});
test('server derives report actor and stores only new-report fields',async()=>{
 const f=fixture();await f.service.saveReport(actor,{id:target,target,code:'ABCDE',category:'other',comment:'',reporter:target,status:'resolved'});
 const c=f.calls.at(-1);assert.equal(c.path,'chs_player_reports');assert.equal(c.body.reporter_id,actor);assert.equal(c.body.status,undefined);
});
test('revision token is required for concurrent report handling',async()=>{
 const f=fixture('moderator');await assert.rejects(f.service.updateReport(actor,{id:target,status:'resolved',resolution:'Erledigt'}),{status:400});
 const revision='2026-10-01T12:00:00.123456+00:00';await f.service.updateReport(actor,{id:target,status:'resolved',resolution:'Nach Prüfung erledigt',expected:revision});assert.equal(f.calls.at(-1).body.p_expected,revision);
});
test('onboarding validates boolean, version and voluntary region before any write',async()=>{
 const f=fixture();for(const value of [{understood:'true',version:rules.ONBOARDING_VERSION},{understood:true,version:'old'},{understood:true,version:rules.ONBOARDING_VERSION,country:'AT',region:'BY'}])await assert.rejects(f.service.onboard(actor,value),{status:400});assert.equal(f.calls.length,0);
 await f.service.onboard(actor,{understood:true,version:rules.ONBOARDING_VERSION});assert.equal(f.calls.at(-1).path,'chs_onboarding');assert.equal(f.calls.length,1);
});
test('personal stats aggregate in SQL instead of truncating at the API row limit',async()=>{
 const f=fixture();assert.equal((await f.service.personalStats(actor)).recordedRounds,3000);assert.equal(f.calls[0].path,'chs_personal_beta_stats');assert.equal(f.calls[0].body.p_user,actor);
});
test('monitor rejects raw strings and retry IDs stay stable while fresh events remain independent',async()=>{
 const m=createMonitor();m.record('API','token=secret');m.record('UNKNOWN','ERROR');assert.equal(m.pending(),0);m.record('API','HTTP_500');m.record('API','HTTP_500');let failed;
 await assert.rejects(m.flush(async rows=>{failed=rows;throw Error('offline');}));assert.equal(failed[0].count,2);m.record('API','HTTP_500');let recovered;await m.flush(async rows=>recovered=rows);assert.equal(recovered.length,2);assert.equal(recovered[0].id,failed[0].id);assert.notEqual(recovered[1].id,failed[0].id);assert.equal(m.pending(),0);
});
test('monitor concurrent flush sends each batch once',async()=>{
 const m=createMonitor();m.record('GPS','TEMPORARY_GAP');let release,calls=0;const write=()=>{calls++;return new Promise(r=>release=r);};const a=m.flush(write),b=m.flush(write);release();await Promise.all([a,b]);assert.equal(calls,1);
});
test('revoked or unavailable permissions fail closed',async()=>{
 const f=fixture('moderator');f.offline(true);await assert.rejects(f.service.reportList(actor,{}),{status:503});assert.equal(f.calls.some(c=>c.path==='chs_player_reports'),false);
});
