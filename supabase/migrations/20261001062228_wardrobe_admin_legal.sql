-- Server-only moderation and evidence. Users cannot grant themselves roles,
-- remove a ban or forge a server-issued acceptance timestamp.
create table public.chs_account_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 500),
  until_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.chs_legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  document_hash text not null check (document_hash ~ '^[a-f0-9]{64}$'),
  document_snapshot jsonb not null,
  accepted_at timestamptz not null default now(),
  terms boolean not null check (terms),
  safety boolean not null check (safety),
  adult boolean not null check (adult),
  privacy_read boolean not null check (privacy_read),
  primary key(user_id,version,document_hash)
);
create table public.chs_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('BAN','UNBAN')),
  reason text not null check (char_length(reason) between 5 and 500),
  created_at timestamptz not null default now()
);
create index chs_admin_audit_created on public.chs_admin_audit(created_at);
alter table public.chs_account_bans enable row level security;
alter table public.chs_legal_acceptances enable row level security;
alter table public.chs_admin_audit enable row level security;
revoke all on public.chs_account_bans,public.chs_legal_acceptances,public.chs_admin_audit from public,anon,authenticated;
grant select,insert,update,delete on public.chs_account_bans,public.chs_legal_acceptances,public.chs_admin_audit to service_role;

create schema if not exists chs_private;
revoke all on schema chs_private from public,anon;
grant usage on schema chs_private to authenticated;
-- This narrowly scoped definer only answers for auth.uid(); no arbitrary IDs,
-- no role mutation, no user-editable metadata and no exposed-schema function.
create function chs_private.account_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and not exists (
    select 1 from public.chs_account_bans b
    where b.user_id=auth.uid() and b.revoked_at is null
      and (b.until_at is null or b.until_at > now())
  );
$$;
revoke all on function chs_private.account_allowed() from public,anon;
grant execute on function chs_private.account_allowed() to authenticated;

-- Restrictive policies compose with existing ownership policies (AND). They
-- grant no new rights. Only existing app tables are targeted.
do $$
declare tab text;
begin
  foreach tab in array array['profiles','vehicles','achievements','user_achievements','game_results','friendships','direct_messages','lobbies','lobby_members','lobby_messages','chs_friendships','chs_direct_messages'] loop
    if to_regclass('public.'||tab) is not null then
      execute format('create policy chs_active_account on public.%I as restrictive for all to authenticated using ((select chs_private.account_allowed())) with check ((select chs_private.account_allowed()))',tab);
    end if;
  end loop;
end;
$$;
create policy chs_active_account on storage.objects as restrictive for all to authenticated
  using ((select chs_private.account_allowed())) with check ((select chs_private.account_allowed()));

-- Existing SECURITY DEFINER RPCs bypass RLS; add the same ban check inside
-- those exact app entry points while preserving signatures and privileges.
do $$
declare item record; definition text; guarded text;
begin
  for item in select p.oid,p.proname,l.lanname from pg_proc p
    join pg_language l on l.oid=p.prolang
    where p.pronamespace='public'::regnamespace and p.proname in
      ('chs_claim_game_result','chs_get_messages','chs_remove_friend','chs_respond_request','chs_search_players','chs_send_message','chs_send_request','chs_social_overview','chs_update_my_profile') loop
    definition:=pg_get_functiondef(item.oid);
    if item.lanname='plpgsql' then
      guarded:=regexp_replace(definition,E'\nbegin\r?\n',E'\nbegin\n  if not chs_private.account_allowed() then raise exception ''Konto gesperrt oder Anmeldung fehlt.''; end if;\n','i');
    elsif item.lanname='sql' then
      guarded:=replace(definition,'where auth.uid() is not null','where chs_private.account_allowed() and auth.uid() is not null');
    else raise exception 'Unsupported app RPC language: %',item.proname;
    end if;
    if guarded=definition then raise exception 'Missing account guard in %',item.proname; end if;
    execute guarded;
  end loop;
end;
$$;

-- An atomic service-role-only transaction: no unaudited successful ban.
create function public.chs_admin_set_ban(p_actor uuid,p_target uuid,p_reason text,p_until timestamptz,p_revoke boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_actor is null or p_target is null or p_actor=p_target then raise exception 'Invalid moderation target'; end if;
  insert into public.chs_account_bans(user_id,reason,until_at,revoked_at,updated_at)
  values(p_target,p_reason,p_until,case when p_revoke then now() else null end,now())
  on conflict(user_id) do update set reason=excluded.reason,until_at=excluded.until_at,revoked_at=excluded.revoked_at,updated_at=excluded.updated_at;
  insert into public.chs_admin_audit(actor_id,target_id,action,reason)
  values(p_actor,p_target,case when p_revoke then 'UNBAN' else 'BAN' end,p_reason);
  delete from public.chs_admin_audit where created_at < now()-interval '90 days';
end;
$$;
revoke all on function public.chs_admin_set_ban(uuid,uuid,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.chs_admin_set_ban(uuid,uuid,text,timestamptz,boolean) to service_role;
