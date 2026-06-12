-- Spin & Win server-side fraud validation tests.
--
-- Run after applying:
-- supabase/migrations/20260612093000_spin_win_server_side_fraud_hardening.sql
--
-- Required setup:
-- - one active branch-role app_user_profiles row with branch_id;
-- - the branch has is_spin_enabled = true;
-- - at least one active spin_prizes row, or this script will create a
--   rollback-only test prize;
-- - trusted SQL/service-role execution that can SET ROLE.
--
-- Expected final result: every returned row has passed = true.

begin;

drop table if exists pg_temp.spin_win_fraud_test_results;
create temp table spin_win_fraud_test_results (
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
  branch_id uuid;
  token_one text;
  token_two text;
  spin_id uuid;
  voucher_code text;
  test_phone text := '+973' || floor(random() * 100000000)::bigint::text;
  result_count integer;
begin
  select p.user_id, p.branch_id
  into branch_user_id, branch_id
  from public.app_user_profiles p
  join public.branches b
    on b.id = p.branch_id
  where p.role = 'branch'
    and p.is_active
    and p.branch_id is not null
    and coalesce(b.is_spin_enabled, true)
  limit 1;

  if branch_user_id is null or branch_id is null then
    insert into spin_win_fraud_test_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        0,
        'setup',
        'active branch app user with spin enabled branch exists',
        'missing setup',
        false,
        'Provision an active branch user/profile and enable Spin & Win for its branch.'
      );
    return;
  end if;

  if not exists (
    select 1
    from public.spin_prizes p
    where p.is_active
      and p.probability_weight > 0
  ) then
    insert into public.spin_prizes (
      name,
      type,
      value,
      probability_weight,
      daily_limit,
      is_active,
      color,
      created_at
    )
    values (
      'Rollback Test Prize',
      'gift',
      0,
      100,
      0,
      true,
      '#B91C1C',
      now()
    );
  end if;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    perform *
    from public.generate_spin_session(branch_id, true);

    reset role;

    insert into spin_win_fraud_test_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (10, 'anon_generate_session_denied', 'anon cannot generate branch QR sessions', 'session generated', false, null);
  exception
    when insufficient_privilege then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (10, 'anon_generate_session_denied', 'anon cannot generate branch QR sessions', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (10, 'anon_generate_session_denied', 'anon cannot generate branch QR sessions', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select out_token
  into token_one
  from public.generate_spin_session(branch_id, true);

  select out_token
  into token_two
  from public.generate_spin_session(branch_id, true);

  reset role;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    select count(*)
    into result_count
    from public.validate_spin_token(token_one)
    where out_is_valid;

    reset role;

    insert into spin_win_fraud_test_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        20,
        'anon_validate_token_allowed',
        'customer token validation works without authentication',
        result_count || ' valid row(s)',
        result_count = 1,
        null
      );
  exception
    when others then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (20, 'anon_validate_token_allowed', 'customer token validation works without authentication', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    select r.spin_id, r.voucher_code
    into spin_id, voucher_code
    from public.execute_spin_transaction(
      token_one,
      test_phone,
      'Fraud',
      'Tester',
      'fraud-test@example.invalid',
      '198.51.100.10'
    ) r;

    reset role;

    insert into spin_win_fraud_test_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        30,
        'anon_execute_valid_token_allowed',
        'customer can execute one valid token without auth',
        case when spin_id is null then 'no spin id' else 'spin created' end,
        spin_id is not null and voucher_code is not null,
        voucher_code
      );
  exception
    when others then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (30, 'anon_execute_valid_token_allowed', 'customer can execute one valid token without auth', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    perform *
    from public.execute_spin_transaction(
      token_two,
      test_phone,
      'Fraud',
      'Tester',
      'fraud-test@example.invalid',
      '203.0.113.55'
    );

    reset role;

    insert into spin_win_fraud_test_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (
        40,
        'double_spin_same_customer_denied',
        'same customer phone cannot spin twice in one server-side day, regardless of client IP',
        'second spin succeeded',
        false,
        null
      );
  exception
    when others then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (
          40,
          'double_spin_same_customer_denied',
          'same customer phone cannot spin twice in one server-side day, regardless of client IP',
          'error raised',
          SQLERRM like '%SPIN_DAILY_LIMIT_REACHED%',
          SQLSTATE || ': ' || SQLERRM
        );
  end;

  begin
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    set local role anon;

    perform *
    from public.redeem_spin_voucher(spin_id, branch_id);

    reset role;

    insert into spin_win_fraud_test_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (50, 'anon_redeem_voucher_denied', 'anon cannot redeem vouchers', 'redeem succeeded', false, null);
  exception
    when insufficient_privilege then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (50, 'anon_redeem_voucher_denied', 'anon cannot redeem vouchers', 'permission denied', true, SQLSTATE || ': ' || SQLERRM);
    when others then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (50, 'anon_redeem_voucher_denied', 'anon cannot redeem vouchers', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    perform *
    from public.redeem_spin_voucher(spin_id, branch_id);

    reset role;

    insert into spin_win_fraud_test_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (60, 'first_voucher_redeem_allowed', 'branch user can redeem valid unredeemed voucher once', 'redeem succeeded', true, voucher_code);
  exception
    when others then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (60, 'first_voucher_redeem_allowed', 'branch user can redeem valid unredeemed voucher once', 'unexpected error', false, SQLSTATE || ': ' || SQLERRM);
  end;

  begin
    perform set_config('request.jwt.claim.sub', branch_user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    perform *
    from public.redeem_spin_voucher(spin_id, branch_id);

    reset role;

    insert into spin_win_fraud_test_results
      (sort_order, test_name, expected, actual, passed, detail)
    values
      (70, 'double_voucher_redeem_denied', 'same voucher cannot be redeemed twice', 'second redeem succeeded', false, null);
  exception
    when others then
      reset role;
      insert into spin_win_fraud_test_results
        (sort_order, test_name, expected, actual, passed, detail)
      values
        (
          70,
          'double_voucher_redeem_denied',
          'same voucher cannot be redeemed twice',
          'error raised',
          SQLERRM like '%VOUCHER_ALREADY_REDEEMED%',
          SQLSTATE || ': ' || SQLERRM
        );
  end;
end $$;

select
  sort_order,
  test_name,
  expected,
  actual,
  passed,
  detail
from spin_win_fraud_test_results
order by sort_order;

rollback;
