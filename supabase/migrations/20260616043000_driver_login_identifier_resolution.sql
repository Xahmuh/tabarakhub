-- Resolve driver mobile login identifiers before Supabase Auth password login.
--
-- Email identifiers are already accepted by Supabase Auth directly. Driver codes
-- such as D001, d001, or 001 need to resolve to the linked Auth email first.

create or replace function public.app_driver_resolve_login_identifier(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := btrim(coalesce(p_identifier, ''));
  v_code text;
  v_email text;
begin
  if v_raw = '' then
    raise exception 'Email ID or driver code is required'
      using errcode = '22023';
  end if;

  if position('@' in v_raw) > 0 then
    return lower(v_raw);
  end if;

  v_code := upper(regexp_replace(v_raw, '\s+', '', 'g'));

  if v_code ~ '^[0-9]+$' then
    v_code := 'D' || lpad(v_code, 3, '0');
  elsif v_code ~ '^D[0-9]+$' then
    v_code := 'D' || lpad(substring(v_code from '^D([0-9]+)$'), 3, '0');
  end if;

  select lower(u.email)
  into v_email
  from public.delivery_drivers d
  join public.app_user_profiles p
    on p.user_id = d.auth_user_id
   and p.role = 'driver'
   and p.is_active = true
  join auth.users u
    on u.id = d.auth_user_id
  where d.is_active = true
    and upper(btrim(d.driver_code)) = v_code
  limit 1;

  if v_email is null then
    raise exception 'Driver code was not found or is not linked to an active driver login'
      using errcode = 'P0002';
  end if;

  return v_email;
end;
$$;

revoke all on function public.app_driver_resolve_login_identifier(text) from public, anon, authenticated;
grant execute on function public.app_driver_resolve_login_identifier(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
