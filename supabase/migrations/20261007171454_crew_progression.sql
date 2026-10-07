-- Additive crew system. All writes run through authenticated, account-guarded RPCs.
create table public.chs_crews (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(btrim(name)) between 3 and 32),
 tag text not null unique check(tag ~ '^[A-Z0-9]{2,6}$'),
 logo text not null default 'shield' check(logo in ('shield','crown','target','car','star','bolt')),
 description text not null default '' check(char_length(description)<=280),
 join_mode text not null default 'OPEN' check(join_mode in ('OPEN','REQUEST','INVITE')),
 member_invites boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.chs_crew_members (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 crew_id uuid not null references public.chs_crews(id) on delete cascade,
 role text not null default 'MEMBER' check(role in ('CHIEF','VICE','OFFICER','MEMBER')),
 joined_at timestamptz not null default now()
);
create index chs_crew_members_crew on public.chs_crew_members(crew_id);
create table public.chs_crew_invites (
 id uuid primary key default gen_random_uuid(),
 crew_id uuid not null references public.chs_crews(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 invited_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 unique(crew_id,user_id)
);
create index chs_crew_invites_user on public.chs_crew_invites(user_id);
create index chs_crew_invites_sender on public.chs_crew_invites(invited_by);
create index if not exists chs_profiles_ranking on public.profiles(xp desc,wins desc,id);
create table public.chs_crew_requests (
 crew_id uuid not null references public.chs_crews(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(crew_id,user_id)
);
create index chs_crew_requests_user on public.chs_crew_requests(user_id);
create table public.chs_cosmetic_choices (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 frame text not null default 'default', title text not null default ''
);
create table public.chs_level_rewards (
 id text primary key, level int not null check(level between 1 and 50),
 kind text not null check(kind in ('frame','title')), label text not null, value text not null
);
insert into public.chs_level_rewards values
 ('frame_copper',5,'frame','Kupfer-Rahmen','copper'),
 ('title_night',10,'title','Titel: Night Rider','Night Rider'),
 ('frame_neon',15,'frame','Neon-Rahmen','neon'),
 ('title_tracker',20,'title','Titel: City Tracker','City Tracker'),
 ('frame_chrome',30,'frame','Chrom-Rahmen','chrome'),
 ('title_legend',40,'title','Titel: Street Legend','Street Legend'),
 ('frame_champion',50,'frame','Champion-Rahmen','champion');
do $$ declare t text; begin
 foreach t in array array['chs_crews','chs_crew_members','chs_crew_invites','chs_crew_requests','chs_cosmetic_choices','chs_level_rewards'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;

create function chs_private.crew_role_power(r text) returns int language sql immutable set search_path='' as $$
 select case r when 'CHIEF' then 4 when 'VICE' then 3 when 'OFFICER' then 2 when 'MEMBER' then 1 else 0 end
$$;
-- An account deletion cannot leave its crew without a chief.
create function chs_private.crew_deleted_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='CHIEF' and exists(select 1 from public.chs_crews where id=old.crew_id) then
  perform 1 from public.chs_crews where id=old.crew_id for update;
  update public.chs_crew_members set role='CHIEF' where user_id=(select user_id from public.chs_crew_members where crew_id=old.crew_id order by chs_private.crew_role_power(role) desc,joined_at,user_id limit 1);
  if not found then delete from public.chs_crews where id=old.crew_id; end if;
 end if;
 return old;
end $$;
create trigger chs_crew_member_deleted after delete on public.chs_crew_members for each row execute function chs_private.crew_deleted_member();

-- Display data only: no emails, locations, private garage lists or account metadata.
create function chs_private.community_player(uid uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('user_id',p.id,'peer_id',p.id,'username',p.username,'player_tag',p.player_tag,'avatar_url',p.avatar_url,
 'level',p.level,'xp',p.xp,'points',p.xp,'online',coalesce((select max(a.last_at) from public.chs_daily_activity a where a.user_id=p.id and a.day>=current_date-1),p.last_seen_at)>now()-interval '2 minutes',
 'frame',coalesce(c.frame,'default'),'title',coalesce(c.title,''),
 'active_vehicle',(select jsonb_build_object('brand',v.brand,'model',v.model,'body_type',v.body_type,'color',v.color,'photo_path',v.photo_path)
 from public.vehicles v where v.user_id=p.id and (v.id=p.active_vehicle_id or v.is_active)
 order by (v.id=p.active_vehicle_id) desc nulls last,v.updated_at desc,v.id limit 1))
 from public.profiles p left join public.chs_cosmetic_choices c on c.user_id=p.id where p.id=uid
$$;

create function chs_private.crew_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); cid uuid; target uuid; mine public.chs_crew_members%rowtype; other public.chs_crew_members%rowtype;
 crew public.chs_crews%rowtype; selected public.chs_level_rewards%rowtype; newrole text; approved boolean;
begin
 if actor is null or not chs_private.account_allowed() then raise exception 'Anmeldung fehlt oder Konto gesperrt.'; end if;
 -- Serialize actions for a user across crews; the unique membership constraint also protects cross-actor races.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,701));
 select * into mine from public.chs_crew_members where user_id=actor;
 if action='equip' then
  insert into public.chs_cosmetic_choices(user_id) values(actor) on conflict do nothing;
  if payload->>'reward' in ('reset_frame','reset_title') then
   update public.chs_cosmetic_choices set frame=case when payload->>'reward'='reset_frame' then 'default' else frame end,
    title=case when payload->>'reward'='reset_title' then '' else title end where user_id=actor;
  else
   select * into selected from public.chs_level_rewards where id=payload->>'reward';
   if not found or selected.level>(select level from public.profiles where id=actor) then raise exception 'Dieses Level ist noch nicht erreicht.'; end if;
   update public.chs_cosmetic_choices set frame=case when selected.kind='frame' then selected.value else frame end,
    title=case when selected.kind='title' then selected.value else title end where user_id=actor;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if action='create' then
  if mine.user_id is not null then raise exception 'Du bist bereits in einer Crew.'; end if;
  insert into public.chs_crews(name,tag,logo,description,join_mode,member_invites)
  values(btrim(payload->>'name'),upper(btrim(payload->>'tag')),coalesce(payload->>'logo','shield'),coalesce(btrim(payload->>'description'),''),coalesce(payload->>'join_mode','OPEN'),coalesce((payload->>'member_invites')::boolean,false)) returning id into cid;
  insert into public.chs_crew_members(user_id,crew_id,role) values(actor,cid,'CHIEF');
  delete from public.chs_crew_requests where user_id=actor;
  delete from public.chs_crew_invites where user_id=actor;
  return jsonb_build_object('ok',true,'crew_id',cid);
 end if;
 cid:=coalesce(nullif(payload->>'crew_id','')::uuid,mine.crew_id);
 target:=nullif(payload->>'user_id','')::uuid;
 select * into crew from public.chs_crews where id=cid for update;
 if not found then raise exception 'Crew nicht gefunden.'; end if;
 -- Re-read after acquiring the crew lock (roles may have changed while waiting).
 select * into mine from public.chs_crew_members where user_id=actor;
 if action in ('join','request','accept_invite') then
  if mine.user_id is not null then raise exception 'Du bist bereits in einer Crew.'; end if;
  if exists(select 1 from public.chs_player_blocks b join public.chs_crew_members m on m.crew_id=cid where (b.user_id=actor and b.target_id=m.user_id) or (b.target_id=actor and b.user_id=m.user_id)) then raise exception 'Beitritt wegen Blockierung nicht möglich.'; end if;
  if (select count(*) from public.chs_crew_members where crew_id=cid)>=50 then raise exception 'Diese Crew ist voll (50 Mitglieder).'; end if;
  if action='request' then
   if crew.join_mode<>'REQUEST' then raise exception 'Diese Crew nimmt keine Beitrittsanfragen an.'; end if;
   if (select count(*) from public.chs_crew_requests where user_id=actor)>=10 then raise exception 'Maximal 10 offene Beitrittsanfragen.'; end if;
   insert into public.chs_crew_requests(crew_id,user_id) values(cid,actor) on conflict do nothing;
  else
   if action='join' and crew.join_mode<>'OPEN' then raise exception 'Beitritt nur per Anfrage oder Einladung.'; end if;
   if action='accept_invite' and not exists(select 1 from public.chs_crew_invites where crew_id=cid and user_id=actor and expires_at>now()) then raise exception 'Einladung nicht mehr verfügbar.'; end if;
   insert into public.chs_crew_members(user_id,crew_id) values(actor,cid);
   delete from public.chs_crew_requests where user_id=actor;
   delete from public.chs_crew_invites where user_id=actor;
  end if;
 elsif action='decline_invite' then
  delete from public.chs_crew_invites where crew_id=cid and user_id=actor;
 elsif action='cancel_request' then
  delete from public.chs_crew_requests where crew_id=cid and user_id=actor;
 else
  if mine.crew_id is distinct from cid then raise exception 'Du bist kein Mitglied dieser Crew.'; end if;
  select * into other from public.chs_crew_members where user_id=target and crew_id=cid;
  if action='leave' then
   -- Trigger elects the highest remaining role, oldest membership first.
   delete from public.chs_crew_members where user_id=actor;
  elsif action='delete' then
   if mine.role<>'CHIEF' then raise exception 'Nur der Crew-Chef kann die Crew löschen.'; end if;
   if payload->>'confirm_tag' is distinct from crew.tag then raise exception 'Crew-Kürzel zur Bestätigung eingeben.'; end if;
   delete from public.chs_crews where id=cid;
  elsif action='update' then
   if mine.role not in ('CHIEF','VICE') then raise exception 'Keine Berechtigung für Crew-Einstellungen.'; end if;
   if mine.role='VICE' and (payload ? 'name' or payload ? 'tag' or payload ? 'logo' or payload ? 'member_invites') then raise exception 'Name, Logo und Einladerechte verwaltet der Crew-Chef.'; end if;
   update public.chs_crews set name=coalesce(btrim(payload->>'name'),name),tag=coalesce(upper(btrim(payload->>'tag')),tag),logo=coalesce(payload->>'logo',logo),
    description=coalesce(btrim(payload->>'description'),description),join_mode=coalesce(payload->>'join_mode',join_mode),member_invites=coalesce((payload->>'member_invites')::boolean,member_invites) where id=cid;
  elsif action='role' then
   newrole:=payload->>'role';
   if target=actor or other.user_id is null or newrole is null or newrole not in ('VICE','OFFICER','MEMBER') then raise exception 'Ungültige Rollenänderung.'; end if;
   if mine.role='CHIEF' and other.role<>'CHIEF' then null;
   elsif mine.role='VICE' and other.role in ('OFFICER','MEMBER') and newrole in ('OFFICER','MEMBER') then null;
   else raise exception 'Keine Berechtigung für diese Rolle.'; end if;
   update public.chs_crew_members set role=newrole where user_id=target;
  elsif action='transfer' then
   if mine.role<>'CHIEF' or other.user_id is null or target=actor then raise exception 'Nur der Chef kann an ein Crew-Mitglied übertragen.'; end if;
   update public.chs_crew_members set role='VICE' where user_id=actor;
   update public.chs_crew_members set role='CHIEF' where user_id=target;
  elsif action='kick' then
   if target=actor or other.user_id is null or chs_private.crew_role_power(mine.role)<3 or chs_private.crew_role_power(mine.role)<=chs_private.crew_role_power(other.role) then raise exception 'Keine Berechtigung zum Entfernen.'; end if;
   delete from public.chs_crew_members where user_id=target;
  elsif action='invite' then
   if mine.role='MEMBER' and not crew.member_invites then raise exception 'Einladen ist für Mitglieder nicht freigegeben.'; end if;
   if target is null or target=actor or exists(select 1 from public.chs_crew_members where user_id=target) then raise exception 'Dieser Spieler ist bereits in einer Crew.'; end if;
   if not exists(select 1 from public.chs_friendships where status='accepted' and ((requester=actor and addressee=target) or (requester=target and addressee=actor))) then raise exception 'Lade einen bestätigten Freund ein.'; end if;
   if exists(select 1 from public.chs_player_blocks b join public.chs_crew_members m on m.crew_id=cid where (b.user_id=target and b.target_id=m.user_id) or (b.target_id=target and b.user_id=m.user_id)) then raise exception 'Einladung wegen Blockierung nicht möglich.'; end if;
   if (select count(*) from public.chs_crew_invites where crew_id=cid and expires_at>now())>=50 then raise exception 'Zu viele offene Einladungen.'; end if;
   insert into public.chs_crew_invites(crew_id,user_id,invited_by) values(cid,target,actor) on conflict(crew_id,user_id) do update set invited_by=actor,expires_at=now()+interval '7 days';
  elsif action='revoke_invite' then
   if chs_private.crew_role_power(mine.role)<2 then raise exception 'Keine Berechtigung.'; end if;
   delete from public.chs_crew_invites where crew_id=cid and user_id=target;
  elsif action='review_request' then
   if chs_private.crew_role_power(mine.role)<2 then raise exception 'Keine Berechtigung für Beitrittsanfragen.'; end if;
   if not exists(select 1 from public.chs_crew_requests where crew_id=cid and user_id=target) then raise exception 'Anfrage nicht mehr verfügbar.'; end if;
   approved:=coalesce((payload->>'accept')::boolean,false);
   if approved then
    if (select count(*) from public.chs_crew_members where crew_id=cid)>=50 then raise exception 'Diese Crew ist voll.'; end if;
    if exists(select 1 from public.chs_player_blocks b join public.chs_crew_members m on m.crew_id=cid where (b.user_id=target and b.target_id=m.user_id) or (b.target_id=target and b.user_id=m.user_id)) then raise exception 'Beitritt wegen Blockierung nicht möglich.'; end if;
    insert into public.chs_crew_members(user_id,crew_id) values(target,cid);
    delete from public.chs_crew_requests where user_id=target;
    delete from public.chs_crew_invites where user_id=target;
   else delete from public.chs_crew_requests where crew_id=cid and user_id=target; end if;
  else raise exception 'Unbekannte Crew-Aktion.';
  end if;
 end if;
 return jsonb_build_object('ok',true,'crew_id',cid);
end $$;

create function chs_private.community_read(section text,query text default '',page int default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); mine public.chs_crew_members%rowtype; result jsonb; scope_id uuid;
begin
 if actor is null or not chs_private.account_allowed() then raise exception 'Anmeldung fehlt oder Konto gesperrt.'; end if;
 select * into mine from public.chs_crew_members where user_id=actor;
 if section in ('global','crew_ranking') then
  if section='crew_ranking' and mine.user_id is null then return jsonb_build_object('rows','[]'::jsonb,'self',null,'total',0); end if;
  with ranked as (
   select p.id,row_number() over(order by p.xp desc,p.wins desc,p.id) as position
   from public.profiles p where (section='global' or exists(select 1 from public.chs_crew_members m where m.crew_id=mine.crew_id and m.user_id=p.id))
   and not exists(select 1 from public.chs_account_bans b where b.user_id=p.id and b.revoked_at is null and (b.until_at is null or b.until_at>now()))
  ), entries as (select chs_private.community_player(id)||jsonb_build_object('position',position) as item,position,id from ranked)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(item order by position) from entries where position>greatest(0,least(page,10000))*50 and position<=greatest(0,least(page,10000))*50+50),'[]'::jsonb),
   'self',(select item from entries where id=actor),'total',(select count(*) from entries)) into result;
 elsif section='search' then
  select coalesce(jsonb_agg(item),'[]'::jsonb) into result from (
   select to_jsonb(c)||jsonb_build_object('members',(select count(*) from public.chs_crew_members where crew_id=c.id),'points',(select coalesce(sum(p.xp),0) from public.chs_crew_members m join public.profiles p on p.id=m.user_id where m.crew_id=c.id),
   'requested',exists(select 1 from public.chs_crew_requests r where r.crew_id=c.id and r.user_id=actor)) item
   from public.chs_crews c where char_length(query)<=32 and (query='' or strpos(lower(c.name),lower(btrim(query)))>0 or strpos(lower(c.tag),lower(btrim(query)))>0)
   order by c.created_at desc,c.id limit 30 offset greatest(0,least(page,10000))*30
  )c;
 elsif section='progress' then
  select chs_private.community_player(actor)||jsonb_build_object('stats',jsonb_build_object('games',p.rounds_played,'wins',p.wins,'finds',p.finds,'survived',p.survived_rounds,
    'seeker_wins',(select count(*) from public.game_results where user_id=actor and won and role='SEEKER'),
    'hider_wins',(select count(*) from public.game_results where user_id=actor and won and role='HIDER')),
    'rewards',(select jsonb_agg(to_jsonb(r) order by r.level,r.id) from public.chs_level_rewards r)) into result from public.profiles p where p.id=actor;
 elsif section='crew' then
  result:=jsonb_build_object('crew',(select to_jsonb(c)||jsonb_build_object('my_role',mine.role,'points',(select coalesce(sum(p.xp),0) from public.chs_crew_members m join public.profiles p on p.id=m.user_id where m.crew_id=c.id)) from public.chs_crews c where c.id=mine.crew_id),
   'members',(select coalesce(jsonb_agg(chs_private.community_player(m.user_id)||jsonb_build_object('role',m.role) order by chs_private.crew_role_power(m.role) desc,p.xp desc,m.joined_at),'[]'::jsonb) from public.chs_crew_members m join public.profiles p on p.id=m.user_id where m.crew_id=mine.crew_id),
   'invitations',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('invited_by',p.username,'expires_at',i.expires_at)),'[]'::jsonb) from public.chs_crew_invites i join public.chs_crews c on c.id=i.crew_id left join public.profiles p on p.id=i.invited_by where i.user_id=actor and i.expires_at>now()),
   'requests',case when chs_private.crew_role_power(mine.role)>=2 then (select coalesce(jsonb_agg(chs_private.community_player(user_id)),'[]'::jsonb) from public.chs_crew_requests where crew_id=mine.crew_id) else '[]'::jsonb end,
   'sent_invites',case when chs_private.crew_role_power(mine.role)>=2 then (select coalesce(jsonb_agg(chs_private.community_player(user_id)),'[]'::jsonb) from public.chs_crew_invites where crew_id=mine.crew_id and expires_at>now()) else '[]'::jsonb end);
 else raise exception 'Unbekannte Ansicht.';
 end if;
 return result;
end $$;

-- Public wrappers use invoker rights; definer implementation stays in the private schema.
create function public.chs_crew_action(action text,payload jsonb default '{}'::jsonb) returns jsonb language sql set search_path='' as $$ select chs_private.crew_action(action,payload) $$;
create function public.chs_community_read(section text,query text default '',page int default 0) returns jsonb language sql stable set search_path='' as $$ select chs_private.community_read(section,query,page) $$;
revoke all on function chs_private.crew_role_power(text),chs_private.crew_deleted_member(),chs_private.community_player(uuid),chs_private.crew_action(text,jsonb),chs_private.community_read(text,text,int),public.chs_crew_action(text,jsonb),public.chs_community_read(text,text,int) from public,anon,authenticated;
grant usage on schema chs_private to authenticated;
grant execute on function chs_private.crew_action(text,jsonb),chs_private.community_read(text,text,int),public.chs_crew_action(text,jsonb),public.chs_community_read(text,text,int) to authenticated;
