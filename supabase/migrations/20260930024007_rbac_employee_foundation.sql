-- Additive identity, inbox and dual-approval foundation. Existing roles and
-- module policies remain active until each module is migrated and validated.

begin;
set local lock_timeout = '5s';

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter table public.app_user_profiles drop constraint if exists app_user_profiles_role_check;
alter table public.app_user_profiles add constraint app_user_profiles_role_check
  check (role in ('admin', 'manager', 'owner', 'accounts', 'supervisor', 'warehouse', 'branch', 'driver', 'employee')) not valid;
alter table public.role_permissions drop constraint if exists role_permissions_role_check;
alter table public.role_permissions add constraint role_permissions_role_check
  check (role in ('admin', 'manager', 'owner', 'accounts', 'supervisor', 'warehouse', 'branch', 'driver', 'employee')) not valid;

-- Existing role defaults and per-user overrides remain the authorization source.
-- Employee access is deliberately disabled until the personal UI is released.
insert into public.role_permissions (role, feature_name, access_level)
select 'employee', feature_name, 'none'
from (values
  ('hr_requests'), ('attendance'), ('tqph'), ('employee_inbox'),
  ('payroll'), ('delivery'), ('settings')
) as features(feature_name)
on conflict (role, feature_name) do nothing;

create table public.app_user_employee_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  linked_at timestamptz not null default now(),
  linked_by uuid references auth.users(id) on delete set null default auth.uid()
);
alter table public.app_user_employee_links enable row level security;
revoke all on public.app_user_employee_links from public, anon, authenticated;
grant select, insert, update, delete on public.app_user_employee_links to authenticated;
grant all on public.app_user_employee_links to service_role;
create policy "employee links read self or admin" on public.app_user_employee_links
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_app_can_manage()));
create policy "employee links admin write" on public.app_user_employee_links
  for all to authenticated
  using ((select public.current_app_can_manage()))
  with check ((select public.current_app_can_manage()));

create function private.validate_employee_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.app_user_profiles profile
    where profile.user_id = new.user_id
      and profile.role in ('employee', 'driver')
  ) then
    raise exception 'Employee link requires an employee or driver login';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_employee_link() from public, anon, authenticated;
create trigger app_user_employee_links_validate
  before insert or update of user_id, employee_id on public.app_user_employee_links
  for each row execute function private.validate_employee_link();

-- Stage employee enrollment without creating an Auth principal. An inactive
-- application profile alone does not protect legacy authenticated-wide RLS.
create table public.pending_employee_accounts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  staged_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  staged_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'provisioned', 'cancelled')),
  provisioned_user_id uuid unique references auth.users(id) on delete set null
);
create unique index pending_employee_accounts_email_unique
  on public.pending_employee_accounts (lower(email)) where status = 'pending';
alter table public.pending_employee_accounts enable row level security;
revoke all on public.pending_employee_accounts from public, anon, authenticated;
grant select on public.pending_employee_accounts to authenticated;
grant all on public.pending_employee_accounts to service_role;
create policy "pending employee accounts admin read" on public.pending_employee_accounts
  for select to authenticated using ((select public.current_app_can_manage()));

-- Fail closed if an older administrative RPC or UI tries to activate a personal
-- role before every legacy authenticated-wide table has been remediated.
create function private.block_early_employee_login()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role = 'employee' then
    raise exception 'Employee Auth logins are not enabled until legacy RLS is scoped';
  end if;
  return new;
end;
$$;
revoke all on function private.block_early_employee_login() from public, anon, authenticated;
create trigger app_user_profiles_block_early_employee_login
  before insert or update of role on public.app_user_profiles
  for each row execute function private.block_early_employee_login();

create function private.current_app_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select link.employee_id
  from public.app_user_employee_links link
  join public.app_user_profiles profile on profile.user_id = link.user_id
  where link.user_id = (select auth.uid()) and profile.is_active
  limit 1
$$;
revoke all on function private.current_app_employee_id() from public, anon;
grant execute on function private.current_app_employee_id() to authenticated, service_role;

-- Branch identifiers in TQPH are text; compare against canonical UUID text
-- instead of casting untrusted legacy values to UUID.
create function private.current_app_has_branch_scope(target_branch_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when profile.role in ('admin', 'manager', 'owner') then true
      when profile.role = 'branch' then profile.branch_id::text = target_branch_id
      when profile.role = 'supervisor' then exists (
        select 1 from public.supervisor_branches scope
        where scope.supervisor_user_id = profile.user_id
          and scope.branch_id::text = target_branch_id
      )
      else false
    end
    from public.app_user_profiles profile
    where profile.user_id = (select auth.uid()) and profile.is_active
  ), false)
