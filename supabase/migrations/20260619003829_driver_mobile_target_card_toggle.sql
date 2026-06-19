-- Control visibility of the driver mobile monthly target card from Delivery Settings.
-- Default is disabled so the app does not show target/incentive UI before the
-- business process is actually active for drivers.

alter table public.delivery_mobile_app_settings
  add column if not exists target_card_enabled boolean not null default false;

update public.delivery_mobile_app_settings
set target_card_enabled = coalesce(target_card_enabled, false)
where id = 'global';

comment on column public.delivery_mobile_app_settings.target_card_enabled
is 'When true, the driver mobile app shows the monthly target/incentive card.';
