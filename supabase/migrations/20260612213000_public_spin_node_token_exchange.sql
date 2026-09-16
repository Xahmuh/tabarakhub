-- Allow legacy static branch QR links (?node=H003) to enter the secure
-- tokenized customer flow without requiring a branch/admin login.
-- The public link only exchanges a valid, spin-enabled branch code for a
-- short-lived single-use token; token validation and spin execution remain
-- enforced by the existing server-side RPCs.

drop function if exists public.generate_spin_session_from_branch_code(text);
create or replace function public.generate_spin_session_from_branch_code(
  p_branch_code text
)
returns table (
  out_token text,
  out_branch_id uuid,
  out_expires_at timestamptz,
  out_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_branch_enabled boolean;
  v_code text := upper(btrim(coalesce(p_branch_code, '')));
  v_token text;
  v_now timestamptz := now();
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if nullif(v_code, '') is null then
    raise exception 'BRANCH_CODE_REQUIRED';
  end if;

  select b.id, coalesce(b.is_spin_enabled, true)
  into v_branch_id, v_branch_enabled
  from public.branches b
  where upper(b.code) = v_code
  order by b.id
  limit 1;

  if not found then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  if not v_branch_enabled then
    raise exception 'SPIN_DISABLED_FOR_BRANCH';
  end if;

  loop
    v_token := 'spin_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    exit when not exists (
      select 1
      from public.spin_sessions s
      where s.token = v_token
    );
  end loop;

  insert into public.spin_sessions (
    token,
    branch_id,
    used,
    is_multi_use,
    expires_at,
    created_at
  )
  values (
    v_token,
    v_branch_id,
    false,
    false,
    v_expires_at,
    v_now
  );

  return query select v_token, v_branch_id, v_expires_at, v_now;
end;
$$;
revoke all on function public.generate_spin_session_from_branch_code(text) from public;
grant execute on function public.generate_spin_session_from_branch_code(text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
