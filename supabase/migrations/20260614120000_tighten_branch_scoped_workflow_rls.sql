-- Tighten branch-scoped workflow RLS after manual role-session QA found
-- legacy public/broad policies still active on the linked project.
--
-- Applied to the linked Supabase project on 2026-06-14 after explicit approval.

do $$
begin
  if to_regclass('public.delivery_orders') is not null then
    alter table public.delivery_orders enable row level security;
    revoke all on public.delivery_orders from anon;
    revoke all on public.delivery_orders from authenticated;
    grant select, insert, update, delete on public.delivery_orders to authenticated;
    grant all on public.delivery_orders to service_role;

    drop policy if exists "Allow all access to delivery_orders" on public.delivery_orders;
    drop policy if exists "Allow delete for authorized roles" on public.delivery_orders;
    drop policy if exists "delivery orders select" on public.delivery_orders;
    drop policy if exists "delivery orders insert" on public.delivery_orders;
    drop policy if exists "delivery orders update" on public.delivery_orders;
    drop policy if exists "delivery orders delete" on public.delivery_orders;

    create policy "delivery orders select"
    on public.delivery_orders
    for select
    to authenticated
    using (public.current_app_can_access_branch(branch_id));

    create policy "delivery orders insert"
    on public.delivery_orders
    for insert
    to authenticated
    with check (
      public.current_app_can_manage()
      or (
        branch_id = public.current_app_branch_id()
        and order_date >= current_date - 1
        and order_date <= current_date
      )
    );

    create policy "delivery orders update"
    on public.delivery_orders
    for update
    to authenticated
    using (
      public.current_app_can_manage()
      or (
        branch_id = public.current_app_branch_id()
        and order_date = current_date
      )
    )
    with check (
      public.current_app_can_manage()
      or (
        branch_id = public.current_app_branch_id()
        and order_date >= current_date - 1
        and order_date <= current_date
      )
    );

    create policy "delivery orders delete"
    on public.delivery_orders
    for delete
    to authenticated
    using (
      public.current_app_can_manage()
      or (
        branch_id = public.current_app_branch_id()
        and order_date = current_date
      )
    );
  end if;

  if to_regclass('public.cash_differences') is not null then
    alter table public.cash_differences enable row level security;
    revoke all on public.cash_differences from anon;
    revoke all on public.cash_differences from authenticated;
    grant select, insert, update, delete on public.cash_differences to authenticated;
    grant all on public.cash_differences to service_role;

    drop policy if exists "Allow all access" on public.cash_differences;
    drop policy if exists "Allow all for now" on public.cash_differences;
    drop policy if exists "cash differences select authenticated" on public.cash_differences;
    drop policy if exists "cash differences insert authenticated" on public.cash_differences;
    drop policy if exists "cash differences update authenticated" on public.cash_differences;
    drop policy if exists "cash differences delete authenticated" on public.cash_differences;

    create policy "cash differences select authenticated"
    on public.cash_differences
    for select
    to authenticated
    using (public.current_app_can_access_branch(branch_id));

    create policy "cash differences insert authenticated"
    on public.cash_differences
    for insert
    to authenticated
    with check (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    );

    create policy "cash differences update authenticated"
    on public.cash_differences
    for update
    to authenticated
    using (public.current_app_can_manage())
    with check (public.current_app_can_manage());

    create policy "cash differences delete authenticated"
    on public.cash_differences
    for delete
    to authenticated
    using (public.current_app_can_manage());
  end if;

  if to_regclass('public.lost_sales') is not null then
    alter table public.lost_sales enable row level security;
    revoke all on public.lost_sales from anon;
    revoke all on public.lost_sales from authenticated;
    grant select, insert, update, delete on public.lost_sales to authenticated;
    grant all on public.lost_sales to service_role;

    drop policy if exists "Public Access" on public.lost_sales;
    drop policy if exists "Anon read lost_sales" on public.lost_sales;
    drop policy if exists "Anon write lost_sales" on public.lost_sales;
    drop policy if exists "Universal read lost_sales" on public.lost_sales;
    drop policy if exists "Admin write lost_sales" on public.lost_sales;
    drop policy if exists "lost sales select authenticated" on public.lost_sales;
    drop policy if exists "lost sales insert authenticated" on public.lost_sales;
    drop policy if exists "lost sales update authenticated" on public.lost_sales;
    drop policy if exists "lost sales delete authenticated" on public.lost_sales;

    create policy "lost sales select authenticated"
    on public.lost_sales
    for select
    to authenticated
    using (public.current_app_can_access_branch(branch_id));

    create policy "lost sales insert authenticated"
    on public.lost_sales
    for insert
    to authenticated
    with check (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    );

    create policy "lost sales update authenticated"
    on public.lost_sales
    for update
    to authenticated
    using (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    )
    with check (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    );

    create policy "lost sales delete authenticated"
    on public.lost_sales
    for delete
    to authenticated
    using (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    );
  end if;

  if to_regclass('public.shortages') is not null then
    alter table public.shortages enable row level security;
    revoke all on public.shortages from anon;
    revoke all on public.shortages from authenticated;
    grant select, insert, update, delete on public.shortages to authenticated;
    grant all on public.shortages to service_role;

    drop policy if exists "Public Access" on public.shortages;
    drop policy if exists "Anon read shortages" on public.shortages;
    drop policy if exists "Anon write shortages" on public.shortages;
    drop policy if exists "Universal read shortages" on public.shortages;
    drop policy if exists "Admin write shortages" on public.shortages;
    drop policy if exists "shortages select authenticated" on public.shortages;
    drop policy if exists "shortages insert authenticated" on public.shortages;
    drop policy if exists "shortages update authenticated" on public.shortages;
    drop policy if exists "shortages delete authenticated" on public.shortages;

    create policy "shortages select authenticated"
    on public.shortages
    for select
    to authenticated
    using (public.current_app_can_access_branch(branch_id));

    create policy "shortages insert authenticated"
    on public.shortages
    for insert
    to authenticated
    with check (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    );

    create policy "shortages update authenticated"
    on public.shortages
    for update
    to authenticated
    using (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    )
    with check (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    );

    create policy "shortages delete authenticated"
    on public.shortages
    for delete
    to authenticated
    using (
      public.current_app_can_manage()
      or branch_id = public.current_app_branch_id()
    );
  end if;

  if to_regclass('public.pharmacist_branches') is not null then
    alter table public.pharmacist_branches enable row level security;
    revoke all on public.pharmacist_branches from anon;
    revoke all on public.pharmacist_branches from authenticated;
    grant select, insert, update, delete on public.pharmacist_branches to authenticated;
    grant all on public.pharmacist_branches to service_role;

    drop policy if exists "Public Access" on public.pharmacist_branches;
    drop policy if exists "Allow all access to pharmacist_branches" on public.pharmacist_branches;
    drop policy if exists "Anon read pharmacist_branches" on public.pharmacist_branches;
    drop policy if exists "Anon write pharmacist_branches" on public.pharmacist_branches;
    drop policy if exists "Universal read pharmacist_branches" on public.pharmacist_branches;
    drop policy if exists "Admin write pharmacist_branches" on public.pharmacist_branches;
    drop policy if exists "pharmacist branches select authenticated" on public.pharmacist_branches;
    drop policy if exists "pharmacist branches manage authenticated" on public.pharmacist_branches;

    create policy "pharmacist branches select authenticated"
    on public.pharmacist_branches
    for select
    to authenticated
    using (public.current_app_can_access_branch(branch_id));

    create policy "pharmacist branches manage authenticated"
    on public.pharmacist_branches
    for all
    to authenticated
    using (public.current_app_can_manage())
    with check (public.current_app_can_manage());
  end if;
end $$;

notify pgrst, 'reload schema';
