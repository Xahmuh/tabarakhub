-- Security remediation: move app access to Supabase Auth + profile-backed RLS.
-- Provision users in Supabase Auth, then link each auth.users.id to an app profile here:
--   insert into public.app_user_profiles (user_id, branch_id, role) values (...);

create table if not exists public.app_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  role text not null check (role in ('admin', 'manager', 'branch', 'accounts')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_user_profiles alter column branch_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_user_profiles_branch_role_requires_branch_id'
      and conrelid = 'public.app_user_profiles'::regclass
  ) then
    alter table public.app_user_profiles
      add constraint app_user_profiles_branch_role_requires_branch_id
      check (role <> 'branch' or branch_id is not null);
  end if;
end $$;

alter table public.app_user_profiles enable row level security;

do $$
begin
  if to_regclass('public.branches') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'branches'
        and column_name = 'password'
    )
  then
    create table if not exists public.legacy_branch_password_backups (
      branch_id uuid primary key references public.branches(id) on delete cascade,
      branch_code text,
      legacy_password text not null,
      captured_at timestamptz not null default now()
    );

    alter table public.legacy_branch_password_backups enable row level security;
    revoke all on public.legacy_branch_password_backups from anon, authenticated;
    grant all on public.legacy_branch_password_backups to service_role;

    insert into public.legacy_branch_password_backups (branch_id, branch_code, legacy_password, captured_at)
    select id, code, password, now()
    from public.branches
    where password is not null and password <> ''
    on conflict (branch_id) do update
      set branch_code = excluded.branch_code,
          legacy_password = excluded.legacy_password,
          captured_at = excluded.captured_at;
  end if;
end $$;

alter table if exists public.branches drop column if exists password;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.app_user_profiles p
  where p.user_id = auth.uid()
    and p.is_active
  limit 1
$$;

create or replace function public.current_app_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.branch_id
  from public.app_user_profiles p
  where p.user_id = auth.uid()
    and p.is_active
  limit 1
$$;

create or replace function public.current_app_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager'), false)
$$;

create or replace function public.current_app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.current_app_can_read_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager', 'accounts'), false)
$$;

create or replace function public.current_app_can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_can_read_all()
    or target_branch_id = public.current_app_branch_id(),
    false
  )
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.current_app_branch_id() from public;
revoke all on function public.current_app_can_manage() from public;
revoke all on function public.current_app_is_admin() from public;
revoke all on function public.current_app_can_read_all() from public;
revoke all on function public.current_app_can_access_branch(uuid) from public;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.current_app_branch_id() to authenticated, service_role;
grant execute on function public.current_app_can_manage() to authenticated, service_role;
grant execute on function public.current_app_is_admin() to authenticated, service_role;
grant execute on function public.current_app_can_read_all() to authenticated, service_role;
grant execute on function public.current_app_can_access_branch(uuid) to authenticated, service_role;

drop policy if exists "app profiles select" on public.app_user_profiles;
drop policy if exists "app profiles manage" on public.app_user_profiles;
create policy "app profiles select"
on public.app_user_profiles
for select
to authenticated
using (user_id = auth.uid() or public.current_app_can_manage());

create policy "app profiles manage"
on public.app_user_profiles
for all
to authenticated
using (public.current_app_is_admin())
with check (public.current_app_is_admin());

grant select on public.app_user_profiles to authenticated;
revoke insert, update, delete on public.app_user_profiles from authenticated;
grant all on public.app_user_profiles to service_role;

do $$
declare
  table_name text;
