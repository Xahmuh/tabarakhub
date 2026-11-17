-- Private order snapshots keep the customer's phone and address out of operational reads.
create schema if not exists delivery_customers_private;
revoke all on schema delivery_customers_private from public, anon, authenticated;

create function delivery_customers_private.normalize_phone(p_phone text)
returns text language sql immutable strict set search_path = '' as $$
  with input as (
    select translate(btrim(p_phone), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789') as raw
  ), cleaned as (
    select regexp_replace(raw, '[[:space:]().-]', '', 'g') as phone from input
  ), international as (
    select case
      when phone ~ '^[0-9]{8}$' then '+973' || phone
      when phone ~ '^973[0-9]{8}$' then '+' || phone
      when phone like '00%' then '+' || substr(phone, 3)
      else phone
    end as phone from cleaned
  )
  select case
    when phone ~ '^\+[1-9][0-9]{6,14}$'
      and (phone not like '+973%' or phone ~ '^\+973[0-9]{8}$')
    then phone end from international;
$$;

create table delivery_customers_private.order_contacts (
  order_id uuid primary key references public.delivery_orders(id) on delete cascade,
  phone text not null check (phone is not distinct from delivery_customers_private.normalize_phone(phone)),
  block_number text,
  area_name text,
  governorate text,
  location_url text,
  customer_address text
);
alter table delivery_customers_private.order_contacts enable row level security;
revoke all on table delivery_customers_private.order_contacts from public, anon, authenticated;
create index order_contacts_phone_idx on delivery_customers_private.order_contacts (phone, order_id);

insert into delivery_customers_private.order_contacts
  (order_id, phone, block_number, area_name, governorate, location_url, customer_address)
select o.id, normalized.phone, o.block_number, o.area_name, o.governorate::text,
  nullif(btrim(d.location_url), ''), nullif(btrim(d.customer_address), '')
from public.delivery_driver_order_destinations d
join public.delivery_orders o on o.id = d.order_id
cross join lateral (select delivery_customers_private.normalize_phone(d.customer_phone) as phone) normalized
where normalized.phone is not null
  and o.order_kind is distinct from 'internal_transfer'
on conflict (order_id) do nothing;

insert into public.role_permissions (role, feature_name, access_level)
values ('branch', 'delivery:customers_log', 'read')
on conflict (role, feature_name) do nothing;

create function delivery_customers_private.branch_feature(p_feature text)
returns text language sql stable set search_path = '' as $$
  select coalesce(
    (select access_level from public.app_user_feature_permissions
      where user_id = auth.uid() and feature_name = p_feature),
    (select access_level from public.feature_permissions
      where branch_id = public.current_app_branch_id() and feature_name = p_feature),
    (select access_level from public.role_permissions
      where role = 'branch' and feature_name = p_feature),
    'none'
  );
$$;

create function delivery_customers_private.scope_branch(p_branch_id uuid, p_recording boolean)
returns uuid language plpgsql stable set search_path = '' as $$
declare
  v_branch_id uuid := public.current_app_branch_id();
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not p_recording and public.current_app_is_admin() then
    if p_branch_id is not null and not public.current_app_can_access_branch(p_branch_id) then
      raise exception 'Branch is unavailable' using errcode = '42501';
    end if;
    return p_branch_id;
  end if;

  if public.current_app_role() is distinct from 'branch'
    or v_branch_id is null or not public.current_app_can_access_branch(v_branch_id)
    or (p_branch_id is not null and p_branch_id is distinct from v_branch_id)
    or (p_recording and p_branch_id is null)
    or (p_recording and delivery_customers_private.branch_feature('delivery') <> 'edit')
    or (not p_recording and (
      delivery_customers_private.branch_feature('delivery') not in ('read', 'edit')
      or delivery_customers_private.branch_feature('delivery:customers_log') not in ('read', 'edit')
    ))
  then
    raise exception 'Customer records are unavailable' using errcode = '42501';
  end if;
  return v_branch_id;
end;
$$;

create view delivery_customers_private.visible_contacts with (security_invoker = true) as
select c.*, o.branch_id, o.order_date, o.created_at
from delivery_customers_private.order_contacts c
join public.delivery_orders o on o.id = c.order_id
where o.deleted_at is null
  and coalesce(o.cancelled_reason, '') not like 'Recorded only void:%'
  and not exists (select 1 from public.delivery_recording_voids v where v.order_id = o.id);

create function delivery_customers_private.addresses(p_phone text, p_branch_id uuid)
returns table (block_number text, area_name text, governorate text, location_url text, customer_address text)
language sql stable set search_path = '' as $$
  select a.block_number, a.area_name, a.governorate, a.location_url, a.customer_address
  from (
    select distinct on (c.block_number, c.location_url, lower(c.customer_address))
      c.block_number, c.area_name, c.governorate, c.location_url, c.customer_address, c.order_date, c.created_at, c.order_id
    from delivery_customers_private.visible_contacts c
    where c.phone = p_phone and (p_branch_id is null or c.branch_id = p_branch_id)
      and (c.block_number is not null or c.location_url is not null or c.customer_address is not null)
    order by c.block_number, c.location_url, lower(c.customer_address), c.order_date desc, c.created_at desc, c.order_id desc
  ) a
  order by a.order_date desc, a.created_at desc, a.order_id desc;
$$;

create function public.app_delivery_lookup_customer_addresses(p_branch_id uuid, p_phone text)
returns table (block_number text, area_name text, governorate text, location_url text, customer_address text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := delivery_customers_private.scope_branch(p_branch_id, true);
  v_phone text := delivery_customers_private.normalize_phone(p_phone);
begin
  if v_phone is null then raise exception 'Enter a valid phone number' using errcode = '22023'; end if;
  return query select * from delivery_customers_private.addresses(v_phone, v_branch);
end;
$$;

create function public.app_delivery_list_customers(p_branch_id uuid, p_search text, p_offset integer)
returns table (phone text, address_count integer, order_count integer, last_order_date date)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := delivery_customers_private.scope_branch(p_branch_id, false);
  v_search text := delivery_customers_private.normalize_phone(p_search);
begin
  if nullif(btrim(p_search), '') is not null and v_search is null then
    raise exception 'Enter a full customer phone number' using errcode = '22023';
  end if;
  return query
    select c.phone,
      count(distinct (c.block_number, c.location_url, lower(c.customer_address)))
        filter (where c.block_number is not null or c.location_url is not null or c.customer_address is not null)::integer,
      count(*)::integer, max(c.order_date)
    from delivery_customers_private.visible_contacts c
    where (v_branch is null or c.branch_id = v_branch) and (v_search is null or c.phone = v_search)
    group by c.phone
    order by max(c.order_date) desc, max(c.created_at) desc, c.phone
    limit 11 offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Only complete the final digit of an almost-complete Bahrain number.
create function public.app_delivery_suggest_customer_numbers(p_branch_id uuid, p_prefix text)
returns table (last_digit text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := delivery_customers_private.scope_branch(p_branch_id, true);
begin
  if p_prefix is null or p_prefix !~ '^[0-9]{7}$' then return; end if;
  return query
    select right(c.phone, 1)
    from delivery_customers_private.visible_contacts c
    where c.branch_id = v_branch
      and c.phone between '+973' || p_prefix || '0' and '+973' || p_prefix || '9'
    group by c.phone
    order by max(c.created_at) desc, c.phone
    limit 5;
end;
$$;

create function public.app_delivery_customer_log_addresses(p_branch_id uuid, p_phone text)
returns table (block_number text, area_name text, governorate text, location_url text, customer_address text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := delivery_customers_private.scope_branch(p_branch_id, false);
begin
  return query select * from delivery_customers_private.addresses(delivery_customers_private.normalize_phone(p_phone), v_branch);
end;
$$;

create function public.app_delivery_customer_log_orders(p_branch_id uuid, p_phone text, p_offset integer)
returns table (
  id uuid, order_number text, order_date date, value_bhd numeric, branch_name text, delivery_status text,
  delivered_at timestamptz, driver_name text, recorded_driver_name text, pharmacist_name text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := delivery_customers_private.scope_branch(p_branch_id, false);
begin
  return query
    select o.id, o.order_number::text, o.order_date, o.value_bhd, b.name::text, o.delivery_status::text,
      o.delivered_at, d.name::text, r.name::text, coalesce(o.pharmacist_name, p.name)::text
    from delivery_customers_private.visible_contacts c
    join public.delivery_orders o on o.id = c.order_id
    left join public.branches b on b.id = o.branch_id
    left join public.delivery_drivers d on d.id = o.driver_id
    left join public.delivery_drivers r on r.id = o.recorded_driver_id
    left join public.pharmacists p on p.id = o.pharmacist_id
    where c.phone = delivery_customers_private.normalize_phone(p_phone)
      and (v_branch is null or c.branch_id = v_branch)
    order by o.order_date desc, o.created_at desc, o.id desc
    limit 11 offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Keep the existing recording validation, dispatch and idempotency in one transaction.
-- Contact details for Recorded only are retained privately without creating a driver destination.
create function public.app_delivery_record_customer_order(p_payload jsonb, p_request_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := delivery_customers_private.scope_branch((p_payload->>'branch_id')::uuid, true);
  v_phone text := delivery_customers_private.normalize_phone(p_payload->>'customer_phone');
  v_url text := nullif(btrim(p_payload->>'location_url'), '');
  v_address text := nullif(btrim(p_payload->>'customer_address'), '');
  v_recording_payload jsonb;
  v_result jsonb;
  v_order_id uuid;
begin
  if v_phone is null or length(v_address) > 1000 or length(v_url) > 2048
    or (v_url is not null and v_url !~* '^https://[^[:space:]]+$')
    or upper(btrim(coalesce(p_payload->>'payment_type', ''))) = 'TALABAT'
  then
    raise exception 'Check the customer phone and address details' using errcode = '22023';
  end if;

  v_recording_payload := case when p_payload->>'dispatch_mode' = 'log_only'
    then p_payload - 'customer_phone' - 'location_url' - 'customer_address'
    else jsonb_set(p_payload, '{customer_phone}', to_jsonb(v_phone))
  end;

  v_result := to_jsonb(public.app_record_delivery(
    p_payload => v_recording_payload,
    p_request_key => p_request_key::uuid
  ));
  v_order_id := (v_result #>> '{order,id}')::uuid;

  insert into delivery_customers_private.order_contacts
    (order_id, phone, block_number, area_name, governorate, location_url, customer_address)
  select o.id, v_phone, o.block_number, o.area_name, o.governorate::text, v_url, v_address
  from public.delivery_orders o
  where o.id = v_order_id and o.branch_id = v_branch and o.order_kind is distinct from 'internal_transfer'
  on conflict (order_id) do nothing;

  if not exists (select 1 from delivery_customers_private.order_contacts c
    join public.delivery_orders o on o.id = c.order_id
    where c.order_id = v_order_id and o.branch_id = v_branch
      and c.phone = v_phone and c.location_url is not distinct from v_url and c.customer_address is not distinct from v_address)
  then
    raise exception 'This recording request used different customer details' using errcode = '22023';
  end if;
  return v_result;
end;
$$;

revoke all on all functions in schema delivery_customers_private from public, anon, authenticated;
revoke all on function public.app_delivery_lookup_customer_addresses(uuid, text),
  public.app_delivery_suggest_customer_numbers(uuid, text),
  public.app_delivery_list_customers(uuid, text, integer),
  public.app_delivery_customer_log_addresses(uuid, text),
  public.app_delivery_customer_log_orders(uuid, text, integer),
  public.app_delivery_record_customer_order(jsonb, text) from public, anon, authenticated;
grant execute on function public.app_delivery_lookup_customer_addresses(uuid, text),
  public.app_delivery_suggest_customer_numbers(uuid, text),
  public.app_delivery_list_customers(uuid, text, integer),
  public.app_delivery_customer_log_addresses(uuid, text),
  public.app_delivery_customer_log_orders(uuid, text, integer),
  public.app_delivery_record_customer_order(jsonb, text) to authenticated;
notify pgrst, 'reload schema';
