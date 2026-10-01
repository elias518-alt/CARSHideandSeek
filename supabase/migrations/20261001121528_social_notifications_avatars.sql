-- Account-bound read cursors. Browser writes go through authenticated RPCs only.
create table public.chs_dm_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 peer_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null,read_id uuid not null,
 primary key(user_id,peer_id),check(user_id<>peer_id)
);
create index chs_dm_receipts_peer on public.chs_dm_receipts(peer_id);
alter table public.chs_dm_receipts enable row level security;
revoke all on public.chs_dm_receipts from public,anon,authenticated;
grant all on public.chs_dm_receipts to service_role;
create index if not exists chs_dm_inbox_cursor on public.chs_direct_messages(recipient,sender,created_at,id);

create function chs_private.social_overview_v2() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(r) order by r.status,r.username),'[]'::jsonb) from (
 select f.id as request_id,p.id as peer_id,p.username::text,p.player_tag::text,coalesce(p.level,1)::int as level,
 f.status,f.addressee=auth.uid() as incoming,p.avatar_url,
 (coalesce((select max(a.last_at) from public.chs_daily_activity a where a.user_id=p.id and a.day>=current_date-1),p.last_seen_at)>now()-interval '2 minutes') as online,
 case when f.status='accepted' then (select count(*) from public.chs_direct_messages m
 left join public.chs_dm_receipts c on c.user_id=auth.uid() and c.peer_id=p.id
 where m.recipient=auth.uid() and m.sender=p.id and
 (m.created_at,m.id)>(coalesce(c.read_at,'-infinity'::timestamptz),coalesce(c.read_id,'00000000-0000-0000-0000-000000000000'::uuid))) else 0 end as unread_count
 from public.chs_friendships f join public.profiles p on p.id=case when f.requester=auth.uid() then f.addressee else f.requester end
 where auth.uid() is not null and chs_private.account_allowed() and (f.requester=auth.uid() or f.addressee=auth.uid())
 )r;
$$;
create function chs_private.social_search_v2(q text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(r)),'[]'::jsonb) from (
 select p.id as user_id,p.username::text,p.player_tag::text,coalesce(p.level,1)::integer as level,p.avatar_url
 from public.profiles p where auth.uid() is not null and chs_private.account_allowed() and p.id<>auth.uid()
 and length(btrim(q)) between 2 and 24 and (strpos(lower(p.username),lower(btrim(q)))>0 or strpos(lower(p.player_tag::text),lower(btrim(q)))>0)
 order by case when lower(p.username)=lower(btrim(q)) then 0 else 1 end,p.username limit 15
 )r;
$$;
create function chs_private.mark_messages_read(peer uuid,message_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare seen timestamptz;begin
 if auth.uid() is null or not chs_private.account_allowed() then raise exception 'Anmeldung erforderlich oder Konto gesperrt'; end if;
 if not exists(select 1 from public.chs_friendships f where f.status='accepted' and ((f.requester=auth.uid() and f.addressee=peer) or (f.requester=peer and f.addressee=auth.uid()))) then raise exception 'Kein privater Chat mit dieser Person'; end if;
 select m.created_at into seen from public.chs_direct_messages m where m.id=message_id and m.sender=peer and m.recipient=auth.uid();
 if not found then raise exception 'Nachricht gehört nicht zu diesem Eingang'; end if;
 insert into public.chs_dm_receipts(user_id,peer_id,read_at,read_id) values(auth.uid(),peer,seen,message_id)
 on conflict(user_id,peer_id) do update set read_at=excluded.read_at,read_id=excluded.read_id
 where (excluded.read_at,excluded.read_id)>(chs_dm_receipts.read_at,chs_dm_receipts.read_id);
end $$;

create function public.chs_social_overview_v2() returns jsonb language sql stable security invoker set search_path='' as $$ select chs_private.social_overview_v2(); $$;
create function public.chs_search_players_v2(q text) returns jsonb language sql stable security invoker set search_path='' as $$ select chs_private.social_search_v2(q); $$;
create function public.chs_mark_messages_read(peer uuid,message_id uuid) returns void language sql security invoker set search_path='' as $$ select chs_private.mark_messages_read(peer,message_id); $$;
revoke all on function chs_private.social_overview_v2(),chs_private.social_search_v2(text),chs_private.mark_messages_read(uuid,uuid),public.chs_social_overview_v2(),public.chs_search_players_v2(text),public.chs_mark_messages_read(uuid,uuid) from public,anon,authenticated;
grant usage on schema chs_private to authenticated;
grant execute on function chs_private.social_overview_v2(),chs_private.social_search_v2(text),chs_private.mark_messages_read(uuid,uuid),public.chs_social_overview_v2(),public.chs_search_players_v2(text),public.chs_mark_messages_read(uuid,uuid) to authenticated;
