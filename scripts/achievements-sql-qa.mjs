// Actual migration and result-claim RPC in isolated PostgreSQL semantics.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite(),uid='00000000-0000-4000-8000-000000000001';
let checks=0,serial=10;
const migration=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const deny=async(sql,label)=>{await assert.rejects(db.exec(sql),undefined,label);checks++;};
const claim=async(result,role='SEEKER',won=true,finds=1,survived=false)=>(await db.query(
 'select public.chs_claim_game_result($1,$2,$3,$4,$5) as result',[result,role,won,finds,survived])).rows[0].result;
const attest=async(role='SEEKER',won=true,finds=1,survived=false)=>{
 const id=`00000000-0000-4000-8000-${String(serial++).padStart(12,'0')}`;
 await db.query('insert into chs_verified_results(user_id,result_id,role,won,finds,survived) values($1,$2,$3,$4,$5,$6)',[uid,id,role,won,finds,survived]);return id;
};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema chs_private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function chs_private.account_allowed() returns boolean language sql as $$select auth.uid() is not null and current_setting('qa.banned',true) is distinct from 'true'$$;
 create table profiles(id uuid primary key,username text,avatar_url text,active_vehicle_id uuid,last_seen_at timestamptz,updated_at timestamptz,
 level int default 1,xp int default 0,rounds_played int default 0,wins int default 0,finds int default 0,survived_rounds int default 0);
 create table achievements(id text primary key,name text,description text,xp_reward int not null);
 create table user_achievements(user_id uuid references profiles(id),achievement_id text references achievements(id),unlocked_at timestamptz default now(),primary key(user_id,achievement_id));
 insert into achievements values('FIRST_GAME','Start','Eine Runde',50),('FIRST_FIND','Fund','Ein Fund',50),('HIDE_MASTER','Versteck','Überlebe',50);
 insert into profiles(id) values('${uid}');
 select set_config('request.jwt.claim.sub','${uid}',false);`);
 await db.exec(migration('20260930094245_game_result_progression.sql'));
 await db.exec(migration('20261001105143_server_verified_results.sql'));
 const sql=migration('20261020130000_more_achievements.sql');
 await db.exec(sql);await db.exec(sql);
 equal((await db.query('select count(*)::int as n from achievements')).rows[0].n,12,'idempotent catalog');
 await deny(`select chs_claim_game_result('${uid}','SEEKER',true,20,false)`,'reject fabricated result');
 const first=await attest(),initial=await claim(first);
 equal(initial.unlocked,['FIRST_FIND','FIRST_GAME'],'legacy achievements preserved');
 equal(initial.xp_awarded,280,'base + legacy bonus');
 equal((await claim(first)).already_claimed,true,'replay');
 const rows=(await db.query('select * from achievements where condition_target>1 order by id')).rows;
 for(const row of rows){
  // Set just below each target; existing legacy counters/awards are retained.
  await db.exec(`update profiles set rounds_played=1,wins=0,finds=1,survived_rounds=1,xp=900,level=1 where id='${uid}';
   delete from user_achievements where achievement_id not in ('FIRST_GAME','FIRST_FIND','HIDE_MASTER');
   insert into user_achievements(user_id,achievement_id) values('${uid}','HIDE_MASTER') on conflict do nothing;`);
  assert.ok(['rounds_played','wins','finds','survived_rounds'].includes(row.condition_field));
  await db.query(`update profiles set ${row.condition_field}=$1 where id=$2`,[row.condition_target-2,uid]);
  const hiding=row.condition_field==='survived_rounds',args=[hiding?'HIDER':'SEEKER',true,hiding?0:1,hiding];
  const below=await claim(await attest(...args),...args);
  equal(below.unlocked.includes(row.id),false,'not awarded below threshold '+row.id);
  const result=await attest(...args),award=await claim(result,...args);
  equal(award.unlocked.includes(row.id),true,'unlocks at exact target '+row.id);
  equal(award.profile.level,Math.min(50,Math.floor(award.profile.xp/1000)+1),'bonus updates level '+row.id);
  const repeat=await claim(result,...args);
  equal(repeat.unlocked,[],'same result has no duplicate bonus '+row.id);
  equal(repeat.profile.xp,award.profile.xp,'replay preserves XP '+row.id);
  const next=await claim(await attest(...args),...args);
  equal(next.unlocked.includes(row.id),false,'new result does not repeat achievement '+row.id);
  equal(next.profile.xp-award.profile.xp,hiding?280:180,'next result only base XP '+row.id);
 }
 await db.exec(`delete from user_achievements where achievement_id not in ('FIRST_GAME','FIRST_FIND','HIDE_MASTER');
  update profiles set rounds_played=100,wins=25,finds=50,survived_rounds=25,xp=48900,level=49 where id='${uid}'`);
 const veteran=await claim(await attest());
 equal(veteran.unlocked.length,9,'historical counters qualify all nine milestones on next verified round');
 equal(veteran.profile.level,50,'achievement bonuses respect max level');
 const invalid=await attest();
 await deny(`select chs_claim_game_result('${invalid}','SEEKER',true,20,false)`,'cannot inflate verified finds');
 await db.exec("select set_config('qa.banned','true',false)");
 await deny(`select chs_claim_game_result('${invalid}','SEEKER',true,1,false)`,'banned account');
 await db.exec("select set_config('qa.banned','false',false);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false)");
 await deny(`select chs_claim_game_result('${invalid}','SEEKER',true,1,false)`,'another account cannot claim');
 await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false);set role authenticated`);
 await deny(`insert into user_achievements(user_id,achievement_id) values('${uid}','ROUNDS_100')`,'no direct client awards');
 await deny("update achievements set condition_target=1",'no client catalog edits');
 await db.exec('reset role');
 await db.exec(sql);
 equal((await claim(invalid)).already_claimed,false,'RPC still works after repeated migration');
 console.log(JSON.stringify({status:'passed',checks}));
}finally{await db.close();}
