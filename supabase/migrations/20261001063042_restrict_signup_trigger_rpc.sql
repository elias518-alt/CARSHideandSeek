-- Trigger execution does not require client EXECUTE rights. Keep this function
-- available to its existing auth.users trigger, without exposing it as an RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
