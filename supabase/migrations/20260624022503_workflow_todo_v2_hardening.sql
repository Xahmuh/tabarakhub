-- Workflow & Todo v2 hardening.
-- Follow-up migration on top of 20260624015026_workflow_todo_module.sql.
--
-- Safety posture:
-- - Do not touch legacy modules or shared permission tables.
-- - Do not rename v1 columns that the current app may still read.
-- - Add reviewed_* fields while keeping approved_* as compatibility aliases.
-- - All schema changes stay inside workflow_* objects.

alter table public.workflow_task_templates
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflow_task_templates_ends_on_check'
      and conrelid = 'public.workflow_task_templates'::regclass
  ) then
    alter table public.workflow_task_templates
      add constraint workflow_task_templates_ends_on_check
      check (ends_on is null or ends_on >= starts_on) not valid;
  end if;
end $$;

alter table public.workflow_tasks
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_outcome text,
  add column if not exists dismissed_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflow_tasks_review_outcome_check'
      and conrelid = 'public.workflow_tasks'::regclass
  ) then
    alter table public.workflow_tasks
      add constraint workflow_tasks_review_outcome_check
      check (review_outcome is null or review_outcome in ('approved', 'rejected'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workflow_tasks'
      and column_name = 'approved_at'
  ) then
    update public.workflow_tasks
    set reviewed_at = coalesce(reviewed_at, approved_at),
        reviewed_by = coalesce(reviewed_by, approved_by),
        review_outcome = coalesce(
          review_outcome,
          case when status in ('approved', 'rejected') then status else null end
        )
    where reviewed_at is null
       or reviewed_by is null
       or (review_outcome is null and status in ('approved', 'rejected'));
  end if;
end $$;

alter table public.workflow_tasks
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector(
        'simple',
        coalesce(title, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(branch_name, '')
      )
    ) stored;

alter table public.workflow_task_templates
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector(
        'simple',
        coalesce(title, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(branch_name, '')
      )
    ) stored;

create index if not exists workflow_tasks_search_vector_idx
  on public.workflow_tasks using gin(search_vector);

create index if not exists workflow_task_templates_search_vector_idx
  on public.workflow_task_templates using gin(search_vector);

alter table public.workflow_task_attachments
  add column if not exists scan_status text not null default 'pending',
  add column if not exists scanned_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflow_task_attachments_scan_status_check'
      and conrelid = 'public.workflow_task_attachments'::regclass
  ) then
    alter table public.workflow_task_attachments
      add constraint workflow_task_attachments_scan_status_check
      check (scan_status in ('pending', 'clean', 'flagged', 'skipped'));
  end if;
end $$;

create table if not exists public.workflow_task_template_events (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workflow_task_templates(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'updated', 'deactivated', 'deleted')),
  changed_fields jsonb,
  old_values jsonb,
  new_values jsonb,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists workflow_task_template_events_template_idx
  on public.workflow_task_template_events(template_id, created_at desc);

alter table public.workflow_task_template_events enable row level security;

revoke all on public.workflow_task_template_events from anon;
revoke all on public.workflow_task_template_events from authenticated;
grant select on public.workflow_task_template_events to authenticated;
grant all on public.workflow_task_template_events to service_role;

drop policy if exists "workflow template events select managers" on public.workflow_task_template_events;
create policy "workflow template events select managers"
on public.workflow_task_template_events
for select
to authenticated
using (public.current_app_can_manage());

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
    or (
      target_task_kind = 'personal'
      and target_created_by = (select auth.uid())
    )
    or (
      target_task_kind = 'work'
      and (
        public.current_app_can_read_all()
        or target_created_by = (select auth.uid())
        or target_assigned_to = (select auth.uid())
        or (target_branch_id is not null and public.current_app_can_access_branch(target_branch_id))
        or (target_assignee_role is not null and target_assignee_role = public.current_app_role())
      )
    ),
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

