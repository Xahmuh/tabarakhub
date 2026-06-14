-- Trust approved branch logins by account + branch + device fingerprint + request IP.
-- A new device or a new IP creates a fresh pending approval for admin review.

drop index if exists public.branch_login_approvals_one_pending_device_idx;

create unique index if not exists branch_login_approvals_one_pending_device_ip_idx
  on public.branch_login_approvals(
    user_id,
    branch_id,
    coalesce(device_fingerprint_hash, ''),
    coalesce(last_ip, '')
  )
  where status = 'pending';

create index if not exists branch_login_approvals_trusted_device_ip_idx
  on public.branch_login_approvals(
    user_id,
    branch_id,
    device_fingerprint_hash,
    last_ip,
    approved_at desc
  )
  where status = 'approved';

create or replace function public.branch_login_approval_request_ip()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw_headers text;
  headers jsonb;
  forwarded_for text;
  detected_ip text;
begin
  raw_headers := current_setting('request.headers', true);
  if raw_headers is null or btrim(raw_headers) = '' then
    return null;
  end if;

  headers := raw_headers::jsonb;
  forwarded_for := coalesce(
    headers ->> 'cf-connecting-ip',
    headers ->> 'x-real-ip',
    headers ->> 'x-forwarded-for',
    headers ->> 'CF-Connecting-IP',
    headers ->> 'X-Real-IP',
    headers ->> 'X-Forwarded-For'
  );

  detected_ip := nullif(btrim(split_part(coalesce(forwarded_for, ''), ',', 1)), '');
  return detected_ip;
exception
  when others then
    return null;
end;
$$;

create or replace function public.branch_login_approval_open_request(
  p_target_branch_id uuid,
  p_device_fingerprint_hash text default null,
  p_device_label text default null,
  p_browser_name text default null,
  p_os_name text default null,
  p_user_agent_hash text default null
)
returns public.branch_login_approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_ip text := public.branch_login_approval_request_ip();
  v_device_hash text := nullif(btrim(coalesce(p_device_fingerprint_hash, '')), '');
  v_device_label text := nullif(btrim(coalesce(p_device_label, '')), '');
  v_browser_name text := nullif(btrim(coalesce(p_browser_name, '')), '');
  v_os_name text := nullif(btrim(coalesce(p_os_name, '')), '');
  v_user_agent_hash text := nullif(btrim(coalesce(p_user_agent_hash, '')), '');
  v_trusted public.branch_login_approvals;
  v_pending public.branch_login_approvals;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to request branch login approval';
  end if;

  if coalesce(public.current_app_role(), '') <> 'branch' then
    raise exception 'Only branch accounts can request branch login approval';
  end if;

  if p_target_branch_id is null
    or public.current_app_branch_id() is null
    or p_target_branch_id <> public.current_app_branch_id() then
    raise exception 'Branch login approval request does not match the authenticated branch';
  end if;

  perform public.branch_login_approval_expire_old();

  select a.* into v_trusted
  from public.branch_login_approvals a
  where a.user_id = auth.uid()
    and a.branch_id = p_target_branch_id
    and a.status = 'approved'
    and coalesce(a.device_fingerprint_hash, '') = coalesce(v_device_hash, '')
    and coalesce(a.last_ip, '') = coalesce(v_request_ip, '')
  order by a.approved_at desc nulls last, a.updated_at desc
  limit 1;

  if found then
    update public.branch_login_approvals
    set device_label = coalesce(v_device_label, device_label),
        browser_name = coalesce(v_browser_name, browser_name),
        os_name = coalesce(v_os_name, os_name),
        user_agent_hash = coalesce(v_user_agent_hash, user_agent_hash),
        last_ip = v_request_ip,
        updated_at = now()
    where id = v_trusted.id
    returning * into v_trusted;

    return v_trusted;
  end if;

  select a.* into v_pending
  from public.branch_login_approvals a
  where a.user_id = auth.uid()
    and a.branch_id = p_target_branch_id
    and a.status = 'pending'
    and coalesce(a.device_fingerprint_hash, '') = coalesce(v_device_hash, '')
    and coalesce(a.last_ip, '') = coalesce(v_request_ip, '')
  order by a.requested_at desc
  limit 1;

  if found then
    update public.branch_login_approvals
    set device_label = coalesce(v_device_label, device_label),
        browser_name = coalesce(v_browser_name, browser_name),
        os_name = coalesce(v_os_name, os_name),
        user_agent_hash = coalesce(v_user_agent_hash, user_agent_hash),
        last_ip = v_request_ip,
        requested_at = now(),
        expires_at = now() + interval '10 minutes',
        updated_at = now()
    where id = v_pending.id
    returning * into v_pending;

    return v_pending;
  end if;

  insert into public.branch_login_approvals (
    user_id,
    branch_id,
    device_fingerprint_hash,
    device_label,
    browser_name,
    os_name,
    user_agent_hash,
    last_ip,
    status
  )
  values (
    auth.uid(),
    p_target_branch_id,
    v_device_hash,
    v_device_label,
    v_browser_name,
    v_os_name,
    v_user_agent_hash,
    v_request_ip,
    'pending'
  )
  returning * into v_pending;

  return v_pending;
end;
$$;

revoke all on function public.branch_login_approval_request_ip() from public, anon;
revoke all on function public.branch_login_approval_open_request(uuid, text, text, text, text, text) from public, anon;

grant execute on function public.branch_login_approval_request_ip() to authenticated, service_role;
grant execute on function public.branch_login_approval_open_request(uuid, text, text, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
