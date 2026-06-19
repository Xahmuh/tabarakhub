create table if not exists public.delivery_talabat_order_daily_sequences (
  branch_id uuid not null references public.branches(id) on delete cascade,
  order_date date not null,
  last_sequence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch_id, order_date),
  constraint delivery_talabat_order_daily_sequences_last_sequence_check check (last_sequence >= 0)
);

alter table public.delivery_talabat_order_daily_sequences enable row level security;

revoke all on public.delivery_talabat_order_daily_sequences from public, anon, authenticated;
grant all on public.delivery_talabat_order_daily_sequences to service_role;

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
begin
  return public.delivery_order_branch_code(p_branch_id)
    || '-'
    || to_char(coalesce(p_order_date, current_date), 'DDMMYY')
    || '-'
    || lpad(greatest(coalesce(p_sequence, 1), 1)::text, 3, '0');
end;
$$;

create or replace function public.delivery_format_talabat_order_number(
  p_branch_id uuid,
  p_order_date date,
  p_sequence integer
)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  return 'TLB-'
    || public.delivery_order_branch_code(p_branch_id)
    || '-'
    || to_char(coalesce(p_order_date, current_date), 'DDMMYY')
    || '-'
    || lpad(greatest(coalesce(p_sequence, 1), 1)::text, 3, '0');
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
    1,
    now(),
    now()
  )
  on conflict (branch_id, order_date)
  do update set
    last_sequence = public.delivery_talabat_order_daily_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_sequence;

  return public.delivery_format_talabat_order_number(p_branch_id, v_order_date, v_sequence);
end;
$$;

-- Re-seed the normal sequence from non-Talabat, non-transfer rows only.
-- Order numbers already written to delivery_orders stay immutable; this only
-- controls the next generated numbers after this policy change.
delete from public.delivery_order_daily_sequences;

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
  and coalesce(o.order_kind, 'actual_delivery') <> 'internal_transfer'
  and upper(btrim(coalesce(o.payment_type, ''))) <> 'TALABAT'
group by o.branch_id, o.order_date;

insert into public.delivery_talabat_order_daily_sequences (
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
  and coalesce(o.order_kind, 'actual_delivery') <> 'internal_transfer'
  and upper(btrim(coalesce(o.payment_type, ''))) = 'TALABAT'
group by o.branch_id, o.order_date
on conflict (branch_id, order_date)
do update set
  last_sequence = excluded.last_sequence,
  updated_at = now();

create index if not exists delivery_talabat_order_daily_sequences_date_idx
  on public.delivery_talabat_order_daily_sequences(order_date desc, branch_id);

create or replace function public.delivery_orders_assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    if new.order_kind = 'internal_transfer' then
      new.order_number := public.delivery_next_internal_transfer_number(
        new.transfer_from_branch_id,
        new.transfer_to_branch_id,
        coalesce(new.order_date, current_date)
      );
    elsif upper(btrim(coalesce(new.payment_type, ''))) = 'TALABAT' then
      new.order_number := public.delivery_next_talabat_order_number(
        new.branch_id,
        coalesce(new.order_date, current_date)
      );
    else
      new.order_number := public.delivery_next_order_number(
        new.branch_id,
        coalesce(new.order_date, current_date)
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.delivery_format_order_number(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.delivery_format_talabat_order_number(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.delivery_next_talabat_order_number(uuid, date) from public, anon, authenticated;
revoke all on function public.delivery_orders_assign_order_number() from public, anon, authenticated;

grant execute on function public.delivery_format_order_number(uuid, date, integer) to service_role;
grant execute on function public.delivery_format_talabat_order_number(uuid, date, integer) to service_role;
grant execute on function public.delivery_next_talabat_order_number(uuid, date) to service_role;
grant execute on function public.delivery_orders_assign_order_number() to service_role;

notify pgrst, 'reload schema';
