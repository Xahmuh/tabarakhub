-- Spin & Win server-side fraud hardening.
-- Dedicated-client model only: no tenant tables, no organization_id.
--
-- Security rules enforced here:
-- - branch/admin/manager sessions generate QR tokens from authenticated app users only;
-- - customer token validation and spin execution are public customer RPCs, but every
--   limit is computed from trusted database state;
-- - p_ip_address remains accepted for backwards-compatible RPC calls but is not
--   trusted for fraud or rate-limit decisions;
-- - one reward spin is allowed per customer phone per UTC day;
-- - single-use tokens are consumed atomically during the spin transaction;
-- - voucher redemption is atomic and cannot be repeated.

drop function if exists public.generate_spin_session(uuid, boolean);
drop function if exists public.validate_spin_token(text);
drop function if exists public.execute_spin_transaction(text, text, text, text, text, text);
drop function if exists public.redeem_spin_voucher(uuid, uuid);

create or replace function public.generate_spin_session(
  p_branch_id uuid,
  p_is_multi_use boolean default false
)
returns table (
  out_token text,
  out_expires_at timestamptz,
  out_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_now timestamptz := now();
  v_expires_at timestamptz;
  v_branch_enabled boolean;
begin
  if p_branch_id is null then
    raise exception 'BRANCH_REQUIRED';
  end if;

  if auth.uid() is null
    or not (
      public.current_app_can_manage()
      or (
        public.current_app_role() = 'branch'
        and public.current_app_branch_id() = p_branch_id
      )
    )
  then
    raise exception 'SPIN_SESSION_NOT_ALLOWED' using errcode = '42501';
  end if;

  select coalesce(b.is_spin_enabled, true)
  into v_branch_enabled
  from public.branches b
  where b.id = p_branch_id;

  if not found then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  if not v_branch_enabled then
    raise exception 'SPIN_DISABLED_FOR_BRANCH';
  end if;

  v_expires_at := v_now + case
    when coalesce(p_is_multi_use, false) then interval '7 days'
    else interval '10 minutes'
  end;

  loop
    v_token := 'spin_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    exit when not exists (
      select 1
      from public.spin_sessions s
      where s.token = v_token
    );
  end loop;

  insert into public.spin_sessions (
    token,
    branch_id,
    used,
    is_multi_use,
    expires_at,
    created_at
  )
  values (
    v_token,
    p_branch_id,
    false,
    coalesce(p_is_multi_use, false),
    v_expires_at,
    v_now
  );

  return query select v_token, v_expires_at, v_now;
end;
$$;

