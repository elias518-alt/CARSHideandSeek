-- Add server-awarded milestones. Existing counters count; qualifying older
-- players receive new awards on their next verified, unclaimed round.
begin;
revoke insert,update,delete on public.achievements from anon,authenticated;
alter table public.achievements add column if not exists condition_field text;
alter table public.achievements add column if not exists condition_target integer;
update public.achievements set condition_field=case id
 when 'FIRST_GAME' then 'rounds_played' when 'FIRST_FIND' then 'finds'
 when 'HIDE_MASTER' then 'survived_rounds' end, condition_target=1
where id in ('FIRST_GAME','FIRST_FIND','HIDE_MASTER');
insert into public.achievements(id,name,description,xp_reward,condition_field,condition_target) values
 ('ROUNDS_5', 'Warmgefahren', 'Schließe 5 Runden ab.', 100, 'rounds_played', 5),
 ('ROUNDS_25', 'Stammfahrer', 'Schließe 25 Runden ab.', 250, 'rounds_played', 25),
 ('ROUNDS_100', 'Straßenlegende', 'Schließe 100 Runden ab.', 500, 'rounds_played', 100),
 ('WINS_5', 'Auf der Überholspur', 'Gewinne 5 Runden.', 150, 'wins', 5),
 ('WINS_25', 'Podiumsjäger', 'Gewinne 25 Runden.', 350, 'wins', 25),
 ('FINDS_10', 'Spürnase', 'Erziele 10 bestätigte Funde.', 150, 'finds', 10),
 ('FINDS_50', 'Radarprofi', 'Erziele 50 bestätigte Funde.', 350, 'finds', 50),
 ('SURVIVED_5', 'Schattenfahrer', 'Überlebe 5 Runden als Verstecker.', 150, 'survived_rounds', 5),
 ('SURVIVED_25', 'Unsichtbar', 'Überlebe 25 Runden als Verstecker.', 350, 'survived_rounds', 25)
on conflict (id) do update set name=excluded.name,description=excluded.description,
 xp_reward=excluded.xp_reward,condition_field=excluded.condition_field,condition_target=excluded.condition_target;
CREATE OR REPLACE FUNCTION public.chs_claim_game_result(p_result_id uuid, p_role text, p_won boolean, p_finds integer, p_survived boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
  v_achievement_inserted integer := 0;
  v_base_xp integer := 0;
  v_bonus_xp integer := 0;
  v_reward integer := 0;
  v_achievement record;
  v_existing_xp integer := 0;
  v_unlocked text[] := array[]::text[];
  v_profile public.profiles%rowtype;
begin
  if not chs_private.account_allowed() then raise exception 'Konto gesperrt oder Anmeldung fehlt.'; end if;
  if v_uid is null then
    raise exception 'Bitte erneut anmelden.';
  end if;

  if p_result_id is null then
    raise exception 'Ungültiges Rundenergebnis.';
  end if;

  if not exists (
    select 1 from public.chs_verified_results v
    where v.user_id=v_uid and v.result_id=p_result_id
      and v.role=p_role and v.won is not distinct from p_won
      and v.finds=p_finds and v.survived is not distinct from p_survived
  ) then
    raise exception 'Kein passendes serverbestätigtes Rundenergebnis.';
  end if;

  if p_role not in ('SEEKER','HIDER') then
    raise exception 'Ungültige Rolle.';
  end if;

  if p_finds is null or p_finds < 0 or p_finds > 20 then
    raise exception 'Ungültige Fundanzahl.';
  end if;

  if p_role = 'HIDER' and p_finds <> 0 then
    raise exception 'Verstecker können keine Funde gutschreiben.';
  end if;

  if p_role = 'SEEKER' and p_survived then
    raise exception 'Sucher können keine Überlebensrunde erhalten.';
  end if;

  if p_role = 'SEEKER' then
    v_base_xp := 100 + (p_finds * 80);
  else
    v_base_xp := case when p_survived then 280 else 140 end;
  end if;

  insert into public.game_results (
    user_id, result_id, role, won, finds, survived, xp_awarded
  )
  values (
    v_uid, p_result_id, p_role, coalesce(p_won,false), p_finds, p_survived, v_base_xp
  )
  on conflict (user_id, result_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.profiles
    set
      rounds_played = rounds_played + 1,
      wins = wins + case when coalesce(p_won,false) then 1 else 0 end,
      finds = finds + p_finds,
      survived_rounds = survived_rounds + case when p_role = 'HIDER' and p_survived then 1 else 0 end,
      xp = xp + v_base_xp,
      updated_at = now()
    where id = v_uid
    returning * into v_profile;

    if not found then
      raise exception 'Profil nicht gefunden. Bitte erneut anmelden.';
    end if;

    -- The profile row is already locked by the stats update above. Claims for
    -- different rounds serialize here; the unique key prevents repeat bonuses.
    for v_achievement in
      select id, xp_reward from public.achievements
      where condition_field in ('rounds_played','wins','finds','survived_rounds')
        and condition_target > 0
        and coalesce((to_jsonb(v_profile)->>condition_field)::integer,0) >= condition_target
      order by id
    loop
      insert into public.user_achievements(user_id, achievement_id)
      values (v_uid, v_achievement.id)
      on conflict (user_id, achievement_id) do nothing;
      get diagnostics v_achievement_inserted = row_count;
      if v_achievement_inserted = 1 then
        v_bonus_xp := v_bonus_xp + coalesce(v_achievement.xp_reward,0);
        v_unlocked := array_append(v_unlocked, v_achievement.id);
      end if;
    end loop;

    update public.profiles
    set
      xp = xp + v_bonus_xp,
      level = least(50, floor((xp + v_bonus_xp) / 1000.0)::integer + 1),
      updated_at = now()
    where id = v_uid
    returning * into v_profile;

    update public.game_results
    set xp_awarded = v_base_xp + v_bonus_xp
    where user_id = v_uid and result_id = p_result_id;

    v_existing_xp := v_base_xp + v_bonus_xp;
  else
    select * into v_profile
    from public.profiles
    where id = v_uid;

    select xp_awarded into v_existing_xp
    from public.game_results
    where user_id = v_uid and result_id = p_result_id;
  end if;

  return jsonb_build_object(
    'already_claimed', v_inserted = 0,
    'xp_awarded', coalesce(v_existing_xp,0),
    'unlocked', to_jsonb(v_unlocked),
    'profile', jsonb_build_object(
      'level', v_profile.level,
      'xp', v_profile.xp,
      'rounds_played', v_profile.rounds_played,
      'wins', v_profile.wins,
      'finds', v_profile.finds,
      'survived_rounds', v_profile.survived_rounds,
      'updated_at', v_profile.updated_at
    )
  );
end;
$function$
;

revoke all on function public.chs_claim_game_result(uuid,text,boolean,integer,boolean) from public;
grant execute on function public.chs_claim_game_result(uuid,text,boolean,integer,boolean) to authenticated;
commit;
