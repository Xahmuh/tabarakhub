create table if not exists public.delivery_internal_transfer_daily_sequences (
  from_branch_id uuid not null references public.branches(id) on delete cascade,
  to_branch_id uuid not null references public.branches(id) on delete cascade,
  order_date date not null,
  last_sequence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (from_branch_id, to_branch_id, order_date),
  constraint delivery_internal_transfer_daily_sequences_last_sequence_check check (last_sequence >= 0),
  constraint delivery_internal_transfer_daily_sequences_route_check check (from_branch_id <> to_branch_id)
);

alter table public.delivery_internal_transfer_daily_sequences enable row level security;

revoke all on public.delivery_internal_transfer_daily_sequences from public, anon, authenticated;
grant all on public.delivery_internal_transfer_daily_sequences to service_role;

create or replace function public.delivery_order_branch_code(
  p_branch_id uuid
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

  return v_branch_code;
end;
$$;

create or replace function public.delivery_format_internal_transfer_number(
  p_from_branch_id uuid,
  p_to_branch_id uuid,
  p_order_date date,
  p_sequence integer
)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if p_from_branch_id is null or p_to_branch_id is null then
    raise exception 'Transfer source and destination branches are required before assigning an order reference'
      using errcode = '23502';
  end if;

  if p_from_branch_id = p_to_branch_id then
    raise exception 'Transfer source and destination must be different branches before assigning an order reference'
      using errcode = '22023';
  end if;

  return '#'
    || public.delivery_order_branch_code(p_from_branch_id)
    || '-'
    || public.delivery_order_branch_code(p_to_branch_id)
    || '-'
    || to_char(coalesce(p_order_date, current_date), 'DDMMYY')
    || '-'
    || lpad(greatest(coalesce(p_sequence, 1), 1)::text, 3, '0');
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
    1,
    now(),
    now()
  )
  on conflict (from_branch_id, to_branch_id, order_date)
  do update set
    last_sequence = public.delivery_internal_transfer_daily_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_sequence;

  return public.delivery_format_internal_transfer_number(
    p_from_branch_id,
    p_to_branch_id,
    v_order_date,
    v_sequence
  );
end;
$$;

do $$
begin
  execute 'alter table public.delivery_orders disable trigger user';

  with numbered as (
    select
      o.id,
      public.delivery_format_internal_transfer_number(
        o.transfer_from_branch_id,
        o.transfer_to_branch_id,
        o.order_date,
        row_number() over (
          partition by o.transfer_from_branch_id, o.transfer_to_branch_id, o.order_date
          order by coalesce(o.created_at, now()), o.id
        )::integer
      ) as next_order_number
    from public.delivery_orders o
    where o.order_kind = 'internal_transfer'
      and o.transfer_from_branch_id is not null
      and o.transfer_to_branch_id is not null
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

insert into public.delivery_internal_transfer_daily_sequences (
  from_branch_id,
  to_branch_id,
  order_date,
  last_sequence,
  created_at,
  updated_at
)
select
  o.transfer_from_branch_id,
  o.transfer_to_branch_id,
  o.order_date,
  count(*)::integer as last_sequence,
  now(),
  now()
from public.delivery_orders o
where o.order_kind = 'internal_transfer'
  and o.transfer_from_branch_id is not null
  and o.transfer_to_branch_id is not null
  and o.order_date is not null
group by o.transfer_from_branch_id, o.transfer_to_branch_id, o.order_date
on conflict (from_branch_id, to_branch_id, order_date)
do update set
  last_sequence = greatest(public.delivery_internal_transfer_daily_sequences.last_sequence, excluded.last_sequence),
  updated_at = now();

create index if not exists delivery_internal_transfer_daily_sequences_date_idx
  on public.delivery_internal_transfer_daily_sequences(order_date desc, from_branch_id, to_branch_id);

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
    else
      new.order_number := public.delivery_next_order_number(new.branch_id, coalesce(new.order_date, current_date));
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.delivery_order_branch_code(uuid) from public, anon, authenticated;
revoke all on function public.delivery_format_internal_transfer_number(uuid, uuid, date, integer) from public, anon, authenticated;
revoke all on function public.delivery_next_internal_transfer_number(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.delivery_orders_assign_order_number() from public, anon, authenticated;

grant execute on function public.delivery_order_branch_code(uuid) to service_role;
grant execute on function public.delivery_format_internal_transfer_number(uuid, uuid, date, integer) to service_role;
grant execute on function public.delivery_next_internal_transfer_number(uuid, uuid, date) to service_role;
grant execute on function public.delivery_orders_assign_order_number() to service_role;

notify pgrst, 'reload schema';
