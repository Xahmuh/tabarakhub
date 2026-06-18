-- Dashboard KPI aggregate RPC.
-- Keeps branch authorization in the function before using SECURITY DEFINER.

create or replace function public.get_dashboard_kpis(
  p_branch_id uuid,
  p_date_from date,
  p_date_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := coalesce(p_date_from, date '1900-01-01')::timestamptz;
  v_to timestamptz := (coalesce(p_date_to, current_date)::timestamp + interval '1 day')::timestamptz;
  v_result jsonb;
begin
  if p_branch_id is null or not public.current_app_can_access_branch(p_branch_id) then
    raise exception 'Not allowed to read dashboard KPIs for this branch';
  end if;

  select jsonb_build_object(
    'total_shortages', (
      select count(*)
      from public.shortages s
      where s.branch_id = p_branch_id
        and s."timestamp" >= v_from
        and s."timestamp" < v_to
    ),
    'total_lost_sales', (
      select coalesce(sum(ls.total_value), 0)
      from public.lost_sales ls
      where ls.branch_id = p_branch_id
        and ls."timestamp" >= v_from
        and ls."timestamp" < v_to
    ),
    'total_products', (
      select count(distinct coalesce(s.product_id::text, s.product_name))
      from public.shortages s
      where s.branch_id = p_branch_id
        and s."timestamp" >= v_from
        and s."timestamp" < v_to
    ),
    'shortage_by_day', coalesce((
      select jsonb_agg(row_to_json(day_row)::jsonb order by day_row.date)
      from (
        select s."timestamp"::date as date, count(*) as count
        from public.shortages s
        where s.branch_id = p_branch_id
          and s."timestamp" >= v_from
          and s."timestamp" < v_to
        group by s."timestamp"::date
      ) day_row
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_kpis(uuid, date, date) from public, anon;
grant execute on function public.get_dashboard_kpis(uuid, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
