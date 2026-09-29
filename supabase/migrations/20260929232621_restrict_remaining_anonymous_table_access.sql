begin;

-- Internal ERP tables: authenticated access and RLS policies remain unchanged;
-- only the anonymous table grants are removed.
revoke all on table public.annual_leave_accrual_events from anon;
revoke all on table public.annual_leave_ledger_entries from anon;
revoke all on table public.branch_shift_types from anon;
revoke all on table public.branch_zone_members from anon;
revoke all on table public.branch_zones from anon;
revoke all on table public.contract_types from anon;
revoke all on table public.duty_schedule_assignments from anon;
revoke all on table public.duty_schedule_changes from anon;
revoke all on table public.duty_schedule_conflicts from anon;
revoke all on table public.duty_scheduler_leave_records from anon;
revoke all on table public.duty_scheduler_settings from anon;
revoke all on table public.duty_schedules from anon;
revoke all on table public.expense_categories from anon;
revoke all on table public.expense_reference_sequences from anon;
revoke all on table public.expense_transactions from anon;
revoke all on table public.fuel_expense_details from anon;
revoke all on table public.insurance_companies from anon;
revoke all on table public.module_settings from anon;
revoke all on table public.pharmacist_allowed_branches from anon;
revoke all on table public.pharmacist_allowed_shift_types from anon;
revoke all on table public.pharmacist_rolling_state from anon;
revoke all on table public.pharmacist_scheduling_profiles from anon;
revoke all on table public.regions from anon;
revoke all on table public.registered_crs from anon;
revoke all on table public.shortages from anon;
revoke all on table public.vehicle_odometer_history from anon;
revoke all on table public.vehicles from anon;
revoke all on table public.visits from anon;

-- Public reward prizes are readable only when active. Management remains
-- available to signed-in authorized roles.
revoke all on table public.spin_prizes from anon;
grant select on table public.spin_prizes to anon;

drop policy if exists "Allow anyone to see prizes" on public.spin_prizes;
drop policy if exists "Public Prizes All" on public.spin_prizes;
drop policy if exists "Public Read Prizes" on public.spin_prizes;
drop policy if exists "spin prizes select authenticated" on public.spin_prizes;
drop policy if exists "spin prizes manage authorized roles" on public.spin_prizes;

create policy "Public Read Prizes"
  on public.spin_prizes for select to anon
  using (is_active = true);
create policy "spin prizes select authenticated"
  on public.spin_prizes for select to authenticated
  using ((select auth.uid()) is not null);
create policy "spin prizes manage authorized roles"
  on public.spin_prizes for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner'));

-- Public review logging is token-prepared-customer based and rate-limited to
-- one record per customer/branch/day. The underlying table stays private.
create or replace function public.log_public_branch_review(
  p_token text,
  p_customer_id uuid,
  p_branch_id uuid,
  p_review_clicked boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review_id uuid;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null
    or p_customer_id is null
    or p_branch_id is null
  then
    raise exception 'REVIEW_CONTEXT_REQUIRED' using errcode = '22023';
  end if;

  if not exists (select 1 from public.customers c where c.id = p_customer_id)
    or not exists (
      select 1
      from public.spin_sessions s
      join public.branches b on b.id = s.branch_id
      where s.token = p_token
        and s.branch_id = p_branch_id
        and s.expires_at > now()
        and (coalesce(s.is_multi_use, false) or not coalesce(s.used, false))
        and coalesce(b.role, 'branch') = 'branch'
        and coalesce((to_jsonb(b)->>'is_active')::boolean, true)
    )
  then
    raise exception 'REVIEW_CONTEXT_INVALID' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('branch-review:' || p_customer_id::text || ':' || p_branch_id::text));

  select r.id into v_review_id
  from public.branch_reviews r
  where r.customer_id = p_customer_id
    and r.branch_id = p_branch_id
    and r.reviewed_at >= date_trunc('day', now())
    and r.reviewed_at < date_trunc('day', now()) + interval '1 day'
  order by r.reviewed_at desc
  limit 1;

  if v_review_id is not null then
    return v_review_id;
  end if;

  insert into public.branch_reviews (customer_id, branch_id, review_clicked, reviewed_at)
  values (p_customer_id, p_branch_id, coalesce(p_review_clicked, true), now())
  returning id into v_review_id;

  return v_review_id;
end;
$$;

revoke all on function public.log_public_branch_review(text, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.log_public_branch_review(text, uuid, uuid, boolean)
  to anon, authenticated, service_role;

revoke all on table public.branch_reviews from anon;
drop policy if exists "Public Reviews All" on public.branch_reviews;
drop policy if exists "branch reviews select authenticated" on public.branch_reviews;
drop policy if exists "branch reviews manage authorized roles" on public.branch_reviews;
create policy "branch reviews select authenticated"
  on public.branch_reviews for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager', 'owner', 'supervisor')
    or (select public.current_app_can_access_branch(branch_id))
  );
create policy "branch reviews manage authorized roles"
  on public.branch_reviews for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner'));

-- Voucher share logging validates that the voucher belongs to the supplied
-- customer and branch and stores at most one share event per voucher.
create or replace function public.log_public_voucher_share(
  p_voucher_code text,
  p_customer_id uuid,
  p_branch_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_voucher_code, '')));
begin
  if v_code = '' or length(v_code) > 64 or p_customer_id is null or p_branch_id is null then
    raise exception 'SHARE_CONTEXT_INVALID' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.spins s
    where upper(s.voucher_code) = v_code
      and s.customer_id = p_customer_id
      and s.branch_id = p_branch_id
  ) then
    raise exception 'SHARE_CONTEXT_INVALID' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('voucher-share:' || v_code));

  if not exists (
    select 1 from public.voucher_shares v
    where upper(v.voucher_code) = v_code
      and v.from_customer_id = p_customer_id
      and v.branch_id = p_branch_id
  ) then
    insert into public.voucher_shares (voucher_code, from_customer_id, branch_id, shared_at)
    values (v_code, p_customer_id, p_branch_id, now());
  end if;

  return true;
end;
$$;

revoke all on function public.log_public_voucher_share(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.log_public_voucher_share(text, uuid, uuid)
  to anon, authenticated, service_role;

revoke all on table public.voucher_shares from anon;
drop policy if exists "Public Shares All" on public.voucher_shares;
drop policy if exists "voucher shares select authenticated" on public.voucher_shares;
drop policy if exists "voucher shares manage authorized roles" on public.voucher_shares;
create policy "voucher shares select authenticated"
  on public.voucher_shares for select to authenticated
  using ((select auth.uid()) is not null);
create policy "voucher shares manage authorized roles"
  on public.voucher_shares for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'owner'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'owner'));

notify pgrst, 'reload schema';

commit;
