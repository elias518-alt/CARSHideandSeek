-- Additive presentation and crew dresscode upgrade. Existing player selections survive.
alter table public.chs_crews add column if not exists dresscode jsonb not null default '{}'::jsonb;
create or replace function chs_private.active_vehicle_presentation(uid uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',v.id,'brand',v.brand,'model',v.model,'series',v.series,'body_type',v.body_type,'model_year',v.model_year,'color',v.color,'photo_path',v.photo_path,
 -- Level gates are authoritative here; calibrated asset support is resolved by the shared renderer.
 'cosmetics',jsonb_build_object('rims',case when u.raw_user_meta_data->'chs_vehicle_loadouts'->v.id::text->>'rims'='silver' and p.level>=2 then 'silver' when u.raw_user_meta_data->'chs_vehicle_loadouts'->v.id::text->>'rims'='graphite' and p.level>=8 then 'graphite' when u.raw_user_meta_data->'chs_vehicle_loadouts'->v.id::text->>'rims'='mesh' and p.level>=12 then 'mesh' else 'stock' end,'package',case when u.raw_user_meta_data->'chs_vehicle_loadouts'->v.id::text->>'package'='sport' and p.level>=5 then 'sport' when u.raw_user_meta_data->'chs_vehicle_loadouts'->v.id::text->>'package'='clean' and p.level>=10 then 'clean' when u.raw_user_meta_data->'chs_vehicle_loadouts'->v.id::text->>'package'='track' and p.level>=15 then 'track' else 'stock' end,'glow',case when u.raw_user_meta_data->'chs_vehicle_loadouts'->v.id::text->>'glow'='cyan' and p.level>=3 then 'cyan' when u.raw_user_meta_data->'chs_vehicle_loadouts'->v.id::text->>'glow'='amber' and p.level>=3 then 'amber' else 'off' end),
 'presentation',jsonb_build_object('mode',case when u.raw_user_meta_data->'chs_vehicle_presentations'->v.id::text->>'mode'='model' then 'model' else 'photo' end,
 'customVehicleTransform',jsonb_build_object('scale',case when jsonb_typeof(u.raw_user_meta_data->'chs_vehicle_presentations'->v.id::text->'customVehicleTransform'->'scale')='number' then greatest(.75,least(1.15,(u.raw_user_meta_data->'chs_vehicle_presentations'->v.id::text->'customVehicleTransform'->>'scale')::numeric)) else 1 end,'translateX',case when jsonb_typeof(u.raw_user_meta_data->'chs_vehicle_presentations'->v.id::text->'customVehicleTransform'->'translateX')='number' then greatest(-.08,least(.08,(u.raw_user_meta_data->'chs_vehicle_presentations'->v.id::text->'customVehicleTransform'->>'translateX')::numeric)) else 0 end)))
 from public.profiles p join auth.users u on u.id=p.id join public.vehicles v on v.user_id=p.id
 where p.id=uid and (v.id=p.active_vehicle_id or v.is_active)
 order by (v.id=p.active_vehicle_id) desc nulls last,v.updated_at desc,v.id limit 1
$$;
revoke all on function chs_private.active_vehicle_presentation(uuid) from public,anon,authenticated;


