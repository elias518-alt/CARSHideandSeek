-- Optional social location sharing. Never expose these tables directly.
create table public.chs_location_settings (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 mode text not null default 'off' check(mode in ('off','friends','crew','contacts','selected')),
 revision uuid not null default gen_random_uuid(),
 updated_at timestamptz not null default now()
);
create table public.chs_location_recipients (
 user_id uuid not null references public.chs_location_settings(user_id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 primary key(user_id,recipient_id), check(user_id<>recipient_id)
);
create table public.chs_social_locations (
 user_id uuid primary key references public.chs_location_settings(user_id) on delete cascade,
 lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180),
 accuracy double precision not null check(accuracy between 0 and 1000),
 measured_at timestamptz not null,
 last_active_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index chs_social_locations_expiry on public.chs_social_locations(expires_at);
do $$ declare t text; begin
 foreach t in array array['chs_location_settings','chs_location_recipients','chs_social_locations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;

-- Only used inside guarded definer RPCs; no arbitrary-user helper is public.
create function chs_private.location_contacts(actor uuid)
returns table(user_id uuid,is_friend boolean,is_crew boolean)
language sql stable set search_path='' as $$
 select p.id,
  exists(select 1 from public.chs_friendships f where f.status='accepted' and
   ((f.requester=actor and f.addressee=p.id) or (f.addressee=actor and f.requester=p.id))),
  exists(select 1 from public.chs_crew_members a join public.chs_crew_members b on a.crew_id=b.crew_id where a.user_id=actor and b.user_id=p.id)
 from public.profiles p
 where p.id<>actor
  and not exists(select 1 from public.chs_player_blocks b where
   (b.user_id=actor and b.target_id=p.id) or (b.target_id=actor and b.user_id=p.id))
  and not exists(select 1 from public.chs_account_bans b where b.user_id=p.id and b.revoked_at is null and (b.until_at is null or b.until_at>now()))
  and (exists(select 1 from public.chs_friendships f where f.status='accepted' and
   ((f.requester=actor and f.addressee=p.id) or (f.addressee=actor and f.requester=p.id)))
   or exists(select 1 from public.chs_crew_members a join public.chs_crew_members b on a.crew_id=b.crew_id where a.user_id=actor and b.user_id=p.id))
$$;

-- Use authoritative persisted game state, never a browser-supplied playing flag.
-- Even eliminated players cannot use this map to locate remaining opponents.
create function chs_private.location_playing(actor uuid) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.chs_server_state s,
  lateral jsonb_array_elements(coalesce(s.snapshot->'lobbies','[]'::jsonb)) l,
  lateral jsonb_array_elements(coalesce(l->'players','[]'::jsonb)) p
  where s.slot='gameplay' and s.expires_at>now()
   and l->>'state' in ('COUNTDOWN','HEADSTART','ACTIVE') and p->>'authId'=actor::text)
$$;

create function chs_private.social_map_read(scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); prefs public.chs_location_settings%rowtype; paused boolean; peers jsonb;
begin
 if actor is null or not chs_private.account_allowed() then raise exception 'Anmeldung fehlt oder Konto gesperrt.'; end if;
 if scope is null or scope not in ('friends','crew') then raise exception 'Unbekannte Kartenansicht.'; end if;
 select * into prefs from public.chs_location_settings where user_id=actor;
 paused:=chs_private.location_playing(actor);
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'username',p.username,'avatar_url',p.avatar_url,
  'lat',l.lat,'lng',l.lng,'accuracy',l.accuracy,'measured_at',l.measured_at,
  'last_active_at',l.last_active_at,'expires_at',l.expires_at) order by p.username,p.id),'[]'::jsonb) into peers
 from chs_private.location_contacts(actor) c
 join public.profiles p on p.id=c.user_id
 join public.chs_location_settings s on s.user_id=c.user_id
 join public.chs_social_locations l on l.user_id=c.user_id and l.expires_at>now()
 where not paused and not chs_private.location_playing(c.user_id)
  and ((scope='friends' and c.is_friend) or (scope='crew' and c.is_crew))
  and (s.mode='contacts' or (s.mode='friends' and c.is_friend) or (s.mode='crew' and c.is_crew)
   or (s.mode='selected' and exists(select 1 from public.chs_location_recipients r where r.user_id=c.user_id and r.recipient_id=actor)));
 return jsonb_build_object('server_time',now(),'paused',paused,'settings',jsonb_build_object(
  'mode',coalesce(prefs.mode,'off'),'revision',prefs.revision,
  'recipients',(select coalesce(jsonb_agg(r.recipient_id),'[]'::jsonb) from public.chs_location_recipients r join chs_private.location_contacts(actor) c on c.user_id=r.recipient_id where r.user_id=actor)),
  'contacts',(select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'username',p.username,'avatar_url',p.avatar_url,'is_friend',c.is_friend,'is_crew',c.is_crew) order by p.username,p.id),'[]'::jsonb)
    from chs_private.location_contacts(actor) c join public.profiles p on p.id=c.user_id),
  'own',case when paused or coalesce(prefs.mode,'off')='off' then null else
   (select jsonb_build_object('user_id',actor,'lat',lat,'lng',lng,'accuracy',accuracy,'measured_at',measured_at,'last_active_at',last_active_at,'expires_at',expires_at)
    from public.chs_social_locations where user_id=actor and expires_at>now()) end,
  'players',peers);
end $$;

create function chs_private.social_map_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); prefs public.chs_location_settings%rowtype; target uuid; mode text;
 lat double precision; lng double precision; accuracy double precision; measured timestamptz;
