-- Durable cosmetic ownership, independent of expiring gameplay snapshots.
create table public.chs_ad_ledger (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 record jsonb not null check(jsonb_typeof(record)='object'),
 updated_at timestamptz not null default now()
);
alter table public.chs_ad_ledger enable row level security;
revoke all on public.chs_ad_ledger from public,anon,authenticated;
grant select on public.chs_ad_ledger to service_role;
create function public.chs_store_ad_ledger(records jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare item record;
begin
 if records is null or jsonb_typeof(records)<>'object' then raise exception 'Invalid ledger';end if;
 perform pg_advisory_xact_lock(715,1);
 for item in select key,value from jsonb_each(records) loop
  if exists(select 1 from public.profiles where id=item.key::uuid) then
  insert into public.chs_ad_ledger(user_id,record) values(item.key::uuid,item.value)
   on conflict(user_id) do update set record=excluded.record,updated_at=now();
  end if;
 end loop;
 delete from public.chs_ad_ledger where not (records ? user_id::text);
end $$;
revoke all on function public.chs_store_ad_ledger(jsonb) from public,anon,authenticated;
grant execute on function public.chs_store_ad_ledger(jsonb) to service_role;
