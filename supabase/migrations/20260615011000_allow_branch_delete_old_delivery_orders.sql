-- Safe replacement for the prior local-only broad branch update/delete policy.
--
-- Security decision:
-- - Admin/legacy-manager keeps full delivery-order control through current_app_can_manage().
-- - Owner remains read-only through select policies only.
-- - Branch users may update only their own recent delivery orders inside the safe
--   today/yesterday recording window.
-- - Branch users may never hard-delete delivery orders.
-- - Historical delivery orders remain read-only for branch users.
-- - Hard delete is admin/legacy-manager only and remains audited by
--   delivery_orders_audit_trigger from 20260612190000.

create or replace function public.delivery_orders_guard_branch_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_branch_id uuid := public.current_app_branch_id();
  v_allowed_branch_update_keys text[] := array[
    'order_date',
    'value_bhd',
    'payment_type',
    'pharmacist_id',
    'pharmacist_name',
    'driver_id',
    'block_number',
    'area_name',
    'governorate',
    'is_outside_governorate',
    'notes',
    'updated_at',
    'updated_by'
  ];
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if public.current_app_can_manage() then
    return new;
  end if;

  if coalesce(v_role, '') <> 'branch' then
    raise exception 'Only admin users can update delivery orders outside the branch safe-edit policy'
      using errcode = '42501';
  end if;

  if v_branch_id is null
    or old.branch_id is distinct from v_branch_id
    or new.branch_id is distinct from v_branch_id then
    raise exception 'Branch users can update only their own delivery orders'
      using errcode = '42501';
  end if;

  if old.order_date < current_date - 1
    or old.order_date > current_date then
    raise exception 'Historical delivery orders are read-only for branch users'
      using errcode = '42501';
  end if;

  if new.order_date < current_date - 1
    or new.order_date > current_date then
    raise exception 'Branch delivery order corrections must stay inside the safe recording window'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - v_allowed_branch_update_keys) <> (to_jsonb(old) - v_allowed_branch_update_keys) then
    raise exception 'Branch delivery order updates are limited to editable recording fields'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();

  return new;
end;
$$;

revoke all on function public.delivery_orders_guard_branch_update() from public, anon, authenticated;
grant execute on function public.delivery_orders_guard_branch_update() to service_role;

drop trigger if exists delivery_orders_safe_branch_update_guard on public.delivery_orders;
create trigger delivery_orders_safe_branch_update_guard
before update on public.delivery_orders
for each row execute function public.delivery_orders_guard_branch_update();

drop policy if exists "delivery orders update" on public.delivery_orders;
create policy "delivery orders update"
on public.delivery_orders
for update
to authenticated
using (
  public.current_app_can_manage()
  or (
    public.current_app_role() = 'branch'
    and branch_id = public.current_app_branch_id()
    and order_date >= current_date - 1
    and order_date <= current_date
  )
)
with check (
  public.current_app_can_manage()
  or (
    public.current_app_role() = 'branch'
    and branch_id = public.current_app_branch_id()
    and order_date >= current_date - 1
    and order_date <= current_date
  )
);

drop policy if exists "delivery orders delete" on public.delivery_orders;
create policy "delivery orders delete"
on public.delivery_orders
for delete
to authenticated
using (public.current_app_can_manage());

notify pgrst, 'reload schema';
