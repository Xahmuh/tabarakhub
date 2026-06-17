-- Phase B clean data layer views.
-- Raw tables remain the source of truth for writes and RLS.
-- These views are read-only by grants and use security_invoker so underlying
-- table RLS still decides which rows an authenticated user can see.

create or replace view public.delivery_orders_clean
with (security_invoker = true)
as
select
  o.id,
  o.order_date,
  o.created_at,
  o.updated_at,
  o.branch_id,
  b.code as branch_code,
  b.name as branch_name,
  o.pharmacist_id,
  coalesce(p.name, o.pharmacist_name) as pharmacist_name,
  o.driver_id,
  d.driver_code,
  d.name as driver_name,
  o.order_kind,
  o.delivery_status,
  o.value_bhd,
  o.payment_type,
  coalesce(pt.label, o.payment_type) as payment_type_label,
  pt.requires_block as payment_requires_block,
  o.block_number,
  o.area_name,
  o.governorate,
  o.is_outside_governorate,
  o.assigned_at,
  o.picked_up_at,
  o.delivered_at,
  o.cancelled_at,
  o.cancelled_reason,
  o.pickup_batch_id,
  o.batch_delivery_sequence,
  o.transfer_from_branch_id,
  tf.code as transfer_from_branch_code,
  tf.name as transfer_from_branch_name,
  o.transfer_to_branch_id,
  tt.code as transfer_to_branch_code,
  tt.name as transfer_to_branch_name,
  o.lifecycle_updated_at,
  o.lifecycle_updated_by
from public.delivery_orders o
left join public.branches b
  on b.id = o.branch_id
left join public.pharmacists p
  on p.id = o.pharmacist_id
left join public.delivery_drivers d
  on d.id = o.driver_id
left join public.delivery_payment_types pt
  on pt.code = o.payment_type
left join public.branches tf
  on tf.id = o.transfer_from_branch_id
left join public.branches tt
  on tt.id = o.transfer_to_branch_id
where o.deleted_at is null;

create or replace view public.delivery_drivers_clean
with (security_invoker = true)
as
select
  d.id,
  d.driver_code,
  d.name,
  d.is_active,
  d.is_online,
  d.status_changed_at,
  d.last_seen_at,
  d.created_at,
  d.updated_at
from public.delivery_drivers d;

create or replace view public.branches_clean
with (security_invoker = true)
as
select
  b.id,
  b.code,
  b.name,
  b.role,
  true::boolean as is_active,
  b.lat,
  b.lng,
  b.duty_radius_m,
  b.google_maps_link,
  b.is_spin_enabled,
  b.is_items_entry_enabled,
  b.is_kpi_dashboard_enabled,
  p.origin_block_number,
  p.core_radius_km,
  p.standard_radius_km,
  p.extended_radius_km,
  p.target_delivery_minutes,
  p.warning_delivery_minutes,
  p.is_delivery_enabled as delivery_enabled,
  (p.id is not null) as has_delivery_profile,
  p.updated_at as delivery_profile_updated_at
from public.branches b
left join public.branch_delivery_profiles p
  on p.branch_id = b.id
where b.role = 'branch'
  and public.current_app_can_access_branch(b.id);

revoke all on table public.delivery_orders_clean from public, anon, authenticated;
revoke all on table public.delivery_drivers_clean from public, anon, authenticated;
revoke all on table public.branches_clean from public, anon, authenticated;

grant select on table public.delivery_orders_clean to authenticated;
grant select on table public.delivery_drivers_clean to authenticated;
grant select on table public.branches_clean to authenticated;

comment on view public.delivery_orders_clean is
  'Phase B read-only clean delivery order view. Uses security_invoker=true and hides legacy order_value/payment_method/order_type/business_date/driver_name text fields.';
comment on view public.delivery_drivers_clean is
  'Phase B read-only clean driver directory view. Uses security_invoker=true and hides auth_user_id, expo_push_token, phone, and notes.';
comment on view public.branches_clean is
  'Phase B read-only clean operational branch view. Uses security_invoker=true and hides contact, regulatory, manager, notes, and credential fields.';

-- Safe validation after explicit approval/apply:
-- select count(*) from public.delivery_orders_clean;
-- select count(*) from public.delivery_drivers_clean;
-- select count(*) from public.branches_clean;
-- select id, order_date, branch_code, order_kind, delivery_status, value_bhd,
--        payment_type, block_number, area_name, governorate, driver_code
-- from public.delivery_orders_clean
-- order by created_at desc
-- limit 20;
