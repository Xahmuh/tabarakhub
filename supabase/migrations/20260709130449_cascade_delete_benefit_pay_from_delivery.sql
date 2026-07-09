-- Recreate the benefit_pay_transfers foreign key on delivery_order_id with ON DELETE CASCADE.
-- This ensures that when a delivery order is hard-deleted from recording, its linked
-- Benefit Pay record is automatically deleted rather than violating check constraints
-- or leaving orphan rows.

alter table public.benefit_pay_transfers
  drop constraint if exists benefit_pay_transfers_delivery_order_id_fkey;

alter table public.benefit_pay_transfers
  add constraint benefit_pay_transfers_delivery_order_id_fkey
    foreign key (delivery_order_id)
    references public.delivery_orders(id)
    on delete cascade;
