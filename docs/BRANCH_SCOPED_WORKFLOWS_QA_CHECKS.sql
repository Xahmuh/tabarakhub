-- Branch-scoped workflow integrity checks after separating users from branches.
-- Safe/read-only: this script creates a temporary result table only.

create temporary table if not exists qa_branch_scope_results (
  workflow text not null,
  check_name text not null,
  status text not null,
  details text not null
) on commit drop;

truncate table qa_branch_scope_results;

do $$
declare
  bad_count integer;
  total_count integer;
  operational_count integer;
  legacy_count integer;
begin
  select count(*) into operational_count
  from public.branches
  where role = 'branch';

  select count(*) into legacy_count
  from public.branches
  where role <> 'branch' or role is null;

  insert into qa_branch_scope_results values
    ('Branches', 'operational branch rows', 'info', operational_count::text),
    ('Branches', 'legacy non-branch rows retained', 'info', legacy_count::text);

  select count(*) into bad_count
  from public.app_user_profiles
  where role <> 'branch'
    and branch_id is not null;

  insert into qa_branch_scope_results values (
    'Users & Roles',
    'non-branch profiles have null branch_id',
    case when bad_count = 0 then 'pass' else 'fail' end,
    bad_count || ' non-branch profile(s) still carry branch_id'
  );

  select count(*) into bad_count
  from public.app_user_profiles p
  left join public.branches b on b.id = p.branch_id and b.role = 'branch'
  where p.role = 'branch'
    and b.id is null;

  insert into qa_branch_scope_results values (
    'Users & Roles',
    'branch profiles point to operational branches',
    case when bad_count = 0 then 'pass' else 'fail' end,
    bad_count || ' branch profile(s) point to missing/non-branch rows'
  );

  select count(*) into bad_count
  from pg_constraint
  where conrelid in ('public.branches'::regclass, 'public.app_user_profiles'::regclass)
    and conname in ('branches_role_must_be_branch', 'app_user_profiles_branch_scope_matches_role');

  insert into qa_branch_scope_results values (
    'Database guards',
    'branch/profile constraints installed',
    case when bad_count = 2 then 'pass' else 'fail' end,
    bad_count || '/2 expected constraints present'
  );

  select count(*) into bad_count
  from pg_trigger
  where tgname in (
    'ensure_app_user_profile_branch_scope',
    'ensure_feature_permissions_operational_branch',
    'ensure_supervisor_branches_operational_branch'
  );

  insert into qa_branch_scope_results values (
    'Database guards',
    'branch-scope triggers installed',
    case when bad_count = 3 then 'pass' else 'fail' end,
    bad_count || '/3 expected triggers present'
  );

  if to_regclass('public.delivery_orders') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.delivery_orders d
      left join public.branches b on b.id = d.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Delivery Recording',
      'delivery_orders branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' delivery order(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Delivery Recording', 'delivery_orders table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.branch_classifications') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.branch_classifications c
      left join public.branches b on b.id = c.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Delivery Coverage',
      'branch_classifications branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' classification row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Delivery Coverage', 'branch_classifications table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.operations_tasks') is not null then
    execute $sql$
      select count(*), count(*) filter (where t.branch_id is not null and b.id is null)
      from public.operations_tasks t
      left join public.branches b on b.id = t.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Delivery Coverage',
      'operations_tasks optional branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' task row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Delivery Coverage', 'operations_tasks table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.cash_differences') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.cash_differences c
      left join public.branches b on b.id = c.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Cash Tracker',
      'cash_differences branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' cash difference row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Cash Tracker', 'cash_differences table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.lost_sales') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.lost_sales l
      left join public.branches b on b.id = l.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Live Shift Coverage',
      'lost_sales branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' lost sale row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Live Shift Coverage', 'lost_sales table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.shortages') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.shortages s
      left join public.branches b on b.id = s.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Live Shift Coverage',
      'shortages branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' shortage row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Live Shift Coverage', 'shortages table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.pharmacist_branches') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.pharmacist_branches pb
      left join public.branches b on b.id = pb.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Pharmacist branch assignment',
      'pharmacist_branches branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' assignment row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Pharmacist branch assignment', 'pharmacist_branches table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.feature_permissions') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.feature_permissions fp
      left join public.branches b on b.id = fp.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Feature permissions',
      'feature_permissions branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' feature permission row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Feature permissions', 'feature_permissions table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.supervisor_branches') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.supervisor_branches sb
      left join public.branches b on b.id = sb.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Supervisor branch access',
      'supervisor_branches branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' supervisor assignment row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Supervisor branch access', 'supervisor_branches table exists', 'skip', 'table not found');
  end if;

  if to_regclass('public.branch_login_approvals') is not null then
    execute $sql$
      select count(*), count(*) filter (where b.id is null)
      from public.branch_login_approvals a
      left join public.branches b on b.id = a.branch_id and b.role = 'branch'
    $sql$ into total_count, bad_count;

    insert into qa_branch_scope_results values (
      'Branch login approval flow',
      'branch_login_approvals branch_id references operational branches',
      case when bad_count = 0 then 'pass' else 'fail' end,
      bad_count || '/' || total_count || ' approval row(s) reference missing/non-branch rows'
    );
  else
    insert into qa_branch_scope_results values ('Branch login approval flow', 'branch_login_approvals table exists', 'fail', 'table not found');
  end if;
end $$;

select workflow, check_name, status, details
from qa_branch_scope_results
order by workflow, check_name;
