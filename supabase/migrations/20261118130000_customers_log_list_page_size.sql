-- Return one extra customer row so the UI can paginate 20 customers at a time.
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
    limit 21 offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