create or replace function chs_private.companion_presentation(uid uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('title',coalesce(c.title,''),'appearance',case when e.user_id is not null then
  (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(case when jsonb_typeof(u.raw_user_meta_data->'chs_appearance')='object' then u.raw_user_meta_data->'chs_appearance' else '{}'::jsonb end) where key in ('collection','figure','gender','classic','top','pants','shoes','topColor','pantsColor','shoeColor','pose','winPose','jewelry','glasses','earrings','watch'))
  else jsonb_build_object('collection','classic','classic',case when u.raw_user_meta_data->'chs_appearance'->>'classic' in ('0','1','2') then (u.raw_user_meta_data->'chs_appearance'->>'classic')::int else 0 end) end,
 'pet',case when e.user_id is not null then
  (select jsonb_object_agg(key,value) from jsonb_each(case when jsonb_typeof(u.raw_user_meta_data->'chs_pet')='object' then u.raw_user_meta_data->'chs_pet' else '{}'::jsonb end) where key in ('breed','coat','eyes','size','flip','stance')) else null end)
 from auth.users u left join public.chs_cosmetic_choices c on c.user_id=u.id
 left join public.chs_plus_entitlements e on e.user_id=u.id and (e.expires_at is null or e.expires_at>now()) where u.id=uid
$$;
revoke all on function chs_private.companion_presentation(uuid) from public,anon,authenticated;

create or replace function chs_private.community_player(uid uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('user_id',p.id,'peer_id',p.id,'username',p.username,'player_tag',p.player_tag,'avatar_url',p.avatar_url,
 'level',p.level,'xp',p.xp,'points',p.xp,'online',coalesce((select max(a.last_at) from public.chs_daily_activity a where a.user_id=p.id and a.day>=current_date-1),p.last_seen_at)>now()-interval '2 minutes',
 'frame',coalesce(c.frame,'default'),'title',coalesce(c.title,''),
 'active_vehicle',chs_private.active_vehicle_presentation(p.id))||coalesce(chs_private.companion_presentation(p.id),'{}'::jsonb)
 from public.profiles p left join public.chs_cosmetic_choices c on c.user_id=p.id where p.id=uid
$$;

-- Add the owned active garage vehicle to the existing authenticated social responses.
-- Existing friendship/account guards, privileges and private-schema security stay intact.
create or replace function chs_private.social_overview_v2() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(r) order by r.status,r.username),'[]'::jsonb) from (
 select f.id as request_id,p.id as peer_id,p.username::text,p.player_tag::text,coalesce(p.level,1)::int as level,
 f.status,f.addressee=auth.uid() as incoming,p.avatar_url,
 chs_private.companion_presentation(p.id)->'appearance' as appearance,chs_private.companion_presentation(p.id)->'pet' as pet,chs_private.companion_presentation(p.id)->>'title' as title,
 chs_private.active_vehicle_presentation(p.id) as active_vehicle,
 (coalesce((select max(a.last_at) from public.chs_daily_activity a where a.user_id=p.id and a.day>=current_date-1),p.last_seen_at)>now()-interval '2 minutes') as online,
 case when f.status='accepted' then (select count(*) from public.chs_direct_messages m
 left join public.chs_dm_receipts c on c.user_id=auth.uid() and c.peer_id=p.id
 where m.recipient=auth.uid() and m.sender=p.id and
 (m.created_at,m.id)>(coalesce(c.read_at,'-infinity'::timestamptz),coalesce(c.read_id,'00000000-0000-0000-0000-000000000000'::uuid))) else 0 end as unread_count
 from public.chs_friendships f join public.profiles p on p.id=case when f.requester=auth.uid() then f.addressee else f.requester end
 where auth.uid() is not null and chs_private.account_allowed() and (f.requester=auth.uid() or f.addressee=auth.uid())
 )r;
$$;
create or replace function chs_private.social_search_v2(q text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(r)),'[]'::jsonb) from (
 select p.id as user_id,p.username::text,p.player_tag::text,coalesce(p.level,1)::integer as level,p.avatar_url,
 chs_private.active_vehicle_presentation(p.id) as active_vehicle
 from public.profiles p where auth.uid() is not null and chs_private.account_allowed() and p.id<>auth.uid()
 and length(btrim(q)) between 2 and 24 and (strpos(lower(p.username),lower(btrim(q)))>0 or strpos(lower(p.player_tag::text),lower(btrim(q)))>0)
 order by case when lower(p.username)=lower(btrim(q)) then 0 else 1 end,p.username limit 15
 )r;
$$;


create or replace function chs_private.crew_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if action='dresscode' then
   if mine.role<>'CHIEF' then raise exception 'Nur die Crew-Leitung darf den Dresscode ändern.'; end if;
   if jsonb_typeof(payload->'dresscode') is distinct from 'object' or octet_length((payload->'dresscode')::text)>1000 then raise exception 'Ungültiger Dresscode.'; end if;
   if exists(select 1 from jsonb_each_text(payload->'dresscode') x where x.value is null or x.key not in ('top','pants','topColor','pantsColor')
    or (x.key='top' and x.value not in ('any','tshirt','hoodie','bomber','oversized','tank','halfzip','pullover','jacket'))
    or (x.key='pants' and x.value not in ('any','cargo','jeans','jogger','baggy','trousers','linen','shorts','sportshorts'))
    or (x.key in ('topColor','pantsColor') and x.value not in ('any','gray','black','white','navy','green','purple','red','cream','pink','orange','blue'))) then raise exception 'Ungültige Kleidungsregel.'; end if;
   update public.chs_crews set dresscode=payload->'dresscode' where id=cid;
  elsif action='leave' then
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
NOTIFY pgrst, 'reload schema';
