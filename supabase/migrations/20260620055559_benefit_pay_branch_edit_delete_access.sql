alter table public.benefit_pay_transfers
  drop constraint if exists benefit_pay_transfers_delivery_order_id_fkey;

alter table public.benefit_pay_transfers
  add constraint benefit_pay_transfers_delivery_order_id_fkey
  foreign key (delivery_order_id)
  references public.delivery_orders(id)
  on delete cascade;

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
  elsif new.sequence_no is null
    or new.sequence_no <= 0
    or new.branch_id is distinct from old.branch_id
    or new.transfer_date is distinct from old.transfer_date then
    new.sequence_no := public.benefit_pay_next_sequence(new.branch_id, new.transfer_date);
  else
    insert into public.benefit_pay_daily_sequences(branch_id, transfer_date, last_sequence)
    values (new.branch_id, new.transfer_date, new.sequence_no)
    on conflict (branch_id, transfer_date)
    do update set
      last_sequence = greatest(public.benefit_pay_daily_sequences.last_sequence, excluded.last_sequence),
      updated_at = now();
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

drop policy if exists "benefit pay transfers update scoped" on public.benefit_pay_transfers;
create policy "benefit pay transfers update scoped"
on public.benefit_pay_transfers
for update
to authenticated
using (
  public.current_app_can_manage()
  or branch_id = public.current_app_branch_id()
)
with check (
  public.current_app_can_manage()
  or branch_id = public.current_app_branch_id()
);

drop policy if exists "benefit pay transfers delete scoped" on public.benefit_pay_transfers;
create policy "benefit pay transfers delete scoped"
on public.benefit_pay_transfers
for delete
to authenticated
using (
  public.current_app_can_manage()
  or branch_id = public.current_app_branch_id()
);

create or replace function public.app_benefit_pay_delete_transfer(p_transfer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.benefit_pay_transfers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to delete Benefit Pay transfers'
      using errcode = '42501';
  end if;

  if p_transfer_id is null then
    raise exception 'Benefit Pay transfer is required'
      using errcode = '22023';
  end if;

  select *
  into v_transfer
  from public.benefit_pay_transfers
  where id = p_transfer_id
  for update;

  if not found then
    return true;
  end if;

  if not public.current_app_can_manage()
    and v_transfer.branch_id is distinct from public.current_app_branch_id() then
    raise exception 'Branches can delete only their own Benefit Pay transfers'
      using errcode = '42501';
  end if;

  delete from public.benefit_pay_transfers
  where id = p_transfer_id;

  return true;
end;
$$;

revoke all on function public.app_benefit_pay_delete_transfer(uuid) from public, anon;
grant execute on function public.app_benefit_pay_delete_transfer(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
