create or replace function public.current_app_can_read_benefit_pay_all()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    public.current_app_can_read_all()
    or public.current_app_role() = 'accounts',
    false
  )
$$;

revoke all on function public.current_app_can_read_benefit_pay_all() from public, anon;
grant execute on function public.current_app_can_read_benefit_pay_all() to authenticated, service_role;

drop policy if exists "benefit pay transfers select scoped" on public.benefit_pay_transfers;
create policy "benefit pay transfers select scoped"
on public.benefit_pay_transfers
for select
to authenticated
using (
  public.current_app_can_read_benefit_pay_all()
  or public.current_app_can_access_branch(branch_id)
);

drop policy if exists "branches select accounts benefit pay analytics" on public.branches;
create policy "branches select accounts benefit pay analytics"
on public.branches
for select
to authenticated
using (
  public.current_app_role() = 'accounts'
  and role = 'branch'
);

notify pgrst, 'reload schema';
