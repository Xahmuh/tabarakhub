-- Align deduction approval and payslip reads with the single-company payroll roles.
-- Historical admin approvals remain in the audit trail, but do not authorize pay.
begin;
set local lock_timeout = '5s';

-- RLS cannot limit an UPDATE to keys inside a JSONB column. Enforce salary
-- edits in the database while allowing compliance fields in salary_matrix to
-- continue through the existing workforce workflow.
create table private.employee_salary_change_audit (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  previous_values jsonb not null,
  new_values jsonb not null
);
alter table private.employee_salary_change_audit enable row level security;
revoke all on private.employee_salary_change_audit from public, anon, authenticated;
grant select on private.employee_salary_change_audit to service_role;

create function private.audit_owner_salary_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous_matrix jsonb := '{}'::jsonb;
  next_matrix jsonb := coalesce(new.salary_matrix, '{}'::jsonb);
  previous_values jsonb := '{}'::jsonb;
  next_values jsonb := '{}'::jsonb;
  salary_key text;
begin
  if tg_op = 'UPDATE' then
    previous_matrix := coalesce(old.salary_matrix, '{}'::jsonb);
  end if;
  foreach salary_key in array array[
    'iban', 'totalSalary', 'basicSalary', 'housing', 'transportation',
    'totalFixed', 'jobResponsibilityBonus', 'longShiftIncentive',
    'totalVariable', 'gosi1Pct', 'ewaFees', 'othersDeduction',
    'payrollDedLoan', 'totalDeductions', 'netSalary'
  ] loop
    if previous_matrix -> salary_key is distinct from next_matrix -> salary_key then
      previous_values := previous_values || jsonb_build_object(salary_key, previous_matrix -> salary_key);
      next_values := next_values || jsonb_build_object(salary_key, next_matrix -> salary_key);
    end if;
  end loop;
  if next_values = '{}'::jsonb then return new; end if;
  if (select auth.role()) is distinct from 'service_role'
     and (select public.current_app_role()) is distinct from 'owner' then
    raise exception 'Only owner may change employee salary fields' using errcode = '42501';
  end if;
  insert into private.employee_salary_change_audit
    (employee_id, changed_by, previous_values, new_values)
  values (new.id, (select auth.uid()), previous_values, next_values);
  return new;
end;
$$;
revoke all on function private.audit_owner_salary_changes() from public, anon, authenticated;
create trigger employees_owner_salary_audit
  after insert or update on public.employees
  for each row execute function private.audit_owner_salary_changes();

alter table public.payroll_deduction_decisions
  drop constraint if exists payroll_deduction_decisions_approver_role_check;
alter table public.payroll_deduction_decisions
  add constraint payroll_deduction_decisions_approver_role_check
  check (approver_role in ('admin', 'owner', 'accounts'));

drop policy if exists "deduction proposals scoped read" on public.payroll_deduction_proposals;
create policy "deduction proposals scoped read" on public.payroll_deduction_proposals
  for select to authenticated
  using (
    (select public.current_app_role()) in ('owner', 'accounts')
    or employee_id = (select private.current_app_employee_id())
  );
drop policy if exists "deduction proposals finance or admin create" on public.payroll_deduction_proposals;
create policy "deduction proposals owner create" on public.payroll_deduction_proposals
  for insert to authenticated
  with check (
    (select public.current_app_role()) = 'owner'
    and proposed_by = (select auth.uid())
  );

drop policy if exists "deduction decisions scoped read" on public.payroll_deduction_decisions;
create policy "deduction decisions scoped read" on public.payroll_deduction_decisions
  for select to authenticated
  using (
    (select public.current_app_role()) in ('owner', 'accounts')
    or exists (
      select 1 from public.payroll_deduction_proposals proposal
      where proposal.id = proposal_id
        and proposal.employee_id = (select private.current_app_employee_id())
    )
  );
drop policy if exists "deduction decisions own role insert" on public.payroll_deduction_decisions;
create policy "deduction decisions own role insert" on public.payroll_deduction_decisions
  for insert to authenticated
  with check (
    approved_by = (select auth.uid())
    and (
      (approver_role = 'owner' and (select public.current_app_role()) = 'owner')
      or (approver_role = 'accounts' and (select public.current_app_role()) = 'accounts')
    )
  );

create or replace view public.payroll_authorized_deductions with (security_invoker = true) as
select proposal.id, proposal.employee_id, proposal.pay_month, proposal.amount_bhd,
       proposal.source_type, proposal.source_ref
