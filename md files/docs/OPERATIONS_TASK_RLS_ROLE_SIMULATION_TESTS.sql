-- Operations task RLS role-simulation tests.
--
-- Run from the Supabase SQL editor, psql, or another trusted SQL session that
-- can SET ROLE anon/authenticated and can seed rollback-only test rows.
--
-- Preconditions:
-- - all migrations are applied;
-- - public.app_user_profiles has one active user for each role:
--   admin, manager, accounts, branch;
-- - the branch user has a branch_id;
-- - public.branches has at least one second branch_id different from the branch
--   user's branch_id.
--
-- The script wraps test data in a transaction and ends with ROLLBACK.
-- Expected final result: every row returned from
-- operations_task_rls_role_results has passed = true.

begin;

drop table if exists pg_temp.operations_task_rls_role_results;
create temp table operations_task_rls_role_results (
  sort_order integer primary key,
  test_name text not null,
  role_under_test text not null,
  expected text not null,
  actual text not null,
  passed boolean not null,
  detail text
);

do $$
declare
  admin_user_id uuid;
  manager_user_id uuid;
  accounts_user_id uuid;
  branch_user_id uuid;
  branch_a_id uuid;
  branch_b_id uuid;
  branch_a_task_id uuid;
  branch_b_task_id uuid;
  manager_task_id uuid;
  seed_event_id uuid;
  created_task_id uuid;
  visible_count integer;
  rows_changed integer;
  reopen_phase text;
  test_suffix text := replace(gen_random_uuid()::text, '-', '');