create or replace function public.prepare_workflow_task_template_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('workflow.internal_template_update', true), '') <> 'on'
     and not public.current_app_can_manage() then
    raise exception 'Only admins can update workflow task templates';
  end if;

  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.soft_delete_workflow_task_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('workflow.internal_template_update', 'on', true);

  update public.workflow_task_templates
  set deleted_at = coalesce(deleted_at, now()),
      deleted_by = coalesce(deleted_by, (select auth.uid())),
      is_active = false,
      updated_at = now()
  where id = old.id;

  perform set_config('workflow.internal_template_update', 'off', true);
  return null;
end;
$$;

drop trigger if exists workflow_task_templates_before_delete on public.workflow_task_templates;
create trigger workflow_task_templates_before_delete
before delete on public.workflow_task_templates
for each row execute function public.soft_delete_workflow_task_template();

create or replace function public.deny_workflow_task_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'workflow_task_events rows are immutable: insert only';
end;
$$;

drop trigger if exists workflow_task_events_immutability_guard on public.workflow_task_events;
create trigger workflow_task_events_immutability_guard
before update or delete on public.workflow_task_events
for each row execute function public.deny_workflow_task_event_mutation();

create or replace function public.deny_workflow_template_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'workflow_task_template_events rows are immutable: insert only';
end;
$$;

drop trigger if exists workflow_template_events_immutability_guard on public.workflow_task_template_events;
create trigger workflow_template_events_immutability_guard
before update or delete on public.workflow_task_template_events
for each row execute function public.deny_workflow_template_event_mutation();

create or replace function public.record_workflow_task_template_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workflow_task_template_events
    (template_id, event_type, created_by, new_values)
  values
    (new.id, 'created', new.created_by, to_jsonb(new) - 'search_vector');
  return null;
end;
$$;

drop trigger if exists workflow_task_templates_after_insert on public.workflow_task_templates;
create trigger workflow_task_templates_after_insert
after insert on public.workflow_task_templates
for each row execute function public.record_workflow_task_template_created();

create or replace function public.record_workflow_task_template_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed jsonb := '{}'::jsonb;
  old_vals jsonb := '{}'::jsonb;
  new_vals jsonb := '{}'::jsonb;
  event_name text := 'updated';
