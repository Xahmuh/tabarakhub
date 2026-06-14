alter table public.system_settings
  add column if not exists module_display_settings jsonb not null default '{"items":[]}'::jsonb;

update public.system_settings
set module_display_settings = coalesce(module_display_settings, '{"items":[]}'::jsonb)
where id = 'global';

comment on column public.system_settings.module_display_settings is
  'Presentation-only module launcher order and badge settings. Does not grant access or bypass RLS.';

notify pgrst, 'reload schema';