$$;
revoke all on function private.current_app_has_branch_scope(text) from public, anon;
grant execute on function private.current_app_has_branch_scope(text) to authenticated, service_role;

create table public.payroll_deduction_proposals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  pay_month date not null check (extract(day from pay_month) = 1),
  source_type text not null check (source_type in ('attendance', 'manual')),
  source_ref text,
  amount_bhd numeric(12,3) not null check (amount_bhd > 0),
  reason text not null check (length(btrim(reason)) > 0),
  proposed_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  proposed_at timestamptz not null default now(),
  unique (employee_id, pay_month, source_type, source_ref)
);
create index payroll_deduction_proposals_employee_month_idx
  on public.payroll_deduction_proposals(employee_id, pay_month);
alter table public.payroll_deduction_proposals enable row level security;
revoke all on public.payroll_deduction_proposals from public, anon, authenticated;
grant select on public.payroll_deduction_proposals to authenticated;
grant insert (employee_id, pay_month, source_type, source_ref, amount_bhd, reason)
  on public.payroll_deduction_proposals to authenticated;
grant all on public.payroll_deduction_proposals to service_role;
create policy "deduction proposals scoped read" on public.payroll_deduction_proposals
  for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager', 'accounts')
    or employee_id = (select private.current_app_employee_id())
  );
create policy "deduction proposals finance or admin create" on public.payroll_deduction_proposals
  for insert to authenticated
  with check (
    (select public.current_app_role()) in ('admin', 'manager', 'accounts')
    and proposed_by = (select auth.uid())
  );

create table public.payroll_deduction_decisions (
  proposal_id uuid not null references public.payroll_deduction_proposals(id) on delete restrict,
  approver_role text not null check (approver_role in ('admin', 'accounts')),
  approved_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  decision text not null check (decision in ('approved', 'rejected')),
  decided_at timestamptz not null default now(),
  primary key (proposal_id, approver_role),
  unique (proposal_id, approved_by)
);
create index payroll_deduction_decisions_approver_idx
  on public.payroll_deduction_decisions(approved_by);
alter table public.payroll_deduction_decisions enable row level security;
revoke all on public.payroll_deduction_decisions from public, anon, authenticated;
grant select on public.payroll_deduction_decisions to authenticated;
grant insert (proposal_id, approver_role, decision)
  on public.payroll_deduction_decisions to authenticated;
grant all on public.payroll_deduction_decisions to service_role;
create policy "deduction decisions scoped read" on public.payroll_deduction_decisions
  for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager', 'accounts')
    or exists (
      select 1 from public.payroll_deduction_proposals proposal
      where proposal.id = proposal_id
        and proposal.employee_id = (select private.current_app_employee_id())
    )
  );
create policy "deduction decisions own role insert" on public.payroll_deduction_decisions
  for insert to authenticated
  with check (
    approved_by = (select auth.uid())
    and case
      when approver_role = 'admin' then (select public.current_app_role()) in ('admin', 'manager')
      when approver_role = 'accounts' then (select public.current_app_role()) = 'accounts'
      else false
    end
  );

-- Only the approved view can feed an attendance deduction into a payroll run.
create view public.payroll_authorized_deductions with (security_invoker = true) as
select proposal.id, proposal.employee_id, proposal.pay_month, proposal.amount_bhd,
       proposal.source_type, proposal.source_ref
from public.payroll_deduction_proposals proposal
join public.payroll_deduction_decisions admin_decision
  on admin_decision.proposal_id = proposal.id
  and admin_decision.approver_role = 'admin' and admin_decision.decision = 'approved'
join public.payroll_deduction_decisions finance_decision
  on finance_decision.proposal_id = proposal.id
  and finance_decision.approver_role = 'accounts' and finance_decision.decision = 'approved';
revoke all on public.payroll_authorized_deductions from public, anon;
grant select on public.payroll_authorized_deductions to authenticated, service_role;

create table public.payroll_payslip_snapshots (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  pay_month date not null check (extract(day from pay_month) = 1),
  gross_bhd numeric(12,3) not null check (gross_bhd >= 0),
  deductions_bhd numeric(12,3) not null check (deductions_bhd >= 0),
  net_bhd numeric(12,3) not null check (net_bhd >= 0),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, pay_month),
  check (status <> 'published' or (published_at is not null and published_by is not null))
);
alter table public.payroll_payslip_snapshots enable row level security;
revoke all on public.payroll_payslip_snapshots from public, anon, authenticated;
grant select on public.payroll_payslip_snapshots to authenticated;
grant all on public.payroll_payslip_snapshots to service_role;
create policy "payslip snapshots scoped read" on public.payroll_payslip_snapshots
  for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager', 'accounts')
    or (status = 'published' and employee_id = (select private.current_app_employee_id()))
  );

