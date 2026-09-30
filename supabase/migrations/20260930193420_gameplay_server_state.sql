-- Apply once before enabling SUPABASE_SECRET_KEY on the Node server.
-- No client policy: exact positions and reports are only accessed by the server.
create table if not exists public.chs_server_state (
  slot text primary key,
  snapshot jsonb not null,
  expires_at timestamptz not null
);
alter table public.chs_server_state enable row level security;
revoke all on public.chs_server_state from public, anon, authenticated;
grant select, insert, update, delete on public.chs_server_state to service_role;
