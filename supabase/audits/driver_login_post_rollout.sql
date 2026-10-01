-- Run only after the new driver APK using the driver-login Edge Function has
-- reached all drivers. The function's service role still needs this RPC.
begin;

revoke all on function public.app_driver_resolve_login_identifier(text)
  from public, anon, authenticated;
grant execute on function public.app_driver_resolve_login_identifier(text)
  to service_role;

notify pgrst, 'reload schema';
commit;
