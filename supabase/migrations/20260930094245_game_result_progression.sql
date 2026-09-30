create table if not exists public.game_results (
  user_id uuid not null references public.profiles(id) on delete cascade,
  result_id uuid not null,
  role text not null check (role in ('SEEKER','HIDER')),
  won boolean not null default false,
  finds integer not null default 0 check (finds >= 0 and finds <= 20),
  survived boolean not null default false,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, result_id)
);

alter table public.game_results enable row level security;

drop policy if exists game_results_owner_read on public.game_results;
create policy game_results_owner_read
on public.game_results
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.game_results from anon, authenticated;
grant select on public.game_results to authenticated;

create or replace function public.chs_claim_game_result(
  p_result_id uuid,
  p_role text,
  p_won boolean,
  p_finds integer,
  p_survived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
  v_achievement_inserted integer := 0;
  v_base_xp integer := 0;
  v_bonus_xp integer := 0;
  v_reward integer := 0;
  v_existing_xp integer := 0;
  v_unlocked text[] := array[]::text[];
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Bitte erneut anmelden.';
  end if;

  if p_result_id is null then
    raise exception 'Ungültiges Rundenergebnis.';
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

    if v_profile.rounds_played >= 1 then
      insert into public.user_achievements(user_id, achievement_id)
      values (v_uid, 'FIRST_GAME')
      on conflict (user_id, achievement_id) do nothing;
      get diagnostics v_achievement_inserted = row_count;
      if v_achievement_inserted = 1 then
        select xp_reward into v_reward from public.achievements where id = 'FIRST_GAME';
        v_bonus_xp := v_bonus_xp + coalesce(v_reward,0);
        v_unlocked := array_append(v_unlocked, 'FIRST_GAME');
      end if;
    end if;

    if v_profile.finds >= 1 then
      insert into public.user_achievements(user_id, achievement_id)
      values (v_uid, 'FIRST_FIND')
      on conflict (user_id, achievement_id) do nothing;
      get diagnostics v_achievement_inserted = row_count;
      if v_achievement_inserted = 1 then
        select xp_reward into v_reward from public.achievements where id = 'FIRST_FIND';
        v_bonus_xp := v_bonus_xp + coalesce(v_reward,0);
        v_unlocked := array_append(v_unlocked, 'FIRST_FIND');
      end if;
    end if;

    if v_profile.survived_rounds >= 1 then
      insert into public.user_achievements(user_id, achievement_id)
      values (v_uid, 'HIDE_MASTER')
      on conflict (user_id, achievement_id) do nothing;
      get diagnostics v_achievement_inserted = row_count;
      if v_achievement_inserted = 1 then
        select xp_reward into v_reward from public.achievements where id = 'HIDE_MASTER';
        v_bonus_xp := v_bonus_xp + coalesce(v_reward,0);
        v_unlocked := array_append(v_unlocked, 'HIDE_MASTER');
      end if;
    end if;

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
$$;

revoke all on function public.chs_claim_game_result(uuid,text,boolean,integer,boolean) from public;
grant execute on function public.chs_claim_game_result(uuid,text,boolean,integer,boolean) to authenticated;
