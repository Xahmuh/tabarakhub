-- Use the business day in Bahrain for branch delivery recording RLS windows.
-- Postgres CURRENT_DATE is UTC in this project, which blocks branch inserts
-- shortly after midnight Bahrain time when the UI has already moved to the new date.

drop policy if exists "delivery orders insert" on public.delivery_orders;
create policy "delivery orders insert"
on public.delivery_orders
for insert
to authenticated
with check (
  public.current_app_can_manage()
  or (
    branch_id = public.current_app_branch_id()
    and order_date >= (((now() at time zone 'Asia/Bahrain')::date) - 1)
    and order_date <= ((now() at time zone 'Asia/Bahrain')::date)
  )
);

drop policy if exists "delivery orders update" on public.delivery_orders;
create policy "delivery orders update"
on public.delivery_orders
for update
to authenticated
using (
  public.current_app_can_manage()
  or (
    public.current_app_role() = 'branch'
    and branch_id = public.current_app_branch_id()
    and order_date >= (((now() at time zone 'Asia/Bahrain')::date) - 1)
    and order_date <= ((now() at time zone 'Asia/Bahrain')::date)
  )
)
with check (
  public.current_app_can_manage()
  or (
    public.current_app_role() = 'branch'
    and branch_id = public.current_app_branch_id()
    and order_date >= (((now() at time zone 'Asia/Bahrain')::date) - 1)
    and order_date <= ((now() at time zone 'Asia/Bahrain')::date)
  )
);
