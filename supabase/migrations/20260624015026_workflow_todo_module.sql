-- Workflow & Todo module.
-- Dedicated-client model: no tenant tables, no organization_id.
-- The mobile app this replaces stored workflow state locally; these tables make
-- branch tasks, personal todos, approvals, recurrence, comments, and attachments
-- durable in Tabarak Hub.
-- Isolation rule: this migration only creates workflow_* objects and policies.
-- It does not alter existing module tables or seed existing permission rows.

create table if not exists public.workflow_task_templates (
  id uuid primary key default gen_random_uuid(),
  task_kind text not null default 'work' check (task_kind in ('work', 'personal')),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  assignee_role text check (
    assignee_role is null
    or assignee_role in ('admin', 'manager', 'owner', 'accounts', 'supervisor', 'warehouse', 'branch')
  ),
  assigned_to uuid references auth.users(id) on delete set null,
  review_required boolean not null default false,
  recurrence_frequency text not null default 'weekly' check (recurrence_frequency in ('daily', 'weekly', 'monthly', 'quarterly')),
  starts_on date not null default current_date,
  ends_on date,
  next_due_on date,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  task_kind text not null default 'work' check (task_kind in ('work', 'personal')),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'submitted', 'approved', 'rejected', 'done', 'dismissed', 'expired')),
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  assignee_role text check (
    assignee_role is null
    or assignee_role in ('admin', 'manager', 'owner', 'accounts', 'supervisor', 'warehouse', 'branch')
  ),
  assigned_to uuid references auth.users(id) on delete set null,
  review_required boolean not null default false,
  template_id uuid references public.workflow_task_templates(id) on delete set null,
  template_occurrence_date date,
  due_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.workflow_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.workflow_tasks(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'status_changed', 'comment', 'review', 'template_generated')),
  old_status text check (old_status is null or old_status in ('open', 'in_progress', 'submitted', 'approved', 'rejected', 'done', 'dismissed', 'expired')),
  new_status text check (new_status is null or new_status in ('open', 'in_progress', 'submitted', 'approved', 'rejected', 'done', 'dismissed', 'expired')),
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.workflow_tasks(id) on delete cascade,
  file_name text not null,
  file_path text,
  file_url text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (file_path is not null or file_url is not null)
);

create index if not exists workflow_tasks_status_due_idx
on public.workflow_tasks(status, due_at);

create index if not exists workflow_tasks_branch_status_due_idx
on public.workflow_tasks(branch_id, status, due_at)
where branch_id is not null;

create index if not exists workflow_tasks_assigned_status_due_idx
on public.workflow_tasks(assigned_to, status, due_at)
where assigned_to is not null;

create index if not exists workflow_tasks_created_kind_status_idx
on public.workflow_tasks(created_by, task_kind, status);

create index if not exists workflow_tasks_role_status_due_idx
on public.workflow_tasks(assignee_role, status, due_at)
where assignee_role is not null;

create index if not exists workflow_tasks_template_idx
on public.workflow_tasks(template_id, template_occurrence_date)
where template_id is not null;

create unique index if not exists workflow_tasks_template_occurrence_guard_idx
on public.workflow_tasks(template_id, template_occurrence_date)
where template_id is not null and template_occurrence_date is not null;

create index if not exists workflow_task_events_task_created_idx
on public.workflow_task_events(task_id, created_at desc);

create index if not exists workflow_task_templates_active_next_due_idx
on public.workflow_task_templates(is_active, next_due_on)
where is_active;

create index if not exists workflow_task_attachments_task_created_idx
on public.workflow_task_attachments(task_id, created_at desc);

create or replace function public.current_app_can_read_workflow_task(
  target_branch_id uuid,
  target_assigned_to uuid,
  target_assignee_role text,
  target_created_by uuid,
  target_task_kind text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_can_manage()
    or public.current_app_can_read_all()
    or target_created_by = (select auth.uid())
    or target_assigned_to = (select auth.uid())
    or (target_branch_id is not null and public.current_app_can_access_branch(target_branch_id))
    or (target_assignee_role is not null and target_assignee_role = public.current_app_role())
    or (target_task_kind = 'personal' and target_created_by = (select auth.uid())),
    false
  )
