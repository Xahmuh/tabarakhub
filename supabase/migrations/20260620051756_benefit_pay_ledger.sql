create table if not exists public.benefit_pay_daily_sequences (
  branch_id uuid not null references public.branches(id) on delete cascade,
  transfer_date date not null,
  last_sequence integer not null default 0 check (last_sequence >= 0),
  updated_at timestamptz not null default now(),
  primary key (branch_id, transfer_date)
);

create table if not exists public.benefit_pay_transfers (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique,
  sequence_no integer not null check (sequence_no > 0),
  branch_id uuid not null references public.branches(id) on delete restrict,
  transfer_date date not null default ((now() at time zone 'Asia/Bahrain')::date),
  pharmacist_id uuid references public.pharmacists(id) on delete set null,
  pharmacist_name text,
  transfer_type text not null check (transfer_type in ('AFS', 'CREDIMAX', 'IBAN')),
  value_bhd numeric(10,3) not null check (value_bhd > 0),
  transfer_time time not null,
  source text not null default 'manual' check (source in ('manual', 'delivery')),
  delivery_order_id uuid unique references public.delivery_orders(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint benefit_pay_transfers_delivery_source_check
    check (
      (source = 'delivery' and delivery_order_id is not null)
      or (source = 'manual' and delivery_order_id is null)
    )
);

create unique index if not exists benefit_pay_transfers_branch_date_sequence_uidx
  on public.benefit_pay_transfers(branch_id, transfer_date, sequence_no);

create index if not exists benefit_pay_transfers_branch_date_idx
  on public.benefit_pay_transfers(branch_id, transfer_date desc, transfer_time desc);

create index if not exists benefit_pay_transfers_type_date_idx
  on public.benefit_pay_transfers(transfer_type, transfer_date desc);

comment on table public.benefit_pay_transfers is
  'Benefit Pay Ledger: branch transfer records plus delivery BP auto-sync rows.';

create or replace function public.benefit_pay_next_sequence(
  p_branch_id uuid,
  p_transfer_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if p_branch_id is null then
    raise exception 'Branch is required for Benefit Pay serial generation'
      using errcode = '23502';
  end if;

  if p_transfer_date is null then
    raise exception 'Transfer date is required for Benefit Pay serial generation'
      using errcode = '23502';
  end if;

  insert into public.benefit_pay_daily_sequences(branch_id, transfer_date, last_sequence)
  values (p_branch_id, p_transfer_date, 1)
  on conflict (branch_id, transfer_date)
  do update set
    last_sequence = public.benefit_pay_daily_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_next;

  return v_next;
end;
$$;

create or replace function public.benefit_pay_assign_serial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_code text;
begin
  new.transfer_date := coalesce(new.transfer_date, (now() at time zone 'Asia/Bahrain')::date);
  new.transfer_type := upper(btrim(coalesce(new.transfer_type, '')));
  new.value_bhd := round(greatest(coalesce(new.value_bhd, 0), 0)::numeric, 3);
  new.pharmacist_name := nullif(btrim(coalesce(new.pharmacist_name, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');

  if new.transfer_type not in ('AFS', 'CREDIMAX', 'IBAN') then
    raise exception 'Invalid Benefit Pay transfer type'
      using errcode = '22023';
  end if;

  if new.value_bhd <= 0 then
    raise exception 'Benefit Pay transfer value must be greater than zero'
      using errcode = '22023';
  end if;

  if new.pharmacist_id is not null and new.pharmacist_name is null then
    select ph.name
    into new.pharmacist_name
    from public.pharmacists ph
    where ph.id = new.pharmacist_id;
  end if;

  select nullif(btrim(code), '')
  into v_branch_code
  from public.branches
  where id = new.branch_id;

  if v_branch_code is null then
    raise exception 'Branch code is required for Benefit Pay serial generation'
      using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if new.sequence_no is null or new.sequence_no <= 0 then
      new.sequence_no := public.benefit_pay_next_sequence(new.branch_id, new.transfer_date);
    else
      insert into public.benefit_pay_daily_sequences(branch_id, transfer_date, last_sequence)
      values (new.branch_id, new.transfer_date, new.sequence_no)
      on conflict (branch_id, transfer_date)
      do update set
        last_sequence = greatest(public.benefit_pay_daily_sequences.last_sequence, excluded.last_sequence),
        updated_at = now();
    end if;
  end if;

  new.serial_number := format(
    'BP-%s-%s-%s',
    upper(v_branch_code),
    to_char(new.transfer_date, 'DDMMYY'),
    lpad(new.sequence_no::text, 2, '0')
  );
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists benefit_pay_assign_serial_trigger on public.benefit_pay_transfers;
create trigger benefit_pay_assign_serial_trigger
before insert or update of branch_id, transfer_date, transfer_type, value_bhd, pharmacist_id, pharmacist_name, notes
on public.benefit_pay_transfers
for each row execute function public.benefit_pay_assign_serial();

create or replace function public.benefit_pay_sync_delivery_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_should_sync boolean;
  v_value numeric(10,3);
  v_pharmacist_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.benefit_pay_transfers
    where delivery_order_id = old.id;
    return old;
  end if;

  v_should_sync :=
    coalesce(new.order_kind, 'actual_delivery') = 'actual_delivery'
    and upper(btrim(coalesce(new.payment_type, ''))) = 'BP'
    and new.benefit_pay_received_time is not null
    and coalesce(new.delivery_status, 'recorded') <> 'cancelled'
    and new.deleted_at is null;

  if not v_should_sync then
    delete from public.benefit_pay_transfers
    where delivery_order_id = new.id;
    return new;
  end if;

  v_value := round(greatest(coalesce(new.amount_received_bhd, new.value_bhd, 0), 0)::numeric, 3);
  if v_value <= 0 then
    v_value := round(greatest(coalesce(new.value_bhd, 0), 0)::numeric, 3);
  end if;

  if v_value <= 0 then
    delete from public.benefit_pay_transfers
    where delivery_order_id = new.id;
    return new;
  end if;

  select ph.name
  into v_pharmacist_name
  from public.pharmacists ph
  where ph.id = new.pharmacist_id;

  delete from public.benefit_pay_transfers bpt
  where bpt.delivery_order_id = new.id
    and (
      bpt.branch_id is distinct from new.branch_id
      or bpt.transfer_date is distinct from new.order_date
    );

  insert into public.benefit_pay_transfers (
    branch_id,
    transfer_date,
    pharmacist_id,
    pharmacist_name,
    transfer_type,
    value_bhd,
    transfer_time,
    source,
    delivery_order_id,
    notes,
    created_by,
    updated_by
  )
  values (
    new.branch_id,
    new.order_date,
    new.pharmacist_id,
    coalesce(v_pharmacist_name, new.pharmacist_name),
    'IBAN',
    v_value,
    new.benefit_pay_received_time,
    'delivery',
    new.id,
    concat_ws(' ', 'Auto from delivery order', coalesce(new.order_number, '#' || left(new.id::text, 8))),
    coalesce(new.created_by, auth.uid()),
    coalesce(new.updated_by, new.created_by, auth.uid())
  )
  on conflict (delivery_order_id)
  do update set
    pharmacist_id = excluded.pharmacist_id,
    pharmacist_name = excluded.pharmacist_name,
    transfer_type = 'IBAN',
    value_bhd = excluded.value_bhd,
    transfer_time = excluded.transfer_time,
    notes = excluded.notes,
    updated_by = excluded.updated_by,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists benefit_pay_sync_delivery_order_trigger on public.delivery_orders;
create trigger benefit_pay_sync_delivery_order_trigger
after insert or update of branch_id, order_date, order_kind, payment_type, benefit_pay_received_time, amount_received_bhd, value_bhd, delivery_status, deleted_at, pharmacist_id, pharmacist_name, order_number
or delete on public.delivery_orders
for each row execute function public.benefit_pay_sync_delivery_order();

alter table public.benefit_pay_daily_sequences enable row level security;
alter table public.benefit_pay_transfers enable row level security;

revoke all on public.benefit_pay_daily_sequences from anon;
revoke all on public.benefit_pay_daily_sequences from authenticated;
grant all on public.benefit_pay_daily_sequences to service_role;

revoke all on public.benefit_pay_transfers from anon;
revoke all on public.benefit_pay_transfers from authenticated;
grant select, insert, update, delete on public.benefit_pay_transfers to authenticated;
grant all on public.benefit_pay_transfers to service_role;

drop policy if exists "benefit pay transfers select scoped" on public.benefit_pay_transfers;
create policy "benefit pay transfers select scoped"
on public.benefit_pay_transfers
for select
to authenticated
using (public.current_app_can_access_branch(branch_id));

drop policy if exists "benefit pay transfers insert scoped" on public.benefit_pay_transfers;
create policy "benefit pay transfers insert scoped"
on public.benefit_pay_transfers
for insert
to authenticated
with check (
  source = 'manual'
  and (
    public.current_app_can_manage()
    or branch_id = public.current_app_branch_id()
  )
);

drop policy if exists "benefit pay transfers update scoped" on public.benefit_pay_transfers;
create policy "benefit pay transfers update scoped"
on public.benefit_pay_transfers
for update
to authenticated
using (
  public.current_app_can_manage()
  or (source = 'manual' and branch_id = public.current_app_branch_id())
)
with check (
  public.current_app_can_manage()
  or (source = 'manual' and branch_id = public.current_app_branch_id())
);

drop policy if exists "benefit pay transfers delete scoped" on public.benefit_pay_transfers;
create policy "benefit pay transfers delete scoped"
on public.benefit_pay_transfers
for delete
to authenticated
using (
  public.current_app_can_manage()
  or (source = 'manual' and branch_id = public.current_app_branch_id())
);

revoke all on function public.benefit_pay_next_sequence(uuid, date) from public, anon, authenticated;
revoke all on function public.benefit_pay_assign_serial() from public, anon, authenticated;
revoke all on function public.benefit_pay_sync_delivery_order() from public, anon, authenticated;
grant execute on function public.benefit_pay_next_sequence(uuid, date) to service_role;
grant execute on function public.benefit_pay_assign_serial() to service_role;
grant execute on function public.benefit_pay_sync_delivery_order() to service_role;

notify pgrst, 'reload schema';
