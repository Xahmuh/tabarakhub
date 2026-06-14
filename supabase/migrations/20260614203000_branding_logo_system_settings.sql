alter table public.system_settings
  add column if not exists pharmacy_logo_url text not null default '/logo.jpg',
  add column if not exists hub_logo_url text not null default '/tabarak-logo.svg',
  add column if not exists browser_icon_url text not null default '/logo.jpg',
  add column if not exists loading_spinner_url text not null default '/spinner.svg';

update public.system_settings
set
  pharmacy_logo_url = coalesce(nullif(pharmacy_logo_url, ''), '/logo.jpg'),
  hub_logo_url = coalesce(nullif(hub_logo_url, ''), '/tabarak-logo.svg'),
  browser_icon_url = coalesce(nullif(browser_icon_url, ''), '/logo.jpg'),
  loading_spinner_url = coalesce(nullif(loading_spinner_url, ''), '/spinner.svg')
where id = 'global';

comment on column public.system_settings.pharmacy_logo_url is
  'Primary pharmacy logo URL/path used in login, header, and loading UI.';

comment on column public.system_settings.hub_logo_url is
  'Large HUB logo URL/path used in the login hero and default footer branding.';

comment on column public.system_settings.browser_icon_url is
  'Browser favicon URL/path controlled from Project Settings.';

comment on column public.system_settings.loading_spinner_url is
  'Animated loading spinner URL/path used during app and reward-flow loading.';

notify pgrst, 'reload schema';
