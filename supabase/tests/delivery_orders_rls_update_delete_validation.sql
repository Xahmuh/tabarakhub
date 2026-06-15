-- Delivery orders update/delete RLS validation.
--
-- Run only after applying the local migration:
-- supabase/migrations/20260615011000_allow_branch_delete_old_delivery_orders.sql
--
-- This script is rollback-only. It creates temporary delivery_orders rows, simulates
-- app sessions through request.jwt.claim.sub + SET LOCAL ROLE, and returns one row
-- per expected security behavior.
--
-- Expected final result: every returned row has passed = true, except rows marked
-- pending when the target project has not provisioned an owner/admin/T001/H003
-- profile needed for a live-session simulation.

begin;

drop table if exists pg_temp.delivery_orders_rls_results;
create temp table delivery_orders_rls_results (
  sort_order integer primary key,
  test_name text not null,
  expected text not null,
  actual text not null,
  passed boolean not null,
  detail text
);

do $$
declare
  branch_user_id uuid;
  t001_branch_id uuid;
  cross_branch_id uuid;
  admin_user_id uuid;
  owner_user_id uuid;
  recent_own_order_id uuid;
  old_own_order_id uuid;
  cross_branch_order_id uuid;
  admin_order_id uuid;
  affected integer;
  audit_count integer;
