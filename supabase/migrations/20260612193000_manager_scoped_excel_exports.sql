-- Keep Excel export views scoped even when broader operational read roles exist.
-- Manager can export all branches. Branch users can export their own branch.
-- Supervisors can export only assigned branches.

create or replace function public.current_app_can_export_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.role() = 'service_role'
    or public.current_app_role() = 'manager'
    or (target_branch_id is not null and target_branch_id = public.current_app_branch_id())
    or public.current_app_is_supervisor_of(target_branch_id),
    false
  )
$$;

revoke all on function public.current_app_can_export_branch(uuid) from public;
grant execute on function public.current_app_can_export_branch(uuid) to authenticated, service_role;

drop view if exists public.lost_sales_excel_export;

create or replace view public.lost_sales_excel_export
with (security_invoker = true)
as
select
  ls.id,
  ls.branch_id,
  b.name as branch_name,
  ls.pharmacist_id,
  coalesce(p.internal_code, ls.internal_code, 'N/A') as internal_code,
  coalesce(p.name, ls.product_name) as product_name,
  ls.lost_date,
  ls.timestamp,
  ls.quantity,
  ls.unit_price,
  ls.total_value,
  coalesce(ls.category, p.category, 'General') as category,
  coalesce(ls.agent_name, p.agent, 'N/A') as agent_name,
  ls.alternative_given,
  ls.internal_transfer,
  ls.notes,
  ls.pharmacist_name
from public.lost_sales ls
left join public.products p on ls.product_id = p.id
left join public.branches b on ls.branch_id = b.id
where public.current_app_can_export_branch(ls.branch_id);

drop view if exists public.shortages_excel_export;

create or replace view public.shortages_excel_export
with (security_invoker = true)
as
select
  s.id,
  s.branch_id,
  b.name as branch_name,
  s.pharmacist_id,
  s.pharmacist_name,
  coalesce(p.internal_code, s.internal_code, 'N/A') as internal_code,
  coalesce(p.name, s.product_name) as product_name,
  coalesce(p.category, 'General') as category,
  coalesce(s.agent_name, p.agent, 'N/A') as agent_name,
  s.status,
  s.timestamp,
  s.notes
from public.shortages s
left join public.products p on s.product_id = p.id
left join public.branches b on s.branch_id = b.id
where public.current_app_can_export_branch(s.branch_id);

revoke all on public.lost_sales_excel_export from anon;
revoke all on public.shortages_excel_export from anon;
grant select on public.lost_sales_excel_export to authenticated, service_role;
grant select on public.shortages_excel_export to authenticated, service_role;

notify pgrst, 'reload schema';