begin
  if to_regclass('public.branches') is not null then
    execute 'alter table public.branches enable row level security';
    execute 'revoke all on public.branches from anon';
    execute 'grant select, insert, update, delete on public.branches to authenticated';
    execute 'drop policy if exists "Allow all access to branches" on public.branches';
    execute 'drop policy if exists "branches select authenticated" on public.branches';
    execute 'drop policy if exists "branches manage authenticated" on public.branches';
    execute 'create policy "branches select authenticated" on public.branches for select to authenticated using (public.current_app_can_access_branch(id))';
    execute 'create policy "branches manage authenticated" on public.branches for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.pharmacists') is not null then
    execute 'alter table public.pharmacists enable row level security';
    execute 'revoke all on public.pharmacists from anon';
    execute 'grant select, insert, update, delete on public.pharmacists to authenticated';
    execute 'drop policy if exists "Allow all access to pharmacists" on public.pharmacists';
    execute 'drop policy if exists "Anon read pharmacists" on public.pharmacists';
    execute 'drop policy if exists "Anon write pharmacists" on public.pharmacists';
    execute 'drop policy if exists "Universal read pharmacists" on public.pharmacists';
    execute 'drop policy if exists "Admin write pharmacists" on public.pharmacists';
    execute 'drop policy if exists "pharmacists select authenticated" on public.pharmacists';
    execute 'drop policy if exists "pharmacists manage authenticated" on public.pharmacists';
    execute 'create policy "pharmacists select authenticated" on public.pharmacists for select to authenticated using (true)';
    execute 'create policy "pharmacists manage authenticated" on public.pharmacists for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.pharmacist_branches') is not null then
    execute 'alter table public.pharmacist_branches enable row level security';
    execute 'revoke all on public.pharmacist_branches from anon';
    execute 'grant select, insert, update, delete on public.pharmacist_branches to authenticated';
    execute 'drop policy if exists "Allow all access to pharmacist_branches" on public.pharmacist_branches';
    execute 'drop policy if exists "Anon read pharmacist_branches" on public.pharmacist_branches';
    execute 'drop policy if exists "Anon write pharmacist_branches" on public.pharmacist_branches';
    execute 'drop policy if exists "Universal read pharmacist_branches" on public.pharmacist_branches';
    execute 'drop policy if exists "Admin write pharmacist_branches" on public.pharmacist_branches';
    execute 'drop policy if exists "pharmacist branches select authenticated" on public.pharmacist_branches';
    execute 'drop policy if exists "pharmacist branches manage authenticated" on public.pharmacist_branches';
    execute 'create policy "pharmacist branches select authenticated" on public.pharmacist_branches for select to authenticated using (true)';
    execute 'create policy "pharmacist branches manage authenticated" on public.pharmacist_branches for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.feature_permissions') is not null then
    execute 'alter table public.feature_permissions enable row level security';
    execute 'revoke all on public.feature_permissions from anon';
    execute 'grant select, insert, update, delete on public.feature_permissions to authenticated';
    execute 'drop policy if exists "Allow all access to feature_permissions" on public.feature_permissions';
    execute 'drop policy if exists "feature permissions select authenticated" on public.feature_permissions';
    execute 'drop policy if exists "feature permissions manage authenticated" on public.feature_permissions';
    execute 'create policy "feature permissions select authenticated" on public.feature_permissions for select to authenticated using (public.current_app_can_access_branch(branch_id))';
    execute 'create policy "feature permissions manage authenticated" on public.feature_permissions for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.lost_sales') is not null then
    execute 'alter table public.lost_sales enable row level security';
    execute 'revoke all on public.lost_sales from anon';
    execute 'grant select, insert, update, delete on public.lost_sales to authenticated';
    execute 'drop policy if exists "Anon read lost_sales" on public.lost_sales';
    execute 'drop policy if exists "Anon write lost_sales" on public.lost_sales';
    execute 'drop policy if exists "Universal read lost_sales" on public.lost_sales';
    execute 'drop policy if exists "Admin write lost_sales" on public.lost_sales';
    execute 'drop policy if exists "lost sales select authenticated" on public.lost_sales';
    execute 'drop policy if exists "lost sales insert authenticated" on public.lost_sales';
    execute 'drop policy if exists "lost sales update authenticated" on public.lost_sales';
    execute 'drop policy if exists "lost sales delete authenticated" on public.lost_sales';
    execute 'create policy "lost sales select authenticated" on public.lost_sales for select to authenticated using (public.current_app_can_access_branch(branch_id))';
    execute 'create policy "lost sales insert authenticated" on public.lost_sales for insert to authenticated with check (public.current_app_can_manage() or branch_id = public.current_app_branch_id())';
    execute 'create policy "lost sales update authenticated" on public.lost_sales for update to authenticated using (public.current_app_can_manage() or branch_id = public.current_app_branch_id()) with check (public.current_app_can_manage() or branch_id = public.current_app_branch_id())';
    execute 'create policy "lost sales delete authenticated" on public.lost_sales for delete to authenticated using (public.current_app_can_manage() or branch_id = public.current_app_branch_id())';
  end if;

  if to_regclass('public.shortages') is not null then
    execute 'alter table public.shortages enable row level security';
    execute 'revoke all on public.shortages from anon';
    execute 'grant select, insert, update, delete on public.shortages to authenticated';
    execute 'drop policy if exists "shortages select authenticated" on public.shortages';
    execute 'drop policy if exists "shortages insert authenticated" on public.shortages';
    execute 'drop policy if exists "shortages update authenticated" on public.shortages';
    execute 'drop policy if exists "shortages delete authenticated" on public.shortages';
    execute 'create policy "shortages select authenticated" on public.shortages for select to authenticated using (public.current_app_can_access_branch(branch_id))';
    execute 'create policy "shortages insert authenticated" on public.shortages for insert to authenticated with check (public.current_app_can_manage() or branch_id = public.current_app_branch_id())';
    execute 'create policy "shortages update authenticated" on public.shortages for update to authenticated using (public.current_app_can_manage() or branch_id = public.current_app_branch_id()) with check (public.current_app_can_manage() or branch_id = public.current_app_branch_id())';
    execute 'create policy "shortages delete authenticated" on public.shortages for delete to authenticated using (public.current_app_can_manage() or branch_id = public.current_app_branch_id())';
  end if;

  if to_regclass('public.products') is not null then
    execute 'alter table public.products enable row level security';
    execute 'revoke all on public.products from anon';
    execute 'grant select, insert, update, delete on public.products to authenticated';
    execute 'drop policy if exists "products select authenticated" on public.products';
    execute 'drop policy if exists "products manage authenticated" on public.products';
    execute 'create policy "products select authenticated" on public.products for select to authenticated using (true)';
    execute 'create policy "products manage authenticated" on public.products for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.manual_products') is not null then
    execute 'alter table public.manual_products enable row level security';
    execute 'revoke all on public.manual_products from anon';
    execute 'grant select, insert, update, delete on public.manual_products to authenticated';
    execute 'drop policy if exists "manual products select authenticated" on public.manual_products';
    execute 'drop policy if exists "manual products insert authenticated" on public.manual_products';
    execute 'drop policy if exists "manual products manage authenticated" on public.manual_products';
    execute 'create policy "manual products select authenticated" on public.manual_products for select to authenticated using (public.current_app_can_read_all() or branch_id = public.current_app_branch_id())';
    execute 'create policy "manual products insert authenticated" on public.manual_products for insert to authenticated with check (public.current_app_can_manage() or branch_id = public.current_app_branch_id())';
    execute 'create policy "manual products manage authenticated" on public.manual_products for update to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.hr_requests') is not null then
    execute 'alter table public.hr_requests enable row level security';
    execute 'revoke all on public.hr_requests from anon';
    execute 'grant select, insert, update, delete on public.hr_requests to authenticated';
    execute 'drop policy if exists "Allow all access to hr_requests" on public.hr_requests';
    execute 'drop policy if exists "hr requests insert authenticated" on public.hr_requests';
    execute 'drop policy if exists "hr requests manage authenticated" on public.hr_requests';
    execute 'create policy "hr requests insert authenticated" on public.hr_requests for insert to authenticated with check (auth.uid() is not null)';
    execute 'create policy "hr requests manage authenticated" on public.hr_requests for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.cash_differences') is not null then
    execute 'alter table public.cash_differences enable row level security';
    execute 'revoke all on public.cash_differences from anon';
    execute 'grant select, insert, update, delete on public.cash_differences to authenticated';
    execute 'drop policy if exists branch_view_own_differences on public.cash_differences';
    execute 'drop policy if exists branch_insert_own_differences on public.cash_differences';
    execute 'drop policy if exists manager_view_all_differences on public.cash_differences';
    execute 'drop policy if exists "cash differences select authenticated" on public.cash_differences';
    execute 'drop policy if exists "cash differences insert authenticated" on public.cash_differences';
    execute 'drop policy if exists "cash differences update authenticated" on public.cash_differences';
    execute 'drop policy if exists "cash differences delete authenticated" on public.cash_differences';
    execute 'create policy "cash differences select authenticated" on public.cash_differences for select to authenticated using (public.current_app_can_access_branch(branch_id))';
    execute 'create policy "cash differences insert authenticated" on public.cash_differences for insert to authenticated with check (public.current_app_can_manage() or branch_id = public.current_app_branch_id())';
    execute 'create policy "cash differences update authenticated" on public.cash_differences for update to authenticated using (public.current_app_can_read_all()) with check (public.current_app_can_read_all())';
    execute 'create policy "cash differences delete authenticated" on public.cash_differences for delete to authenticated using (public.current_app_can_manage())';
  end if;

  foreach table_name in array array['suppliers','cheques','expenses','revenues_actual','revenues_expected','cash_flow_settings']
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on public.%I from anon', table_name);
      execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
      execute format('drop policy if exists "Authenticated users can select %s" on public.%I', table_name, table_name);
      execute format('drop policy if exists "Authenticated users can insert %s" on public.%I', table_name, table_name);
      execute format('drop policy if exists "Authenticated users can update %s" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s select authenticated" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s manage authenticated" on public.%I', table_name, table_name);
      execute format('create policy "%s select authenticated" on public.%I for select to authenticated using (public.current_app_can_read_all())', table_name, table_name);
      execute format('create policy "%s manage authenticated" on public.%I for all to authenticated using (public.current_app_can_read_all()) with check (public.current_app_can_read_all())', table_name, table_name);
    end if;
  end loop;

  if to_regclass('public.corporate_codex') is not null then
    execute 'alter table public.corporate_codex enable row level security';
    execute 'revoke all on public.corporate_codex from anon';
    execute 'grant select, insert, update, delete on public.corporate_codex to authenticated';
    execute 'drop policy if exists "Allow all access to corporate_codex" on public.corporate_codex';
    execute 'drop policy if exists "corporate codex select authenticated" on public.corporate_codex';
    execute 'drop policy if exists "corporate codex manage authenticated" on public.corporate_codex';
    execute 'create policy "corporate codex select authenticated" on public.corporate_codex for select to authenticated using (true)';
    execute 'create policy "corporate codex manage authenticated" on public.corporate_codex for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.corporate_codex_acknowledgments') is not null then
    execute 'alter table public.corporate_codex_acknowledgments enable row level security';
    execute 'revoke all on public.corporate_codex_acknowledgments from anon';
    execute 'grant select, insert, update, delete on public.corporate_codex_acknowledgments to authenticated';
    execute 'drop policy if exists "Allow all access to corporate_codex_acknowledgments" on public.corporate_codex_acknowledgments';
    execute 'drop policy if exists "corporate codex acknowledgments select authenticated" on public.corporate_codex_acknowledgments';
    execute 'drop policy if exists "corporate codex acknowledgments insert authenticated" on public.corporate_codex_acknowledgments';
    execute 'drop policy if exists "corporate codex acknowledgments manage authenticated" on public.corporate_codex_acknowledgments';
    execute 'create policy "corporate codex acknowledgments select authenticated" on public.corporate_codex_acknowledgments for select to authenticated using (public.current_app_can_manage() or user_id = public.current_app_branch_id()::text)';
    execute 'create policy "corporate codex acknowledgments insert authenticated" on public.corporate_codex_acknowledgments for insert to authenticated with check (user_id = public.current_app_branch_id()::text or public.current_app_can_manage())';
    execute 'create policy "corporate codex acknowledgments manage authenticated" on public.corporate_codex_acknowledgments for update to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.employee_contributions') is not null then
    execute 'alter table public.employee_contributions enable row level security';
    execute 'revoke all on public.employee_contributions from anon';
    execute 'grant select, insert, update, delete on public.employee_contributions to authenticated';
    execute 'drop policy if exists "employee contributions select authenticated" on public.employee_contributions';
    execute 'drop policy if exists "employee contributions manage authenticated" on public.employee_contributions';
    execute 'create policy "employee contributions select authenticated" on public.employee_contributions for select to authenticated using (true)';
    execute 'create policy "employee contributions manage authenticated" on public.employee_contributions for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.feedback_responses') is not null then
    execute 'alter table public.feedback_responses enable row level security';
    execute 'revoke all on public.feedback_responses from anon';
    execute 'grant select, insert, update, delete on public.feedback_responses to authenticated';
    execute 'drop policy if exists "Public insert responses" on public.feedback_responses';
    execute 'drop policy if exists "feedback responses insert authenticated" on public.feedback_responses';
    execute 'drop policy if exists "feedback responses manage authenticated" on public.feedback_responses';
    execute 'create policy "feedback responses insert authenticated" on public.feedback_responses for insert to authenticated with check (auth.uid() is not null)';
    execute 'create policy "feedback responses manage authenticated" on public.feedback_responses for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.quality_feedback_questions') is not null then
    execute 'alter table public.quality_feedback_questions enable row level security';
    execute 'revoke all on public.quality_feedback_questions from anon';
    execute 'grant select, insert, update, delete on public.quality_feedback_questions to authenticated';
    execute 'drop policy if exists "Public read questions" on public.quality_feedback_questions';
    execute 'drop policy if exists "quality feedback questions select authenticated" on public.quality_feedback_questions';
    execute 'drop policy if exists "quality feedback questions manage authenticated" on public.quality_feedback_questions';
    execute 'create policy "quality feedback questions select authenticated" on public.quality_feedback_questions for select to authenticated using (is_active = true or public.current_app_can_manage())';
    execute 'create policy "quality feedback questions manage authenticated" on public.quality_feedback_questions for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  if to_regclass('public.quality_feedback_settings') is not null then
    execute 'alter table public.quality_feedback_settings enable row level security';
    execute 'revoke all on public.quality_feedback_settings from anon';
    execute 'grant select, update on public.quality_feedback_settings to authenticated';
    execute 'drop policy if exists "Public read settings" on public.quality_feedback_settings';
    execute 'drop policy if exists "Admin update settings" on public.quality_feedback_settings';
    execute 'drop policy if exists "quality feedback settings select authenticated" on public.quality_feedback_settings';
    execute 'drop policy if exists "quality feedback settings manage authenticated" on public.quality_feedback_settings';
    execute 'create policy "quality feedback settings select authenticated" on public.quality_feedback_settings for select to authenticated using (true)';
    execute 'create policy "quality feedback settings manage authenticated" on public.quality_feedback_settings for update to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())';
  end if;

  foreach table_name in array array['branch_sales_data','branch_hr_turnover']
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on public.%I from anon', table_name);
      execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
      execute format('drop policy if exists "%s select authenticated" on public.%I', table_name, table_name);
      execute format('drop policy if exists "%s manage authenticated" on public.%I', table_name, table_name);
      execute format('create policy "%s select authenticated" on public.%I for select to authenticated using (public.current_app_can_manage())', table_name, table_name);
      execute format('create policy "%s manage authenticated" on public.%I for all to authenticated using (public.current_app_can_manage()) with check (public.current_app_can_manage())', table_name, table_name);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.lost_sales_excel_export') is not null then
    revoke all on public.lost_sales_excel_export from anon;
    grant select on public.lost_sales_excel_export to authenticated;
  end if;
  if to_regclass('public.shortages_excel_export') is not null then
    revoke all on public.shortages_excel_export from anon;
    grant select on public.shortages_excel_export to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
