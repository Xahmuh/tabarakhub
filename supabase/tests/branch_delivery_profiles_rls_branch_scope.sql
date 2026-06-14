-- Read-only branch-scope RLS sanity check for branch_delivery_profiles.
-- Uses one existing active branch app_user_profile and does not print credentials.

select set_config(
  'request.jwt.claim.sub',
  (
    select p.user_id::text
    from public.app_user_profiles p
    join public.branches b on b.id = p.branch_id
    where p.role = 'branch'
      and p.is_active
      and upper(b.code) = 'T001'
    limit 1
  ),
  false
);

set role authenticated;

with visibility as (
  select
    count(*) as total_visible,
    count(*) filter (where upper(b.code) = 'T001') as own_t001_visible,
    count(*) filter (where upper(b.code) = 'H003') as cross_h003_visible
  from public.branch_delivery_profiles p
  join public.branches b on b.id = p.branch_id
)
select 'branch_t001_total_visible' as metric, total_visible::text as value
from visibility
union all
select 'branch_t001_own_t001_visible', own_t001_visible::text
from visibility
union all
select 'branch_t001_cross_h003_visible', cross_h003_visible::text
from visibility;
