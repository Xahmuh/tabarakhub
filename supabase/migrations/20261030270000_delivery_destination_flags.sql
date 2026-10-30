-- Return only presence flags so history rows can hide empty destination popups.
create or replace function public.app_delivery_get_order_destination_flags(p_order_ids uuid[])
returns table (
  order_id uuid,
  has_details boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    nullif(btrim(destination.location_url), '') is not null
      or nullif(btrim(destination.customer_address), '') is not null
      or nullif(btrim(destination.customer_phone), '') is not null
  from public.delivery_orders o
  left join public.delivery_driver_order_destinations destination on destination.order_id = o.id
  where o.id = any(coalesce(p_order_ids, '{}'::uuid[]))
    and public.current_app_can_access_branch(o.branch_id);
end;
$$;

revoke all on function public.app_delivery_get_order_destination_flags(uuid[]) from public, anon;
grant execute on function public.app_delivery_get_order_destination_flags(uuid[]) to authenticated;
