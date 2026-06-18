-- Branch-scoped shortages export RPC with keyset pagination.
-- Mirrors public.shortages_excel_export columns while avoiding offset scans.

create or replace function public.export_shortages_paginated(
  p_branch_id uuid,
  p_date_from date,
  p_date_to date,
  p_cursor uuid default null,
  p_limit int default 1000
)
returns table (
  id uuid,
  branch_id uuid,
  branch_name text,
  pharmacist_id uuid,
  pharmacist_name text,
  internal_code text,
  product_id uuid,
  product_name text,
  category text,
  agent_name text,
  status text,
  "timestamp" timestamptz,
  notes text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := coalesce(p_date_from, date '1900-01-01')::timestamptz;
  v_to timestamptz := (coalesce(p_date_to, current_date)::timestamp + interval '1 day')::timestamptz;
  v_cursor_timestamp timestamptz;
  v_limit int := least(greatest(coalesce(p_limit, 1000), 1), 1000);
begin
  if p_branch_id is null or not public.current_app_can_export_branch(p_branch_id) then
    raise exception 'Not allowed to export shortages for this branch';
  end if;

  if p_cursor is not null then
    select s."timestamp"
    into v_cursor_timestamp
    from public.shortages s
    where s.id = p_cursor
      and s.branch_id = p_branch_id;
  end if;

  return query
  select
    s.id,
    s.branch_id,
    b.name as branch_name,
    s.pharmacist_id,
    s.pharmacist_name,
    coalesce(p.internal_code, s.internal_code, 'N/A') as internal_code,
    s.product_id,
    coalesce(p.name, s.product_name) as product_name,
    coalesce(p.category, 'General') as category,
    coalesce(s.agent_name, p.agent, 'N/A') as agent_name,
    s.status,
    s."timestamp",
    s.notes
  from public.shortages s
  left join public.products p on p.id = s.product_id
  left join public.branches b on b.id = s.branch_id
  where s.branch_id = p_branch_id
    and s."timestamp" >= v_from
    and s."timestamp" < v_to
    and (
      p_cursor is null
      or v_cursor_timestamp is null
      or s."timestamp" < v_cursor_timestamp
      or (s."timestamp" = v_cursor_timestamp and s.id < p_cursor)
    )
  order by s."timestamp" desc, s.id desc
  limit v_limit;
end;
$$;

revoke all on function public.export_shortages_paginated(uuid, date, date, uuid, int) from public, anon;
grant execute on function public.export_shortages_paginated(uuid, date, date, uuid, int) to authenticated, service_role;

notify pgrst, 'reload schema';
