-- Persistent operations task workflow for the Daily Command Center.
-- Dedicated-client model only: no tenant tables, no organization_id.

create table if not exists public.operations_tasks (
  id uuid primary key default gen_random_uuid(),
  source_module text not null,
  title text not null,
  description text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  owner_role text,
  assigned_to uuid references auth.users(id) on delete set null,
  recommended_action text,
  next_step text,
  related_record_id text,
  related_record_type text,
  created_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operations_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.operations_tasks(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'status_changed', 'comment')),
  old_status text check (old_status is null or old_status in ('open', 'in_progress', 'resolved', 'dismissed')),
  new_status text check (new_status is null or new_status in ('open', 'in_progress', 'resolved', 'dismissed')),
  comment text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists operations_tasks_status_idx on public.operations_tasks(status);
create index if not exists operations_tasks_severity_idx on public.operations_tasks(severity);
create index if not exists operations_tasks_priority_idx on public.operations_tasks(priority);
create index if not exists operations_tasks_branch_id_idx on public.operations_tasks(branch_id);
create index if not exists operations_tasks_source_module_idx on public.operations_tasks(source_module);
create index if not exists operations_tasks_due_at_idx on public.operations_tasks(due_at);
create index if not exists operations_tasks_related_record_idx on public.operations_tasks(source_module, related_record_type, related_record_id);
create unique index if not exists operations_tasks_open_duplicate_guard_idx
on public.operations_tasks (
  source_module,
  title,
  coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(related_record_type, ''),
  coalesce(related_record_id, '')
)
where status in ('open', 'in_progress');
create index if not exists operations_task_events_task_id_idx on public.operations_task_events(task_id);

create or replace function public.current_app_can_read_operations_task(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_can_read_all()
    or (target_branch_id is not null and target_branch_id = public.current_app_branch_id()),
    false
  )
$$;

create or replace function public.current_app_can_update_operations_task(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_can_manage()
    or (
      public.current_app_role() = 'branch'
      and target_branch_id is not null
      and target_branch_id = public.current_app_branch_id()
    ),
    false
  )
$$;

revoke all on function public.current_app_can_read_operations_task(uuid) from public;
revoke all on function public.current_app_can_update_operations_task(uuid) from public;
grant execute on function public.current_app_can_read_operations_task(uuid) to authenticated, service_role;
grant execute on function public.current_app_can_update_operations_task(uuid) to authenticated, service_role;

create or replace function public.prepare_operations_task_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);

  new.updated_at := now();

  if new.status in ('resolved', 'dismissed') then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(auth.uid(), new.resolved_by);
  end if;

  return new;
end;
$$;

create or replace function public.enforce_operations_task_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_manage() then
    if new.source_module is distinct from old.source_module
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.severity is distinct from old.severity
      or new.priority is distinct from old.priority
      or new.branch_id is distinct from old.branch_id
      or new.branch_name is distinct from old.branch_name
      or new.owner_role is distinct from old.owner_role
      or new.assigned_to is distinct from old.assigned_to
      or new.recommended_action is distinct from old.recommended_action
      or new.next_step is distinct from old.next_step
      or new.related_record_id is distinct from old.related_record_id
      or new.related_record_type is distinct from old.related_record_type
      or new.created_by is distinct from old.created_by
      or new.resolved_by is distinct from old.resolved_by
      or new.resolved_at is distinct from old.resolved_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Only managers can change operation task assignment, priority, severity, scope, or source metadata';
    end if;

    if old.status in ('resolved', 'dismissed') and new.status is distinct from old.status then
      raise exception 'Only managers can reopen resolved or dismissed operation tasks';
    end if;
  end if;

  new.updated_at := now();

  if new.status is distinct from old.status then
    if new.status in ('resolved', 'dismissed') then
      new.resolved_at := coalesce(new.resolved_at, now());
      new.resolved_by := coalesce(auth.uid(), new.resolved_by);
    else
      new.resolved_at := null;
      new.resolved_by := null;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prepare_operations_task_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task_status text;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);

  select status
  into current_task_status
  from public.operations_tasks
  where id = new.task_id;

  if current_task_status is null then
    raise exception 'Operation task event must reference an existing task';
  end if;

  if new.event_type = 'created' and not public.current_app_can_manage() then
    raise exception 'Only managers can create operation task creation events';
  end if;

  if new.event_type = 'comment' and (new.old_status is not null or new.new_status is not null) then
    raise exception 'Comment events cannot include status transition fields';
  end if;

  if new.event_type = 'status_changed' then
    if new.old_status is null or new.new_status is null then
      raise exception 'Status change events require old_status and new_status';
    end if;

    if new.new_status <> current_task_status then
      raise exception 'Status change event must match the current operation task status';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_operations_task_insert() from public;
