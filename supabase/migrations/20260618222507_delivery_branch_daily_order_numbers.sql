alter table public.delivery_orders
  add column if not exists order_number text;

create table if not exists public.delivery_order_daily_sequences (
  branch_id uuid not null references public.branches(id) on delete cascade,
  order_date date not null,
  last_sequence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch_id, order_date),
  constraint delivery_order_daily_sequences_last_sequence_check check (last_sequence >= 0)
);

alter table public.delivery_order_daily_sequences enable row level security;

revoke all on public.delivery_order_daily_sequences from public, anon, authenticated;
grant all on public.delivery_order_daily_sequences to service_role;

create or replace function public.delivery_format_order_number(
  p_branch_id uuid,
  p_order_date date,
  p_sequence integer
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_branch_code text;
begin
  select nullif(upper(regexp_replace(coalesce(b.code, ''), '[^A-Za-z0-9]+', '', 'g')), '')
  into v_branch_code
  from public.branches b
  where b.id = p_branch_id;

  if v_branch_code is null then
    v_branch_code := 'BR' || upper(left(replace(coalesce(p_branch_id::text, ''), '-', ''), 4));
  end if;

  return '#' || v_branch_code || '-' || to_char(coalesce(p_order_date, current_date), 'DDMMYY') || '-' || lpad(greatest(coalesce(p_sequence, 1), 1)::text, 3, '0');
end;
$$;

create or replace function public.delivery_next_order_number(
  p_branch_id uuid,
  p_order_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence integer;
  v_order_date date := coalesce(p_order_date, current_date);
begin
  if p_branch_id is null then
    raise exception 'Branch is required before assigning a delivery order number'
      using errcode = '23502';
  end if;

  insert into public.delivery_order_daily_sequences (
    branch_id,
    order_date,
    last_sequence,
    created_at,
    updated_at
  )
  values (
    p_branch_id,
    v_order_date,
    1,
    now(),
    now()
  )
  on conflict (branch_id, order_date)
  do update set
    last_sequence = public.delivery_order_daily_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_sequence;

  return public.delivery_format_order_number(p_branch_id, v_order_date, v_sequence);
end;
$$;

do $$
begin
  execute 'alter table public.delivery_orders disable trigger user';

  with numbered as (
    select
      o.id,
      public.delivery_format_order_number(
        o.branch_id,
        o.order_date,
        row_number() over (
          partition by o.branch_id, o.order_date
          order by coalesce(o.created_at, now()), o.id
        )::integer
      ) as next_order_number
    from public.delivery_orders o
    where o.order_number is null
      or btrim(o.order_number) = ''
  )
  update public.delivery_orders o
  set order_number = n.next_order_number
  from numbered n
  where n.id = o.id;

  execute 'alter table public.delivery_orders enable trigger user';
exception
  when others then
    execute 'alter table public.delivery_orders enable trigger user';
    raise;
end $$;

insert into public.delivery_order_daily_sequences (
  branch_id,
  order_date,
  last_sequence,
  created_at,
  updated_at
)
select
  o.branch_id,
  o.order_date,
  count(*)::integer as last_sequence,
  now(),
  now()
from public.delivery_orders o
where o.branch_id is not null
  and o.order_date is not null
group by o.branch_id, o.order_date
on conflict (branch_id, order_date)
do update set
  last_sequence = greatest(public.delivery_order_daily_sequences.last_sequence, excluded.last_sequence),
  updated_at = now();

alter table public.delivery_orders
  alter column order_number set not null;

create unique index if not exists delivery_orders_order_number_uidx
  on public.delivery_orders(order_number);

create index if not exists delivery_orders_branch_order_number_idx
  on public.delivery_orders(branch_id, order_date desc, order_number);

create or replace function public.delivery_orders_assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := public.delivery_next_order_number(new.branch_id, coalesce(new.order_date, current_date));
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_orders_assign_order_number_trigger on public.delivery_orders;
create trigger delivery_orders_assign_order_number_trigger
before insert on public.delivery_orders
for each row execute function public.delivery_orders_assign_order_number();

drop function if exists public.app_driver_get_active_orders();

create function public.app_driver_get_active_orders()
returns table (
  id uuid,
  order_number text,
  branch_id uuid,
  branch_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
  order_kind text,
  transfer_from_branch_id uuid,
  transfer_from_branch_code text,
  transfer_from_branch_name text,
  transfer_to_branch_id uuid,
  transfer_to_branch_code text,
  transfer_to_branch_name text,
  block_number text,
  area_name text,
  governorate text,
  delivery_status text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz,
  pickup_batch_id uuid,
  batch_delivery_sequence integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
    coalesce(o.order_kind, 'actual_delivery')::text as order_kind,
    o.transfer_from_branch_id,
    from_branch.code::text as transfer_from_branch_code,
    from_branch.name::text as transfer_from_branch_name,
    o.transfer_to_branch_id,
    to_branch.code::text as transfer_to_branch_code,
    to_branch.name::text as transfer_to_branch_name,
    o.block_number,
    o.area_name,
    o.governorate,
    o.delivery_status,
    o.assigned_at,
    o.picked_up_at,
    o.delivered_at,
    o.cancelled_at,
    o.notes,
    o.created_at,
    o.pickup_batch_id,
    o.batch_delivery_sequence
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  left join public.branches from_branch on from_branch.id = o.transfer_from_branch_id
  left join public.branches to_branch on to_branch.id = o.transfer_to_branch_id
  where o.driver_id = v_driver_id
    and o.delivery_status in ('assigned', 'picked_up')
  order by coalesce(o.assigned_at, o.created_at), o.created_at;
end;
$$;

drop function if exists public.app_driver_get_order_history(integer, text, text, date, date);

create function public.app_driver_get_order_history(
  p_limit integer default 50,
  p_status text default null,
  p_order_kind text default null,
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  id uuid,
  order_number text,
  branch_id uuid,
  branch_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
  order_kind text,
  transfer_from_branch_id uuid,
  transfer_from_branch_code text,
  transfer_from_branch_name text,
  transfer_to_branch_id uuid,
  transfer_to_branch_code text,
  transfer_to_branch_name text,
  block_number text,
  area_name text,
  governorate text,
  delivery_status text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz,
  pickup_batch_id uuid,
  batch_delivery_sequence integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_order_kind text := nullif(lower(btrim(coalesce(p_order_kind, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if public.current_app_role() <> 'driver' or v_driver_id is null then
    raise exception 'Driver mobile access requires a linked active driver'
      using errcode = '42501';
  end if;

  if v_status is not null and v_status not in ('picked_up', 'delivered', 'cancelled') then
    raise exception 'Driver history can be filtered only by picked_up, delivered, or cancelled'
      using errcode = '22023';
  end if;

  if v_order_kind is not null and v_order_kind not in ('actual_delivery', 'internal_transfer') then
    raise exception 'Driver history order kind filter is invalid'
      using errcode = '22023';
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.branch_id,
    b.name::text as branch_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
    coalesce(o.order_kind, 'actual_delivery')::text as order_kind,
    o.transfer_from_branch_id,
    from_branch.code::text as transfer_from_branch_code,
    from_branch.name::text as transfer_from_branch_name,
    o.transfer_to_branch_id,
    to_branch.code::text as transfer_to_branch_code,
    to_branch.name::text as transfer_to_branch_name,
    o.block_number,
    o.area_name,
    o.governorate,
    o.delivery_status,
    o.assigned_at,
    o.picked_up_at,
    o.delivered_at,
    o.cancelled_at,
    o.notes,
    o.created_at,
    o.pickup_batch_id,
    o.batch_delivery_sequence
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id
  left join public.branches from_branch on from_branch.id = o.transfer_from_branch_id
  left join public.branches to_branch on to_branch.id = o.transfer_to_branch_id
  where o.driver_id = v_driver_id
    and o.delivery_status in ('picked_up', 'delivered', 'cancelled')
    and (v_status is null or o.delivery_status = v_status)
    and (v_order_kind is null or coalesce(o.order_kind, 'actual_delivery') = v_order_kind)
    and (p_date_from is null or o.order_date >= p_date_from)
    and (p_date_to is null or o.order_date <= p_date_to)
  order by coalesce(o.delivered_at, o.cancelled_at, o.picked_up_at, o.assigned_at, o.created_at) desc
  limit v_limit;
end;
$$;

revoke all on function public.delivery_format_order_number(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.delivery_next_order_number(uuid, date) from public, anon, authenticated;
revoke all on function public.delivery_orders_assign_order_number() from public, anon, authenticated;
revoke all on function public.app_driver_get_active_orders() from public, anon;
revoke all on function public.app_driver_get_order_history(integer, text, text, date, date) from public, anon;

grant execute on function public.delivery_format_order_number(uuid, date, integer) to service_role;
grant execute on function public.delivery_next_order_number(uuid, date) to service_role;
grant execute on function public.delivery_orders_assign_order_number() to service_role;
grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
grant execute on function public.app_driver_get_order_history(integer, text, text, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
