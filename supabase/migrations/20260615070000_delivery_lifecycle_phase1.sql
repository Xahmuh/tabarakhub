-- Phase 1 delivery lifecycle support for internal admin/branch-managed dispatch.
--
-- Scope guardrails:
-- - No driver app role is added here.
-- - Existing delivery_orders and delivery_drivers are extended/reused, not replaced.
-- - Existing delivery_order_audit_logs remains the edit/delete audit table.
-- - New delivery_order_events is append-only lifecycle traceability.
-- - Branch lifecycle writes must go through app_delivery_transition_order().

alter table public.delivery_orders
  add column if not exists delivery_status text not null default 'recorded',
  add column if not exists assigned_at timestamptz,
  add column if not exists picked_up_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_reason text,
  add column if not exists lifecycle_updated_at timestamptz,
  add column if not exists lifecycle_updated_by uuid references auth.users(id) on delete set null;

update public.delivery_orders
set delivery_status = 'recorded'
where delivery_status is null;

alter table public.delivery_orders
  drop constraint if exists delivery_orders_delivery_status_check;

alter table public.delivery_orders
  add constraint delivery_orders_delivery_status_check
  check (delivery_status in ('recorded', 'assigned', 'picked_up', 'delivered', 'cancelled'));

create index if not exists delivery_orders_delivery_status_idx
  on public.delivery_orders(delivery_status);

create index if not exists delivery_orders_driver_status_date_idx
  on public.delivery_orders(driver_id, delivery_status, order_date desc);

create table if not exists public.delivery_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.delivery_orders(id) on delete set null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  event_type text not null,
  previous_status text,
  new_status text not null,
  driver_id uuid references public.delivery_drivers(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  notes text,
  idempotency_key text,
  order_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint delivery_order_events_event_type_check
    check (event_type in ('recorded', 'assigned', 'picked_up', 'delivered', 'cancelled')),
  constraint delivery_order_events_previous_status_check
    check (previous_status is null or previous_status in ('recorded', 'assigned', 'picked_up', 'delivered', 'cancelled')),
  constraint delivery_order_events_new_status_check
    check (new_status in ('recorded', 'assigned', 'picked_up', 'delivered', 'cancelled'))
);

create index if not exists delivery_order_events_order_created_idx
  on public.delivery_order_events(order_id, created_at desc);

create index if not exists delivery_order_events_branch_created_idx
  on public.delivery_order_events(branch_id, created_at desc);

create unique index if not exists delivery_order_events_idempotency_idx
  on public.delivery_order_events(order_id, idempotency_key)
  where order_id is not null and idempotency_key is not null;

alter table public.delivery_order_events enable row level security;

revoke all on public.delivery_order_events from public, anon, authenticated;
grant select on public.delivery_order_events to authenticated;
grant all on public.delivery_order_events to service_role;

drop policy if exists "delivery order events select" on public.delivery_order_events;
create policy "delivery order events select"
on public.delivery_order_events
for select
to authenticated
using (public.current_app_can_access_branch(branch_id));

create or replace function public.delivery_orders_guard_branch_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_branch_id uuid := public.current_app_branch_id();
  v_is_lifecycle_rpc boolean := coalesce(current_setting('app.delivery_lifecycle_rpc', true), '') = 'true';
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

  if v_is_lifecycle_rpc then
    v_allowed_branch_update_keys := v_allowed_branch_update_keys || array[
      'delivery_status',
      'assigned_at',
      'picked_up_at',
      'delivered_at',
      'cancelled_at',
      'cancelled_reason',
      'lifecycle_updated_at',
      'lifecycle_updated_by'
    ];
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

