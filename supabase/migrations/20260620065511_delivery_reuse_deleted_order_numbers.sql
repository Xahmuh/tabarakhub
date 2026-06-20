-- Reuse deleted Delivery Recording / Traceability order numbers per branch/day.
-- If #T001-200626-003 is hard-deleted, the next matching delivery order can
-- receive #T001-200626-003 again instead of skipping to the next value.

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
  v_last_sequence integer;
  v_search_ceiling integer;
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
    0,
    now(),
    now()
  )
  on conflict (branch_id, order_date) do nothing;

  select last_sequence
  into v_last_sequence
  from public.delivery_order_daily_sequences
  where branch_id = p_branch_id
    and order_date = v_order_date
  for update;

  v_search_ceiling := greatest(coalesce(v_last_sequence, 0) + 1, 1);

  select candidate.sequence_no
  into v_sequence
  from generate_series(1, v_search_ceiling) as candidate(sequence_no)
  where not exists (
    select 1
    from public.delivery_orders o
    where o.branch_id = p_branch_id
      and o.order_date = v_order_date
      and coalesce(o.order_kind, 'actual_delivery') <> 'internal_transfer'
      and upper(btrim(coalesce(o.payment_type, ''))) <> 'TALABAT'
      and o.order_number = public.delivery_format_order_number(
        p_branch_id,
        v_order_date,
        candidate.sequence_no
      )
  )
  order by candidate.sequence_no
  limit 1;

  if v_sequence is null then
    v_sequence := v_search_ceiling;
  end if;

  update public.delivery_order_daily_sequences
  set
    last_sequence = greatest(last_sequence, v_sequence),
    updated_at = now()
  where branch_id = p_branch_id
    and order_date = v_order_date;

  return public.delivery_format_order_number(p_branch_id, v_order_date, v_sequence);
end;
$$;

create or replace function public.delivery_next_talabat_order_number(
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
  v_last_sequence integer;
  v_search_ceiling integer;
begin
  if p_branch_id is null then
    raise exception 'Branch is required before assigning a Talabat order number'
      using errcode = '23502';
  end if;

  insert into public.delivery_talabat_order_daily_sequences (
    branch_id,
    order_date,
    last_sequence,
    created_at,
    updated_at
  )
  values (
    p_branch_id,
    v_order_date,
    0,
    now(),
    now()
  )
  on conflict (branch_id, order_date) do nothing;

  select last_sequence
  into v_last_sequence
  from public.delivery_talabat_order_daily_sequences
  where branch_id = p_branch_id
    and order_date = v_order_date
  for update;

  v_search_ceiling := greatest(coalesce(v_last_sequence, 0) + 1, 1);

  select candidate.sequence_no
  into v_sequence
  from generate_series(1, v_search_ceiling) as candidate(sequence_no)
  where not exists (
    select 1
    from public.delivery_orders o
    where o.branch_id = p_branch_id
      and o.order_date = v_order_date
      and coalesce(o.order_kind, 'actual_delivery') <> 'internal_transfer'
      and upper(btrim(coalesce(o.payment_type, ''))) = 'TALABAT'
      and o.order_number = public.delivery_format_talabat_order_number(
        p_branch_id,
        v_order_date,
        candidate.sequence_no
      )
  )
  order by candidate.sequence_no
  limit 1;

  if v_sequence is null then
    v_sequence := v_search_ceiling;
  end if;

  update public.delivery_talabat_order_daily_sequences
  set
    last_sequence = greatest(last_sequence, v_sequence),
    updated_at = now()
  where branch_id = p_branch_id
    and order_date = v_order_date;

  return public.delivery_format_talabat_order_number(p_branch_id, v_order_date, v_sequence);
end;
$$;

create or replace function public.delivery_next_internal_transfer_number(
  p_from_branch_id uuid,
  p_to_branch_id uuid,
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
  v_last_sequence integer;
  v_search_ceiling integer;
begin
  if p_from_branch_id is null or p_to_branch_id is null then
    raise exception 'Transfer source and destination branches are required before assigning an order reference'
      using errcode = '23502';
  end if;

  if p_from_branch_id = p_to_branch_id then
    raise exception 'Transfer source and destination must be different branches before assigning an order reference'
      using errcode = '22023';
  end if;

  insert into public.delivery_internal_transfer_daily_sequences (
    from_branch_id,
    to_branch_id,
    order_date,
    last_sequence,
    created_at,
    updated_at
  )
  values (
    p_from_branch_id,
    p_to_branch_id,
    v_order_date,
    0,
    now(),
    now()
  )
  on conflict (from_branch_id, to_branch_id, order_date) do nothing;

  select last_sequence
  into v_last_sequence
  from public.delivery_internal_transfer_daily_sequences
  where from_branch_id = p_from_branch_id
    and to_branch_id = p_to_branch_id
    and order_date = v_order_date
  for update;

  v_search_ceiling := greatest(coalesce(v_last_sequence, 0) + 1, 1);

  select candidate.sequence_no
  into v_sequence
  from generate_series(1, v_search_ceiling) as candidate(sequence_no)
  where not exists (
    select 1
    from public.delivery_orders o
    where o.order_kind = 'internal_transfer'
      and o.transfer_from_branch_id = p_from_branch_id
      and o.transfer_to_branch_id = p_to_branch_id
      and o.order_date = v_order_date
      and o.order_number = public.delivery_format_internal_transfer_number(
        p_from_branch_id,
        p_to_branch_id,
        v_order_date,
        candidate.sequence_no
      )
  )
  order by candidate.sequence_no
  limit 1;

  if v_sequence is null then
    v_sequence := v_search_ceiling;
  end if;

  update public.delivery_internal_transfer_daily_sequences
  set
    last_sequence = greatest(last_sequence, v_sequence),
    updated_at = now()
  where from_branch_id = p_from_branch_id
    and to_branch_id = p_to_branch_id
    and order_date = v_order_date;

  return public.delivery_format_internal_transfer_number(
    p_from_branch_id,
    p_to_branch_id,
    v_order_date,
    v_sequence
  );
end;
$$;

revoke all on function public.delivery_next_order_number(uuid, date) from public, anon, authenticated;
revoke all on function public.delivery_next_talabat_order_number(uuid, date) from public, anon, authenticated;
revoke all on function public.delivery_next_internal_transfer_number(uuid, uuid, date) from public, anon, authenticated;

grant execute on function public.delivery_next_order_number(uuid, date) to service_role;
grant execute on function public.delivery_next_talabat_order_number(uuid, date) to service_role;
grant execute on function public.delivery_next_internal_transfer_number(uuid, uuid, date) to service_role;

notify pgrst, 'reload schema';