$$;

create or replace function public.current_app_can_update_workflow_task(
  target_branch_id uuid,
  target_assigned_to uuid,
  target_assignee_role text,
  target_created_by uuid,
  target_task_kind text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_can_manage()
    or target_created_by = (select auth.uid())
    or target_assigned_to = (select auth.uid())
    or (
      target_branch_id is not null
      and public.current_app_role() in ('branch', 'supervisor')
      and public.current_app_can_access_branch(target_branch_id)
    )
    or (
      target_assignee_role is not null
      and target_assignee_role = public.current_app_role()
      and public.current_app_role() in ('accounts', 'warehouse', 'supervisor', 'branch')
    )
    or (target_task_kind = 'personal' and target_created_by = (select auth.uid())),
    false
  )
$$;

revoke all on function public.current_app_can_read_workflow_task(uuid, uuid, text, uuid, text) from public, anon;
revoke all on function public.current_app_can_update_workflow_task(uuid, uuid, text, uuid, text) from public, anon;
grant execute on function public.current_app_can_read_workflow_task(uuid, uuid, text, uuid, text) to authenticated, service_role;
grant execute on function public.current_app_can_update_workflow_task(uuid, uuid, text, uuid, text) to authenticated, service_role;

create or replace function public.prepare_workflow_task_template_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  new.updated_at := now();
  new.next_due_on := coalesce(new.next_due_on, new.starts_on);
  return new;
end;
$$;

create or replace function public.prepare_workflow_task_template_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_manage() then
    raise exception 'Only admins can update workflow task templates';
  end if;

  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prepare_workflow_task_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  new.updated_at := now();
  new.last_activity_at := now();

  if new.status = 'submitted' then
    new.submitted_at := coalesce(new.submitted_at, now());
  end if;

  if new.status in ('approved', 'rejected') then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, (select auth.uid()));
  end if;

  if new.status in ('approved', 'done', 'dismissed', 'expired') then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
  end if;

  return new;
end;
$$;

create or replace function public.enforce_workflow_task_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_app_can_manage() then
    if new.task_kind is distinct from old.task_kind
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.branch_id is distinct from old.branch_id
      or new.branch_name is distinct from old.branch_name
      or new.assignee_role is distinct from old.assignee_role
      or new.assigned_to is distinct from old.assigned_to
      or new.review_required is distinct from old.review_required
      or new.template_id is distinct from old.template_id
      or new.template_occurrence_date is distinct from old.template_occurrence_date
      or new.due_at is distinct from old.due_at
      or new.approved_by is distinct from old.approved_by
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.metadata is distinct from old.metadata
    then
      raise exception 'Only admins can change workflow task assignment, priority, due date, review, or template metadata';
    end if;

    if new.status in ('approved', 'rejected', 'expired') and new.status is distinct from old.status then
      raise exception 'Only admins can approve, reject, or expire workflow tasks';
    end if;

    if old.status in ('approved', 'done', 'dismissed', 'expired') and new.status is distinct from old.status then
      raise exception 'Only admins can reopen closed workflow tasks';
    end if;

    if new.task_kind = 'work' and new.status = 'dismissed' and new.status is distinct from old.status then
      raise exception 'Only admins can dismiss work tasks';
    end if;
  end if;

  new.updated_at := now();
  new.last_activity_at := now();

  if new.status is distinct from old.status then
    if new.status = 'submitted' then
      new.submitted_at := coalesce(new.submitted_at, now());
    elsif old.status = 'submitted' and new.status not in ('approved', 'rejected') then
      new.submitted_at := null;
    end if;

    if new.status in ('approved', 'rejected') then
      new.approved_at := coalesce(new.approved_at, now());
      new.approved_by := coalesce(new.approved_by, (select auth.uid()));
    elsif old.status in ('approved', 'rejected') then
      new.approved_at := null;
      new.approved_by := null;
    end if;

    if new.status in ('approved', 'done', 'dismissed', 'expired') then
      new.resolved_at := coalesce(new.resolved_at, now());
      new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
    elsif old.status in ('approved', 'done', 'dismissed', 'expired') then
      new.resolved_at := null;
      new.resolved_by := null;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prepare_workflow_task_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task_status text;
