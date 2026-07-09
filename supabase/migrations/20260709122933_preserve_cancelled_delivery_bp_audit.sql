-- Preserve Benefit Pay audit traceability for BP delivery orders even after
-- delivery lifecycle cancellation. Cancellation is operational; Benefit Pay is
-- a financial/audit ledger and should not silently lose a received BP record.

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
    concat_ws(
      ' ',
      'Auto from delivery order',
      coalesce(new.order_number, '#' || left(new.id::text, 8)),
      case when coalesce(new.delivery_status, 'recorded') = 'cancelled' then '(cancelled delivery)' else null end
    ),
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

-- Backfill BP delivery orders that already have a received time but are missing
-- from the Benefit Pay ledger, including cancelled deliveries kept for audit.
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
select
  o.branch_id,
  o.order_date,
  o.pharmacist_id,
  coalesce(ph.name, o.pharmacist_name),
  'IBAN',
  round(greatest(coalesce(o.amount_received_bhd, o.value_bhd, 0), 0)::numeric, 3),
  o.benefit_pay_received_time,
  'delivery',
  o.id,
  concat_ws(
    ' ',
    'Auto from delivery order',
    coalesce(o.order_number, '#' || left(o.id::text, 8)),
    case when coalesce(o.delivery_status, 'recorded') = 'cancelled' then '(cancelled delivery)' else null end
  ),
  o.created_by,
  coalesce(o.updated_by, o.created_by)
from public.delivery_orders o
left join public.pharmacists ph on ph.id = o.pharmacist_id
left join public.benefit_pay_transfers bpt on bpt.delivery_order_id = o.id
where bpt.id is null
  and coalesce(o.order_kind, 'actual_delivery') = 'actual_delivery'
  and upper(btrim(coalesce(o.payment_type, ''))) = 'BP'
  and o.benefit_pay_received_time is not null
  and o.deleted_at is null
  and round(greatest(coalesce(o.amount_received_bhd, o.value_bhd, 0), 0)::numeric, 3) > 0
on conflict (delivery_order_id)
do nothing;

drop policy if exists "benefit pay transfers delete scoped" on public.benefit_pay_transfers;
create policy "benefit pay transfers delete scoped"
on public.benefit_pay_transfers
for delete
to authenticated
using (
  source = 'manual'
  and delivery_order_id is null
  and (
    public.current_app_can_manage()
    or branch_id = public.current_app_branch_id()
  )
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

  if v_transfer.source = 'delivery' or v_transfer.delivery_order_id is not null then
    raise exception 'Delivery-linked Benefit Pay transfers are audit records. Update or cancel the linked delivery order instead.'
      using errcode = '42501';
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
