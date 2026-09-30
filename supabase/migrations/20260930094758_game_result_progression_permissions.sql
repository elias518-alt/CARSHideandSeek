revoke execute on function public.chs_claim_game_result(uuid,text,boolean,integer,boolean) from anon;
revoke execute on function public.chs_claim_game_result(uuid,text,boolean,integer,boolean) from public;
grant execute on function public.chs_claim_game_result(uuid,text,boolean,integer,boolean) to authenticated;
