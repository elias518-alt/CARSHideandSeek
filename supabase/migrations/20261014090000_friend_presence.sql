-- Last activity is visible only to confirmed, unblocked friends.
create function chs_private.friend_presence() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not chs_private.account_allowed() then raise exception 'Anmeldung erforderlich.'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'last_active_at',greatest(p.last_seen_at,
  (select max(a.last_at) from public.chs_daily_activity a where a.user_id=p.id)))), '[]'::jsonb)
 from chs_private.location_contacts(auth.uid()) c join public.profiles p on p.id=c.user_id where c.is_friend);
end $$;
create function public.chs_friend_presence() returns jsonb language sql stable security invoker set search_path='' as $$select chs_private.friend_presence()$$;
revoke all on function chs_private.friend_presence(),public.chs_friend_presence() from public,anon,authenticated;
grant execute on function chs_private.friend_presence(),public.chs_friend_presence() to authenticated;