revoke all on function public.enforce_operations_task_update() from public;
revoke all on function public.prepare_operations_task_event_insert() from public;

drop trigger if exists operations_tasks_before_insert on public.operations_tasks;
create trigger operations_tasks_before_insert
before insert on public.operations_tasks
for each row execute function public.prepare_operations_task_insert();

drop trigger if exists operations_tasks_before_update on public.operations_tasks;
create trigger operations_tasks_before_update
before update on public.operations_tasks
for each row execute function public.enforce_operations_task_update();

drop trigger if exists operations_task_events_before_insert on public.operations_task_events;
create trigger operations_task_events_before_insert
before insert on public.operations_task_events
for each row execute function public.prepare_operations_task_event_insert();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operations_tasks'::regclass
      and conname = 'operations_tasks_resolved_metadata_check'
  ) then
    alter table public.operations_tasks
      add constraint operations_tasks_resolved_metadata_check
      check (status <> 'resolved' or (resolved_at is not null and resolved_by is not null));
  end if;
end;
$$;

alter table public.operations_tasks enable row level security;
alter table public.operations_task_events enable row level security;

revoke all on public.operations_tasks from anon;
revoke all on public.operations_task_events from anon;
revoke all on public.operations_tasks from authenticated;
revoke all on public.operations_task_events from authenticated;

grant select, insert, update on public.operations_tasks to authenticated;
grant select, insert on public.operations_task_events to authenticated;
grant all on public.operations_tasks to service_role;
grant all on public.operations_task_events to service_role;

drop policy if exists "operations tasks select scoped" on public.operations_tasks;
drop policy if exists "operations tasks insert managers" on public.operations_tasks;
drop policy if exists "operations tasks update scoped status" on public.operations_tasks;
drop policy if exists "operations task events select scoped" on public.operations_task_events;
drop policy if exists "operations task events insert scoped" on public.operations_task_events;
drop policy if exists "operations task events insert task access" on public.operations_task_events;

create policy "operations tasks select scoped"
on public.operations_tasks
for select
to authenticated
using (public.current_app_can_read_operations_task(branch_id));

create policy "operations tasks insert managers"
on public.operations_tasks
for insert
to authenticated
with check (public.current_app_can_manage());

create policy "operations tasks update scoped status"
on public.operations_tasks
for update
to authenticated
using (public.current_app_can_update_operations_task(branch_id))
with check (public.current_app_can_update_operations_task(branch_id));

create policy "operations task events select scoped"
on public.operations_task_events
for select
to authenticated
using (
  exists (
    select 1
    from public.operations_tasks t
    where t.id = operations_task_events.task_id
      and public.current_app_can_read_operations_task(t.branch_id)
  )
);

create policy "operations task events insert scoped"
on public.operations_task_events
for insert
to authenticated
with check (
  (created_by is null or created_by = auth.uid())
  and
  exists (
    select 1
    from public.operations_tasks t
    where t.id = operations_task_events.task_id
      and public.current_app_can_update_operations_task(t.branch_id)
  )
);

notify pgrst, 'reload schema';
