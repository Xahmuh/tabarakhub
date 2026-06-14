-- Branch login approval flow.
-- Dedicated-client model only: no organization_id / multi-tenancy.

create table if not exists public.branch_login_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_fingerprint_hash text null,
  device_label text null,
  browser_name text null,
  os_name text null,
  user_agent_hash text null,
  last_ip text null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  approved_by uuid null references auth.users(id),
  approved_at timestamptz null,
  rejected_by uuid null references auth.users(id),
  rejected_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_login_approvals_status_check
    check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled'))
);

create index if not exists branch_login_approvals_user_id_idx
  on public.branch_login_approvals(user_id);
create index if not exists branch_login_approvals_branch_id_idx
  on public.branch_login_approvals(branch_id);
create index if not exists branch_login_approvals_status_idx
  on public.branch_login_approvals(status);
create index if not exists branch_login_approvals_requested_at_idx
  on public.branch_login_approvals(requested_at desc);
create index if not exists branch_login_approvals_expires_at_idx
  on public.branch_login_approvals(expires_at);
create index if not exists branch_login_approvals_device_fingerprint_hash_idx
  on public.branch_login_approvals(device_fingerprint_hash);

create unique index if not exists branch_login_approvals_one_pending_device_idx
  on public.branch_login_approvals(user_id, branch_id, coalesce(device_fingerprint_hash, ''))
  where status = 'pending';

create or replace function public.branch_login_approvals_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists branch_login_approvals_touch_updated_at on public.branch_login_approvals;
create trigger branch_login_approvals_touch_updated_at
before update on public.branch_login_approvals
for each row execute function public.branch_login_approvals_touch_updated_at();

create or replace function public.current_app_can_approve_branch_login()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager', 'owner'), false)
$$;

revoke all on function public.current_app_can_approve_branch_login() from public, anon;
grant execute on function public.current_app_can_approve_branch_login() to authenticated, service_role;

alter table public.branch_login_approvals enable row level security;

revoke all on public.branch_login_approvals from anon;
revoke all on public.branch_login_approvals from authenticated;
grant select, insert on public.branch_login_approvals to authenticated;
grant update (status, approved_by, approved_at, rejected_by, rejected_at, rejection_reason, updated_at)
  on public.branch_login_approvals to authenticated;
grant all on public.branch_login_approvals to service_role;

drop policy if exists "branch login approvals select own or approver" on public.branch_login_approvals;
create policy "branch login approvals select own or approver"
on public.branch_login_approvals
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_app_can_approve_branch_login()
);

drop policy if exists "branch login approvals insert own branch pending" on public.branch_login_approvals;
create policy "branch login approvals insert own branch pending"
on public.branch_login_approvals
for insert
to authenticated
with check (
  public.current_app_role() = 'branch'
  and user_id = auth.uid()
  and branch_id = public.current_app_branch_id()
  and status = 'pending'
  and approved_by is null
  and approved_at is null
  and rejected_by is null
  and rejected_at is null
);

drop policy if exists "branch login approvals approver update" on public.branch_login_approvals;
create policy "branch login approvals approver update"
on public.branch_login_approvals
for update
to authenticated
using (public.current_app_can_approve_branch_login())
with check (public.current_app_can_approve_branch_login());

create or replace function public.branch_login_approval_expire_old()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  update public.branch_login_approvals
  set status = 'expired',
      updated_at = now()
  where status = 'pending'
    and expires_at <= now();

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

