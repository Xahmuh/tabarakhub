-- Existing rows were checked before validation on 2026-10-18.
-- Leave branches_role_must_be_branch NOT VALID until the legacy manager row is classified.
alter table public.app_user_profiles
  validate constraint app_user_profiles_role_check;

alter table public.role_permissions
  validate constraint role_permissions_role_check;

alter table public.delivery_orders
  validate constraint delivery_orders_customer_lat_check;

alter table public.delivery_orders
  validate constraint delivery_orders_customer_lng_check;
