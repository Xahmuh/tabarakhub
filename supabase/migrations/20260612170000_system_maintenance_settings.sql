create table if not exists public.system_settings (
  id text primary key default 'global' check (id = 'global'),
  maintenance_mode_enabled boolean not null default false,
  maintenance_title text not null default 'Tabarak Hub is under maintenance',
  maintenance_message text not null default 'We are making a few improvements. Please check back shortly.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.system_settings (id)
values ('global')
on conflict (id) do nothing;

create or replace function public.set_system_settings_updated_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists system_settings_updated_metadata on public.system_settings;
create trigger system_settings_updated_metadata
before insert or update on public.system_settings
for each row
execute function public.set_system_settings_updated_metadata();

alter table public.system_settings enable row level security;

revoke all on public.system_settings from anon, authenticated;
grant select on public.system_settings to anon, authenticated;
grant insert, update on public.system_settings to authenticated;
grant all on public.system_settings to service_role;

drop policy if exists "system settings public read" on public.system_settings;
drop policy if exists "system settings manage authenticated" on public.system_settings;

create policy "system settings public read"
on public.system_settings
for select
to anon, authenticated
using (true);

create policy "system settings manage authenticated"
on public.system_settings
for all
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

notify pgrst, 'reload schema';
