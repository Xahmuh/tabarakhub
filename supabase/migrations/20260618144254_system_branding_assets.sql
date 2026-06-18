-- System-wide branding assets uploaded from Settings.
-- Public read is required because login, maintenance, favicon, and public flows
-- may render before a user is authenticated. Writes remain manager/admin scoped.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'system-branding-assets',
  'system-branding-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "system branding assets public read" on storage.objects;
create policy "system branding assets public read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'system-branding-assets');

drop policy if exists "system branding assets manager insert" on storage.objects;
create policy "system branding assets manager insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'system-branding-assets'
  and public.current_app_can_manage()
);

drop policy if exists "system branding assets manager update" on storage.objects;
create policy "system branding assets manager update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'system-branding-assets'
  and public.current_app_can_manage()
)
with check (
  bucket_id = 'system-branding-assets'
  and public.current_app_can_manage()
);

drop policy if exists "system branding assets manager delete" on storage.objects;
create policy "system branding assets manager delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'system-branding-assets'
  and public.current_app_can_manage()
);
