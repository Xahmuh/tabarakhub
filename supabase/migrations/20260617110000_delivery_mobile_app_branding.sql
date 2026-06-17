-- Driver mobile app branding controlled from Delivery Settings.
-- Login screen reads this before authentication, so the settings row is public-read
-- while updates and asset uploads stay manager/admin controlled.

create table if not exists public.delivery_mobile_app_settings (
  id text primary key default 'global',
  login_logo_url text not null default '',
  footer_logo_url text not null default '',
  footer_credit text not null default 'Developed by Ahmed Elsherbini',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint delivery_mobile_app_settings_singleton_check check (id = 'global')
);

insert into public.delivery_mobile_app_settings (id)
values ('global')
on conflict (id) do nothing;

alter table public.delivery_mobile_app_settings enable row level security;

revoke all on public.delivery_mobile_app_settings from public, anon, authenticated;
grant select on public.delivery_mobile_app_settings to anon, authenticated;
grant insert, update on public.delivery_mobile_app_settings to authenticated;
grant all on public.delivery_mobile_app_settings to service_role;

drop policy if exists "delivery mobile app settings public read" on public.delivery_mobile_app_settings;
create policy "delivery mobile app settings public read"
on public.delivery_mobile_app_settings
for select
to anon, authenticated
using (true);

drop policy if exists "delivery mobile app settings manage" on public.delivery_mobile_app_settings;
create policy "delivery mobile app settings manage"
on public.delivery_mobile_app_settings
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-mobile-assets',
  'driver-mobile-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "driver mobile assets public read" on storage.objects;
create policy "driver mobile assets public read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'driver-mobile-assets');

drop policy if exists "driver mobile assets manager insert" on storage.objects;
create policy "driver mobile assets manager insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'driver-mobile-assets'
  and public.current_app_can_manage()
);

drop policy if exists "driver mobile assets manager update" on storage.objects;
create policy "driver mobile assets manager update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'driver-mobile-assets'
  and public.current_app_can_manage()
)
with check (
  bucket_id = 'driver-mobile-assets'
  and public.current_app_can_manage()
);

drop policy if exists "driver mobile assets manager delete" on storage.objects;
create policy "driver mobile assets manager delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'driver-mobile-assets'
  and public.current_app_can_manage()
);