create or replace function public.app_delivery_transition_order(
  p_order_id uuid,
  p_next_status text,
  p_driver_id uuid default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.delivery_order_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_updated public.delivery_orders%rowtype;
  v_event public.delivery_order_events%rowtype;
  v_existing_event public.delivery_order_events%rowtype;
  v_actor_role text := public.current_app_role();
  v_current_status text;
  v_next_status text := lower(trim(coalesce(p_next_status, '')));
  v_effective_driver_id uuid;
  v_driver_name text;
  v_can_manage boolean := public.current_app_can_manage();
begin
  if auth.uid() is null then
    raise exception 'Authentication required for delivery lifecycle transitions'
      using errcode = '42501';
  end if;

  if v_next_status not in ('recorded', 'assigned', 'picked_up', 'delivered', 'cancelled') then
    raise exception 'Invalid delivery lifecycle status: %', p_next_status
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.delivery_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Delivery order not found'
      using errcode = 'P0002';
  end if;

  if not v_can_manage then
    if coalesce(v_actor_role, '') <> 'branch'
      or public.current_app_branch_id() is distinct from v_order.branch_id then
      raise exception 'Only admin users or the owning branch can change delivery lifecycle status'
        using errcode = '42501';
    end if;

    if v_order.order_date < current_date - 1
      or v_order.order_date > current_date then
      raise exception 'Branch lifecycle transitions are limited to today and yesterday'
        using errcode = '42501';
    end if;
  end if;

  if p_idempotency_key is not null then
    select *
    into v_existing_event
    from public.delivery_order_events
    where order_id = p_order_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return v_existing_event;
    end if;
  end if;

  v_current_status := coalesce(v_order.delivery_status, 'recorded');
  v_effective_driver_id := coalesce(p_driver_id, v_order.driver_id);

  if not v_can_manage then
    if v_current_status in ('delivered', 'cancelled') then
      raise exception 'Delivered or cancelled orders are terminal for branch users'
        using errcode = '42501';
    end if;

    if v_current_status = 'recorded' and v_next_status not in ('assigned', 'cancelled') then
      raise exception 'Recorded orders must be assigned or cancelled before later lifecycle steps'
        using errcode = '42501';
    end if;

    if v_current_status = 'assigned' and v_next_status not in ('picked_up', 'delivered', 'cancelled') then
      raise exception 'Assigned orders can move only to picked up, delivered, or cancelled'
        using errcode = '42501';
    end if;

    if v_current_status = 'picked_up' and v_next_status not in ('delivered', 'cancelled') then
      raise exception 'Picked-up orders can move only to delivered or cancelled'
        using errcode = '42501';
    end if;
  end if;

  if v_next_status in ('assigned', 'picked_up', 'delivered')
    and v_effective_driver_id is null then
    raise exception 'A driver is required before this delivery lifecycle transition'
      using errcode = '23502';
  end if;

  if v_effective_driver_id is not null then
    select name
    into v_driver_name
    from public.delivery_drivers
    where id = v_effective_driver_id
      and is_active = true;

    if not found then
      raise exception 'Selected driver is inactive or unavailable'
        using errcode = '23503';
    end if;
  end if;

  perform set_config('app.delivery_lifecycle_rpc', 'true', true);

  update public.delivery_orders
  set delivery_status = v_next_status,
      driver_id = case
        when v_next_status in ('assigned', 'picked_up', 'delivered') then v_effective_driver_id
        else driver_id
      end,
      assigned_at = case
        when v_next_status in ('assigned', 'picked_up', 'delivered') then coalesce(assigned_at, now())
        else assigned_at
      end,
      picked_up_at = case
        when v_next_status = 'picked_up' then coalesce(picked_up_at, now())
        else picked_up_at
      end,
      delivered_at = case
        when v_next_status = 'delivered' then coalesce(delivered_at, now())
        else delivered_at
      end,
      cancelled_at = case
        when v_next_status = 'cancelled' then coalesce(cancelled_at, now())
        else cancelled_at
      end,
      cancelled_reason = case
        when v_next_status = 'cancelled' then nullif(trim(coalesce(p_notes, '')), '')
        else cancelled_reason
      end,
      lifecycle_updated_at = now(),
      lifecycle_updated_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_order_id
  returning * into v_updated;

  insert into public.delivery_order_events (
    order_id,
    branch_id,
    event_type,
    previous_status,
    new_status,
    driver_id,
    actor_user_id,
    actor_role,
    notes,
    idempotency_key,
    order_snapshot,
    metadata
  )
  values (
    v_updated.id,
    v_updated.branch_id,
    v_next_status,
    v_current_status,
    v_next_status,
    v_effective_driver_id,
    auth.uid(),
    v_actor_role,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_idempotency_key,
    to_jsonb(v_updated),
    jsonb_build_object(
      'source', 'internal_dispatch_phase1',
      'driver_role_enabled', false,
      'driver_name', v_driver_name
    )
  )
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.app_delivery_transition_order(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.app_delivery_transition_order(uuid, text, uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
