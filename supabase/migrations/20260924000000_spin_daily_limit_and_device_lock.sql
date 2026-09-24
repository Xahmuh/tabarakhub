-- 1. Add device_fingerprint column to public.spins if not exists
alter table public.spins
  add column if not exists device_fingerprint text null;

create index if not exists spins_device_fingerprint_created_at_idx
  on public.spins(device_fingerprint, created_at desc);

-- 2. Create spin_settings table
create table if not exists public.spin_settings (
  id text primary key default 'global',
  daily_spins_per_mobile integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.spin_settings (id, daily_spins_per_mobile)
values ('global', 1)
on conflict (id) do nothing;

alter table public.spin_settings enable row level security;

drop policy if exists "spin_settings_select_all" on public.spin_settings;
create policy "spin_settings_select_all" on public.spin_settings
  for select using (true);

drop policy if exists "spin_settings_modify_auth" on public.spin_settings;
create policy "spin_settings_modify_auth" on public.spin_settings
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.spin_settings to anon, authenticated, service_role;
grant all on public.spin_settings to authenticated, service_role;

-- 3. Replace execute_spin_transaction to enforce dynamic daily limit by phone and by device
drop function if exists public.execute_spin_transaction(text, text, text, text, text, text, text);
drop function if exists public.execute_spin_transaction(text, text, text, text, text, text);
drop function if exists public.execute_spin_transaction(text, text, text, text, text);

create or replace function public.execute_spin_transaction(
  p_token text,
  p_phone text,
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null,
  p_ip_address text default null,
  p_device_fingerprint text default null
)
returns table (
  spin_id uuid,
  voucher_code text,
  prize_id uuid,
  prize_name text,
  prize_type text,
  prize_value numeric
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
  v_prize_value numeric;
  v_prize_daily_limit integer;
  v_voucher_code text;
  v_spin_id uuid;
  v_device_fingerprint text;
  v_daily_spins_limit integer;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');
  v_device_fingerprint := nullif(btrim(coalesce(p_device_fingerprint, '')), '');

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

  -- Read configured daily spins limit from spin_settings (default: 1)
  select coalesce(daily_spins_per_mobile, 1)
  into v_daily_spins_limit
  from public.spin_settings
  where id = 'global';

  if v_daily_spins_limit is null or v_daily_spins_limit < 1 then
    v_daily_spins_limit := 1;
  end if;

  -- 1. Check daily limit by phone number
  if (
    select count(*)
    from public.spins s
    join public.customers c
      on c.id = s.customer_id
    where c.phone = v_phone
      and s.created_at >= date_trunc('day', v_now)
      and s.created_at < date_trunc('day', v_now) + interval '1 day'
  ) >= v_daily_spins_limit then
    raise exception 'SPIN_DAILY_LIMIT_REACHED';
  end if;

  -- 2. Check daily limit by device fingerprint (if supplied)
  if v_device_fingerprint is not null and (
    select count(*)
    from public.spins s
    where s.device_fingerprint = v_device_fingerprint
      and s.created_at >= date_trunc('day', v_now)
      and s.created_at < date_trunc('day', v_now) + interval '1 day'
  ) >= v_daily_spins_limit then
    raise exception 'SPIN_DEVICE_DAILY_LIMIT_REACHED';
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
      coalesce(p.value, 0) as value,
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
  select id, name, type, value, daily_limit
  into v_prize_id, v_prize_name, v_prize_type, v_prize_value, v_prize_daily_limit
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
    device_fingerprint,
    created_at
  )
  values (
    v_customer_id,
    v_session.branch_id,
    v_prize_id,
    v_voucher_code,
    v_device_fingerprint,
    v_now
  )
  returning id into v_spin_id;

  if not v_session.is_multi_use then
    update public.spin_sessions
    set used = true
    where token = p_token;
  end if;

  return query select v_spin_id, v_voucher_code, v_prize_id, v_prize_name, v_prize_type, coalesce(v_prize_value, 0::numeric);
end;
$$;

revoke all on function public.execute_spin_transaction(text, text, text, text, text, text, text) from public;
grant execute on function public.execute_spin_transaction(text, text, text, text, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
