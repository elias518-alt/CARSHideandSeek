-- PLUS is manually assigned for now. No client or checkout can issue a grant.
create table public.chs_plus_entitlements (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 expires_at timestamptz, granted_by uuid references public.profiles(id) on delete set null,
 source text not null default 'manual' check(source in ('manual','payment')),
 updated_at timestamptz not null default now()
);
create table public.chs_player_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 accent text not null default 'orange' check(accent in ('orange','pink','purple','blue','turquoise','white'))
);
create table public.chs_plus_audit (
 id bigint generated always as identity primary key,
 actor uuid references public.profiles(id) on delete set null,
 target uuid references public.profiles(id) on delete set null,
 action text not null check(action in ('grant','revoke')),
 previous_state jsonb, next_state jsonb, reason text not null,
 created_at timestamptz not null default now()
);
do $$declare t text;begin
 foreach t in array array['chs_plus_entitlements','chs_player_preferences','chs_plus_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
create function chs_private.plus_read() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); entitlement public.chs_plus_entitlements%rowtype; active boolean;
begin
 if actor is null or not chs_private.account_allowed() then raise exception 'Anmeldung erforderlich.';end if;
 select * into entitlement from public.chs_plus_entitlements where user_id=actor;
 active:=entitlement.user_id is not null and (entitlement.expires_at is null or entitlement.expires_at>now());
 return jsonb_build_object('active',active,'expires_at',entitlement.expires_at,'server_time',now(),
  'accent',case when active then coalesce((select accent from public.chs_player_preferences where user_id=actor),'orange') else 'orange' end,
  'can_manage',exists(select 1 from public.chs_staff_roles where user_id=actor and role in ('admin','super_admin')),
  'purchases_enabled',false);
end $$;
create function chs_private.plus_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; expiry timestamptz; old_state jsonb; new_state jsonb; reason text; accent text;
begin
 if actor is null or not chs_private.account_allowed() then raise exception 'Anmeldung erforderlich.';end if;
 if action='accent' then
  perform pg_advisory_xact_lock(hashtextextended(actor::text,714));
  accent:=payload->>'accent';
  if accent is null or accent not in ('orange','pink','purple','blue','turquoise','white') then raise exception 'Unbekannte Farbe.';end if;
  if accent<>'orange' and not exists(select 1 from public.chs_plus_entitlements where user_id=actor and (expires_at is null or expires_at>now())) then raise exception 'PLUS erforderlich.';end if;
  insert into public.chs_player_preferences(user_id,accent) values(actor,accent) on conflict(user_id) do update set accent=excluded.accent;
 elsif action in ('grant','revoke') then
  if not exists(select 1 from public.chs_staff_roles where user_id=actor and role in ('admin','super_admin')) then raise exception 'Administratorrechte erforderlich.';end if;
  target:=(payload->>'target')::uuid;reason:=btrim(payload->>'reason');
  if target is null or not exists(select 1 from public.profiles where id=target) then raise exception 'Spieler nicht gefunden.';end if;
  if reason is null or length(reason) not between 3 and 300 then raise exception 'Begründung mit 3 bis 300 Zeichen erforderlich.';end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,714));
  select to_jsonb(e) into old_state from public.chs_plus_entitlements e where user_id=target;
  if action='grant' then
   expiry:=nullif(payload->>'expires_at','')::timestamptz;
   if expiry is not null and (not isfinite(expiry) or expiry<=now()) then raise exception 'Ablaufdatum muss in der Zukunft liegen.';end if;
   insert into public.chs_plus_entitlements(user_id,expires_at,granted_by) values(target,expiry,actor)
    on conflict(user_id) do update set expires_at=excluded.expires_at,granted_by=actor,source='manual',updated_at=now();
   select to_jsonb(e) into new_state from public.chs_plus_entitlements e where user_id=target;
  else
   delete from public.chs_plus_entitlements where user_id=target;
  end if;
  insert into public.chs_plus_audit(actor,target,action,previous_state,next_state,reason) values(actor,target,action,old_state,new_state,reason);
 else
  raise exception 'Diese Aktion ist nicht verfügbar. Käufe sind deaktiviert.';
 end if;
 return chs_private.plus_read();
end $$;
create function public.chs_plus_read() returns jsonb language sql stable security invoker set search_path='' as $$select chs_private.plus_read()$$;
create function public.chs_plus_action(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select chs_private.plus_action(action,payload)$$;
revoke all on function chs_private.plus_read(),chs_private.plus_action(text,jsonb),public.chs_plus_read(),public.chs_plus_action(text,jsonb) from public,anon,authenticated;
grant execute on function chs_private.plus_read(),chs_private.plus_action(text,jsonb),public.chs_plus_read(),public.chs_plus_action(text,jsonb) to authenticated;
-- Match the existing 90-day administrative audit retention policy.
create function chs_private.prune_plus_audit() returns void language sql security definer set search_path='' as $$
 delete from public.chs_plus_audit where created_at<now()-interval '90 days';
$$;
revoke all on function chs_private.prune_plus_audit() from public,anon,authenticated;
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('chs-plus-audit-retention','17 3 * * *','select chs_private.prune_plus_audit()');
 end if;
end $$;
