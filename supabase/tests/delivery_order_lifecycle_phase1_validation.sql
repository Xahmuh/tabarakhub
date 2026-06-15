-- Delivery lifecycle Phase 1 validation.
--
-- Run after applying:
-- supabase/migrations/20260615070000_delivery_lifecycle_phase1.sql
--
-- This script is rollback-only. It creates temporary delivery drivers/orders/events,
-- simulates app sessions through request.jwt.claim.sub + SET LOCAL ROLE, and
-- returns one row per expected security behavior.
--
-- Expected final result: every returned row has passed = true.

begin;

drop table if exists pg_temp.delivery_lifecycle_phase1_results;
create temp table delivery_lifecycle_phase1_results (
  sort_order integer primary key,
  test_name text not null,
  expected text not null,
  actual text not null,
  passed boolean not null,
  detail text
);

insert into delivery_lifecycle_phase1_results
with checks as (
  select
    10 as sort_order,
    'delivery_orders_lifecycle_columns' as test_name,
    'all lifecycle columns exist' as expected,
    count(*)::text as actual,
    count(*) = 8 as passed,
    null::text as detail
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'delivery_orders'
    and column_name in (
      'delivery_status',
      'assigned_at',
      'picked_up_at',
      'delivered_at',
      'cancelled_at',
      'cancelled_reason',
      'lifecycle_updated_at',
      'lifecycle_updated_by'
    )

  union all

  select
    20,
    'delivery_order_events_table',
    'table exists',
    coalesce(to_regclass('public.delivery_order_events')::text, 'missing'),
    to_regclass('public.delivery_order_events') is not null,
    null::text

  union all

  select
    30,
    'delivery_order_events_rls',
    'RLS enabled',
    c.relrowsecurity::text,
    c.relrowsecurity,
    null::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'delivery_order_events'

  union all

  select
    40,
    'delivery_order_events_anon_grants',
    '0 anon privileges',
    count(*)::text,
    count(*) = 0,
    null::text
  from information_schema.table_privileges
  where table_schema = 'public'
    and table_name = 'delivery_order_events'
    and grantee in ('anon', 'PUBLIC')

  union all

  select
    50,
    'delivery_order_events_authenticated_write_grants',
    '0 authenticated write privileges',
    count(*)::text,
    count(*) = 0,
    null::text
  from information_schema.table_privileges
  where table_schema = 'public'
    and table_name = 'delivery_order_events'
    and grantee = 'authenticated'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')

  union all

  select
    60,
    'delivery_order_events_select_policy',
    'branch-scoped select policy exists',
    count(*)::text,
    count(*) = 1,
    null::text
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'delivery_order_events'
    and p.polname = 'delivery order events select'

  union all

  select
    70,
    'delivery_order_events_no_write_policies',
    'no direct insert/update/delete policies',
    count(*)::text,
    count(*) = 0,
    null::text
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'delivery_order_events'
    and p.polcmd in ('a', 'w', 'd', '*')

  union all

  select
    80,
    'transition_rpc_exists',
    'app_delivery_transition_order exists',
    coalesce(to_regprocedure('public.app_delivery_transition_order(uuid,text,uuid,text,text)')::text, 'missing'),
    to_regprocedure('public.app_delivery_transition_order(uuid,text,uuid,text,text)') is not null,
    null::text

  union all

  select
    90,
    'transition_rpc_authenticated_only',
    'authenticated can execute; anon cannot',
    concat(
      'authenticated=',
      has_function_privilege('authenticated', to_regprocedure('public.app_delivery_transition_order(uuid,text,uuid,text,text)'), 'execute'),
      ', anon=',
      has_function_privilege('anon', to_regprocedure('public.app_delivery_transition_order(uuid,text,uuid,text,text)'), 'execute')
    ),
    has_function_privilege('authenticated', to_regprocedure('public.app_delivery_transition_order(uuid,text,uuid,text,text)'), 'execute')
      and not has_function_privilege('anon', to_regprocedure('public.app_delivery_transition_order(uuid,text,uuid,text,text)'), 'execute'),
    null::text
)
select * from checks;

