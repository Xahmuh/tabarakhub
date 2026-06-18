-- The zone sync trigger function is invoked by database triggers only.
-- It should not be exposed as an authenticated RPC endpoint.

revoke all on function public.handle_supervisor_zone_access_sync() from public, anon, authenticated;
