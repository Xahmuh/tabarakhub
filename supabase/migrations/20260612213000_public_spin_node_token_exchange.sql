-- Allow static public Spin & Win QR links (?node=H003) to enter the secure
-- tokenized customer flow without requiring a branch/admin login.
--
-- The public link exchanges a branch code (public.branches.code), never a
-- branch UUID, for a short-lived single-use token. Token validation and spin
-- execution remain enforced by the existing server-side RPCs.
--
-- Abuse controls in this SQL-only path:
-- - reject invalid, missing, disabled, inactive, or ambiguous branch codes with
--   the same generic error;
-- - delete expired single-use sessions after a short grace window;
-- - cap recent active unused single-use sessions per branch;
-- - cap total single-use sessions generated per branch per hour.
--
-- SQL cannot see trusted client IP/device metadata in this RPC path. Add an
-- Edge Function/WAF layer before production if per-client/network throttling is
-- required by the release owner.

drop function if exists public.generate_spin_session_from_branch_code(text);

create or replace function public.generate_spin_session_from_branch_code(
  p_branch_code text
)
returns table (
  out_token text,
  out_expires_at timestamptz,
  out_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_code text := upper(btrim(coalesce(p_branch_code, '')));
  v_token text;
  v_now timestamptz := now();
  v_expires_at timestamptz := now() + interval '10 minutes';
  v_branch_match_count integer;
  v_recent_active_unused_count integer;
  v_recent_total_count integer;
begin
  if nullif(v_code, '') is null
    or length(v_code) > 32
    or v_code !~ '^[A-Z0-9_-]+$'
  then
    raise exception 'SPIN_QR_UNAVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtext('spin-static-node:' || v_code));

  delete from public.spin_sessions s
  where coalesce(s.is_multi_use, false) = false
    and s.expires_at < v_now - interval '1 hour';

  select count(*), max(b.id)
  into v_branch_match_count, v_branch_id
  from public.branches b
  where upper(btrim(coalesce(b.code, ''))) = v_code
    and coalesce(b.is_spin_enabled, true)
    and coalesce((to_jsonb(b)->>'is_active')::boolean, true);

  if v_branch_match_count <> 1 or v_branch_id is null then
    raise exception 'SPIN_QR_UNAVAILABLE';
  end if;

  select count(*)
  into v_recent_active_unused_count
  from public.spin_sessions s
  where s.branch_id = v_branch_id
    and coalesce(s.is_multi_use, false) = false
    and coalesce(s.used, false) = false
    and s.expires_at > v_now
    and s.created_at >= v_now - interval '10 minutes';

  if v_recent_active_unused_count >= 60 then
    raise exception 'SPIN_QR_UNAVAILABLE';
  end if;

  select count(*)
  into v_recent_total_count
  from public.spin_sessions s
  where s.branch_id = v_branch_id
    and coalesce(s.is_multi_use, false) = false
    and s.created_at >= v_now - interval '1 hour';

  if v_recent_total_count >= 240 then
    raise exception 'SPIN_QR_UNAVAILABLE';
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

  return query select v_token, v_expires_at, v_now;
end;
$$;

create index if not exists spin_sessions_branch_single_use_recent_idx
on public.spin_sessions(branch_id, created_at desc)
where coalesce(is_multi_use, false) = false;

revoke all on function public.generate_spin_session_from_branch_code(text) from public;
grant execute on function public.generate_spin_session_from_branch_code(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
