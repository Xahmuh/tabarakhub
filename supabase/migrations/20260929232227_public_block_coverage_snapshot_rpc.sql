begin;

-- Curated public projection for the standalone Bahrain coverage analyzer.
-- The source tables remain private; only non-sensitive branch coverage fields
-- are exposed and there are no caller-controlled filters or dynamic SQL.
create or replace function public.get_public_bahrain_block_coverage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'branches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'code', b.code,
          'name', b.name,
          'role', coalesce(b.role, 'branch')
        )
        order by b.code, b.name
      )
      from public.branches b
      where coalesce(b.role, 'branch') = 'branch'
        and coalesce((to_jsonb(b)->>'is_active')::boolean, true)
    ), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'branchId', p.branch_id,
          'branchCode', b.code,
          'branchName', b.name,
          'originBlockNumber', p.origin_block_number,
          'isDeliveryEnabled', p.is_delivery_enabled
        )
        order by b.code, b.name
      )
      from public.branch_delivery_profiles p
      join public.branches b on b.id = p.branch_id
      where coalesce(b.role, 'branch') = 'branch'
        and coalesce((to_jsonb(b)->>'is_active')::boolean, true)
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'blockNumber', d.block_number,
          'areaName', d.area_name,
          'governorate', d.governorate,
          'isActive', d.is_active
        )
        order by d.block_number
      )
      from public.delivery_blocks d
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_public_bahrain_block_coverage()
  from public, anon, authenticated;
grant execute on function public.get_public_bahrain_block_coverage()
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
