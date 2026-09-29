-- Security hardening that preserves the current authenticated application flows.
--
-- This migration is intentionally idempotent because two historical local
-- migrations are not registered in the remote migration history. It closes
-- anonymous table access, keeps the existing authenticated ERP behavior, and
-- moves the public spin flow behind narrowly-scoped RPCs.

begin;

-- ---------------------------------------------------------------------------
-- 1. Workforce data: enable RLS and remove anonymous access.
-- ---------------------------------------------------------------------------

alter table if exists public.employees enable row level security;
alter table if exists public.pharmacists enable row level security;
alter table if exists public.employee_branch_assignments enable row level security;

revoke all on table public.employees from anon;
revoke all on table public.pharmacists from anon;
revoke all on table public.employee_branch_assignments from anon;

drop policy if exists "Public Access" on public.pharmacists;

drop policy if exists "employees select authenticated" on public.employees;
create policy "employees select authenticated"
  on public.employees
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "employees manage authenticated" on public.employees;
drop policy if exists "employees manage authorized roles" on public.employees;
create policy "employees manage authorized roles"
  on public.employees
  for all
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

drop policy if exists "pharmacists select authenticated" on public.pharmacists;
create policy "pharmacists select authenticated"
  on public.pharmacists
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "pharmacists manage authenticated" on public.pharmacists;
drop policy if exists "pharmacists manage authorized roles" on public.pharmacists;
create policy "pharmacists manage authorized roles"
  on public.pharmacists
  for all
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

drop policy if exists "employee_branch_assignments select authenticated" on public.employee_branch_assignments;
create policy "employee_branch_assignments select authenticated"
  on public.employee_branch_assignments
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "employee_branch_assignments manage authenticated" on public.employee_branch_assignments;
drop policy if exists "employee_branch_assignments manage authorized roles" on public.employee_branch_assignments;
create policy "employee_branch_assignments manage authorized roles"
  on public.employee_branch_assignments
  for all
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

-- ---------------------------------------------------------------------------
-- 2. Public spin flow: token-bound customer preparation RPC.
-- ---------------------------------------------------------------------------

create or replace function public.prepare_spin_customer(
  p_token text,
  p_phone text,
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null
)
returns table (
  customer_id uuid,
  customer_phone text,
  customer_first_name text,
  customer_last_name text,
  customer_email text,
  customer_created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\\s+', '', 'g');
  v_customer public.customers%rowtype;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then
    raise exception 'SPIN_SESSION_UNAVAILABLE' using errcode = '22023';
  end if;

  if length(v_phone) < 6
    or length(v_phone) > 32
    or v_phone !~ '^\\+?[0-9]+$'
  then
    raise exception 'CUSTOMER_PHONE_INVALID' using errcode = '22023';
  end if;

  if length(coalesce(p_first_name, '')) > 120
    or length(coalesce(p_last_name, '')) > 120
    or length(coalesce(p_email, '')) > 320
  then
    raise exception 'CUSTOMER_DETAILS_INVALID' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_email, '')), '') is not null
    and btrim(p_email) !~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
  then
    raise exception 'CUSTOMER_EMAIL_INVALID' using errcode = '22023';
  end if;

  perform 1
  from public.spin_sessions s
  join public.branches b on b.id = s.branch_id
  where s.token = p_token
    and s.expires_at > v_now
    and (coalesce(s.is_multi_use, false) or not coalesce(s.used, false))
    and coalesce(b.is_spin_enabled, true)
    and coalesce((to_jsonb(b)->>'is_active')::boolean, true)
  limit 1;

  if not found then
    raise exception 'SPIN_SESSION_UNAVAILABLE' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('spin-customer:' || v_phone));

  select c.*
    into v_customer
  from public.customers c
  where c.phone = v_phone
  order by c.created_at asc
  limit 1
  for update;

  if v_customer.id is null then
    insert into public.customers (phone, first_name, last_name, email, created_at)
    values (
      v_phone,
      nullif(btrim(coalesce(p_first_name, '')), ''),
      nullif(btrim(coalesce(p_last_name, '')), ''),
      nullif(lower(btrim(coalesce(p_email, ''))), ''),
      v_now
    )
    returning * into v_customer;
  else
    update public.customers c
    set
      first_name = coalesce(nullif(btrim(coalesce(p_first_name, '')), ''), c.first_name),
      last_name = coalesce(nullif(btrim(coalesce(p_last_name, '')), ''), c.last_name),
      email = coalesce(nullif(lower(btrim(coalesce(p_email, ''))), ''), c.email)
    where c.id = v_customer.id
    returning c.* into v_customer;
  end if;

  return query
  select
    v_customer.id,
    v_customer.phone,
    v_customer.first_name,
    v_customer.last_name,
    v_customer.email,
    v_customer.created_at;
