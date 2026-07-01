-- Workflow & Todo operational parity follow-up.
-- Scope is intentionally limited to workflow_* objects.

alter table public.workflow_task_templates
  drop constraint if exists workflow_task_templates_recurrence_frequency_check;

alter table public.workflow_task_templates
  add constraint workflow_task_templates_recurrence_frequency_check
  check (recurrence_frequency in ('none', 'daily', 'weekly', 'monthly', 'quarterly'));

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

  if template_row.recurrence_frequency = 'none' then
    update public.workflow_task_templates
    set next_due_on = null,
        is_active = false,
        metadata = metadata || jsonb_build_object('deactivation_note', 'One-time template generated'),
        updated_at = now()
    where id = new.template_id;
  elsif template_row.ends_on is not null and next_due > template_row.ends_on then
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

revoke all on function public.advance_template_next_due_on() from public, anon;

notify pgrst, 'reload schema';