begin
 if actor is null or not chs_private.account_allowed() then raise exception 'Anmeldung fehlt oder Konto gesperrt.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,713));
 delete from public.chs_social_locations where expires_at<=now();
 if action='settings' then
  mode:=payload->>'mode';
  if mode is null or mode not in ('off','friends','crew','contacts','selected') then raise exception 'Ungültige Standortfreigabe.'; end if;
  if mode<>'off' and (payload->'consent') is distinct from 'true'::jsonb then raise exception 'Standort und letzte Aktivität bitte ausdrücklich freigeben.'; end if;
  if jsonb_typeof(coalesce(payload->'recipients','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(payload->'recipients','[]'::jsonb))>200 then raise exception 'Maximal 200 Personen auswählen.'; end if;
  insert into public.chs_location_settings(user_id,mode) values(actor,mode)
   on conflict(user_id) do update set mode=excluded.mode,revision=gen_random_uuid(),updated_at=now();
  delete from public.chs_location_recipients where user_id=actor;
  if mode='selected' then
   for target in select distinct value::uuid from jsonb_array_elements_text(coalesce(payload->'recipients','[]'::jsonb)) loop
    if not exists(select 1 from chs_private.location_contacts(actor) c where c.user_id=target) then raise exception 'Nur bestätigte Freunde oder Mitglieder deiner Crew auswählen.'; end if;
    insert into public.chs_location_recipients(user_id,recipient_id) values(actor,target);
   end loop;
   if not exists(select 1 from public.chs_location_recipients where user_id=actor) then raise exception 'Mindestens eine Person auswählen.'; end if;
  end if;
  -- Changing the audience never republishes an earlier coordinate.
  delete from public.chs_social_locations where user_id=actor;
  select * into prefs from public.chs_location_settings where user_id=actor;
  return jsonb_build_object('ok',true,'mode',prefs.mode,'revision',prefs.revision);
 end if;
 select * into prefs from public.chs_location_settings where user_id=actor;
 if prefs.user_id is null or prefs.mode='off' or (payload->>'revision') is distinct from prefs.revision::text then
  raise exception 'Standortfreigabe ist aus oder wurde geändert.';
 end if;
 if chs_private.location_playing(actor) then
  delete from public.chs_social_locations where user_id=actor;
  return jsonb_build_object('ok',true,'paused',true);
 end if;
 if action='heartbeat' then
  update public.chs_social_locations set last_active_at=now() where user_id=actor;
 elsif action='publish' then
  if jsonb_typeof(payload->'lat') is distinct from 'number' or jsonb_typeof(payload->'lng') is distinct from 'number'
   or jsonb_typeof(payload->'accuracy') is distinct from 'number' then raise exception 'Ungültiger Standort.'; end if;
  lat:=(payload->>'lat')::double precision; lng:=(payload->>'lng')::double precision; accuracy:=(payload->>'accuracy')::double precision;
  measured:=(payload->>'measured_at')::timestamptz;
  if lat not between -90 and 90 or lng not between -180 and 180 or accuracy not between 0 and 1000
   or measured is null or measured<now()-interval '2 minutes' or measured>now()+interval '15 seconds' then
   raise exception 'Standort ist ungültig, zu alt oder zu ungenau.';
  end if;
  if exists(select 1 from public.chs_social_locations l where l.user_id=actor and l.measured_at>=measured) then
   return jsonb_build_object('ok',true,'ignored',true);
  end if;
  insert into public.chs_social_locations(user_id,lat,lng,accuracy,measured_at,last_active_at,expires_at)
   values(actor,lat,lng,accuracy,measured,now(),least(measured,now())+interval '24 hours')
   on conflict(user_id) do update set lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,
    measured_at=excluded.measured_at,last_active_at=excluded.last_active_at,expires_at=excluded.expires_at;
 else raise exception 'Unbekannte Kartenaktion.';
 end if;
 return jsonb_build_object('ok',true);
end $$;

-- Starting a round clears the social copy in the same transaction as its snapshot.
create function chs_private.clear_playing_social_locations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.chs_social_locations where user_id::text in (
  select p->>'authId' from jsonb_array_elements(coalesce(new.snapshot->'lobbies','[]'::jsonb)) l,
   lateral jsonb_array_elements(coalesce(l->'players','[]'::jsonb)) p
  where l->>'state' in ('COUNTDOWN','HEADSTART','ACTIVE'));
 return new;
end $$;
create trigger chs_clear_playing_social_locations after insert or update of snapshot on public.chs_server_state
 for each row execute function chs_private.clear_playing_social_locations();

create function chs_private.prune_social_locations() returns void
language sql security definer set search_path='' as $$
 delete from public.chs_social_locations where expires_at<=now()
$$;
-- Existing deployments already use pg_cron; local SQL runners may not have it.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('chs-social-location-retention','*/10 * * * *','select chs_private.prune_social_locations()');
 end if;
end $$;

create function public.chs_social_map_read(scope text default 'friends') returns jsonb
language sql stable set search_path='' as $$ select chs_private.social_map_read(scope) $$;
create function public.chs_social_map_action(action text,payload jsonb default '{}'::jsonb) returns jsonb
language sql set search_path='' as $$ select chs_private.social_map_action(action,payload) $$;
revoke all on function chs_private.location_contacts(uuid),chs_private.location_playing(uuid),
 chs_private.social_map_read(text),chs_private.social_map_action(text,jsonb),
 chs_private.clear_playing_social_locations(),chs_private.prune_social_locations(),
 public.chs_social_map_read(text),public.chs_social_map_action(text,jsonb) from public,anon,authenticated;
grant execute on function chs_private.social_map_read(text),chs_private.social_map_action(text,jsonb),
 public.chs_social_map_read(text),public.chs_social_map_action(text,jsonb) to authenticated;
