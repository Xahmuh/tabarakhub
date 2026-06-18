-- Ensure Access-first supervisor zone RPCs are not callable by anonymous users.

revoke all on function public.app_sync_supervisor_zone_access() from public, anon;
grant execute on function public.app_sync_supervisor_zone_access() to authenticated, service_role;

revoke all on function public.handle_supervisor_zone_access_sync() from public, anon, authenticated;

revoke all on function public.app_replace_branch_staff_assignments(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.app_replace_branch_staff_assignments(uuid, uuid[], uuid[]) to authenticated, service_role;