create or replace function public.validate_spin_token(p_token text)
returns table (
  out_is_valid boolean,
  out_error_message text,
  out_branch_id uuid,
  out_branch_name text,
  out_is_multi_use boolean,
  out_google_maps_link text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then
    return query select false, 'TOKEN_REQUIRED', null::uuid, null::text, false, null::text;
    return;
  end if;

  select
    s.branch_id,
    coalesce(s.used, false) as used,
    coalesce(s.is_multi_use, false) as is_multi_use,
    s.expires_at,
    b.name as branch_name,
    b.google_maps_link,
    coalesce(b.is_spin_enabled, true) as branch_enabled
  into v_session
  from public.spin_sessions s
  join public.branches b
    on b.id = s.branch_id
  where s.token = p_token
  limit 1;

  if not found then
    return query select false, 'TOKEN_NOT_FOUND', null::uuid, null::text, false, null::text;
    return;
  end if;

  if not v_session.branch_enabled then
    return query select false, 'SPIN_DISABLED_FOR_BRANCH', v_session.branch_id, v_session.branch_name, v_session.is_multi_use, v_session.google_maps_link;
    return;
  end if;

  if v_session.expires_at <= now() then
    return query select false, 'TOKEN_EXPIRED', v_session.branch_id, v_session.branch_name, v_session.is_multi_use, v_session.google_maps_link;
    return;
  end if;

  if not v_session.is_multi_use and v_session.used then
    return query select false, 'TOKEN_INVALID_OR_USED', v_session.branch_id, v_session.branch_name, v_session.is_multi_use, v_session.google_maps_link;
    return;
  end if;

  return query select true, null::text, v_session.branch_id, v_session.branch_name, v_session.is_multi_use, v_session.google_maps_link;
end;
$$;

create or replace function public.execute_spin_transaction(
  p_token text,
  p_phone text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_ip_address text default null
)
returns table (
  spin_id uuid,
  voucher_code text,
  prize_id uuid,
  prize_name text,
  prize_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_customer_id uuid;
  v_phone text;
  v_now timestamptz := now();
  v_weight_total numeric;
  v_roll numeric;
  v_prize_id uuid;
  v_prize_name text;
  v_prize_type text;
  v_prize_daily_limit integer;
  v_voucher_code text;
  v_spin_id uuid;
begin
  -- p_ip_address is intentionally ignored for security decisions. Rate limits
  -- are based on persisted customer/spin data only.
  v_phone := regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');

  if nullif(trim(coalesce(p_token, '')), '') is null then
    raise exception 'TOKEN_REQUIRED';
  end if;

  if length(v_phone) < 6 then
    raise exception 'CUSTOMER_PHONE_REQUIRED';
  end if;

  select
    s.token,
    s.branch_id,
    coalesce(s.used, false) as used,
    coalesce(s.is_multi_use, false) as is_multi_use,
    s.expires_at,
    coalesce(b.is_spin_enabled, true) as branch_enabled
  into v_session
  from public.spin_sessions s
  join public.branches b
    on b.id = s.branch_id
  where s.token = p_token
  for update of s;

  if not found then
    raise exception 'TOKEN_NOT_FOUND';
  end if;

  if not v_session.branch_enabled then
    raise exception 'SPIN_DISABLED_FOR_BRANCH';
  end if;

  if v_session.expires_at <= v_now then
    raise exception 'TOKEN_EXPIRED';
  end if;

  if not v_session.is_multi_use and v_session.used then
    raise exception 'TOKEN_INVALID_OR_USED';
  end if;

  perform pg_advisory_xact_lock(hashtext('spin-win-phone:' || v_phone));

  select c.id
  into v_customer_id
  from public.customers c
  where c.phone = v_phone
  order by c.created_at asc
  limit 1
  for update;

  if v_customer_id is null then
    insert into public.customers (
      phone,
      first_name,
      last_name,
      email,
      created_at
    )
    values (
      v_phone,
      nullif(trim(coalesce(p_first_name, '')), ''),
      nullif(trim(coalesce(p_last_name, '')), ''),
      nullif(trim(coalesce(p_email, '')), ''),
      v_now
    )
    returning id into v_customer_id;
  else
    update public.customers
    set
      first_name = coalesce(nullif(trim(coalesce(p_first_name, '')), ''), first_name),
      last_name = coalesce(nullif(trim(coalesce(p_last_name, '')), ''), last_name),
      email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email)
    where id = v_customer_id;
  end if;

  if exists (
    select 1
    from public.spins s
    join public.customers c
      on c.id = s.customer_id
    where c.phone = v_phone
      and s.created_at >= date_trunc('day', v_now)
      and s.created_at < date_trunc('day', v_now) + interval '1 day'
  ) then
    raise exception 'SPIN_DAILY_LIMIT_REACHED';
  end if;

  select sum(greatest(p.probability_weight, 0))
  into v_weight_total
  from public.spin_prizes p
  where p.is_active
    and greatest(p.probability_weight, 0) > 0
    and (
      p.daily_limit is null
      or p.daily_limit <= 0
      or (
        select count(*)
        from public.spins s
        where s.prize_id = p.id
          and s.created_at >= date_trunc('day', v_now)
          and s.created_at < date_trunc('day', v_now) + interval '1 day'
      ) < p.daily_limit
    );

  if coalesce(v_weight_total, 0) <= 0 then
    raise exception 'NO_PRIZES_CONFIGURED';
  end if;

  v_roll := random() * v_weight_total;

  with eligible as (
    select
      p.id,
      p.name,
      p.type,
      p.daily_limit,
      greatest(p.probability_weight, 0) as weight
    from public.spin_prizes p
    where p.is_active
      and greatest(p.probability_weight, 0) > 0
      and (
        p.daily_limit is null
        or p.daily_limit <= 0
        or (
          select count(*)
          from public.spins s
          where s.prize_id = p.id
            and s.created_at >= date_trunc('day', v_now)
            and s.created_at < date_trunc('day', v_now) + interval '1 day'
        ) < p.daily_limit
      )
  ),
  ranked as (
    select
      e.*,
      sum(e.weight) over (order by e.id) as cumulative_weight
    from eligible e
  )
  select id, name, type, daily_limit
  into v_prize_id, v_prize_name, v_prize_type, v_prize_daily_limit
  from ranked
  where cumulative_weight >= v_roll
  order by cumulative_weight
  limit 1;

  if v_prize_id is null then
    raise exception 'NO_PRIZES_CONFIGURED';
  end if;

  perform 1
  from public.spin_prizes p
  where p.id = v_prize_id
  for update;

  if coalesce(v_prize_daily_limit, 0) > 0
    and (
      select count(*)
      from public.spins s
      where s.prize_id = v_prize_id
        and s.created_at >= date_trunc('day', v_now)
        and s.created_at < date_trunc('day', v_now) + interval '1 day'
    ) >= v_prize_daily_limit
  then
    raise exception 'PRIZE_DAILY_LIMIT_REACHED';
  end if;

  loop
    v_voucher_code := 'VOUCH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1
      from public.spins s
      where s.voucher_code = v_voucher_code
    );
  end loop;

  insert into public.spins (
    customer_id,
    branch_id,
    prize_id,
    voucher_code,
    created_at
  )
  values (
    v_customer_id,
    v_session.branch_id,
    v_prize_id,
    v_voucher_code,
    v_now
  )
  returning id into v_spin_id;

  if not v_session.is_multi_use then
    update public.spin_sessions
    set used = true
    where token = p_token;
  end if;

  return query select v_spin_id, v_voucher_code, v_prize_id, v_prize_name, v_prize_type;