from public.payroll_deduction_proposals proposal
where exists (
  select 1 from public.payroll_deduction_decisions owner_decision
  where owner_decision.proposal_id = proposal.id
    and owner_decision.approver_role = 'owner'
    and owner_decision.decision = 'approved'
)
and exists (
  select 1 from public.payroll_deduction_decisions accounts_decision
  where accounts_decision.proposal_id = proposal.id
    and accounts_decision.approver_role = 'accounts'
    and accounts_decision.decision = 'approved'
);

drop policy if exists "payslip snapshots scoped read" on public.payroll_payslip_snapshots;
create policy "payslip snapshots scoped read" on public.payroll_payslip_snapshots
  for select to authenticated
  using (
    (select public.current_app_role()) in ('owner', 'accounts')
    or (status = 'published' and employee_id = (select private.current_app_employee_id()))
  );

-- Variable earnings are entered as exact amounts, never calculated from a
-- hard-coded hourly multiplier. Overtime hours are evidence for review only.
create table public.payroll_earning_proposals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  pay_month date not null check (extract(day from pay_month) = 1),
  source_type text not null check (source_type in ('overtime', 'night_shift', 'relief_shift', 'license', 'bonus', 'other')),
  source_ref text,
  hours numeric(10,2) check (hours is null or hours > 0),
  amount_bhd numeric(12,3) not null check (amount_bhd > 0),
  reason text not null check (length(btrim(reason)) > 0),
  proposed_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  proposed_at timestamptz not null default now()
);
create index payroll_earning_proposals_employee_month_idx
  on public.payroll_earning_proposals(employee_id, pay_month);
create unique index payroll_earning_proposals_source_idx
  on public.payroll_earning_proposals(employee_id, pay_month, source_type, source_ref)
  where source_ref is not null;
alter table public.payroll_earning_proposals enable row level security;
revoke all on public.payroll_earning_proposals from public, anon, authenticated;
grant select on public.payroll_earning_proposals to authenticated;
grant insert (employee_id, pay_month, source_type, source_ref, hours, amount_bhd, reason)
  on public.payroll_earning_proposals to authenticated;
grant all on public.payroll_earning_proposals to service_role;
create policy "earning proposals finance read" on public.payroll_earning_proposals
  for select to authenticated
  using ((select public.current_app_role()) in ('owner', 'accounts'));
create policy "earning proposals owner create" on public.payroll_earning_proposals
  for insert to authenticated
  with check (
    (select public.current_app_role()) = 'owner'
    and proposed_by = (select auth.uid())
  );

create table public.payroll_earning_decisions (
  proposal_id uuid not null references public.payroll_earning_proposals(id) on delete restrict,
  approver_role text not null check (approver_role in ('owner', 'accounts')),
  approved_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  decision text not null check (decision in ('approved', 'rejected')),
  decided_at timestamptz not null default now(),
  primary key (proposal_id, approver_role),
  unique (proposal_id, approved_by)
);
alter table public.payroll_earning_decisions enable row level security;
revoke all on public.payroll_earning_decisions from public, anon, authenticated;
grant select on public.payroll_earning_decisions to authenticated;
grant insert (proposal_id, approver_role, decision)
  on public.payroll_earning_decisions to authenticated;
grant all on public.payroll_earning_decisions to service_role;
create policy "earning decisions finance read" on public.payroll_earning_decisions
  for select to authenticated
  using ((select public.current_app_role()) in ('owner', 'accounts'));
create policy "earning decisions own role create" on public.payroll_earning_decisions
  for insert to authenticated
  with check (
    approved_by = (select auth.uid())
    and (
      (approver_role = 'owner' and (select public.current_app_role()) = 'owner')
      or (approver_role = 'accounts' and (select public.current_app_role()) = 'accounts')
    )
  );

create view public.payroll_authorized_earnings with (security_invoker = true) as
select proposal.id, proposal.employee_id, proposal.pay_month,
       proposal.source_type, proposal.source_ref, proposal.hours,
       proposal.amount_bhd
from public.payroll_earning_proposals proposal
where exists (
  select 1 from public.payroll_earning_decisions owner_decision
  where owner_decision.proposal_id = proposal.id
    and owner_decision.approver_role = 'owner'
    and owner_decision.decision = 'approved'
)
and exists (
  select 1 from public.payroll_earning_decisions accounts_decision
  where accounts_decision.proposal_id = proposal.id
    and accounts_decision.approver_role = 'accounts'
    and accounts_decision.decision = 'approved'
);
revoke all on public.payroll_authorized_earnings from public, anon;
grant select on public.payroll_authorized_earnings to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
