drop function if exists public.app_driver_get_active_orders();

create function public.app_driver_get_active_orders()
returns table (
  id uuid,
  order_number text,
  branch_id uuid,
  branch_name text,
  pharmacist_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
  driver_payment_collected_at timestamptz,
  driver_payment_collected_amount_bhd numeric,
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
    coalesce(ph.name, o.pharmacist_name)::text as pharmacist_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
    o.driver_payment_collected_at,
    o.driver_payment_collected_amount_bhd,
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
  left join public.pharmacists ph on ph.id = o.pharmacist_id
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
  pharmacist_name text,
  order_date date,
  payment_type text,
  payment_collection_status text,
  amount_to_collect_bhd numeric,
  cash_handed_to_driver_bhd numeric,
  driver_payment_note text,
  driver_payment_collected_at timestamptz,
  driver_payment_collected_amount_bhd numeric,
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
    coalesce(ph.name, o.pharmacist_name)::text as pharmacist_name,
    o.order_date,
    o.payment_type,
    o.payment_collection_status,
    o.amount_to_collect_bhd,
    o.cash_handed_to_driver_bhd,
    o.driver_payment_note,
    o.driver_payment_collected_at,
    o.driver_payment_collected_amount_bhd,
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
  left join public.pharmacists ph on ph.id = o.pharmacist_id
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

revoke all on function public.app_driver_get_active_orders() from public, anon;
revoke all on function public.app_driver_get_order_history(integer, text, text, date, date) from public, anon;

grant execute on function public.app_driver_get_active_orders() to authenticated, service_role;
grant execute on function public.app_driver_get_order_history(integer, text, text, date, date) to authenticated, service_role;
