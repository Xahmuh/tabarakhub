-- app_user_profiles is the root authorization table for app roles and branch scope.
-- Frontend-reachable authenticated users may read profiles only; all profile
-- provisioning and mutation must happen through trusted SQL or service_role.

alter table public.app_user_profiles enable row level security;

drop policy if exists "app profiles manage" on public.app_user_profiles;

revoke all privileges on table public.app_user_profiles from anon;
revoke all privileges on table public.app_user_profiles from authenticated;

do $$
declare
  app_profile_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into app_profile_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'app_user_profiles';

  if app_profile_columns is not null then
    execute format(
      'revoke all privileges (%s) on public.app_user_profiles from anon, authenticated',
      app_profile_columns
    );
  end if;
end $$;

grant select on table public.app_user_profiles to authenticated;
grant all privileges on table public.app_user_profiles to service_role;

notify pgrst, 'reload schema';
