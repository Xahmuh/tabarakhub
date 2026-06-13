-- Spin & Win static QR security checks.
--
-- Run after applying:
-- supabase/migrations/20260612093000_spin_win_server_side_fraud_hardening.sql
-- supabase/migrations/20260612213000_public_spin_node_token_exchange.sql
--
-- Required real-project setup:
-- - at least one branch with code and is_spin_enabled = true;
-- - optionally one branch with is_spin_enabled = false for disabled-branch denial;
-- - at least one active spin_prizes row if running the single-use execution check;
-- - trusted SQL execution that can SET ROLE and ROLLBACK.
--
-- Expected final result: every returned row has passed = true, except rows with
-- actual = 'pending setup' where the setup prerequisite is intentionally absent.

begin;

drop table if exists pg_temp.spin_static_qr_security_results;
create temp table spin_static_qr_security_results (
  sort_order integer primary key,
  test_name text not null,
  expected text not null,
  actual text not null,
  passed boolean not null,
  detail text
);

do $$
declare
  function_def text;
  enabled_code text;
  disabled_code text;
  generated_token text;
  expired_token text;
  rate_limited_token text;
  enabled_branch_id uuid;
  spin_id uuid;
  voucher_code text;
  validation_count integer;
  grant_count integer;
begin
  select pg_get_functiondef('public.generate_spin_session_from_branch_code(text)'::regprocedure)
  into function_def;

  insert into spin_static_qr_security_results
    (sort_order, test_name, expected, actual, passed, detail)
  values
    (
      10,
      'rpc_exists',
      'generate_spin_session_from_branch_code(text) exists',
      case when function_def is null then 'missing' else 'exists' end,
      function_def is not null,
      null
    );

  select count(*)
  into grant_count
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'generate_spin_session_from_branch_code'
    and grantee in ('anon', 'authenticated', 'service_role')
    and privilege_type = 'EXECUTE';

  insert into spin_static_qr_security_results
    (sort_order, test_name, expected, actual, passed, detail)
  values
    (20, 'rpc_execute_grants', 'anon/authenticated/service_role can execute the exchange RPC', grant_count::text || ' grant(s)', grant_count >= 3, null);

  insert into spin_static_qr_security_results
    (sort_order, test_name, expected, actual, passed, detail)
  values
    (
      30,
      'rpc_uses_branch_code',
      'function body uses public.branches.code and does not return branch UUID',
      case
        when function_def ilike '%branches b%' and function_def ilike '%b.code%' and function_def not ilike '%out_branch_id%' then 'code-based/no branch UUID output'
        else 'check failed'
      end,
      function_def ilike '%branches b%' and function_def ilike '%b.code%' and function_def not ilike '%out_branch_id%',
      null
    );

  select b.code, b.id
  into enabled_code, enabled_branch_id
  from public.branches b
  where nullif(btrim(coalesce(b.code, '')), '') is not null
    and coalesce(b.is_spin_enabled, true)
    and coalesce((to_jsonb(b)->>'is_active')::boolean, true)
  order by b.code
  limit 1;

  if enabled_code is null then
    insert into spin_static_qr_security_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (40, 'setup_enabled_branch', 'one enabled branch with code exists', 'pending setup', false, 'Create or enable a branch before running functional static QR checks.');
    return;
  end if;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    select out_token
    into generated_token
    from public.generate_spin_session_from_branch_code(enabled_code);

    reset role;

    insert into spin_static_qr_security_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        50,
        'anon_node_exchange_allowed',
        'anon can exchange a valid branch code for a token',
        case when generated_token like 'spin_%' then 'spin token generated' else coalesce(generated_token, 'no token') end,
        generated_token like 'spin_%',
        enabled_code
      );
  exception
    when others then
      reset role;
      insert into spin_static_qr_security_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (50, 'anon_node_exchange_allowed', 'anon can exchange a valid branch code for a token', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  insert into spin_static_qr_security_results
    (sort_order, test_name, expected, actual, passed, detail)
  select
    60,
    'generated_token_lifecycle',
    'generated token is single-use, branch-bound, and expires within 10 minutes',
    case
      when coalesce(s.is_multi_use, true) = false
        and coalesce(s.used, false) = false
        and s.branch_id = enabled_branch_id
        and s.expires_at > now()
        and s.expires_at <= now() + interval '11 minutes'
      then 'valid lifecycle'
      else 'unexpected lifecycle'
    end,
    coalesce(s.is_multi_use, true) = false
      and coalesce(s.used, false) = false
      and s.branch_id = enabled_branch_id
      and s.expires_at > now()
      and s.expires_at <= now() + interval '11 minutes',
    s.expires_at::text
  from public.spin_sessions s
  where s.token = generated_token;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    select count(*)
    into validation_count
    from public.validate_spin_token(generated_token)
    where out_is_valid;

    reset role;

    insert into spin_static_qr_security_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (70, 'generated_token_validates', 'generated token validates through validate_spin_token', validation_count::text || ' valid row(s)', validation_count = 1, null);
  exception
    when others then
      reset role;
      insert into spin_static_qr_security_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (70, 'generated_token_validates', 'generated token validates through validate_spin_token', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    perform *
    from public.generate_spin_session_from_branch_code('not-a-real-branch-code');

    reset role;

    insert into spin_static_qr_security_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (80, 'invalid_code_denied_generic', 'invalid code is rejected with generic error', 'exchange succeeded', false, null);
  exception
    when others then
      reset role;
      insert into spin_static_qr_security_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (80, 'invalid_code_denied_generic', 'invalid code is rejected with generic error', 'error raised', SQLERRM like '%SPIN_QR_UNAVAILABLE%', SQLSTATE || ': ' || SQLERRM);
  end;

  select b.code
  into disabled_code
  from public.branches b
  where nullif(btrim(coalesce(b.code, '')), '') is not null
    and not coalesce(b.is_spin_enabled, true)
  order by b.code
  limit 1;

  if disabled_code is null then
    insert into spin_static_qr_security_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (90, 'disabled_branch_denied_generic', 'spin-disabled branch is rejected with generic error', 'pending setup', false, 'Create or temporarily disable a branch inside this rollback transaction to test.');
  else
    begin
      perform set_config('request.jwt.claim.sub', '', true);
      perform set_config('request.jwt.claim.role', 'anon', true);
      set local role anon;

      perform *
      from public.generate_spin_session_from_branch_code(disabled_code);

      reset role;

      insert into spin_static_qr_security_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (90, 'disabled_branch_denied_generic', 'spin-disabled branch is rejected with generic error', 'exchange succeeded', false, disabled_code);
    exception
      when others then
        reset role;
        insert into spin_static_qr_security_results
          (sort_order, test_name, expected, actual, passed, detail)
        values
          (90, 'disabled_branch_denied_generic', 'spin-disabled branch is rejected with generic error', 'error raised', SQLERRM like '%SPIN_QR_UNAVAILABLE%', SQLSTATE || ': ' || SQLERRM);
    end;
  end if;

  select out_token
  into expired_token
  from public.generate_spin_session_from_branch_code(enabled_code);

  update public.spin_sessions
  set expires_at = now() - interval '1 minute'
  where token = expired_token;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    select count(*)
    into validation_count
    from public.validate_spin_token(expired_token)
    where out_is_valid;

    reset role;

    insert into spin_static_qr_security_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (100, 'expired_token_fails_validation', 'expired generated token fails validation', validation_count::text || ' valid row(s)', validation_count = 0, null);
  exception
    when others then
      reset role;
      insert into spin_static_qr_security_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (100, 'expired_token_fails_validation', 'unexpected error', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  if exists (
    select 1
    from public.spin_prizes p
    where p.is_active
      and p.probability_weight > 0
  ) then
    begin
      perform set_config('request.jwt.claim.sub', '', true);
      perform set_config('request.jwt.claim.role', 'anon', true);
      set local role anon;

      select r.spin_id, r.voucher_code
      into spin_id, voucher_code
      from public.execute_spin_transaction(
        generated_token,
        '+973' || (90000000 + floor(random() * 999999)::bigint)::text,
        'Static',
        'QR',
        'static-qr-test@example.invalid',
        null
      ) r;

      reset role;

      insert into spin_static_qr_security_results
        (sort_order, test_name, expected, actual, passed, detail)
      select
        110,
        'single_use_consumed_on_spin',
        'single-use static token is consumed by execute_spin_transaction',
        case when coalesce(s.used, false) then 'used' else 'not used' end,
        coalesce(s.used, false) and spin_id is not null and voucher_code is not null,
        voucher_code
      from public.spin_sessions s
      where s.token = generated_token;
    exception
      when others then
        reset role;
        insert into spin_static_qr_security_results
          (sort_order, test_name, expected, actual, passed, detail)
        values
          (110, 'single_use_consumed_on_spin', 'single-use static token is consumed by execute_spin_transaction', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
    end;
  else
    insert into spin_static_qr_security_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (110, 'single_use_consumed_on_spin', 'single-use static token is consumed by execute_spin_transaction', 'pending setup', false, 'Add one active spin_prizes row to run this check.');
  end if;

  for i in 1..60 loop
    insert into public.spin_sessions (
      token,
      branch_id,
      used,
      is_multi_use,
      expires_at,
      created_at
    )
    values (
      'static_rate_test_' || i || '_' || replace(gen_random_uuid()::text, '-', ''),
      enabled_branch_id,
      false,
      false,
      now() + interval '10 minutes',
      now()
    );
  end loop;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    select out_token
    into rate_limited_token
    from public.generate_spin_session_from_branch_code(enabled_code);

    reset role;

    insert into spin_static_qr_security_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (120, 'branch_session_rate_limit', 'excessive repeated exchange is rejected server-side', 'token generated', false, rate_limited_token);
  exception
    when others then
      reset role;
      insert into spin_static_qr_security_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (120, 'branch_session_rate_limit', 'excessive repeated exchange is rejected server-side', 'error raised', SQLERRM like '%SPIN_QR_UNAVAILABLE%', SQLSTATE || ': ' || SQLERRM);
  end;
end $$;

select *
from spin_static_qr_security_results
order by sort_order;

rollback;
