-- New user-facing modules must be manager-approved before any non-manager role can open them.
-- The application also treats missing permissions as "none"; these rows make the default explicit.

insert into public.role_permissions (role, feature_name, access_level)
select role_name, feature_name, case when role_name = 'manager' then 'edit' else 'none' end
from (
  values
    ('manager'),
    ('owner'),
    ('supervisor'),
    ('warehouse'),
    ('branch')
) as roles(role_name)
cross join (
  values
    ('command_center'),
    ('workforce'),
    ('quality_feedback'),
    ('products'),
    ('block_analyzer')
) as features(feature_name)
on conflict (role, feature_name) do nothing;
