-- The driver app subscribes to changes for its assigned delivery_orders.
-- Existing SELECT RLS limits each driver's visibility; app polling remains a fallback.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_orders'
  ) then
    alter publication supabase_realtime add table public.delivery_orders;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_driver_monthly_targets'
  ) then
    alter publication supabase_realtime add table public.delivery_driver_monthly_targets;
  end if;
end;
$$;
