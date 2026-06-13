alter table public.system_settings
  add column if not exists footer_logo_url text not null default '/logo.jpg',
  add column if not exists footer_text text not null default 'HUB';

update public.system_settings
set
  footer_logo_url = coalesce(footer_logo_url, '/logo.jpg'),
  footer_text = coalesce(nullif(footer_text, ''), 'HUB')
where id = 'global';

notify pgrst, 'reload schema';
