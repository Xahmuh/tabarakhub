create table if not exists public.delivery_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null default 'delivery_delivered',
  order_id uuid not null references public.delivery_orders(id) on delete cascade,
  event_id uuid not null references public.delivery_order_events(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  driver_id uuid references public.delivery_drivers(id) on delete set null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  read_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint delivery_notifications_type_check
    check (notification_type in ('delivery_delivered'))
);

create unique index if not exists delivery_notifications_event_id_idx
  on public.delivery_notifications(event_id);

create index if not exists delivery_notifications_created_idx
  on public.delivery_notifications(created_at desc);

create index if not exists delivery_notifications_unread_created_idx
  on public.delivery_notifications(is_read, created_at desc);

create index if not exists delivery_notifications_branch_created_idx
  on public.delivery_notifications(branch_id, created_at desc);

alter table public.delivery_notifications enable row level security;

revoke all on public.delivery_notifications from public, anon, authenticated;
grant select on public.delivery_notifications to authenticated;
grant all on public.delivery_notifications to service_role;

drop policy if exists "delivery notifications select" on public.delivery_notifications;
create policy "delivery notifications select"
on public.delivery_notifications
for select
to authenticated
using (public.current_app_can_access_branch(branch_id));

create or replace function public.app_enqueue_delivery_delivered_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.delivery_orders%rowtype;
  v_branch_name text;
  v_branch_code text;
  v_driver_name text;
  v_driver_code text;
  v_block_suffix text := '';
begin
  if tg_op <> 'INSERT'
    or new.new_status <> 'delivered'
    or coalesce(new.actor_role, '') <> 'driver'
    or new.driver_id is null
    or new.order_id is null then
    return new;
  end if;

  select *
  into v_order
  from public.delivery_orders
  where id = new.order_id;

  if not found or coalesce(v_order.order_kind, 'actual_delivery') <> 'actual_delivery' then
    return new;
  end if;

  select b.name, b.code
  into v_branch_name, v_branch_code
  from public.branches b
  where b.id = new.branch_id;

  select d.name, d.driver_code
  into v_driver_name, v_driver_code
  from public.delivery_drivers d
  where d.id = new.driver_id;

  if nullif(trim(coalesce(v_order.block_number, '')), '') is not null then
    v_block_suffix := format(' to block %s', v_order.block_number);
  end if;

  insert into public.delivery_notifications (
    notification_type,
    order_id,
    event_id,
    branch_id,
    driver_id,
    title,
    body,
    payload,
    created_at
  )
  values (
    'delivery_delivered',
    v_order.id,
    new.id,
    new.branch_id,
    new.driver_id,
    format('%s delivery completed', coalesce(nullif(v_branch_name, ''), nullif(v_branch_code, ''), 'Branch')),
    format(
      '%s delivered order #%s%s.',
      coalesce(nullif(v_driver_name, ''), nullif(v_driver_code, ''), 'Driver'),
      left(v_order.id::text, 8),
      v_block_suffix
    ),
    jsonb_build_object(
      'orderId', v_order.id,
      'orderDate', v_order.order_date,
      'orderKind', coalesce(v_order.order_kind, 'actual_delivery'),
      'paymentType', v_order.payment_type,
      'blockNumber', v_order.block_number,
      'areaName', v_order.area_name,
      'governorate', v_order.governorate,
      'branchId', new.branch_id,
      'branchName', v_branch_name,
      'branchCode', v_branch_code,
      'driverId', new.driver_id,
      'driverName', v_driver_name,
      'driverCode', v_driver_code,
      'deliveredAt', coalesce(v_order.delivered_at, new.created_at),
      'eventId', new.id
    ),
    new.created_at
  )
  on conflict (event_id) do nothing;

  return new;
end;
$$;

revoke all on function public.app_enqueue_delivery_delivered_notification() from public, anon, authenticated;
grant execute on function public.app_enqueue_delivery_delivered_notification() to service_role;

drop trigger if exists enqueue_delivery_delivered_notification on public.delivery_order_events;
create trigger enqueue_delivery_delivered_notification
after insert on public.delivery_order_events
for each row
execute function public.app_enqueue_delivery_delivered_notification();

create or replace function public.app_mark_delivery_notification_read(
  p_notification_id uuid,
  p_read boolean default true
)
returns public.delivery_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.delivery_notifications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to update delivery notifications'
      using errcode = '42501';
  end if;

  select *
  into v_notification
  from public.delivery_notifications
  where id = p_notification_id
  for update;

  if not found then
    raise exception 'Delivery notification not found'
      using errcode = 'P0002';
  end if;

  if not public.current_app_can_access_branch(v_notification.branch_id) then
    raise exception 'Not allowed to update this delivery notification'
      using errcode = '42501';
  end if;

  update public.delivery_notifications
  set is_read = coalesce(p_read, true),
      read_at = case when coalesce(p_read, true) then now() else null end,
      read_by = case when coalesce(p_read, true) then auth.uid() else null end
  where id = p_notification_id
  returning * into v_notification;

  return v_notification;
end;
$$;

create or replace function public.app_mark_all_delivery_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to update delivery notifications'
      using errcode = '42501';
  end if;

  with updated as (
    update public.delivery_notifications
    set is_read = true,
        read_at = now(),
        read_by = auth.uid()
    where is_read = false
      and public.current_app_can_access_branch(branch_id)
    returning 1
  )
  select count(*)::integer into v_count from updated;

  return v_count;
end;
$$;

revoke all on function public.app_mark_delivery_notification_read(uuid, boolean) from public, anon;
revoke all on function public.app_mark_all_delivery_notifications_read() from public, anon;
grant execute on function public.app_mark_delivery_notification_read(uuid, boolean) to authenticated, service_role;
grant execute on function public.app_mark_all_delivery_notifications_read() to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.delivery_notifications;
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
