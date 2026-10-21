-- Server-only moderation inbox and auditable level management.
begin;
alter table public.chs_player_reports alter column lobby_code drop not null;
alter table public.chs_player_reports add column if not exists kind text not null default 'player' check(kind in ('feedback','player'));
alter table public.chs_player_reports add column if not exists area text not null default 'lobby' check(area in ('home','lobby','garage','profile','stats','friends','crew','map','wardrobe','pets','other'));
alter table public.chs_player_reports add column if not exists evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object' and octet_length(evidence::text)<=40000);
alter table public.chs_player_reports drop constraint if exists chs_player_reports_category_check;
alter table public.chs_player_reports add constraint chs_player_reports_category_check check(category in ('dangerous_driving','harassment','cheating','privacy','other','bug','idea','ui'));
alter table public.chs_admin_audit drop constraint if exists chs_admin_audit_action_check;
alter table public.chs_admin_audit add constraint chs_admin_audit_action_check check(action in ('BAN','UNBAN','ROLE_CHANGE','REPORT_UPDATE','LOBBY_CLOSE','LEVEL_CHANGE'));
create index if not exists chs_reports_inbox on public.chs_player_reports(kind,status,created_at desc);

create or replace function public.chs_admin_set_level(p_actor uuid,p_target uuid,p_level integer,p_expected_xp integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old_level integer;old_xp integer;new_xp integer;
begin
 if not chs_private.staff_access(p_actor,array['admin','super_admin']) then raise exception 'Level access forbidden'; end if;
 if p_level is null or p_level not between 1 and 50 or p_expected_xp is null or p_reason is null or char_length(trim(p_reason)) not between 5 and 500 then raise exception 'Invalid level change'; end if;
 if p_actor<>p_target and exists(select 1 from public.chs_staff_roles where user_id=p_target and role='super_admin') and not chs_private.staff_access(p_actor,array['super_admin']) then raise exception 'Protected staff account'; end if;
 select level,xp into old_level,old_xp from public.profiles where id=p_target for update;
 if not found then raise exception 'User not found'; end if;
 if old_xp<>p_expected_xp then raise exception 'Progress changed; refresh required'; end if;
 new_xp:=(p_level-1)*1000;
 update public.profiles set level=p_level,xp=new_xp,updated_at=now() where id=p_target;
 insert into public.chs_admin_audit(actor_id,target_id,action,reason,context)
 values(p_actor,p_target,'LEVEL_CHANGE',trim(p_reason),jsonb_build_object('before_level',old_level,'before_xp',old_xp,'after_level',p_level,'after_xp',new_xp));
 return jsonb_build_object('level',p_level,'xp',new_xp);
end $$;

create or replace function public.chs_submit_feedback(p_actor uuid,p_id uuid,p_kind text,p_area text,p_target uuid,p_category text,p_comment text,p_lobby text,p_evidence jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) or exists(select 1 from public.chs_account_bans where user_id=p_actor and revoked_at is null and (until_at is null or until_at>now())) then raise exception 'Feedback access forbidden'; end if;
 if p_kind is null or p_kind not in ('feedback','player') or p_comment is null or char_length(trim(p_comment)) not between 5 and 500 then raise exception 'Invalid feedback'; end if;
 if p_kind='player' and (p_target is null or p_target=p_actor or p_category not in ('dangerous_driving','harassment','cheating','privacy','other')) then raise exception 'Invalid report'; end if;
 if p_kind='feedback' and (p_target is not null or p_category not in ('bug','idea','ui')) then raise exception 'Invalid feedback category'; end if;
 if p_target is not null and not exists(select 1 from public.profiles where id=p_target) then raise exception 'Target not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,11600));
 if (select count(*) from public.chs_player_reports where reporter_id=p_actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Zu viele Meldungen. Bitte später erneut versuchen.'; end if;
 insert into public.chs_player_reports(id,reporter_id,target_id,kind,area,category,comment,lobby_code,evidence)
 values(p_id,p_actor,p_target,p_kind,p_area,p_category,trim(p_comment),p_lobby,p_evidence);
end $$;

-- Only a message received by the reporter may be attached. No general DM browser.
create or replace function public.chs_report_message_evidence(p_actor uuid,p_target uuid,p_message uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare message jsonb;
begin
 select jsonb_build_object('id',m.id,'name',coalesce(p.username,'Spieler'),'body',m.body,'at',m.created_at)
 into message from public.chs_direct_messages m left join public.profiles p on p.id=m.sender
 where m.id=p_message and m.sender=p_target and m.recipient=p_actor;
 if message is null then raise exception 'Message access forbidden'; end if;
 return jsonb_build_object('source','reported_direct_message','capturedAt',now(),'messages',jsonb_build_array(message),'events','[]'::jsonb);
end $$;

create or replace function public.chs_admin_inbox(p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not chs_private.staff_access(p_actor,array['moderator','admin','super_admin']) then raise exception 'Inbox access forbidden'; end if;
 return (select jsonb_build_object('open',count(*) filter(where status='open'),
 'feedback',count(*) filter(where status='open' and kind='feedback'),
 'players',count(*) filter(where status='open' and kind='player'),
 'inReview',count(*) filter(where status='in_review')) from public.chs_player_reports);
end $$;

do $$ declare name text;sig regprocedure;begin
 foreach name in array array['chs_admin_set_level','chs_submit_feedback','chs_report_message_evidence','chs_admin_inbox'] loop
  select p.oid::regprocedure into sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=name;
  execute format('revoke all on function %s from public,anon,authenticated',sig);
  execute format('grant execute on function %s to service_role',sig);
 end loop;
end $$;
commit;
