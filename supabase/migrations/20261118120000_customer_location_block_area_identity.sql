-- A saved location is identified by its exact block and area pair. Keep the
-- newest GPS and detailed address for that pair while preserving every order snapshot.
create or replace function delivery_customers_private.addresses(p_phone text, p_branch_id uuid)
returns table (block_number text, area_name text, governorate text, location_url text, customer_address text)
language sql stable set search_path = '' as $$
  select a.block_number, a.area_name, a.governorate, a.location_url, a.customer_address
  from (
    select distinct on (
      nullif(btrim(c.block_number), ''),
      lower(nullif(btrim(c.area_name), '')),
      case
        when nullif(btrim(c.block_number), '') is null
          or nullif(btrim(c.area_name), '') is null then c.order_id
      end
    )
      c.block_number, c.area_name, c.governorate, c.location_url, c.customer_address,
      c.order_date, c.created_at, c.order_id
    from delivery_customers_private.visible_contacts c
    where c.phone = p_phone and (p_branch_id is null or c.branch_id = p_branch_id)
      and (c.block_number is not null or c.area_name is not null
        or c.location_url is not null or c.customer_address is not null)
    order by
      nullif(btrim(c.block_number), ''),
      lower(nullif(btrim(c.area_name), '')),
      case
        when nullif(btrim(c.block_number), '') is null
          or nullif(btrim(c.area_name), '') is null then c.order_id
      end,
      c.order_date desc, c.created_at desc, c.order_id desc
  ) a
  order by a.order_date desc, a.created_at desc, a.order_id desc;
$$;

create or replace function public.app_delivery_list_customers(p_branch_id uuid, p_search text, p_offset integer)
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
      (
        count(distinct (
          nullif(btrim(c.block_number), ''),
          lower(nullif(btrim(c.area_name), '')),
          case
            when nullif(btrim(c.block_number), '') is null
              or nullif(btrim(c.area_name), '') is null then c.order_id
          end
        )) filter (where c.block_number is not null or c.area_name is not null
          or c.location_url is not null or c.customer_address is not null)
      )::integer,
      count(*)::integer, max(c.order_date)
    from delivery_customers_private.visible_contacts c
    where (v_branch is null or c.branch_id = v_branch) and (v_search is null or c.phone = v_search)
    group by c.phone
    order by max(c.order_date) desc, max(c.created_at) desc, c.phone
    limit 11 offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
