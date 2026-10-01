-- Private server-owned authorization, moderation, and coarse beta metrics.
create table public.chs_staff_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('user','moderator','admin','super_admin')),
 updated_at timestamptz not null default now()
);
create table public.chs_player_blocks (
 user_id uuid not null references auth.users(id) on delete cascade,
 target_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,target_id),check(user_id<>target_id)
);
create index chs_player_blocks_target on public.chs_player_blocks(target_id);
create table public.chs_player_reports (
 id uuid primary key,
 reporter_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete set null,
 lobby_code text not null check(lobby_code ~ '^[A-Z0-9]{5}$'),
 category text not null check(category in ('dangerous_driving','harassment','cheating','privacy','other')),
 comment text not null default '' check(char_length(comment)<=500),
 status text not null default 'open' check(status in ('open','in_review','resolved','dismissed')),
 resolution text not null default '' check(char_length(resolution)<=500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index chs_reports_status_created on public.chs_player_reports(status,created_at desc);
create index chs_reports_reporter_created on public.chs_player_reports(reporter_id,created_at desc);
create index chs_reports_target_created on public.chs_player_reports(target_id,created_at desc);
create table public.chs_daily_activity (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null default (now() at time zone 'Europe/Berlin')::date,
 last_at timestamptz not null default now(),primary key(day,user_id)
);
create index chs_activity_user on public.chs_daily_activity(user_id,day desc);
create table public.chs_user_regions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 country text not null check(country in ('DE','AT','CH','OTHER')),
 region text check(region in ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH')),
 check(country='DE' or region is null)
);
create table public.chs_onboarding (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version text not null,seen_at timestamptz not null default now()
);
create table public.chs_match_metrics (
 result_id uuid primary key,lobby_code text not null,
 started_at timestamptz not null,ended_at timestamptz not null,
 duration_seconds integer not null check(duration_seconds between 0 and 21600),
 player_count integer not null check(player_count between 1 and 20),
 visibility text not null check(visibility in ('PUBLIC','PRIVATE')),
 aborted boolean not null,reason text not null,
 check(ended_at>=started_at)
);
create index chs_matches_end on public.chs_match_metrics(ended_at desc);
create table public.chs_player_round_stats (
 user_id uuid not null references auth.users(id) on delete cascade,
 result_id uuid not null references public.chs_match_metrics(result_id) on delete cascade,
 role text not null check(role in ('HIDER','SEEKER')),
 finds integer not null check(finds between 0 and 20),
 survival_seconds integer not null check(survival_seconds between 0 and 21600),
 won boolean not null,primary key(user_id,result_id)
);
create index chs_round_stats_result on public.chs_player_round_stats(result_id);
create table public.chs_ops_events (
 id uuid primary key,at timestamptz not null,
 category text not null check(category in ('API','AUTH','GPS','DISCONNECT','REJOIN','BACKEND','FRONTEND','VEHICLE','CHAT','SUPABASE','NETWORK')),
 code text not null check(code ~ '^[A-Z0-9_]{1,50}$'),
 count integer not null default 1 check(count between 1 and 100000)
);
create index chs_ops_at on public.chs_ops_events(at desc);
alter table public.chs_admin_audit drop constraint chs_admin_audit_action_check;
alter table public.chs_admin_audit add constraint chs_admin_audit_action_check check(action in ('BAN','UNBAN','ROLE_CHANGE','REPORT_UPDATE','LOBBY_CLOSE'));
alter table public.chs_admin_audit add column context jsonb not null default '{}'::jsonb;

-- No browser-facing grants or policies: these tables are accessible only by the server.
do $$ declare tab text;begin
 foreach tab in array array['chs_staff_roles','chs_player_blocks','chs_player_reports','chs_daily_activity','chs_user_regions','chs_onboarding','chs_match_metrics','chs_player_round_stats','chs_ops_events'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select,insert,update,delete on public.%I to service_role',tab);
 end loop;
end $$;
revoke update on public.chs_admin_audit from service_role;

create function chs_private.staff_access(actor uuid,allowed text[]) returns boolean
 language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.chs_staff_roles where user_id=actor and role=any(allowed))
 and not exists(select 1 from public.chs_account_bans where user_id=actor and revoked_at is null and (until_at is null or until_at>now()));
$$;
revoke all on function chs_private.staff_access(uuid,text[]) from public,anon,authenticated;
grant usage on schema chs_private to service_role;
grant execute on function chs_private.staff_access(uuid,text[]) to service_role;

create function public.chs_admin_set_role(p_actor uuid,p_target uuid,p_role text,p_reason text) returns void
 language plpgsql security invoker set search_path='' as $$
declare previous text;begin
 perform pg_advisory_xact_lock(19371001);
 if not chs_private.staff_access(p_actor,array['super_admin']) then raise exception 'Role management forbidden'; end if;
 if p_actor=p_target or p_role not in ('user','moderator','admin','super_admin') or char_length(p_reason) not between 5 and 500 then raise exception 'Invalid role change'; end if;
 if not exists(select 1 from public.profiles where id=p_target) then raise exception 'User not found'; end if;
 select role into previous from public.chs_staff_roles where user_id=p_target for update;
 if previous='super_admin' and p_role<>'super_admin' and (select count(*) from public.chs_staff_roles where role='super_admin')<=1 then raise exception 'Last super admin protected'; end if;
 insert into public.chs_staff_roles(user_id,role) values(p_target,p_role) on conflict(user_id) do update set role=excluded.role,updated_at=now();
 insert into public.chs_admin_audit(actor_id,target_id,action,reason,context) values(p_actor,p_target,'ROLE_CHANGE',p_reason,jsonb_build_object('before',coalesce(previous,'user'),'after',p_role));
end $$;

create function public.chs_admin_update_report(p_actor uuid,p_id uuid,p_status text,p_resolution text,p_expected timestamptz) returns void
 language plpgsql security invoker set search_path='' as $$
declare report public.chs_player_reports;begin
 if not chs_private.staff_access(p_actor,array['moderator','admin','super_admin']) then raise exception 'Report access forbidden'; end if;
 if p_status not in ('open','in_review','resolved','dismissed') or char_length(p_resolution) not between 5 and 500 then raise exception 'Invalid report resolution'; end if;
 select * into report from public.chs_player_reports where id=p_id for update;
 if not found then raise exception 'Report not found'; end if;
 if report.updated_at is distinct from p_expected then raise exception 'Report changed; refresh required'; end if;
 update public.chs_player_reports set status=p_status,resolution=p_resolution,updated_at=greatest(now(),report.updated_at+interval '1 microsecond') where id=p_id;
 insert into public.chs_admin_audit(actor_id,target_id,action,reason,context) values(p_actor,report.target_id,'REPORT_UPDATE',p_resolution,jsonb_build_object('report_id',p_id,'before',report.status,'after',p_status));
end $$;

create or replace function public.chs_admin_set_ban(p_actor uuid,p_target uuid,p_reason text,p_until timestamptz,p_revoke boolean) returns void
 language plpgsql security invoker set search_path='' as $$
declare target_role text;begin
 if not chs_private.staff_access(p_actor,array['admin','super_admin']) then raise exception 'Ban access forbidden'; end if;
 select role into target_role from public.chs_staff_roles where user_id=p_target;
 if p_actor=p_target or p_target is null or char_length(p_reason) not between 5 and 500 then raise exception 'Invalid moderation target'; end if;
 if target_role='super_admin' or (target_role='admin' and not chs_private.staff_access(p_actor,array['super_admin'])) then raise exception 'Protected staff account'; end if;
 insert into public.chs_account_bans(user_id,reason,until_at,revoked_at,updated_at) values(p_target,p_reason,p_until,case when p_revoke then now() else null end,now())
 on conflict(user_id) do update set reason=excluded.reason,until_at=excluded.until_at,revoked_at=excluded.revoked_at,updated_at=excluded.updated_at;
 insert into public.chs_admin_audit(actor_id,target_id,action,reason) values(p_actor,p_target,case when p_revoke then 'UNBAN' else 'BAN' end,p_reason);
end $$;

create function public.chs_admin_log_close(p_actor uuid,p_code text,p_reason text) returns void
 language plpgsql security invoker set search_path='' as $$ begin
 if not chs_private.staff_access(p_actor,array['admin','super_admin']) then raise exception 'Lobby access forbidden'; end if;
 if p_code !~ '^[A-Z0-9]{5}$' or char_length(p_reason) not between 5 and 500 then raise exception 'Invalid closure'; end if;
 insert into public.chs_admin_audit(actor_id,action,reason,context) values(p_actor,'LOBBY_CLOSE',p_reason,jsonb_build_object('lobby_code',p_code));
end $$;

create function chs_private.audit_immutable() returns trigger
 language plpgsql security invoker set search_path='' as $$ begin
 if tg_op='DELETE' and old.created_at<now()-interval '90 days' then return old; end if;
 -- Account deletion may anonymize the FK identifiers, but never rewrite the action.
 if tg_op='UPDATE' and (to_jsonb(new)-array['actor_id','target_id'])=(to_jsonb(old)-array['actor_id','target_id'])
 and (new.actor_id is null or new.actor_id=old.actor_id) and (new.target_id is null or new.target_id=old.target_id) then return new; end if;
 raise exception 'Audit records are append-only';
end $$;
revoke all on function chs_private.audit_immutable() from public,anon,authenticated;
create trigger chs_audit_immutable before update or delete on public.chs_admin_audit for each row execute function chs_private.audit_immutable();

create function public.chs_record_match(p_match jsonb,p_players jsonb) returns void
 language plpgsql security invoker set search_path='' as $$
declare inserted integer;begin
 insert into public.chs_match_metrics(result_id,lobby_code,started_at,ended_at,duration_seconds,player_count,visibility,aborted,reason)
 values((p_match->>'result_id')::uuid,p_match->>'lobby_code',(p_match->>'started_at')::timestamptz,(p_match->>'ended_at')::timestamptz,(p_match->>'duration_seconds')::integer,(p_match->>'player_count')::integer,p_match->>'visibility',(p_match->>'aborted')::boolean,p_match->>'reason') on conflict(result_id) do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 and not (p_match->>'aborted')::boolean then
  insert into public.chs_player_round_stats(user_id,result_id,role,finds,survival_seconds,won)
  select (v->>'user_id')::uuid,(p_match->>'result_id')::uuid,v->>'role',(v->>'finds')::integer,(v->>'survival_seconds')::integer,(v->>'won')::boolean from jsonb_array_elements(p_players) v;
 end if;
end $$;

create function public.chs_admin_beta_stats(p_actor uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare today date:=(now() at time zone 'Europe/Berlin')::date;begin
 if not chs_private.staff_access(p_actor,array['admin','super_admin']) then raise exception 'Stats access forbidden'; end if;
 return jsonb_build_object(
  'registered',(select count(*) from public.profiles),
  'active_day',(select count(distinct user_id) from public.chs_daily_activity where day=today),
  'active_week',(select count(distinct user_id) from public.chs_daily_activity where day>=today-6),
  'active_month',(select count(distinct user_id) from public.chs_daily_activity where day>=today-29),
  'matches_total',(select count(*) from public.chs_match_metrics),
  'matches_today',(select count(*) from public.chs_match_metrics where (ended_at at time zone 'Europe/Berlin')::date=today),
  'average_players',(select round(avg(player_count),1) from public.chs_match_metrics),
  'average_seconds',(select round(avg(duration_seconds)) from public.chs_match_metrics where not aborted),
  'reports_open',(select count(*) from public.chs_player_reports where status in ('open','in_review')),
  'operations',(select coalesce(jsonb_agg(v),'[]'::jsonb) from (select category,code,sum(count) as count from public.chs_ops_events where at>now()-interval '24 hours' group by category,code order by category,code) v),
  'regions',(select coalesce(jsonb_agg(v),'[]'::jsonb) from (select country,region,count(*) as players from public.chs_user_regions group by country,region having count(*)>=3 order by country,region) v),
  'region_source','optional_self_report',
  'first_recorded_match',(select min(started_at) from public.chs_match_metrics)
 );
end $$;

create function public.chs_beta_retention() returns void language plpgsql security invoker set search_path='' as $$ begin
 delete from public.chs_daily_activity where day<(now() at time zone 'Europe/Berlin')::date-30;
 delete from public.chs_ops_events where at<now()-interval '30 days';
 delete from public.chs_player_reports where (status in ('resolved','dismissed') and updated_at<now()-interval '30 days') or created_at<now()-interval '90 days';
 delete from public.chs_admin_audit where created_at<now()-interval '90 days';
 -- Expiry removes coordinate-bearing data even when the game server is asleep.
 update public.chs_server_state set snapshot=jsonb_set(snapshot,'{lobbies}','[]'::jsonb) where expires_at<now() and jsonb_array_length(coalesce(snapshot->'lobbies','[]'::jsonb))>0;
end $$;

do $$ declare item record;begin
 for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('chs_admin_set_role','chs_admin_update_report','chs_admin_set_ban','chs_admin_log_close','chs_record_match','chs_admin_beta_stats','chs_beta_retention') loop
  execute format('revoke all on function %s from public,anon,authenticated',item.signature);
  execute format('grant execute on function %s to service_role',item.signature);
 end loop;
end $$;

-- Carry existing blocks/reports out of the expiring gameplay snapshot.
with legacy as (
 select case when b->>0 ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (b->>0)::uuid end as owner,
 case when t #>> '{}' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (t #>> '{}')::uuid end as target
 from public.chs_server_state s cross join lateral jsonb_array_elements(coalesce(s.snapshot->'blocks','[]')) b
 cross join lateral jsonb_array_elements(b->1) t where s.slot='gameplay'
)
insert into public.chs_player_blocks(user_id,target_id)
 select l.owner,l.target from legacy l join auth.users a on a.id=l.owner join auth.users b on b.id=l.target where l.owner<>l.target on conflict do nothing;
with legacy as (
 select r,case when r->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (r->>'id')::uuid end as id,
 case when r->>'reporter' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (r->>'reporter')::uuid end as reporter,
 case when r->>'target' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (r->>'target')::uuid end as target
 from public.chs_server_state s cross join lateral jsonb_array_elements(coalesce(s.snapshot->'reports','[]')) r where s.slot='gameplay'
)
insert into public.chs_player_reports(id,reporter_id,target_id,lobby_code,category,comment)
 select l.id,a.id,b.id,l.r->>'code','other',left(coalesce(l.r->>'comment',l.r->>'reason',''),500)
 from legacy l left join auth.users a on a.id=l.reporter left join auth.users b on b.id=l.target
 where l.id is not null and l.r->>'code' ~ '^[A-Z0-9]{5}$' on conflict do nothing;

create function public.chs_personal_beta_stats(p_user uuid) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('recordedRounds',count(*),'seekerRounds',count(*) filter(where role='SEEKER'),
 'hiderRounds',count(*) filter(where role='HIDER'),'finds',coalesce(sum(finds),0),'wins',count(*) filter(where won),
 'averageSurvivalSeconds',round(avg(survival_seconds) filter(where role='HIDER')))
 from public.chs_player_round_stats where user_id=p_user;
$$;
revoke all on function public.chs_personal_beta_stats(uuid) from public,anon,authenticated;
grant execute on function public.chs_personal_beta_stats(uuid) to service_role;

-- Database scheduling works independently of Render sleep/restarts.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('chs-beta-retention','*/10 * * * *','select public.chs_beta_retention()');