end;
$$;

revoke all on function public.prepare_spin_customer(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_spin_customer(text, text, text, text, text)
  to anon, authenticated, service_role;

revoke all on table public.customers from anon;
revoke all on table public.spins from anon;
revoke all on table public.spin_sessions from anon;

drop policy if exists "Anon Read Only" on public.customers;
drop policy if exists "Customer Contact View" on public.customers;
drop policy if exists "Public Customers All" on public.customers;
drop policy if exists "System Only" on public.customers;

drop policy if exists "Anon Read Only" on public.spins;
drop policy if exists "Dashboard View" on public.spins;
drop policy if exists "Public Spins All" on public.spins;
drop policy if exists "System Only" on public.spins;

drop policy if exists "Public Sessions All" on public.spin_sessions;

revoke all on table public.spin_settings from anon;
drop policy if exists "spin_settings_select_all" on public.spin_settings;
drop policy if exists "spin_settings_modify_auth" on public.spin_settings;
drop policy if exists "spin_settings_select_authenticated" on public.spin_settings;
drop policy if exists "spin_settings_manage_authorized_roles" on public.spin_settings;
create policy "spin_settings_select_authenticated"
  on public.spin_settings
  for select
  to authenticated
  using ((select auth.uid()) is not null);
create policy "spin_settings_manage_authorized_roles"
  on public.spin_settings
  for all
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner'));

drop policy if exists "customers select authenticated" on public.customers;
create policy "customers select authenticated"
  on public.customers
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "customers manage authorized roles" on public.customers;
create policy "customers manage authorized roles"
  on public.customers
  for all
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

drop policy if exists "spins select authenticated" on public.spins;
create policy "spins select authenticated"
  on public.spins
  for select
  to authenticated
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- 3. Remove anonymous access from internal ERP modules while preserving the
--    current authenticated behavior. Further tenant scoping can now be added
--    module-by-module without exposing data publicly.
-- ---------------------------------------------------------------------------

drop policy if exists "Admin read responses" on public.feedback_responses;

revoke all on table public.annual_leave_requests from anon;
drop policy if exists "annual_leave_requests select authenticated" on public.annual_leave_requests;
create policy "annual_leave_requests select authenticated"
  on public.annual_leave_requests
  for select
  to authenticated
  using ((select auth.uid()) is not null);

revoke all on table public.business_day_sessions from anon;
drop policy if exists "Allow all access to business_day_sessions" on public.business_day_sessions;
drop policy if exists "Allow delete session for authorized roles" on public.business_day_sessions;
drop policy if exists "Allow update session" on public.business_day_sessions;
drop policy if exists "business_day_sessions authenticated access" on public.business_day_sessions;
create policy "business_day_sessions authenticated access"
  on public.business_day_sessions
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

revoke all on table public.delivery_audit_logs from anon;
drop policy if exists "Allow all access to delivery_audit_logs" on public.delivery_audit_logs;
drop policy if exists "delivery_audit_logs authenticated access" on public.delivery_audit_logs;
create policy "delivery_audit_logs authenticated access"
  on public.delivery_audit_logs
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

revoke all on table public.drivers from anon;
drop policy if exists "Allow all access to drivers" on public.drivers;
drop policy if exists "drivers authenticated access" on public.drivers;
create policy "drivers authenticated access"
  on public.drivers
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- 4. TQPH: authenticated role-based records and private evidence storage.
-- ---------------------------------------------------------------------------

revoke all on table public.tqph_audits from anon;
revoke all on table public.tqph_appraisals from anon;
revoke all on table public.tqph_capa_tasks from anon;
revoke all on table public.tqph_distribution_logs from anon;
revoke all on table public.tqph_attachments from anon;

drop policy if exists "Allow anon read/write on tqph_audits" on public.tqph_audits;
drop policy if exists "Allow anon read/write on tqph_appraisals" on public.tqph_appraisals;
drop policy if exists "Allow anon read/write on tqph_capa_tasks" on public.tqph_capa_tasks;
drop policy if exists "Allow anon read/write on tqph_distribution_logs" on public.tqph_distribution_logs;
drop policy if exists "Allow anon read/write on tqph_attachments" on public.tqph_attachments;

drop policy if exists "Allow authenticated read on tqph_audits" on public.tqph_audits;
drop policy if exists "Allow authenticated insert/update on tqph_audits" on public.tqph_audits;
drop policy if exists "tqph_audits authorized roles" on public.tqph_audits;
create policy "tqph_audits authorized roles"
  on public.tqph_audits for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

drop policy if exists "Allow authenticated read on tqph_appraisals" on public.tqph_appraisals;
drop policy if exists "Allow authenticated insert/update on tqph_appraisals" on public.tqph_appraisals;
drop policy if exists "tqph_appraisals authorized roles" on public.tqph_appraisals;
create policy "tqph_appraisals authorized roles"
  on public.tqph_appraisals for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

drop policy if exists "Allow authenticated read on tqph_capa_tasks" on public.tqph_capa_tasks;
drop policy if exists "Allow authenticated update on tqph_capa_tasks" on public.tqph_capa_tasks;
drop policy if exists "tqph_capa_tasks authorized roles" on public.tqph_capa_tasks;
create policy "tqph_capa_tasks authorized roles"
  on public.tqph_capa_tasks for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

drop policy if exists "Allow authenticated read on tqph_distribution_logs" on public.tqph_distribution_logs;
drop policy if exists "Allow authenticated insert on tqph_distribution_logs" on public.tqph_distribution_logs;
drop policy if exists "tqph_distribution_logs authorized roles" on public.tqph_distribution_logs;
create policy "tqph_distribution_logs authorized roles"
  on public.tqph_distribution_logs for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

drop policy if exists "Allow authenticated read/write on tqph_attachments" on public.tqph_attachments;
drop policy if exists "tqph_attachments authorized roles" on public.tqph_attachments;
create policy "tqph_attachments authorized roles"
  on public.tqph_attachments for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor'));

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]::text[]
where id = 'tqph-evidence';

