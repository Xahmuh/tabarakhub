alter table public.system_settings
  add column if not exists login_badges jsonb not null default '[]'::jsonb;

update public.system_settings
set login_badges = '[]'::jsonb
where login_badges is null;

notify pgrst, 'reload schema';
