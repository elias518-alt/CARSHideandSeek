const {PGlite}=await import(process.argv[3]||'@electric-sql/pglite');
import fs from 'node:fs';import crypto from 'node:crypto';
const db=new PGlite(),[a,b,c,outsider]=Array.from({length:4},()=>crypto.randomUUID());
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema chs_private;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function chs_private.account_allowed() returns boolean language sql as $$ select auth.uid() is not null and coalesce(current_setting('test.banned',true),'false')<>'true' $$;
create table auth.users(id uuid primary key);create table profiles(id uuid primary key,username text,player_tag text,level int,avatar_url text,last_seen_at timestamptz);
create table chs_friendships(id uuid primary key default gen_random_uuid(),requester uuid,addressee uuid,status text);
create table chs_direct_messages(id uuid primary key default gen_random_uuid(),sender uuid,recipient uuid,body text,created_at timestamptz default now());create table chs_daily_activity(user_id uuid,day date,last_at timestamptz);
insert into auth.users values('${a}'),('${b}'),('${c}'),('${outsider}');
insert into profiles values('${a}','Elias','EP',12,null,now()),('${b}','Lea','LEA',2,'https://example.com/lea.png',now()),('${c}','Ben','BEN',1,null,now());
insert into chs_friendships(requester,addressee,status) values('${a}','${b}','accepted'),('${c}','${a}','pending');`);
await db.exec(fs.readFileSync(process.argv[2],'utf8'));const m1=crypto.randomUUID(),m2=crypto.randomUUID(),m3=crypto.randomUUID();await db.exec(`insert into chs_direct_messages(id,sender,recipient,body,created_at) values('${m1}','${b}','${a}','SECRET1',now()-interval '3 seconds'),('${m2}','${b}','${a}','SECRET2',now()-interval '2 seconds');set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`);let checks=0;
async function overview(){return (await db.query('select chs_social_overview_v2() as data')).rows[0].data;}
const first=await overview();if(first.find(r=>r.peer_id===b).unread_count!==2||first.find(r=>r.peer_id===b).avatar_url!=='https://example.com/lea.png'||first.find(r=>r.peer_id===c).incoming!==true||JSON.stringify(first).includes('SECRET'))throw Error('Overview/identity/privacy');checks+=3;
await db.query('select chs_mark_messages_read($1,$2)',[b,m1]);if((await overview()).find(r=>r.peer_id===b).unread_count!==1)throw Error('Partial cursor');checks++;
await db.query('select chs_mark_messages_read($1,$2)',[b,m2]);await db.query('select chs_mark_messages_read($1,$2)',[b,m1]);if((await overview()).find(r=>r.peer_id===b).unread_count!==0)throw Error('Cursor regression');checks++;
async function rejects(sql,args){try{await db.query(sql,args);throw Error('Unexpected permission');}catch(e){if(e.message==='Unexpected permission')throw e;checks++;}}
await rejects('select * from chs_dm_receipts');await rejects('select chs_mark_messages_read($1,$2)',[c,m1]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[outsider]);if((await overview()).length)throw Error('Other account leak');checks++;await rejects('select chs_mark_messages_read($1,$2)',[b,m2]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('reset role');await db.query('insert into chs_direct_messages(id,sender,recipient,body) values($1,$2,$3,$4)',[m3,b,a,'New after read']);await db.exec('set role authenticated');if((await overview()).find(r=>r.peer_id===b).unread_count!==1)throw Error('Incoming during read lost');checks++;
await db.query("select set_config('test.banned','true',false)");if((await overview()).length)throw Error('Ban bypass');checks++;await rejects('select chs_mark_messages_read($1,$2)',[b,m3]);
await db.exec('reset role;set role anon');await rejects('select chs_social_overview_v2()');console.log(JSON.stringify({checks,status:'passed',scope:'PGlite actual SQL, no real messages sent'}));await db.close();