begin
  if new.deleted_at is distinct from old.deleted_at then
    changed := changed || '{"deleted_at":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('deleted_at', old.deleted_at);
    new_vals := new_vals || jsonb_build_object('deleted_at', new.deleted_at);
    event_name := 'deleted';
  end if;

  if new.deleted_by is distinct from old.deleted_by then
    changed := changed || '{"deleted_by":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('deleted_by', old.deleted_by);
    new_vals := new_vals || jsonb_build_object('deleted_by', new.deleted_by);
  end if;

  if new.title is distinct from old.title then
    changed := changed || '{"title":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('title', old.title);
    new_vals := new_vals || jsonb_build_object('title', new.title);
  end if;

  if new.description is distinct from old.description then
    changed := changed || '{"description":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('description', old.description);
    new_vals := new_vals || jsonb_build_object('description', new.description);
  end if;

  if new.priority is distinct from old.priority then
    changed := changed || '{"priority":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('priority', old.priority);
    new_vals := new_vals || jsonb_build_object('priority', new.priority);
  end if;

  if new.recurrence_frequency is distinct from old.recurrence_frequency then
    changed := changed || '{"recurrence_frequency":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('recurrence_frequency', old.recurrence_frequency);
    new_vals := new_vals || jsonb_build_object('recurrence_frequency', new.recurrence_frequency);
  end if;

  if new.starts_on is distinct from old.starts_on then
    changed := changed || '{"starts_on":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('starts_on', old.starts_on);
    new_vals := new_vals || jsonb_build_object('starts_on', new.starts_on);
  end if;

  if new.ends_on is distinct from old.ends_on then
    changed := changed || '{"ends_on":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('ends_on', old.ends_on);
    new_vals := new_vals || jsonb_build_object('ends_on', new.ends_on);
  end if;

  if new.next_due_on is distinct from old.next_due_on then
    changed := changed || '{"next_due_on":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('next_due_on', old.next_due_on);
    new_vals := new_vals || jsonb_build_object('next_due_on', new.next_due_on);
  end if;

  if new.branch_id is distinct from old.branch_id then
    changed := changed || '{"branch_id":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('branch_id', old.branch_id);
    new_vals := new_vals || jsonb_build_object('branch_id', new.branch_id);
  end if;

  if new.branch_name is distinct from old.branch_name then
    changed := changed || '{"branch_name":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('branch_name', old.branch_name);
    new_vals := new_vals || jsonb_build_object('branch_name', new.branch_name);
  end if;

  if new.assignee_role is distinct from old.assignee_role then
    changed := changed || '{"assignee_role":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('assignee_role', old.assignee_role);
    new_vals := new_vals || jsonb_build_object('assignee_role', new.assignee_role);
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    changed := changed || '{"assigned_to":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('assigned_to', old.assigned_to);
    new_vals := new_vals || jsonb_build_object('assigned_to', new.assigned_to);
  end if;

  if new.review_required is distinct from old.review_required then
    changed := changed || '{"review_required":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('review_required', old.review_required);
    new_vals := new_vals || jsonb_build_object('review_required', new.review_required);
  end if;

  if new.is_active is distinct from old.is_active then
    changed := changed || '{"is_active":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('is_active', old.is_active);
    new_vals := new_vals || jsonb_build_object('is_active', new.is_active);
    if event_name <> 'deleted' and not new.is_active then
      event_name := 'deactivated';
    end if;
  end if;

  if new.metadata is distinct from old.metadata then
    changed := changed || '{"metadata":true}'::jsonb;
    old_vals := old_vals || jsonb_build_object('metadata', old.metadata);
    new_vals := new_vals || jsonb_build_object('metadata', new.metadata);
  end if;

  if changed <> '{}'::jsonb then
    insert into public.workflow_task_template_events
      (template_id, event_type, changed_fields, old_values, new_values, created_by)
    values
      (new.id, event_name, changed, old_vals, new_vals, (select auth.uid()));
  end if;

  return null;
end;
$$;

drop trigger if exists workflow_task_templates_after_update on public.workflow_task_templates;
create trigger workflow_task_templates_after_update
after update on public.workflow_task_templates
for each row execute function public.record_workflow_task_template_updated();

create or replace function public.advance_template_next_due_on()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  template_row record;
  next_due date;
begin
  if new.template_id is null or new.template_occurrence_date is null then
    return new;
  end if;

  select recurrence_frequency, ends_on, is_active
  into template_row
  from public.workflow_task_templates
  where id = new.template_id
  for update;

  if not found or not template_row.is_active then
    return new;
  end if;

  next_due := case template_row.recurrence_frequency
    when 'daily' then (new.template_occurrence_date + interval '1 day')::date
    when 'weekly' then (new.template_occurrence_date + interval '1 week')::date
    when 'monthly' then (new.template_occurrence_date + interval '1 month')::date
    when 'quarterly' then (new.template_occurrence_date + interval '3 months')::date
    else null
  end;

  perform set_config('workflow.internal_template_update', 'on', true);

  if template_row.ends_on is not null and next_due > template_row.ends_on then
    update public.workflow_task_templates
    set next_due_on = null,
        is_active = false,
        metadata = metadata || jsonb_build_object('deactivation_note', 'Recurrence ended: next_due_on exceeded ends_on'),
        updated_at = now()
    where id = new.template_id;
  else
    update public.workflow_task_templates
    set next_due_on = next_due,
        updated_at = now()
    where id = new.template_id;
  end if;

  perform set_config('workflow.internal_template_update', 'off', true);
  return new;
end;
$$;

