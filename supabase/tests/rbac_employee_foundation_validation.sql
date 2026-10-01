-- Run after bootstrap + migration in a disposable PostgreSQL database.
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'), -- Admin
  ('00000000-0000-4000-8000-000000000002'), -- Finance
  ('00000000-0000-4000-8000-000000000003'), -- Employee A
  ('00000000-0000-4000-8000-000000000004'); -- Employee B
insert into public.employees(id, code) values
  ('10000000-0000-4000-8000-000000000001', 'E001'),
  ('10000000-0000-4000-8000-000000000002', 'E002');
insert into public.pending_employee_accounts(employee_id, email, staged_by)
values ('10000000-0000-4000-8000-000000000001', 'employee-a@example.test', '00000000-0000-4000-8000-000000000001');
do $$
begin
  if (select count(*) from public.pending_employee_accounts where status = 'pending') <> 1 then
    raise exception 'Employee enrollment was not staged';
  end if;
  begin
    insert into public.app_user_profiles(user_id, role)
    values ('00000000-0000-4000-8000-000000000003', 'employee');
    raise exception 'Early employee login was permitted';
  exception when raise_exception then
    if sqlerrm = 'Early employee login was permitted' then raise; end if;
  end;
end;
$$;
-- Model the later reviewed activation migration only for isolation tests.
drop trigger app_user_profiles_block_early_employee_login on public.app_user_profiles;
insert into public.app_user_profiles(user_id, role) values
  ('00000000-0000-4000-8000-000000000001', 'admin'),
  ('00000000-0000-4000-8000-000000000002', 'accounts'),
  ('00000000-0000-4000-8000-000000000003', 'employee'),
  ('00000000-0000-4000-8000-000000000004', 'employee');
insert into public.app_user_employee_links(user_id, employee_id) values
  ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002');
insert into public.payroll_deduction_proposals
  (id, employee_id, pay_month, source_type, source_ref, amount_bhd, reason, proposed_by)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-09-01', 'attendance', 'attendance-2026-09', 5.000, 'Test missing punch', '00000000-0000-4000-8000-000000000001');
insert into public.hr_requests(ref_num, status, employee_id)
values ('HR-TEST-1', 'Approved', '10000000-0000-4000-8000-000000000001');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
do $$
begin
  if (select count(*) from public.employee_inbox_items) <> 1 then
    raise exception 'Employee A must see exactly one own HR inbox item';
  end if;
  if (select count(*) from public.payroll_deduction_proposals) <> 1 then
    raise exception 'Employee A must see their own deduction proposal';
  end if;
  if (select count(*) from public.payroll_authorized_deductions) <> 0 then
    raise exception 'Unapproved deduction must not appear in payroll view';
  end if;
  if (select count(*) from public.pending_employee_accounts) <> 0 then
    raise exception 'Employee must not see pending enrollment records';
  end if;
end;
$$;

set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
do $$
begin
  if (select count(*) from public.employee_inbox_items) <> 0 then
    raise exception 'Employee B must not see employee A inbox';
  end if;
  if (select count(*) from public.payroll_deduction_proposals) <> 0 then
    raise exception 'Employee B must not see employee A deduction';
  end if;
  begin
    insert into public.payroll_deduction_decisions(proposal_id, approver_role, decision)
    values ('20000000-0000-4000-8000-000000000001', 'admin', 'approved');
    raise exception 'Employee B was allowed to approve a deduction';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
do $$
begin
  if (select count(*) from public.pending_employee_accounts) <> 1 then
    raise exception 'Admin must see staged employee enrollment';
  end if;
end;
$$;
insert into public.payroll_deduction_decisions(proposal_id, approver_role, decision)
values ('20000000-0000-4000-8000-000000000001', 'admin', 'approved');
do $$
begin
  if (select count(*) from public.payroll_authorized_deductions) <> 0 then
    raise exception 'One approval must not authorize payroll deduction';
  end if;
  begin
    insert into public.payroll_deduction_decisions(proposal_id, approver_role, decision)
    values ('20000000-0000-4000-8000-000000000001', 'accounts', 'approved');
    raise exception 'Admin was allowed to sign as Finance';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
insert into public.payroll_deduction_decisions(proposal_id, approver_role, decision)
values ('20000000-0000-4000-8000-000000000001', 'accounts', 'approved');
do $$
begin
  if (select count(*) from public.payroll_authorized_deductions) <> 1 then
    raise exception 'Both distinct approvals must authorize exactly one deduction';
  end if;
end;
$$;

reset role;
insert into public.payroll_payslip_snapshots
  (employee_id, pay_month, gross_bhd, deductions_bhd, net_bhd, status, published_at, published_by)
values
  ('10000000-0000-4000-8000-000000000001', '2026-09-01', 500, 5, 495,
   'published', now(), '00000000-0000-4000-8000-000000000001');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
do $$
begin
  if (select count(*) from public.employee_inbox_items) <> 2 then
    raise exception 'Published payslip must arrive in employee A inbox';
  end if;
  if (select count(*) from public.payroll_payslip_snapshots) <> 1 then
    raise exception 'Employee A must see their published payslip';
  end if;
end;
$$;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
do $$
begin
  if (select count(*) from public.payroll_payslip_snapshots) <> 0 then
    raise exception 'Employee B must not see employee A payslip';
  end if;
end;
$$;
