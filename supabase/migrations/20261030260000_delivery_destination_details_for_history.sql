-- Fetch private destination details on demand for users who can access the order's branch.
create or replace function public.app_delivery_get_order_destination_details(p_order_id uuid)
returns table (
  location_url text,
  customer_address text,
  customer_phone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.delivery_orders o
    where o.id = p_order_id
      and public.current_app_can_access_branch(o.branch_id)
  ) then
    raise exception 'Order is unavailable' using errcode = '42501';
  end if;

  return query
  select destination.location_url, destination.customer_address, destination.customer_phone
  from public.delivery_orders o
  left join public.delivery_driver_order_destinations destination on destination.order_id = o.id
  where o.id = p_order_id;
end;
$$;

revoke all on function public.app_delivery_get_order_destination_details(uuid) from public, anon;
grant execute on function public.app_delivery_get_order_destination_details(uuid) to authenticated;