drop trigger if exists workflow_tasks_after_insert_advance_template on public.workflow_tasks;
create trigger workflow_tasks_after_insert_advance_template
after insert on public.workflow_tasks
for each row
when (new.template_id is not null and new.template_occurrence_date is not null)
execute function public.advance_template_next_due_on();

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
    new.reviewed_at := coalesce(new.reviewed_at, new.approved_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, new.approved_by, (select auth.uid()));
    new.review_outcome := new.status;
    new.approved_at := coalesce(new.approved_at, new.reviewed_at);
    new.approved_by := coalesce(new.approved_by, new.reviewed_by);
  end if;

  if new.status in ('approved', 'done', 'dismissed', 'expired') then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
  end if;

  if new.status = 'dismissed' then
    new.dismissed_by := coalesce(new.dismissed_by, (select auth.uid()));
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
      or new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.review_outcome is distinct from old.review_outcome
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by
      or new.dismissed_by is distinct from old.dismissed_by
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
      new.reviewed_at := coalesce(new.reviewed_at, new.approved_at, now());
      new.reviewed_by := coalesce(new.reviewed_by, new.approved_by, (select auth.uid()));
      new.review_outcome := new.status;
      new.approved_at := coalesce(new.approved_at, new.reviewed_at);
      new.approved_by := coalesce(new.approved_by, new.reviewed_by);
    elsif old.status in ('approved', 'rejected') then
      new.reviewed_at := null;
      new.reviewed_by := null;
      new.review_outcome := null;
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

    if new.status = 'dismissed' then
      new.dismissed_by := coalesce(new.dismissed_by, (select auth.uid()));
    elsif old.status = 'dismissed' then
      new.dismissed_by := null;
    end if;
  end if;

  return new;
end;
$$;

insert into public.workflow_task_template_events
  (template_id, event_type, created_by, new_values, note, created_at)
select t.id,
       'created',
       t.created_by,
       to_jsonb(t) - 'search_vector',
       'Backfilled by workflow v2 migration',
       t.created_at
from public.workflow_task_templates t
where not exists (
  select 1
  from public.workflow_task_template_events e
  where e.template_id = t.id
    and e.event_type = 'created'
);

drop policy if exists "workflow templates select scoped" on public.workflow_task_templates;
create policy "workflow templates select scoped"
on public.workflow_task_templates
for select
to authenticated
using (
  deleted_at is null
  and (
    public.current_app_can_manage()
    or (
      is_active
      and public.current_app_can_read_workflow_task(branch_id, assigned_to, assignee_role, created_by, task_kind)
    )
  )
);

drop policy if exists "workflow templates select deleted managers" on public.workflow_task_templates;
create policy "workflow templates select deleted managers"
on public.workflow_task_templates
for select
to authenticated
using (
  deleted_at is not null
  and public.current_app_can_manage()
);

drop policy if exists "workflow tasks insert scoped" on public.workflow_tasks;
create policy "workflow tasks insert scoped"
on public.workflow_tasks
for insert
to authenticated
with check (
  (created_by is null or created_by = (select auth.uid()))
  and (
    public.current_app_can_manage()
    or (
      template_id is null
      and template_occurrence_date is null
      and (
        (
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
    )
  )
);

create index if not exists workflow_task_templates_active_not_deleted_idx
  on public.workflow_task_templates(is_active, next_due_on)
  where is_active and deleted_at is null;

revoke all on function public.soft_delete_workflow_task_template() from public, anon;
revoke all on function public.deny_workflow_task_event_mutation() from public, anon;
revoke all on function public.deny_workflow_template_event_mutation() from public, anon;
revoke all on function public.record_workflow_task_template_created() from public, anon;
revoke all on function public.record_workflow_task_template_updated() from public, anon;
revoke all on function public.advance_template_next_due_on() from public, anon;
revoke all on function public.prepare_workflow_task_template_update() from public, anon;
revoke all on function public.prepare_workflow_task_insert() from public, anon;
revoke all on function public.enforce_workflow_task_update() from public, anon;

revoke all on function public.current_app_can_read_workflow_task(uuid, uuid, text, uuid, text) from public, anon;
revoke all on function public.current_app_can_update_workflow_task(uuid, uuid, text, uuid, text) from public, anon;
grant execute on function public.current_app_can_read_workflow_task(uuid, uuid, text, uuid, text) to authenticated, service_role;
grant execute on function public.current_app_can_update_workflow_task(uuid, uuid, text, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