create or replace function public.branch_login_approval_list_pending()
returns table (
  id uuid,
  user_id uuid,
  user_email text,
  branch_id uuid,
  branch_code text,
  branch_name text,
  device_fingerprint_hash text,
  device_label text,
  browser_name text,
  os_name text,
  user_agent_hash text,
  last_ip text,
  status text,
  requested_at timestamptz,
  expires_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_approve_branch_login() then
    raise exception 'Only admin, manager, or owner can list branch login approvals';
  end if;

  perform public.branch_login_approval_expire_old();

  return query
  select
    a.id,
    a.user_id,
    u.email::text,
    a.branch_id,
    b.code,
    b.name,
    a.device_fingerprint_hash,
    a.device_label,
    a.browser_name,
    a.os_name,
    a.user_agent_hash,
    a.last_ip,
    a.status,
    a.requested_at,
    a.expires_at,
    a.approved_by,
    a.approved_at,
    a.rejected_by,
    a.rejected_at,
    a.rejection_reason,
    a.created_at,
    a.updated_at
  from public.branch_login_approvals a
  join auth.users u on u.id = a.user_id
  left join public.branches b on b.id = a.branch_id
  where a.status = 'pending'
  order by a.requested_at desc;
end;
$$;

create or replace function public.branch_login_approval_approve(target_request_id uuid)
returns public.branch_login_approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.branch_login_approvals;
  updated public.branch_login_approvals;
begin
  if not public.current_app_can_approve_branch_login() then
    raise exception 'Only admin, manager, or owner can approve branch login requests';
  end if;

  select * into target
  from public.branch_login_approvals
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Branch login approval request was not found';
  end if;

  if target.user_id = auth.uid() then
    raise exception 'You cannot approve your own login request';
  end if;

  if target.status <> 'pending' then
    raise exception 'Only pending login requests can be approved';
  end if;

  if target.expires_at <= now() then
    update public.branch_login_approvals
    set status = 'expired',
        updated_at = now()
    where id = target_request_id;
    raise exception 'This login approval request has expired';
  end if;

  update public.branch_login_approvals
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      rejection_reason = null,
      updated_at = now()
  where id = target_request_id
  returning * into updated;

  return updated;
end;
$$;

create or replace function public.branch_login_approval_reject(
  target_request_id uuid,
  reason text default null
)
returns public.branch_login_approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.branch_login_approvals;
  updated public.branch_login_approvals;
begin
  if not public.current_app_can_approve_branch_login() then
    raise exception 'Only admin, manager, or owner can reject branch login requests';
  end if;

  select * into target
  from public.branch_login_approvals
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Branch login approval request was not found';
  end if;

  if target.user_id = auth.uid() then
    raise exception 'You cannot reject your own login request';
  end if;

  if target.status <> 'pending' then
    raise exception 'Only pending login requests can be rejected';
  end if;

  update public.branch_login_approvals
  set status = 'rejected',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_reason = nullif(trim(reason), ''),
      updated_at = now()
  where id = target_request_id
  returning * into updated;

  return updated;
end;
$$;

create or replace function public.branch_login_approval_cancel(target_request_id uuid)
returns public.branch_login_approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.branch_login_approvals;
  updated public.branch_login_approvals;
begin
  select * into target
  from public.branch_login_approvals
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Branch login approval request was not found';
  end if;

  if target.user_id <> auth.uid() and not public.current_app_can_approve_branch_login() then
    raise exception 'You cannot cancel this login approval request';
  end if;

  if target.status <> 'pending' then
    return target;
  end if;

  update public.branch_login_approvals
  set status = 'cancelled',
      updated_at = now()
  where id = target_request_id
  returning * into updated;

  return updated;
end;
$$;

revoke all on function public.branch_login_approval_expire_old() from public, anon;
revoke all on function public.branch_login_approval_list_pending() from public, anon;
revoke all on function public.branch_login_approval_approve(uuid) from public, anon;
revoke all on function public.branch_login_approval_reject(uuid, text) from public, anon;
revoke all on function public.branch_login_approval_cancel(uuid) from public, anon;

grant execute on function public.branch_login_approval_expire_old() to authenticated, service_role;
grant execute on function public.branch_login_approval_list_pending() to authenticated, service_role;
grant execute on function public.branch_login_approval_approve(uuid) to authenticated, service_role;
grant execute on function public.branch_login_approval_reject(uuid, text) to authenticated, service_role;
grant execute on function public.branch_login_approval_cancel(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