begin
  select p.user_id
  into admin_user_id
  from public.app_user_profiles p
  where p.role = 'admin'
    and p.is_active
  limit 1;

  select p.user_id
  into manager_user_id
  from public.app_user_profiles p
  where p.role = 'manager'
    and p.is_active
  limit 1;

  select p.user_id
  into accounts_user_id
  from public.app_user_profiles p
  where p.role = 'accounts'
    and p.is_active
  limit 1;

  select p.user_id, p.branch_id
  into branch_user_id, branch_a_id
  from public.app_user_profiles p
  where p.role = 'branch'
    and p.is_active
    and p.branch_id is not null
  limit 1;

  select b.id
  into branch_b_id
  from public.branches b
  where branch_a_id is not null
    and b.id <> branch_a_id
  limit 1;

  if admin_user_id is null
    or manager_user_id is null
    or accounts_user_id is null
    or branch_user_id is null
    or branch_a_id is null
    or branch_b_id is null
  then
    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        0,
        'setup',
        'trusted_sql',
        'admin, manager, accounts, branch users and two branches exist',
        'missing setup data',
        false,
        'Provision the required app_user_profiles rows and a second branch before running role tests.'
      );
    return;
  end if;

  insert into public.operations_tasks (
    source_module,
    title,
    description,
    severity,
    priority,
    status,
    branch_id,
    branch_name,
    owner_role,
    related_record_id,
    related_record_type,
    created_by
  )
  values
    (
      'cash_tracker',
      'RLS branch A seed ' || test_suffix,
      'Rollback-only RLS test task for branch user scope.',
      'medium',
      'medium',
      'open',
      branch_a_id,
      'RLS Branch A',
      'branch',
      'rls-branch-a-' || test_suffix,
      'rls_test',
      admin_user_id
    )
  returning id into branch_a_task_id;

  insert into public.operations_tasks (
    source_module,
    title,
    description,
    severity,
    priority,
    status,
    branch_id,
    branch_name,
    owner_role,
    related_record_id,
    related_record_type,
    created_by
  )
  values
    (
      'cash_tracker',
      'RLS branch B seed ' || test_suffix,
      'Rollback-only RLS test task for other-branch denial.',
      'medium',
      'medium',
      'open',
      branch_b_id,
      'RLS Branch B',
      'branch',
      'rls-branch-b-' || test_suffix,
      'rls_test',
      admin_user_id
    )
  returning id into branch_b_task_id;

  insert into public.operations_task_events (task_id, event_type, comment, created_by)
  values (branch_a_task_id, 'comment', 'Rollback-only seed event.', admin_user_id)
  returning id into seed_event_id;

  -- 1. anon must not read operations_tasks.
  begin
    visible_count := 0;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    select count(*)
    into visible_count
    from public.operations_tasks
    where id in (branch_a_task_id, branch_b_task_id);

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        10,
        'anon_read_operations_tasks_denied',
        'anon',
        'denied or zero visible rows',
        visible_count || ' visible row(s)',
        visible_count = 0,
        null
      );
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          10,
          'anon_read_operations_tasks_denied',
          'anon',
          'denied or zero visible rows',
          'permission denied',
          true,
          SQLSTATE || ': ' || SQLERRM
        );
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          10,
          'anon_read_operations_tasks_denied',
          'anon',
          'denied or zero visible rows',
          'unexpected error',
          false,
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  -- 2. anon must not read operations_task_events.
  begin
    visible_count := 0;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    select count(*)
    into visible_count
    from public.operations_task_events
    where id = seed_event_id;

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        20,
        'anon_read_operations_task_events_denied',
        'anon',
        'denied or zero visible rows',
        visible_count || ' visible row(s)',
        visible_count = 0,
        null
      );
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          20,
          'anon_read_operations_task_events_denied',
          'anon',
          'denied or zero visible rows',
          'permission denied',
          true,
          SQLSTATE || ': ' || SQLERRM
        );
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          20,
          'anon_read_operations_task_events_denied',
          'anon',
          'denied or zero visible rows',
          'unexpected error',
          false,
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  -- 3. admin can create a task and creation event.
  begin
    created_task_id := null;
    perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    insert into public.operations_tasks (
      source_module,
      title,
      description,
      severity,
      priority,
      branch_id,
      owner_role,
      related_record_id,
      related_record_type
    )
    values (
      'cash_tracker',
      'RLS admin create ' || test_suffix,
      'Rollback-only admin create test.',
      'high',
      'high',
      branch_a_id,
      'manager',
      'rls-admin-create-' || test_suffix,
      'rls_test'
    )
    returning id into created_task_id;

    insert into public.operations_task_events (task_id, event_type, new_status, comment)
    values (created_task_id, 'created', 'open', 'Admin creation event test.');

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        30,
        'admin_create_task_and_event_allowed',
        'admin',
        'task and created event insert succeed',
        case when created_task_id is null then 'no task id returned' else 'created task' end,
        created_task_id is not null,
        created_task_id::text
      );
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          30,
          'admin_create_task_and_event_allowed',
          'admin',
          'task and created event insert succeed',
          'unexpected error',
          false,
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  -- 4. manager can create and update a task.
  begin
    manager_task_id := null;
    rows_changed := 0;
    perform set_config('request.jwt.claim.sub', manager_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    insert into public.operations_tasks (
      source_module,
      title,
      description,
      severity,
      priority,
      branch_id,
      owner_role,
      related_record_id,
      related_record_type
    )
    values (
      'cash_tracker',
      'RLS manager create ' || test_suffix,
      'Rollback-only manager create/update test.',
      'high',
      'high',
      branch_a_id,
      'manager',
      'rls-manager-create-' || test_suffix,
      'rls_test'
    )
    returning id into manager_task_id;

    update public.operations_tasks
    set status = 'in_progress'
    where id = manager_task_id;

    get diagnostics rows_changed = row_count;
    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        40,
        'manager_create_update_task_allowed',
        'manager',
        'task insert and status update succeed',
        rows_changed || ' updated row(s)',
        manager_task_id is not null and rows_changed = 1,
        manager_task_id::text
      );
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          40,
          'manager_create_update_task_allowed',
          'manager',
          'task insert and status update succeed',
          'unexpected error',
          false,
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  -- 5. accounts can read task rows but cannot insert, update, or comment.
  begin
    visible_count := 0;
    perform set_config('request.jwt.claim.sub', accounts_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select count(*)
    into visible_count
    from public.operations_tasks
    where id in (branch_a_task_id, branch_b_task_id);

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        50,
        'accounts_read_tasks_allowed',
        'accounts',
        'accounts can read all scoped task rows',
        visible_count || ' visible row(s)',
        visible_count = 2,
        null
      );
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          50,
          'accounts_read_tasks_allowed',
          'accounts',
          'accounts can read all scoped task rows',
          'unexpected error',
          false,
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  begin
    perform set_config('request.jwt.claim.sub', accounts_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    insert into public.operations_tasks (
      source_module,
      title,
      severity,
      priority,
      branch_id,
      related_record_id,
      related_record_type
    )
    values (
      'cash_tracker',
      'RLS accounts denied create ' || test_suffix,
      'low',
      'low',
      branch_a_id,
      'rls-accounts-denied-' || test_suffix,
      'rls_test'
    );

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        60,
        'accounts_create_task_denied',
        'accounts',
        'insert denied',
        'insert succeeded',
        false,
        null
      );
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (60, 'accounts_create_task_denied', 'accounts', 'insert denied', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (60, 'accounts_create_task_denied', 'accounts', 'insert denied', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    rows_changed := 0;
    perform set_config('request.jwt.claim.sub', accounts_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.operations_tasks
    set status = 'in_progress'
    where id = branch_a_task_id;

    get diagnostics rows_changed = row_count;
    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        70,
        'accounts_update_task_denied',
        'accounts',
        'update denied or zero rows changed',
        rows_changed || ' updated row(s)',
        rows_changed = 0,
        null
      );
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (70, 'accounts_update_task_denied', 'accounts', 'update denied or zero rows changed', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (70, 'accounts_update_task_denied', 'accounts', 'update denied or zero rows changed', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', accounts_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    insert into public.operations_task_events (task_id, event_type, comment)
    values (branch_a_task_id, 'comment', 'Accounts comment should be denied.');

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (80, 'accounts_comment_denied', 'accounts', 'event insert denied', 'insert succeeded', false, null);
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (80, 'accounts_comment_denied', 'accounts', 'event insert denied', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (80, 'accounts_comment_denied', 'accounts', 'event insert denied', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  -- 6. branch user can read/update/comment own branch task, but not other branch task.
  begin
    visible_count := 0;
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select count(*)
    into visible_count
    from public.operations_tasks
    where id = branch_a_task_id;

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (90, 'branch_read_own_task_allowed', 'branch', 'own branch task visible', visible_count || ' visible row(s)', visible_count = 1, null);
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (90, 'branch_read_own_task_allowed', 'branch', 'own branch task visible', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    visible_count := 0;
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select count(*)
    into visible_count
    from public.operations_tasks
    where id = branch_b_task_id;

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (100, 'branch_read_other_task_denied', 'branch', 'other branch task hidden', visible_count || ' visible row(s)', visible_count = 0, null);
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (100, 'branch_read_other_task_denied', 'branch', 'other branch task hidden', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (100, 'branch_read_other_task_denied', 'branch', 'other branch task hidden', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    rows_changed := 0;
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.operations_tasks
    set status = 'in_progress'
    where id = branch_a_task_id;

    get diagnostics rows_changed = row_count;

    insert into public.operations_task_events (task_id, event_type, comment)
    values (branch_a_task_id, 'comment', 'Branch own-task comment should be allowed.');

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (
        110,
        'branch_update_comment_own_task_allowed',
        'branch',
        'own branch status update and comment insert succeed',
        rows_changed || ' updated row(s)',
        rows_changed = 1,
        null
      );
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (110, 'branch_update_comment_own_task_allowed', 'branch', 'own branch status update and comment insert succeed', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    rows_changed := 0;
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.operations_tasks
    set status = 'in_progress'
    where id = branch_b_task_id;

    get diagnostics rows_changed = row_count;
    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (120, 'branch_update_other_task_denied', 'branch', 'other branch update denied or zero rows changed', rows_changed || ' updated row(s)', rows_changed = 0, null);
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (120, 'branch_update_other_task_denied', 'branch', 'other branch update denied or zero rows changed', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (120, 'branch_update_other_task_denied', 'branch', 'other branch update denied or zero rows changed', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.operations_tasks
    set priority = 'critical'
    where id = branch_a_task_id;

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (130, 'branch_priority_edit_denied', 'branch', 'metadata edit denied by trigger/RLS', 'update succeeded', false, null);
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          130,
          'branch_priority_edit_denied',
          'branch',
          'metadata edit denied by trigger/RLS',
          'error raised',
          true,
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  begin
    reopen_phase := 'resolve';
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.operations_tasks
    set status = 'resolved'
    where id = branch_a_task_id;

    reopen_phase := 'reopen';
    update public.operations_tasks
    set status = 'open'
    where id = branch_a_task_id;

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (140, 'branch_reopen_terminal_task_denied', 'branch', 'reopen denied', 'reopen succeeded', false, null);
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (
          140,
          'branch_reopen_terminal_task_denied',
          'branch',
          'own-task resolve succeeds, then reopen is denied',
          'error raised during ' || coalesce(reopen_phase, 'unknown phase'),
          reopen_phase = 'reopen',
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    insert into public.operations_task_events (task_id, event_type, new_status, comment)
    values (branch_a_task_id, 'created', 'resolved', 'Branch-created event should be denied.');

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (150, 'branch_created_event_denied', 'branch', 'created event denied for branch users', 'insert succeeded', false, null);
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (150, 'branch_created_event_denied', 'branch', 'created event denied for branch users', 'error raised', true, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    insert into public.operations_task_events (task_id, event_type, old_status, new_status, comment)
    values (branch_a_task_id, 'status_changed', 'open', 'dismissed', 'Mismatched status event should be denied.');

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (160, 'branch_status_event_mismatch_denied', 'branch', 'status event with mismatched new_status denied', 'insert succeeded', false, null);
  exception
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (160, 'branch_status_event_mismatch_denied', 'branch', 'status event with mismatched new_status denied', 'error raised', true, SQLSTATE || ': ' || SQLERRM);
  end;

  -- 7. operations_task_events is append-only for authenticated clients.
  begin
    perform set_config('request.jwt.claim.sub', manager_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    update public.operations_task_events
    set comment = 'This update should be denied.'
    where id = seed_event_id;

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (170, 'authenticated_update_event_denied', 'manager', 'event update denied', 'update succeeded', false, null);
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (170, 'authenticated_update_event_denied', 'manager', 'event update denied', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (170, 'authenticated_update_event_denied', 'manager', 'event update denied', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', manager_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    delete from public.operations_task_events
    where id = seed_event_id;

    reset role;

    insert into operations_task_rls_role_results
      (sort_order, test_name, role_under_test, expected, actual, passed, detail)
    values
      (180, 'authenticated_delete_event_denied', 'manager', 'event delete denied', 'delete succeeded', false, null);
  exception
    when insufficient_privilege then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (180, 'authenticated_delete_event_denied', 'manager', 'event delete denied', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into operations_task_rls_role_results
        (sort_order, test_name, role_under_test, expected, actual, passed, detail)
      values
        (180, 'authenticated_delete_event_denied', 'manager', 'event delete denied', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;
end $$;

select
  sort_order,
  test_name,
  role_under_test,
  expected,
  actual,
  passed,
  detail
from operations_task_rls_role_results
order by sort_order;

rollback;
