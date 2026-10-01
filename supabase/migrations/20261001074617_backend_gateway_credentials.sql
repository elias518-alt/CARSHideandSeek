create table public.chs_backend_credentials (
  slot text primary key check (slot='render'),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);
alter table public.chs_backend_credentials enable row level security;
revoke all on public.chs_backend_credentials from public,anon,authenticated;
grant select on public.chs_backend_credentials to service_role;
