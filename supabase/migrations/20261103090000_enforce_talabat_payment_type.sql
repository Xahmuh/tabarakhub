-- Talabat-sourced orders are not Benefit Pay orders. Keep their payment type
-- fixed so edits cannot create false Benefit Pay ledger entries.

create or replace function public.delivery_orders_guard_talabat_payment_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(btrim(coalesce(new.external_source, ''))) = 'talabat'
    and upper(btrim(coalesce(new.payment_type, ''))) <> 'TALABAT' then
    raise exception 'Talabat orders must keep payment type TALABAT.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_orders_guard_talabat_payment_type_trigger
  on public.delivery_orders;
create trigger delivery_orders_guard_talabat_payment_type_trigger
before insert or update of external_source, payment_type
on public.delivery_orders
for each row
execute function public.delivery_orders_guard_talabat_payment_type();

-- Repair the one Talabat order that was changed to BP. Updating its payment
-- type fires benefit_pay_sync_delivery_order(), which removes its false BP row.
-- Bypass only the branch safe-edit guard for this audited administrative repair;
-- keep the audit, payment normalization, validation, and Benefit Pay triggers active.
alter table public.delivery_orders
  disable trigger delivery_orders_safe_branch_update_guard;

update public.delivery_orders
set payment_type = 'TALABAT',
    benefit_pay_received_time = null,
    payment_collection_status = 'paid',
    amount_received_bhd = value_bhd,
    amount_to_collect_bhd = 0,
    cash_handed_to_driver_bhd = 0,
    driver_payment_note = null,
    driver_id = null,
    block_number = null,
    updated_at = now()
where id = 'aeeb2f58-13d7-4d6c-9335-b69806d0471d'
  and order_number = 'TLB-T004-031126-003'
  and lower(btrim(coalesce(external_source, ''))) = 'talabat'
  and upper(btrim(coalesce(payment_type, ''))) = 'BP';

alter table public.delivery_orders
  enable trigger delivery_orders_safe_branch_update_guard;