create table public.employee_inbox_items (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('hr_letter', 'payslip', 'notification')),
  source_id uuid,
  title text not null,
  message text,
  document_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (employee_id, item_type, source_id)
);
create index employee_inbox_items_recipient_idx
  on public.employee_inbox_items(recipient_user_id, created_at desc);
alter table public.employee_inbox_items enable row level security;
revoke all on public.employee_inbox_items from public, anon, authenticated;
grant select, update (read_at) on public.employee_inbox_items to authenticated;
grant all on public.employee_inbox_items to service_role;
create policy "inbox owner read" on public.employee_inbox_items
  for select to authenticated
  using (recipient_user_id = (select auth.uid())
    and employee_id = (select private.current_app_employee_id()));
create policy "inbox owner mark read" on public.employee_inbox_items
  for update to authenticated
  using (recipient_user_id = (select auth.uid())
    and employee_id = (select private.current_app_employee_id()))
  with check (recipient_user_id = (select auth.uid())
    and employee_id = (select private.current_app_employee_id()));

-- Existing HR records remain valid. The new identity fields are nullable until
-- historical requests are reconciled and the personal submission route ships.
do $$
begin
  if to_regclass('public.hr_requests') is not null then
    alter table public.hr_requests
      add column if not exists employee_id uuid references public.employees(id) on delete set null,
      add column if not exists requester_user_id uuid references auth.users(id) on delete set null,
      add column if not exists generated_document_path text;
    create index if not exists hr_requests_employee_created_idx
      on public.hr_requests(employee_id, "timestamp" desc) where employee_id is not null;
    alter table public.hr_requests alter column ref_num
      set default ('HR-' || gen_random_uuid()::text);
    execute $policy$create policy "hr requests employee own read" on public.hr_requests
      for select to authenticated
      using (employee_id is not null and employee_id = (select private.current_app_employee_id()))$policy$;

    -- The legacy insert path remains available to existing roles. Personal
    -- employee submissions use a validated RPC in the next rollout phase.
    drop policy if exists "hr requests insert authenticated" on public.hr_requests;
    execute $policy$create policy "hr requests insert existing roles" on public.hr_requests
      for insert to authenticated
      with check (
        (select auth.uid()) is not null
        and (select public.current_app_role()) is not null
        and (select public.current_app_role()) <> 'employee'
      )$policy$;
  end if;
end;
$$;

create function private.deliver_employee_documents()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  if tg_table_name = 'hr_requests' then
    if new.employee_id is null or new.status not in ('Approved', 'Completed') then return new; end if;
    select link.user_id into recipient from public.app_user_employee_links link
      where link.employee_id = new.employee_id;
    if recipient is null then return new; end if;
    insert into public.employee_inbox_items
      (employee_id, recipient_user_id, item_type, source_id, title, message, document_path)
    values (new.employee_id, recipient, 'hr_letter', new.id, 'HR letter request approved',
            'Reference: ' || new.ref_num, new.generated_document_path)
    on conflict (employee_id, item_type, source_id) do update
      set recipient_user_id = excluded.recipient_user_id,
          document_path = excluded.document_path,
          message = excluded.message;
  elsif tg_table_name = 'payroll_payslip_snapshots' then
    if new.status <> 'published' then return new; end if;
    select link.user_id into recipient from public.app_user_employee_links link
      where link.employee_id = new.employee_id;
    if recipient is null then return new; end if;
    insert into public.employee_inbox_items
      (employee_id, recipient_user_id, item_type, source_id, title, message)
    values (new.employee_id, recipient, 'payslip', new.id, 'Monthly payslip available',
            'Payroll month: ' || to_char(new.pay_month, 'YYYY-MM'))
    on conflict (employee_id, item_type, source_id) do update
      set recipient_user_id = excluded.recipient_user_id;
  end if;
  return new;
end;
$$;
revoke all on function private.deliver_employee_documents() from public, anon, authenticated;
do $$
begin
  if to_regclass('public.hr_requests') is not null then
    execute $trigger$create trigger hr_request_employee_inbox_insert
      after insert on public.hr_requests
      for each row execute function private.deliver_employee_documents()$trigger$;
    execute $trigger$create trigger hr_request_employee_inbox_update
      after update of status, generated_document_path on public.hr_requests
      for each row execute function private.deliver_employee_documents()$trigger$;
  end if;
end;
$$;
create trigger payroll_payslip_employee_inbox_insert
  after insert on public.payroll_payslip_snapshots
  for each row execute function private.deliver_employee_documents();
create trigger payroll_payslip_employee_inbox_update
  after update of status on public.payroll_payslip_snapshots
  for each row execute function private.deliver_employee_documents();

notify pgrst, 'reload schema';
commit;
