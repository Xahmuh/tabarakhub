-- Emergency rollback for supabase/migrations/20260614120000_tighten_branch_scoped_workflow_rls.sql.
--
-- This is a schema-only restore point for the pre-fix broad RLS policies
-- observed on the linked Supabase project before applying the security fix.
-- Do not run unless an urgent staging outage requires restoring the prior
-- permissive behavior. This intentionally reintroduces the security defect.

do $$
begin
  if to_regclass('public.delivery_orders') is not null then
    drop policy if exists "Allow all access to delivery_orders" on public.delivery_orders;
    drop policy if exists "Allow delete for authorized roles" on public.delivery_orders;

    create policy "Allow all access to delivery_orders"
    on public.delivery_orders
    for all
    to public
    using (true)
    with check (true);

    create policy "Allow delete for authorized roles"
    on public.delivery_orders
    for delete
    to public
    using (true);
  end if;

  if to_regclass('public.cash_differences') is not null then
    drop policy if exists "Allow all access" on public.cash_differences;
    drop policy if exists "Allow all for now" on public.cash_differences;

    create policy "Allow all access"
    on public.cash_differences
    for all
    to public
    using (true)
    with check (true);

    create policy "Allow all for now"
    on public.cash_differences
    for all
    to public
    using (true)
    with check (true);
  end if;

  if to_regclass('public.lost_sales') is not null then
    drop policy if exists "Public Access" on public.lost_sales;

    create policy "Public Access"
    on public.lost_sales
    for all
    to public
    using (auth.role() = any (array['anon'::text, 'authenticated'::text]))
    with check (auth.role() = any (array['anon'::text, 'authenticated'::text]));
  end if;

  if to_regclass('public.shortages') is not null then
    drop policy if exists "Public Access" on public.shortages;

    create policy "Public Access"
    on public.shortages
    for all
    to public
    using (auth.role() = any (array['anon'::text, 'authenticated'::text]))
    with check (auth.role() = any (array['anon'::text, 'authenticated'::text]));
  end if;

  if to_regclass('public.pharmacist_branches') is not null then
    drop policy if exists "Public Access" on public.pharmacist_branches;
    drop policy if exists "pharmacist branches select authenticated" on public.pharmacist_branches;

    create policy "Public Access"
    on public.pharmacist_branches
    for all
    to public
    using (auth.role() = any (array['anon'::text, 'authenticated'::text]))
    with check (auth.role() = any (array['anon'::text, 'authenticated'::text]));

    create policy "pharmacist branches select authenticated"
    on public.pharmacist_branches
    for select
    to authenticated
    using (true);
  end if;
end $$;

notify pgrst, 'reload schema';
