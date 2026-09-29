begin;

create or replace function public.prepare_spin_customer(
  p_token text,
  p_phone text,
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null
)
returns table (
  customer_id uuid,
  customer_phone text,
  customer_first_name text,
  customer_last_name text,
  customer_email text,
  customer_created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\\s+', '', 'g');
  v_customer public.customers%rowtype;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then
    raise exception 'SPIN_SESSION_UNAVAILABLE' using errcode = '22023';
  end if;

  if length(v_phone) < 6
    or length(v_phone) > 32
    or v_phone !~ '^\\+?[0-9]+$'
  then
    raise exception 'CUSTOMER_PHONE_INVALID' using errcode = '22023';
  end if;

  if length(coalesce(p_first_name, '')) > 120
    or length(coalesce(p_last_name, '')) > 120
    or length(coalesce(p_email, '')) > 320
  then
    raise exception 'CUSTOMER_DETAILS_INVALID' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_email, '')), '') is not null
    and btrim(p_email) !~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
  then
    raise exception 'CUSTOMER_EMAIL_INVALID' using errcode = '22023';
  end if;

  perform 1
  from public.spin_sessions s
  join public.branches b on b.id = s.branch_id
  where s.token = p_token
    and s.expires_at > v_now
    and (coalesce(s.is_multi_use, false) or not coalesce(s.used, false))
    and coalesce(b.is_spin_enabled, true)
    and coalesce((to_jsonb(b)->>'is_active')::boolean, true)
  limit 1;

  if not found then
    raise exception 'SPIN_SESSION_UNAVAILABLE' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('spin-customer:' || v_phone));

  select c.*
    into v_customer
  from public.customers c
  where c.phone = v_phone
  order by c.created_at asc
  limit 1
  for update;

  if v_customer.id is null then
    insert into public.customers (phone, first_name, last_name, email, created_at)
    values (
      v_phone,
      nullif(btrim(coalesce(p_first_name, '')), ''),
      nullif(btrim(coalesce(p_last_name, '')), ''),
      nullif(lower(btrim(coalesce(p_email, ''))), ''),
      v_now
    )
    returning * into v_customer;
  else
    update public.customers c
    set
      first_name = coalesce(nullif(btrim(coalesce(p_first_name, '')), ''), c.first_name),
      last_name = coalesce(nullif(btrim(coalesce(p_last_name, '')), ''), c.last_name),
      email = coalesce(nullif(lower(btrim(coalesce(p_email, ''))), ''), c.email)
    where c.id = v_customer.id
    returning c.* into v_customer;
  end if;

  return query
  select
    v_customer.id,
    v_customer.phone::text,
    v_customer.first_name::text,
    v_customer.last_name::text,
    v_customer.email::text,
    v_customer.created_at;
end;
$$;

revoke all on function public.prepare_spin_customer(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_spin_customer(text, text, text, text, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