drop policy if exists "Public Read on tqph-evidence" on storage.objects;
drop policy if exists "Upload on tqph-evidence" on storage.objects;
drop policy if exists "Update on tqph-evidence" on storage.objects;
drop policy if exists "TQPH evidence authorized read" on storage.objects;
drop policy if exists "TQPH evidence authorized insert" on storage.objects;
drop policy if exists "TQPH evidence authorized update" on storage.objects;
drop policy if exists "TQPH evidence authorized delete" on storage.objects;

create policy "TQPH evidence authorized read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tqph-evidence'
    and (select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor')
  );

create policy "TQPH evidence authorized insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tqph-evidence'
    and (select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor')
  );

create policy "TQPH evidence authorized update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'tqph-evidence'
    and (select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor')
  )
  with check (
    bucket_id = 'tqph-evidence'
    and (select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor')
  );

create policy "TQPH evidence authorized delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tqph-evidence'
    and (select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor')
  );

-- ---------------------------------------------------------------------------
-- 5. Privileged function hygiene.
-- ---------------------------------------------------------------------------

create or replace function public.app_expense_next_reference_no(
  p_branch_id uuid,
  p_expense_date date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch_code text;
  v_seq integer;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_branch_id is null or p_expense_date is null then
    raise exception 'BRANCH_AND_DATE_REQUIRED' using errcode = '22023';
  end if;

  if not (
    (select public.current_app_can_manage())
    or (select public.current_app_role()) = 'owner'
    or (select public.current_app_can_access_branch(p_branch_id))
  ) then
    raise exception 'BRANCH_ACCESS_DENIED' using errcode = '42501';
  end if;

  select b.code
    into v_branch_code
  from public.branches b
  where b.id = p_branch_id
  limit 1;

  if v_branch_code is null then
    raise exception 'BRANCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.expense_reference_sequences (branch_id, expense_date, next_seq)
  values (p_branch_id, p_expense_date, 2)
  on conflict (branch_id, expense_date)
  do update set next_seq = public.expense_reference_sequences.next_seq + 1
  returning next_seq - 1 into v_seq;

  return upper(v_branch_code)
    || '-X-'
    || to_char(p_expense_date, 'DDMMYY')
    || '-'
    || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function public.app_expense_next_reference_no(uuid, date)
  from public, anon, authenticated;
grant execute on function public.app_expense_next_reference_no(uuid, date)
  to authenticated, service_role;

alter function public.get_monthly_trend() set search_path = 'public';
alter function public.update_updated_at_column() set search_path = '';
alter function public.set_submission_month() set search_path = '';
alter function public.app_driver_android_build_to_integer(numeric) set search_path = '';

revoke all on function public.assign_delivery_driver_code() from public, anon, authenticated;
revoke all on function public.delivery_order_events_block_talabat_assignment() from public, anon, authenticated;
revoke all on function public.touch_branch_delivery_profile() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.set_submission_month() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
