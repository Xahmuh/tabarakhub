-- Tighten grants for user-level module permission overrides.
--
-- RLS policies decide which authenticated users may read or manage rows.
-- Authenticated users should not hold table-level TRUNCATE/REFERENCES/TRIGGER
-- privileges on this security-sensitive access-control table.

revoke all on public.app_user_feature_permissions from public, anon, authenticated;

grant select, insert, update, delete on public.app_user_feature_permissions to authenticated;
grant all on public.app_user_feature_permissions to service_role;

notify pgrst, 'reload schema';
