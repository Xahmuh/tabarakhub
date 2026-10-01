-- Run after rbac_employee_foundation_validation.sql in a disposable database.
reset role;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000005');
insert into public.app_user_profiles(user_id, role)
values ('00000000-0000-4000-8000-000000000005', 'supervisor');
insert into public.branches(id) values
  ('30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002');
insert into public.supervisor_branches(supervisor_user_id, branch_id)
values ('00000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001');
insert into public.employee_branch_assignments(employee_id, branch_id)
values ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000005';
do $$
begin
  if not (select private.current_app_has_branch_scope('30000000-0000-4000-8000-000000000001')) then
    raise exception 'Supervisor must access assigned branch';
  end if;
  if (select private.current_app_has_branch_scope('30000000-0000-4000-8000-000000000002')) then
    raise exception 'Supervisor must not access unrelated branch';
  end if;
end;
$$;

set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
do $$
begin
  if (select private.current_app_has_branch_scope('30000000-0000-4000-8000-000000000001')) then
    raise exception 'Employee must not receive generic branch operational scope';
  end if;
  if (select private.current_app_has_branch_scope('30000000-0000-4000-8000-000000000002')) then
    raise exception 'Employee must not access unrelated branch';
  end if;
end;
$$;

set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
do $$
begin
  if (select private.current_app_has_branch_scope('30000000-0000-4000-8000-000000000001')) then
    raise exception 'Finance role must not receive operational branch scope';
  end if;
end;
$$;