do $$
declare
  branch_user_id uuid;
  admin_user_id uuid;
  own_branch_id uuid;
  cross_branch_id uuid;
  driver_id uuid;
  own_order_id uuid;
  invalid_order_id uuid;
  old_order_id uuid;
  cross_order_id uuid;
  event_row public.delivery_order_events%rowtype;
  event_count integer;
  visible_own integer;
  visible_cross integer;
  affected integer;
begin
  select p.user_id, p.branch_id
  into branch_user_id, own_branch_id
  from public.app_user_profiles p
  join public.branches b on b.id = p.branch_id
  where p.role = 'branch'
    and p.is_active
    and b.role = 'branch'
  order by b.code nulls last, b.name
  limit 1;

  select b.id
  into cross_branch_id
  from public.branches b
  where b.role = 'branch'
    and b.id is distinct from own_branch_id
  order by b.code nulls last, b.name
  limit 1;

  select p.user_id
  into admin_user_id
  from public.app_user_profiles p
  where p.role in ('admin', 'manager')
    and p.is_active
  limit 1;

  if branch_user_id is null or own_branch_id is null or cross_branch_id is null or admin_user_id is null then
    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        100,
        'live_profile_setup',
        'active branch profile, second branch, and admin profile exist',
        'missing setup',
        false,
        'Provision branch/admin profiles and at least two operational branches before running lifecycle RLS validation.'
      );
    return;
  end if;

  insert into public.delivery_drivers (name, phone, notes, is_active)
  values ('Phase 1 RLS Test Driver ' || substr(gen_random_uuid()::text, 1, 8), null, 'rollback-only lifecycle validation', true)
  returning id into driver_id;

  insert into public.delivery_orders (branch_id, order_date, value_bhd, payment_type, notes, created_by)
  values (own_branch_id, current_date, 1.000, 'TALABAT', 'phase1 own lifecycle order', branch_user_id)
  returning id into own_order_id;

  insert into public.delivery_orders (branch_id, order_date, value_bhd, payment_type, notes, created_by)
  values (own_branch_id, current_date, 1.250, 'TALABAT', 'phase1 invalid lifecycle order', branch_user_id)
  returning id into invalid_order_id;

  insert into public.delivery_orders (branch_id, order_date, value_bhd, payment_type, notes, created_by)
  values (own_branch_id, current_date - 7, 2.000, 'TALABAT', 'phase1 historical lifecycle order', branch_user_id)
  returning id into old_order_id;

  insert into public.delivery_orders (branch_id, order_date, value_bhd, payment_type, notes, created_by)
  values (cross_branch_id, current_date, 3.000, 'TALABAT', 'phase1 cross-branch lifecycle order', branch_user_id)
  returning id into cross_order_id;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    perform count(*) from public.delivery_order_events;
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (110, 'anon_read_lifecycle_events', 'denied', 'read succeeded', false, 'Anon must not read lifecycle events.');
  exception
    when insufficient_privilege then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (110, 'anon_read_lifecycle_events', 'denied', 'denied', true, null);
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (110, 'anon_read_lifecycle_events', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    perform * from public.app_delivery_transition_order(own_order_id, 'cancelled', null, 'anon transition attempt', 'anon-transition');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (120, 'anon_transition_rpc', 'denied', 'transition succeeded', false, 'Anon must not execute lifecycle transition RPC.');
  exception
    when insufficient_privilege then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (120, 'anon_transition_rpc', 'denied', 'denied', true, null);
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (120, 'anon_transition_rpc', 'denied', sqlstate, sqlstate in ('42501', 'PGRST202'), sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select *
    into event_row
    from public.app_delivery_transition_order(own_order_id, 'assigned', driver_id, 'branch assigned order', 'branch-own-assigned');

    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        130,
        'branch_own_transition_allowed',
        'own branch recent order assigned',
        coalesce(event_row.new_status, 'no event'),
        event_row.new_status = 'assigned' and event_row.branch_id = own_branch_id and event_row.actor_user_id = branch_user_id,
        'Branch users may transition only own recent delivery orders through the RPC.'
      );
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (130, 'branch_own_transition_allowed', 'own branch recent order assigned', sqlstate, false, sqlerrm);
  end;

  select count(*)
  into event_count
  from public.delivery_order_events
  where order_id = own_order_id
    and new_status = 'assigned'
    and actor_user_id = branch_user_id
    and actor_role = 'branch'
    and metadata ->> 'source' = 'internal_dispatch_phase1'
    and metadata ->> 'driver_role_enabled' = 'false';

  insert into delivery_lifecycle_phase1_results
    (sort_order, test_name, expected, actual, passed, detail)
  values
    (140, 'lifecycle_event_audit_row', 'event row with actor/source metadata', event_count::text, event_count = 1, null);

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select count(*) into visible_own from public.delivery_order_events where branch_id = own_branch_id;
    select count(*) into visible_cross from public.delivery_order_events where branch_id = cross_branch_id;
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        150,
        'branch_event_visibility_scope',
        'own events visible and cross-branch events hidden',
        concat('own=', visible_own, ', cross=', visible_cross),
        visible_own >= 1 and visible_cross = 0,
        null
      );
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (150, 'branch_event_visibility_scope', 'own events visible and cross-branch events hidden', sqlstate, false, sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    perform * from public.app_delivery_transition_order(cross_order_id, 'assigned', driver_id, 'cross branch attempt', 'branch-cross-assigned');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (160, 'branch_cross_branch_transition_denied', 'denied', 'transition succeeded', false, 'Branch users must not mutate another branch order.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (160, 'branch_cross_branch_transition_denied', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    perform * from public.app_delivery_transition_order(old_order_id, 'assigned', driver_id, 'old branch attempt', 'branch-old-assigned');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (170, 'branch_historical_transition_denied', 'denied', 'transition succeeded', false, 'Branch users must not mutate historical lifecycle records.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (170, 'branch_historical_transition_denied', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    perform * from public.app_delivery_transition_order(invalid_order_id, 'delivered', driver_id, 'invalid jump attempt', 'branch-invalid-delivered');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (180, 'branch_invalid_transition_denied', 'denied', 'transition succeeded', false, 'Recorded branch orders cannot jump directly to delivered.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (180, 'branch_invalid_transition_denied', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    delete from public.delivery_orders where id = own_order_id;
    get diagnostics affected = row_count;
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (190, 'branch_hard_delete_denied', '0 rows deleted', affected::text, affected = 0, 'Branch hard delete remains blocked.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (190, 'branch_hard_delete_denied', '0 rows deleted', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('app.delivery_lifecycle_rpc', 'false', true);
    set local role authenticated;

    update public.delivery_orders
    set delivery_status = 'delivered'
    where id = own_order_id;
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (200, 'branch_direct_lifecycle_update_denied', 'denied', 'direct update succeeded', false, 'Branch lifecycle writes must use the RPC.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (200, 'branch_direct_lifecycle_update_denied', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    insert into public.delivery_order_events (
      order_id,
      branch_id,
      event_type,
      new_status
    )
    values (own_order_id, own_branch_id, 'assigned', 'assigned');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (210, 'branch_direct_event_insert_denied', 'denied', 'insert succeeded', false, 'Lifecycle events must be append-only through the RPC.');
  exception
    when insufficient_privilege then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (210, 'branch_direct_event_insert_denied', 'denied', 'denied', true, null);
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (210, 'branch_direct_event_insert_denied', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select *
    into event_row
    from public.app_delivery_transition_order(cross_order_id, 'assigned', driver_id, 'admin assigned cross branch', 'admin-cross-assigned');

    select count(*) into event_count from public.delivery_order_events;
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        220,
        'admin_transition_and_read_all',
        'admin can transition and view all events',
        concat('status=', coalesce(event_row.new_status, 'none'), ', events=', event_count),
        event_row.new_status = 'assigned' and event_count >= 2,
        null
      );
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (220, 'admin_transition_and_read_all', 'admin can transition and view all events', sqlstate, false, sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select *
    into event_row
    from public.app_delivery_transition_order(old_order_id, 'assigned', driver_id, 'admin assigned old order', 'admin-old-assigned');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (230, 'admin_historical_transition_allowed', 'admin can manage old order lifecycle', coalesce(event_row.new_status, 'none'), event_row.new_status = 'assigned', null);
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (230, 'admin_historical_transition_allowed', 'admin can manage old order lifecycle', sqlstate, false, sqlerrm);
  end;

  update public.app_user_profiles
  set role = 'owner',
      branch_id = null,
      is_active = true,
      updated_at = now()
  where user_id = admin_user_id;

  begin
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    perform * from public.app_delivery_transition_order(own_order_id, 'picked_up', driver_id, 'owner write attempt', 'owner-picked-up');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (240, 'owner_transition_denied', 'denied', 'transition succeeded', false, 'Owner must remain read-only.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (240, 'owner_transition_denied', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    delete from public.delivery_orders where id = own_order_id;
    get diagnostics affected = row_count;
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (250, 'owner_delete_denied', '0 rows deleted', affected::text, affected = 0, 'Owner must not hard-delete delivery orders.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (250, 'owner_delete_denied', '0 rows deleted', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  update public.app_user_profiles
  set role = 'supervisor',
      branch_id = null,
      is_active = true,
      updated_at = now()
  where user_id = admin_user_id;

  insert into public.supervisor_branches (supervisor_user_id, branch_id, created_by)
  values (admin_user_id, own_branch_id, admin_user_id)
  on conflict (supervisor_user_id, branch_id) do nothing;

  begin
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select count(*) into visible_own from public.delivery_order_events where branch_id = own_branch_id;
    select count(*) into visible_cross from public.delivery_order_events where branch_id = cross_branch_id;
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        260,
        'supervisor_assigned_branch_read_only_scope',
        'assigned branch events visible and cross-branch events hidden',
        concat('own=', visible_own, ', cross=', visible_cross),
        visible_own >= 1 and visible_cross = 0,
        null
      );
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (260, 'supervisor_assigned_branch_read_only_scope', 'assigned branch events visible and cross-branch events hidden', sqlstate, false, sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    perform * from public.app_delivery_transition_order(own_order_id, 'picked_up', driver_id, 'supervisor write attempt', 'supervisor-picked-up');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (270, 'supervisor_transition_denied', 'denied', 'transition succeeded', false, 'Supervisor must stay read-only for lifecycle transitions.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (270, 'supervisor_transition_denied', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;

  update public.app_user_profiles
  set role = 'warehouse',
      branch_id = null,
      is_active = true,
      updated_at = now()
  where user_id = admin_user_id;

  begin
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select count(*) into event_count from public.delivery_order_events;
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (280, 'warehouse_read_all_no_write_setup', 'warehouse can read lifecycle events', event_count::text, event_count >= 2, 'Warehouse is read-only but can read all through current_app_can_read_all().');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (280, 'warehouse_read_all_no_write_setup', 'warehouse can read lifecycle events', sqlstate, false, sqlerrm);
  end;

  begin
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    perform * from public.app_delivery_transition_order(own_order_id, 'picked_up', driver_id, 'warehouse write attempt', 'warehouse-picked-up');
    reset role;

    insert into delivery_lifecycle_phase1_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (290, 'warehouse_transition_denied', 'denied', 'transition succeeded', false, 'Warehouse must stay read-only for lifecycle transitions.');
  exception
    when others then
      reset role;
      insert into delivery_lifecycle_phase1_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (290, 'warehouse_transition_denied', 'denied', sqlstate, sqlstate = '42501', sqlerrm);
  end;
end $$;

select
  sort_order,
  test_name,
  expected,
  actual,
  passed,
  detail
from delivery_lifecycle_phase1_results
order by sort_order;

rollback;