begin
  select p.user_id, p.branch_id
  into branch_user_id, t001_branch_id
  from public.app_user_profiles p
  join public.branches b on b.id = p.branch_id
  where p.role = 'branch'
    and p.is_active
    and upper(b.code) = 'T001'
  limit 1;

  select b.id
  into cross_branch_id
  from public.branches b
  where upper(b.code) = 'H003'
    and b.role = 'branch'
  limit 1;

  select p.user_id
  into admin_user_id
  from public.app_user_profiles p
  where p.role in ('admin', 'manager')
    and p.is_active
  limit 1;

  select p.user_id
  into owner_user_id
  from public.app_user_profiles p
  where p.role = 'owner'
    and p.is_active
  limit 1;

  if branch_user_id is null or t001_branch_id is null or cross_branch_id is null then
    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        0,
        'setup_t001_h003',
        'active T001 branch profile and H003 branch row exist',
        'missing setup',
        false,
        'Provision active T001 branch app_user_profiles row and H003 branch row before running live RLS validation.'
      );
    return;
  end if;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    notes,
    created_by
  )
  values (t001_branch_id, current_date, 1.000, 'TALABAT', 'rls recent own order', branch_user_id)
  returning id into recent_own_order_id;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    notes,
    created_by
  )
  values (t001_branch_id, current_date - 7, 2.000, 'TALABAT', 'rls old own order', branch_user_id)
  returning id into old_own_order_id;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    notes,
    created_by
  )
  values (cross_branch_id, current_date, 3.000, 'TALABAT', 'rls cross branch order', branch_user_id)
  returning id into cross_branch_order_id;

  insert into public.delivery_orders (
    branch_id,
    order_date,
    value_bhd,
    payment_type,
    notes
  )
  values (t001_branch_id, current_date - 30, 4.000, 'TALABAT', 'rls admin delete order')
  returning id into admin_order_id;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    perform count(*) from public.delivery_orders;
    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (10, 'anon_read_delivery_orders', 'denied', 'read succeeded', false, 'Anon must not read delivery_orders.');
  exception
    when insufficient_privilege then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (10, 'anon_read_delivery_orders', 'denied', 'denied', true, null);
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (10, 'anon_read_delivery_orders', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    insert into public.delivery_orders (
      branch_id,
      order_date,
      value_bhd,
      payment_type,
      notes
    )
    values (t001_branch_id, current_date, 9.000, 'TALABAT', 'anon insert blocked');

    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (11, 'anon_write_delivery_orders', 'denied', 'insert succeeded', false, 'Anon must not write delivery_orders.');
  exception
    when insufficient_privilege then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (11, 'anon_write_delivery_orders', 'denied', 'denied', true, null);
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (11, 'anon_write_delivery_orders', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.delivery_orders
    set notes = 'branch recent update allowed'
    where id = recent_own_order_id;
    get diagnostics affected = row_count;

    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (20, 'branch_update_recent_own_order', '1 row updated', affected::text, affected = 1, null);
  exception
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (20, 'branch_update_recent_own_order', '1 row updated', sqlstate, false, sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.delivery_orders
    set notes = 'branch cross update blocked'
    where id = cross_branch_order_id;
    get diagnostics affected = row_count;

    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (30, 'branch_update_cross_branch_order', '0 rows updated', affected::text, affected = 0, null);
  exception
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (30, 'branch_update_cross_branch_order', '0 rows updated', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.delivery_orders
    set notes = 'branch historical update blocked'
    where id = old_own_order_id;
    get diagnostics affected = row_count;

    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (40, 'branch_update_historical_own_order', '0 rows updated', affected::text, affected = 0, null);
  exception
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (40, 'branch_update_historical_own_order', '0 rows updated', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.delivery_orders
    set created_at = created_at - interval '1 day'
    where id = recent_own_order_id;
    get diagnostics affected = row_count;

    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (50, 'branch_update_immutable_field', 'denied', affected::text || ' rows updated', false, 'Branch users must not alter immutable traceability fields.');
  exception
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (50, 'branch_update_immutable_field', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    delete from public.delivery_orders
    where id = recent_own_order_id;
    get diagnostics affected = row_count;

    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (60, 'branch_delete_recent_own_order', '0 rows deleted', affected::text, affected = 0, 'Branch hard delete is never allowed.');
  exception
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (60, 'branch_delete_recent_own_order', '0 rows deleted', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    delete from public.delivery_orders
    where id = cross_branch_order_id;
    get diagnostics affected = row_count;

    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (65, 'branch_delete_cross_branch_order', '0 rows deleted', affected::text, affected = 0, 'Branch users must not delete another branch order.');
  exception
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (65, 'branch_delete_cross_branch_order', '0 rows deleted', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    delete from public.delivery_orders
    where id = old_own_order_id;
    get diagnostics affected = row_count;

    reset role;

    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (70, 'branch_delete_historical_own_order', '0 rows deleted', affected::text, affected = 0, 'Historical branch orders are read-only.');
  exception
    when others then
      reset role;
      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (70, 'branch_delete_historical_own_order', '0 rows deleted', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  select count(*)
  into audit_count
  from public.delivery_order_audit_logs
  where order_id = recent_own_order_id
    and action = 'update';

  insert into delivery_orders_rls_results
    (sort_order, test_name, expected, actual, passed, detail)
  values
    (80, 'delivery_update_audit_traceability', '>= 1 audit row', audit_count::text, audit_count >= 1, 'Branch-safe updates must remain traceable.');

  if admin_user_id is null then
    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (90, 'admin_delete_delivery_order', 'admin live session available', 'pending', true, 'No active admin/manager profile exists; live admin delete validation is pending.');
  else
    begin
      perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      set local role authenticated;

      delete from public.delivery_orders
      where id = admin_order_id;
      get diagnostics affected = row_count;

      reset role;

      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (90, 'admin_delete_delivery_order', '1 row deleted', affected::text, affected = 1, 'Admin/legacy-manager hard delete remains intentional and audited.');
    exception
      when others then
        reset role;
        insert into delivery_orders_rls_results
          (sort_order, test_name, expected, actual, passed, detail)
        values
          (90, 'admin_delete_delivery_order', '1 row deleted', sqlstate, false, sqlerrm);
    end;
  end if;

  if owner_user_id is null then
    insert into delivery_orders_rls_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (100, 'owner_write_delivery_order', 'owner live session available', 'pending', true, 'No active owner profile exists; live owner write validation is pending.');
  else
    begin
      perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      set local role authenticated;

      update public.delivery_orders
      set notes = 'owner update blocked'
      where id = old_own_order_id;
      get diagnostics affected = row_count;

      reset role;

      insert into delivery_orders_rls_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (100, 'owner_write_delivery_order', '0 rows updated', affected::text, affected = 0, 'Owner must stay read-only.');
    exception
      when others then
        reset role;
        insert into delivery_orders_rls_results
          (sort_order, test_name, expected, actual, passed, detail)
        values
          (100, 'owner_write_delivery_order', '0 rows updated', sqlstate, sqlstate = '42501', sqlerrm);
    end;
  end if;
end $$;

select
  sort_order,
  test_name,
  expected,
  actual,
  passed,
  detail
from delivery_orders_rls_results
order by sort_order;

rollback;
