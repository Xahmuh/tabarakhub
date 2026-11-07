-- One-time correction requested on 2026-11-07:
-- move HASNAA ELAGAMY records created on 2026-11-06/07 Bahrain time
-- from S002 to S004, preserving order/transfer IDs and creator attribution.
-- This script is intentionally outside migrations and refuses to rerun.
do $correction$
declare
  v_source uuid := '8d428bcb-9594-43a9-a2f9-d684c0f7fd25';
  v_target uuid := '9efda513-5566-4ad2-8342-b11732ba3eac';
  v_pharmacist uuid := '048f0e11-e513-439f-a7fd-c148400be626';
  v_order record;
  v_orders integer;
  v_transfers integer;
  v_rows integer;
begin
  select count(*) into v_orders
  from public.delivery_orders
  where branch_id = v_source
    and pharmacist_id = v_pharmacist
    and (created_at at time zone 'Asia/Bahrain')::date
      between date '2026-11-06' and date '2026-11-07';

  select count(*) into v_transfers
  from public.benefit_pay_transfers
  where branch_id = v_source
    and pharmacist_id = v_pharmacist
    and (created_at at time zone 'Asia/Bahrain')::date
      between date '2026-11-06' and date '2026-11-07';

  if v_orders <> 7 or v_transfers <> 7 then
    raise exception 'Expected 7 orders and 7 BP rows; found % and %',
      v_orders, v_transfers;
  end if;

  if exists (
    select 1 from public.benefit_pay_transfers bpt
    where bpt.branch_id = v_source
      and bpt.pharmacist_id = v_pharmacist
      and (bpt.created_at at time zone 'Asia/Bahrain')::date
        between date '2026-11-06' and date '2026-11-07'
      and (bpt.source <> 'delivery'
        or not exists (
          select 1 from public.delivery_orders o
          where o.id = bpt.delivery_order_id
            and o.branch_id = v_source
            and o.pharmacist_id = v_pharmacist
            and (o.created_at at time zone 'Asia/Bahrain')::date
              between date '2026-11-06' and date '2026-11-07'
        ))
  ) then
    raise exception 'BP rows do not match the selected delivery orders';
  end if;

  -- The ordinary branch guard forbids changing an order's branch. Disable it
  -- only within this atomic statement; any error rolls the DDL back too.
  execute 'alter table public.delivery_orders disable trigger delivery_orders_safe_branch_update_guard';

  for v_order in
    select id, order_date from public.delivery_orders
    where branch_id = v_source
      and pharmacist_id = v_pharmacist
      and (created_at at time zone 'Asia/Bahrain')::date
        between date '2026-11-06' and date '2026-11-07'
    order by created_at, id
    for update
  loop
    update public.benefit_pay_transfers bpt
    set branch_id = v_target,
        sequence_no = public.benefit_pay_next_sequence(v_target, bpt.transfer_date)
    where bpt.delivery_order_id = v_order.id and bpt.branch_id = v_source;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Expected one BP row for order %, found %',
        v_order.id, v_rows;
    end if;

    update public.delivery_orders
    set branch_id = v_target,
        order_number = public.delivery_next_order_number(v_target, v_order.order_date)
    where id = v_order.id and branch_id = v_source;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Failed to move order %', v_order.id;
    end if;

    update public.delivery_order_events
    set branch_id = v_target
    where order_id = v_order.id and branch_id = v_source;
  end loop;

  execute 'alter table public.delivery_orders enable trigger delivery_orders_safe_branch_update_guard';

  if exists (
    select 1 from public.benefit_pay_transfers bpt
    join public.delivery_orders o on o.id = bpt.delivery_order_id
    where o.branch_id = v_target
      and o.pharmacist_id = v_pharmacist
      and (o.created_at at time zone 'Asia/Bahrain')::date
        between date '2026-11-06' and date '2026-11-07'
      and bpt.branch_id <> o.branch_id
  ) then
    raise exception 'Moved BP row and order have different branches';
  end if;
end
$correction$;
