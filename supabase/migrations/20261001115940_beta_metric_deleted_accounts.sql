-- A deleted account must not block atomic recording for remaining participants.
create or replace function public.chs_record_match(p_match jsonb,p_players jsonb) returns void
 language plpgsql security invoker set search_path='' as $$
declare inserted integer;begin
 insert into public.chs_match_metrics(result_id,lobby_code,started_at,ended_at,duration_seconds,player_count,visibility,aborted,reason)
 values((p_match->>'result_id')::uuid,p_match->>'lobby_code',(p_match->>'started_at')::timestamptz,(p_match->>'ended_at')::timestamptz,(p_match->>'duration_seconds')::integer,(p_match->>'player_count')::integer,p_match->>'visibility',(p_match->>'aborted')::boolean,p_match->>'reason') on conflict(result_id) do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 and not (p_match->>'aborted')::boolean then
  insert into public.chs_player_round_stats(user_id,result_id,role,finds,survival_seconds,won)
  select (v->>'user_id')::uuid,(p_match->>'result_id')::uuid,v->>'role',(v->>'finds')::integer,(v->>'survival_seconds')::integer,(v->>'won')::boolean from jsonb_array_elements(p_players) v join auth.users u on u.id=(v->>'user_id')::uuid;
 end if;
end $$;

