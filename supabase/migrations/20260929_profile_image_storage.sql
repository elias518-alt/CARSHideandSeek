insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_images_owner_select" on storage.objects;
create policy "profile_images_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "profile_images_owner_insert" on storage.objects;
create policy "profile_images_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "profile_images_owner_update" on storage.objects;
create policy "profile_images_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "profile_images_owner_delete" on storage.objects;
create policy "profile_images_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create or replace function public.chs_update_my_profile(p_username text, p_avatar text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(p_username);
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Bitte erneut anmelden.'; end if;

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 24 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Der Name muss 2 bis 24 Zeichen lang sein und darf keine Steuerzeichen enthalten.';
  end if;

  if p_avatar is not null
     and p_avatar <> '__KEEP__'
     and (
       octet_length(p_avatar) > 1200
       or p_avatar !~ '^https://yyvljkzitodxhtkilsxm\.supabase\.co/storage/v1/object/public/profile-images/'
     ) then
    raise exception 'Ungültiges Profilbild.';
  end if;

  update public.profiles
  set username = v_name,
      avatar_url = case when p_avatar = '__KEEP__' then avatar_url else p_avatar end,
      updated_at = now()
  where id = v_uid
  returning jsonb_build_object(
    'username', username,
    'avatar_url', avatar_url,
    'updated_at', updated_at
  ) into v_result;

  if not found then raise exception 'Profil nicht gefunden. Bitte erneut anmelden.'; end if;
  return v_result;

exception when unique_violation then
  raise exception 'Dieser Name ist bereits vergeben. Bitte einen anderen wählen.';
end;
$function$;

revoke execute on function public.chs_update_my_profile(text,text) from anon;
grant execute on function public.chs_update_my_profile(text,text) to authenticated;
