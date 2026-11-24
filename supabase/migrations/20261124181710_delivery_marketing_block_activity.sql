create or replace function public.app_delivery_marketing_block_activity(p_from date, p_to date)
returns table (
  block_number text, branch_id uuid, branch_name text, branch_code text,
  orders bigint, tracked bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_app_role();
  v_access text;
begin
  if v_user is null or coalesce(v_role, '') not in ('admin', 'manager', 'owner') then
    raise exception 'Delivery marketing access is required' using errcode = '42501';
  end if;

  if v_role = 'owner' then
    select coalesce(
      (select p.access_level::text from public.app_user_feature_permissions p
        where p.user_id = v_user and p.feature_name = 'delivery'),
      (select p.access_level::text from public.role_permissions p
        where p.role = v_role and p.feature_name = 'delivery'),
      (select 'read' where exists (
        select 1 from public.app_user_feature_permissions p where p.user_id = v_user
          and p.feature_name like 'delivery:%' and p.access_level in ('read', 'edit')
      )),
      'none'
    ) into v_access;
    if v_access not in ('read', 'edit') then
      raise exception 'Delivery marketing access is required' using errcode = '42501';
    end if;
  end if;

  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 89 then
    raise exception 'Choose a valid date range of up to 90 days' using errcode = '22023';
  end if;

  return query
  select btrim(o.block_number::text), b.id, b.name::text, b.code::text,
    count(*), count(*) filter (
      where o.delivery_status = 'delivered' and o.delivered_at > o.assigned_at
    )
  from public.delivery_orders o
  join public.branches b on b.id = o.branch_id and b.role = 'branch'
  where o.order_date between p_from and p_to
    and o.deleted_at is null
    and b.code is distinct from 'TEST-01'
    and nullif(btrim(o.block_number::text), '') is not null
    and o.order_kind is distinct from 'internal_transfer'
    and o.delivery_status is distinct from 'cancelled'
    and upper(btrim(coalesce(o.payment_type, ''))) <> 'TALABAT'
    and regexp_replace(lower(coalesce(o.external_source, '')), '[[:space:]_-]+', '', 'g') <> 'talabat'
    and coalesce(o.cancelled_reason, '') not like 'Recorded only void:%'
    and not exists (select 1 from public.delivery_recording_voids v where v.order_id = o.id)
  group by btrim(o.block_number::text), b.id, b.name, b.code;
end;
$$;

revoke all on function public.app_delivery_marketing_block_activity(date, date) from public, anon, authenticated;
grant execute on function public.app_delivery_marketing_block_activity(date, date) to authenticated;
