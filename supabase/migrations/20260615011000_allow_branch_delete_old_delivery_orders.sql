drop policy if exists "delivery orders update" on public.delivery_orders;
create policy "delivery orders update"
on public.delivery_orders for update to authenticated
using (
  public.current_app_can_manage()
  or branch_id = public.current_app_branch_id()
)
with check (
  public.current_app_can_manage()
  or branch_id = public.current_app_branch_id()
);

drop policy if exists "delivery orders delete" on public.delivery_orders;
create policy "delivery orders delete"
on public.delivery_orders for delete to authenticated
using (
  public.current_app_can_manage()
  or branch_id = public.current_app_branch_id()
);
