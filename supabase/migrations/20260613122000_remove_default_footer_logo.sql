alter table public.system_settings
  alter column footer_logo_url set default '';

update public.system_settings
set footer_logo_url = ''
where id = 'global';

notify pgrst, 'reload schema';