end;
$$;

create or replace function public.redeem_spin_voucher(
  p_spin_id uuid,
  p_branch_id uuid
)
returns table (
  out_spin_id uuid,
  out_redeemed_at timestamptz,
  out_redeemed_branch_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spin record;
  v_now timestamptz := now();
begin
  if auth.uid() is null
    or not (
      public.current_app_can_manage()
      or (
        public.current_app_role() = 'branch'
        and public.current_app_branch_id() = p_branch_id
      )
    )
  then
    raise exception 'VOUCHER_REDEEM_NOT_ALLOWED' using errcode = '42501';
  end if;

  if p_spin_id is null or p_branch_id is null then
    raise exception 'VOUCHER_REDEEM_INPUT_REQUIRED';
  end if;

  select s.id, s.created_at, s.redeemed_at
  into v_spin
  from public.spins s
  where s.id = p_spin_id
  for update;

  if not found then
    raise exception 'VOUCHER_NOT_FOUND';
  end if;

  if v_spin.redeemed_at is not null then
    raise exception 'VOUCHER_ALREADY_REDEEMED';
  end if;

  if v_spin.created_at + interval '7 days' < v_now then
    raise exception 'VOUCHER_EXPIRED';
  end if;

  update public.spins
  set
    redeemed_at = v_now,
    redeemed_branch_id = p_branch_id
  where id = p_spin_id
  returning id, redeemed_at, redeemed_branch_id
  into out_spin_id, out_redeemed_at, out_redeemed_branch_id;

  return next;
end;
$$;

revoke all on function public.generate_spin_session(uuid, boolean) from public;
revoke all on function public.validate_spin_token(text) from public;
revoke all on function public.execute_spin_transaction(text, text, text, text, text, text) from public;
revoke all on function public.redeem_spin_voucher(uuid, uuid) from public;

grant execute on function public.generate_spin_session(uuid, boolean) to authenticated, service_role;
grant execute on function public.validate_spin_token(text) to anon, authenticated, service_role;
grant execute on function public.execute_spin_transaction(text, text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.redeem_spin_voucher(uuid, uuid) to authenticated, service_role;

revoke insert, update, delete on table public.spins from anon, authenticated;
revoke all privileges on table public.spin_sessions from anon, authenticated;
grant select on table public.spins to authenticated;
grant all privileges on table public.spins to service_role;
grant all privileges on table public.spin_sessions to service_role;

notify pgrst, 'reload schema';
