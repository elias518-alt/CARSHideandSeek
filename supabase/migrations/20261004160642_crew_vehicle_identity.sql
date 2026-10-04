-- Add the owned active garage vehicle to the existing authenticated social responses.
-- Existing friendship/account guards, privileges and private-schema security stay intact.
create or replace function chs_private.social_overview_v2() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(r) order by r.status,r.username),'[]'::jsonb) from (
 select f.id as request_id,p.id as peer_id,p.username::text,p.player_tag::text,coalesce(p.level,1)::int as level,
 f.status,f.addressee=auth.uid() as incoming,p.avatar_url,
 (select jsonb_build_object('brand',v.brand,'model',v.model,'series',v.series,'body_type',v.body_type,'color',v.color,'photo_path',v.photo_path)
 from public.vehicles v where v.user_id=p.id and (v.id=p.active_vehicle_id or v.is_active)
 order by (v.id=p.active_vehicle_id) desc nulls last,v.updated_at desc,v.id limit 1) as active_vehicle,
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
 (select jsonb_build_object('brand',v.brand,'model',v.model,'series',v.series,'body_type',v.body_type,'color',v.color,'photo_path',v.photo_path)
 from public.vehicles v where v.user_id=p.id and (v.id=p.active_vehicle_id or v.is_active)
 order by (v.id=p.active_vehicle_id) desc nulls last,v.updated_at desc,v.id limit 1) as active_vehicle
 from public.profiles p where auth.uid() is not null and chs_private.account_allowed() and p.id<>auth.uid()
 and length(btrim(q)) between 2 and 24 and (strpos(lower(p.username),lower(btrim(q)))>0 or strpos(lower(p.player_tag::text),lower(btrim(q)))>0)
 order by case when lower(p.username)=lower(btrim(q)) then 0 else 1 end,p.username limit 15
 )r;
$$;
