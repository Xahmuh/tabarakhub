-- Keep HR-synced delivery drivers on the same visible code as their HR record.
-- The driver UUID remains unchanged, so existing delivery and duty references stay intact.
do $$
declare
  conflict_record record;
begin
  lock table public.delivery_drivers in share row exclusive mode;

  create temp table driver_code_reconciliation on commit drop as
  select
    id,
    driver_code as old_code,
    upper(btrim(substring(notes from 'Synced from HR Master Directory \[([^]]+)\]'))) as new_code
  from public.delivery_drivers
  where notes ~ 'Synced from HR Master Directory \[[^]]+\]';

  delete from driver_code_reconciliation where new_code = old_code;

  select new_code, count(*) as driver_count
  into conflict_record
  from driver_code_reconciliation
  group by new_code
  having count(*) > 1
  limit 1;
  if found then
    raise exception 'HR driver code % is assigned to % delivery drivers',
      conflict_record.new_code, conflict_record.driver_count;
  end if;

  select d.driver_code, d.id
  into conflict_record
  from driver_code_reconciliation r
  join public.delivery_drivers d on upper(btrim(d.driver_code)) = r.new_code and d.id <> r.id
  left join driver_code_reconciliation moving on moving.id = d.id
  where moving.id is null
  limit 1;
  if found then
    raise exception 'HR driver code % is held by a different driver (%)',
      conflict_record.driver_code, conflict_record.id;
  end if;

  -- Temporary unique values allow code swaps such as D075 -> D029 and D193 -> D075.
  update public.delivery_drivers d
  set driver_code = '__HR_DRIVER_CODE_REWRITE__' || d.id::text
  from driver_code_reconciliation r
  where d.id = r.id;

  update public.delivery_drivers d
  set driver_code = r.new_code
  from driver_code_reconciliation r
  where d.id = r.id;
end $$;