begin
  new.created_by := coalesce(new.created_by, (select auth.uid()));

  select status
  into current_task_status
  from public.workflow_tasks
  where id = new.task_id;

  if current_task_status is null then
    raise exception 'Workflow task event must reference an existing task';
  end if;

  if new.event_type in ('comment', 'created', 'template_generated') and (new.old_status is not null or new.new_status is not null) then
    raise exception 'Non-transition workflow task events cannot include status transition fields';
  end if;

  if new.event_type in ('status_changed', 'review') then
    if new.old_status is null or new.new_status is null then
      raise exception 'Workflow status events require old_status and new_status';
    end if;

    if new.new_status <> current_task_status then
      raise exception 'Workflow status event must match the current task status';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prepare_workflow_task_attachment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.uploaded_by := coalesce(new.uploaded_by, (select auth.uid()));
  return new;
end;
$$;

revoke all on function public.prepare_workflow_task_template_insert() from public, anon;
revoke all on function public.prepare_workflow_task_template_update() from public, anon;
revoke all on function public.prepare_workflow_task_insert() from public, anon;
revoke all on function public.enforce_workflow_task_update() from public, anon;
revoke all on function public.prepare_workflow_task_event_insert() from public, anon;
revoke all on function public.prepare_workflow_task_attachment_insert() from public, anon;

drop trigger if exists workflow_task_templates_before_insert on public.workflow_task_templates;
create trigger workflow_task_templates_before_insert
before insert on public.workflow_task_templates
for each row execute function public.prepare_workflow_task_template_insert();

drop trigger if exists workflow_task_templates_before_update on public.workflow_task_templates;
create trigger workflow_task_templates_before_update
before update on public.workflow_task_templates
for each row execute function public.prepare_workflow_task_template_update();

drop trigger if exists workflow_tasks_before_insert on public.workflow_tasks;
create trigger workflow_tasks_before_insert
before insert on public.workflow_tasks
for each row execute function public.prepare_workflow_task_insert();

drop trigger if exists workflow_tasks_before_update on public.workflow_tasks;
create trigger workflow_tasks_before_update
before update on public.workflow_tasks
for each row execute function public.enforce_workflow_task_update();

drop trigger if exists workflow_task_events_before_insert on public.workflow_task_events;
create trigger workflow_task_events_before_insert
before insert on public.workflow_task_events
for each row execute function public.prepare_workflow_task_event_insert();

drop trigger if exists workflow_task_attachments_before_insert on public.workflow_task_attachments;
create trigger workflow_task_attachments_before_insert
before insert on public.workflow_task_attachments
for each row execute function public.prepare_workflow_task_attachment_insert();

alter table public.workflow_task_templates enable row level security;
alter table public.workflow_tasks enable row level security;
alter table public.workflow_task_events enable row level security;
alter table public.workflow_task_attachments enable row level security;

revoke all on public.workflow_task_templates from anon;
revoke all on public.workflow_tasks from anon;
revoke all on public.workflow_task_events from anon;
revoke all on public.workflow_task_attachments from anon;

revoke all on public.workflow_task_templates from authenticated;
revoke all on public.workflow_tasks from authenticated;
revoke all on public.workflow_task_events from authenticated;
revoke all on public.workflow_task_attachments from authenticated;

grant select, insert, update, delete on public.workflow_task_templates to authenticated;
grant select, insert, update on public.workflow_tasks to authenticated;
grant select, insert on public.workflow_task_events to authenticated;
grant select, insert, delete on public.workflow_task_attachments to authenticated;

grant all on public.workflow_task_templates to service_role;
grant all on public.workflow_tasks to service_role;
grant all on public.workflow_task_events to service_role;
grant all on public.workflow_task_attachments to service_role;

