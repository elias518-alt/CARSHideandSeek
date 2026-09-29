alter table public.vehicles
  add column if not exists photo_path text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists vehicles_one_active_per_user
  on public.vehicles(user_id)
  where is_active = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-images',
  'vehicle-images',
  true,
  2097152,
  array['image/webp','image/png']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicle_images_owner_select" on storage.objects;
create policy "vehicle_images_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "vehicle_images_owner_insert" on storage.objects;
create policy "vehicle_images_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "vehicle_images_owner_update" on storage.objects;
create policy "vehicle_images_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "vehicle_images_owner_delete" on storage.objects;
create policy "vehicle_images_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
