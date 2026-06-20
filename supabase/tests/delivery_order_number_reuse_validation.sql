-- Validation for Delivery Recording / Traceability order-number gap reuse.
-- Runs inside a rollback transaction and does not persist QA data.

begin;

create temp table delivery_order_number_reuse_results (
  test_name text primary key,
  expected text not null,
  actual text not null,
  passed boolean not null,
  notes text
);

do $$
declare
  v_branch_id uuid;
  v_to_branch_id uuid;
  v_order_date date := date '2099-01-02';
  v_block_number text;
  v_normal_payment_type text;
  v_normal_requires_block boolean;
  v_normal_first public.delivery_orders%rowtype;
  v_normal_second public.delivery_orders%rowtype;
  v_normal_reused public.delivery_orders%rowtype;
  v_talabat_first public.delivery_orders%rowtype;
  v_talabat_second public.delivery_orders%rowtype;
  v_talabat_reused public.delivery_orders%rowtype;
  v_transfer_first public.delivery_orders%rowtype;
  v_transfer_second public.delivery_orders%rowtype;
  v_transfer_reused public.delivery_orders%rowtype;
begin
  select id
  into v_branch_id
  from public.branches
  where role = 'branch'
    and coalesce(is_active, true) = true
  order by code
  limit 1;

  select id
  into v_to_branch_id
  from public.branches
  where role = 'branch'
    and coalesce(is_active, true) = true
    and id is distinct from v_branch_id
  order by code
  limit 1;

  select block_number
  into v_block_number
  from public.delivery_blocks
  where coalesce(is_active, true) = true
  order by block_number
  limit 1;

  select code, requires_block
  into v_normal_payment_type, v_normal_requires_block
  from public.delivery_payment_types
  where is_active = true
    and code not in ('TALABAT', 'INTERNAL_TRANSFER')
  order by
    case code
      when 'CASH' then 0
      when 'CARD' then 1
      when 'BP' then 2
      else 3
    end,
    sort_order,
    code
  limit 1;

  if v_branch_id is null then
    insert into delivery_order_number_reuse_results
    values (
      'active_branch_available',
      'active branch row exists',
      'missing',
      false,
      'Provision at least one active public.branches row with role=branch before running validation.'
    );
    return;
  end if;

  if v_normal_payment_type is null then
    insert into delivery_order_number_reuse_results
    values (
      'active_normal_payment_type_available',
      'active non-Talabat payment type exists',
      'missing',
      false,
      'Activate at least one non-Talabat delivery payment type before validating normal delivery numbering.'
    );
  elsif v_normal_requires_block is true and v_block_number is null then
    insert into delivery_order_number_reuse_results
    values (
      'active_delivery_block_available',
      'active delivery block row exists',
      'missing',
      false,
      'Provision at least one active public.delivery_blocks row before validating non-Talabat delivery numbering.'
    );
  else
    insert into public.delivery_orders (
      branch_id,
      order_date,
      value_bhd,
      payment_type,
      order_kind,
      block_number,
      notes
    )
    values (
      v_branch_id,
      v_order_date,
      0.001,
      v_normal_payment_type,
      'actual_delivery',
      case when v_normal_requires_block is true then v_block_number else null end,
      'QA sequence reuse validation - normal first'
    )
    returning * into v_normal_first;

    insert into public.delivery_orders (
      branch_id,
      order_date,
      value_bhd,
      payment_type,
      order_kind,
      block_number,
      notes
    )
    values (
      v_branch_id,
      v_order_date,
      0.001,
      v_normal_payment_type,
      'actual_delivery',
      case when v_normal_requires_block is true then v_block_number else null end,
      'QA sequence reuse validation - normal second'
    )
    returning * into v_normal_second;

    delete from public.delivery_orders
    where id = v_normal_first.id;

    insert into public.delivery_orders (
      branch_id,
      order_date,
      value_bhd,
      payment_type,
      order_kind,
      block_number,
      notes
    )
    values (
      v_branch_id,
      v_order_date,
      0.001,
      v_normal_payment_type,
      'actual_delivery',
      case when v_normal_requires_block is true then v_block_number else null end,
      'QA sequence reuse validation - normal reused'
    )
    returning * into v_normal_reused;

    insert into delivery_order_number_reuse_results
    values (
      'normal_delivery_deleted_gap_reused',
      v_normal_first.order_number,
      v_normal_reused.order_number,
      v_normal_reused.order_number = v_normal_first.order_number,
      'First normal delivery order was hard-deleted; next insert should reuse its order number.'
    );

    insert into delivery_order_number_reuse_results
    values (
      'normal_delivery_second_remains_distinct',
      v_normal_second.order_number,
      v_normal_second.order_number,
      v_normal_second.order_number is distinct from v_normal_reused.order_number,
      'The occupied second normal delivery order number must not be duplicated.'
    );
  end if;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    order_kind,
    notes
  )
  values (
    v_branch_id,
    v_order_date,
    0.001,
    'TALABAT',
    'actual_delivery',
    'QA sequence reuse validation - Talabat first'
  )
  returning * into v_talabat_first;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    order_kind,
    notes
  )
  values (
    v_branch_id,
    v_order_date,
    0.001,
    'TALABAT',
    'actual_delivery',
    'QA sequence reuse validation - Talabat second'
  )
  returning * into v_talabat_second;

  delete from public.delivery_orders
  where id = v_talabat_first.id;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    order_kind,
    notes
  )
  values (
    v_branch_id,
    v_order_date,
    0.001,
    'TALABAT',
    'actual_delivery',
    'QA sequence reuse validation - Talabat reused'
  )
  returning * into v_talabat_reused;

  insert into delivery_order_number_reuse_results
  values (
    'talabat_delivery_deleted_gap_reused',
    v_talabat_first.order_number,
    v_talabat_reused.order_number,
    v_talabat_reused.order_number = v_talabat_first.order_number,
    'First Talabat order was hard-deleted; next Talabat insert should reuse its order number.'
  );

  insert into delivery_order_number_reuse_results
  values (
    'talabat_delivery_second_remains_distinct',
    v_talabat_second.order_number,
    v_talabat_second.order_number,
    v_talabat_second.order_number is distinct from v_talabat_reused.order_number,
    'The occupied second Talabat order number must not be duplicated.'
  );

  if v_to_branch_id is null then
    insert into delivery_order_number_reuse_results
    values (
      'internal_transfer_deleted_gap_reused',
      'two active branch rows exist',
      'missing destination branch',
      false,
      'Provision at least two active branch rows to validate internal-transfer route numbering.'
    );
  else
    insert into public.delivery_orders (
      branch_id,
      order_date,
      value_bhd,
      payment_type,
      order_kind,
      transfer_from_branch_id,
      transfer_to_branch_id,
      notes
    )
    values (
      v_branch_id,
      v_order_date,
      0.001,
      'INTERNAL_TRANSFER',
      'internal_transfer',
      v_branch_id,
      v_to_branch_id,
      'QA sequence reuse validation - transfer first'
    )
    returning * into v_transfer_first;

    insert into public.delivery_orders (
      branch_id,
      order_date,
      value_bhd,
      payment_type,
      order_kind,
      transfer_from_branch_id,
      transfer_to_branch_id,
      notes
    )
    values (
      v_branch_id,
      v_order_date,
      0.001,
      'INTERNAL_TRANSFER',
      'internal_transfer',
      v_branch_id,
      v_to_branch_id,
      'QA sequence reuse validation - transfer second'
    )
    returning * into v_transfer_second;

    delete from public.delivery_orders
    where id = v_transfer_first.id;

    insert into public.delivery_orders (
      branch_id,
      order_date,
      value_bhd,
      payment_type,
      order_kind,
      transfer_from_branch_id,
      transfer_to_branch_id,
      notes
    )
    values (
      v_branch_id,
      v_order_date,
      0.001,
      'INTERNAL_TRANSFER',
      'internal_transfer',
      v_branch_id,
      v_to_branch_id,
      'QA sequence reuse validation - transfer reused'
    )
    returning * into v_transfer_reused;

    insert into delivery_order_number_reuse_results
    values (
      'internal_transfer_deleted_gap_reused',
      v_transfer_first.order_number,
      v_transfer_reused.order_number,
      v_transfer_reused.order_number = v_transfer_first.order_number,
      'First internal-transfer order was hard-deleted; next insert for the same route/date should reuse its order number.'
    );

    insert into delivery_order_number_reuse_results
    values (
      'internal_transfer_second_remains_distinct',
      v_transfer_second.order_number,
      v_transfer_second.order_number,
      v_transfer_second.order_number is distinct from v_transfer_reused.order_number,
      'The occupied second internal-transfer order number must not be duplicated.'
    );
  end if;
end;
$$;

select *
from delivery_order_number_reuse_results
order by test_name;

rollback;