drop policy if exists "workflow templates select scoped" on public.workflow_task_templates;
drop policy if exists "workflow templates insert managers" on public.workflow_task_templates;
drop policy if exists "workflow templates update managers" on public.workflow_task_templates;
drop policy if exists "workflow templates delete managers" on public.workflow_task_templates;
drop policy if exists "workflow tasks select scoped" on public.workflow_tasks;
drop policy if exists "workflow tasks insert scoped" on public.workflow_tasks;
drop policy if exists "workflow tasks update scoped" on public.workflow_tasks;
drop policy if exists "workflow events select scoped" on public.workflow_task_events;
drop policy if exists "workflow events insert scoped" on public.workflow_task_events;
drop policy if exists "workflow attachments select scoped" on public.workflow_task_attachments;
drop policy if exists "workflow attachments insert scoped" on public.workflow_task_attachments;
drop policy if exists "workflow attachments delete scoped" on public.workflow_task_attachments;

create policy "workflow templates select scoped"
on public.workflow_task_templates
for select
to authenticated
using (
  public.current_app_can_manage()
  or (
    is_active
    and public.current_app_can_read_workflow_task(branch_id, assigned_to, assignee_role, created_by, task_kind)
  )
);

create policy "workflow templates insert managers"
on public.workflow_task_templates
for insert
to authenticated
with check (public.current_app_can_manage());

create policy "workflow templates update managers"
on public.workflow_task_templates
for update
to authenticated
using (public.current_app_can_manage())
with check (public.current_app_can_manage());

create policy "workflow templates delete managers"
on public.workflow_task_templates
for delete
to authenticated
using (public.current_app_can_manage());

create policy "workflow tasks select scoped"
on public.workflow_tasks
for select
to authenticated
using (
  public.current_app_can_read_workflow_task(branch_id, assigned_to, assignee_role, created_by, task_kind)
);

create policy "workflow tasks insert scoped"
on public.workflow_tasks
for insert
to authenticated
with check (
  (created_by is null or created_by = (select auth.uid()))
  and (
    public.current_app_can_manage()
    or (
      task_kind = 'personal'
      and branch_id is null
      and assignee_role is null
      and assigned_to is null
    )
    or (
      task_kind = 'work'
      and public.current_app_role() in ('branch', 'supervisor', 'warehouse', 'accounts')
      and (branch_id is null or public.current_app_can_access_branch(branch_id))
    )
  )
);

create policy "workflow tasks update scoped"
on public.workflow_tasks
for update
to authenticated
using (
  public.current_app_can_update_workflow_task(branch_id, assigned_to, assignee_role, created_by, task_kind)
)
with check (
  public.current_app_can_update_workflow_task(branch_id, assigned_to, assignee_role, created_by, task_kind)
);

create policy "workflow events select scoped"
on public.workflow_task_events
for select
to authenticated
using (
  exists (
    select 1
    from public.workflow_tasks t
    where t.id = workflow_task_events.task_id
      and public.current_app_can_read_workflow_task(t.branch_id, t.assigned_to, t.assignee_role, t.created_by, t.task_kind)
  )
);

create policy "workflow events insert scoped"
on public.workflow_task_events
for insert
to authenticated
with check (
  (created_by is null or created_by = (select auth.uid()))
  and exists (
    select 1
    from public.workflow_tasks t
    where t.id = workflow_task_events.task_id
      and public.current_app_can_update_workflow_task(t.branch_id, t.assigned_to, t.assignee_role, t.created_by, t.task_kind)
  )
);

create policy "workflow attachments select scoped"
on public.workflow_task_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.workflow_tasks t
    where t.id = workflow_task_attachments.task_id
      and public.current_app_can_read_workflow_task(t.branch_id, t.assigned_to, t.assignee_role, t.created_by, t.task_kind)
  )
);

create policy "workflow attachments insert scoped"
on public.workflow_task_attachments
for insert
to authenticated
with check (
  (uploaded_by is null or uploaded_by = (select auth.uid()))
  and exists (
    select 1
    from public.workflow_tasks t
    where t.id = workflow_task_attachments.task_id
      and public.current_app_can_update_workflow_task(t.branch_id, t.assigned_to, t.assignee_role, t.created_by, t.task_kind)
  )
);

create policy "workflow attachments delete scoped"
on public.workflow_task_attachments
for delete
to authenticated
using (
  public.current_app_can_manage()
  or uploaded_by = (select auth.uid())
);

notify pgrst, 'reload schema';
