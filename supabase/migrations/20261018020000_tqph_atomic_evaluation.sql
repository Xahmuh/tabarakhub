-- A submitted evaluation is one transaction: audit, appraisal, then CAPA.
-- This function does not replace the separate TQPH row-scope RLS rollout.
alter table public.tqph_audits
  add column if not exists supervisor_name_snapshot text;
alter table public.tqph_appraisals
  add column if not exists supervisor_name_snapshot text;

create or replace function private.submit_tqph_evaluation(
  p_audit jsonb,
  p_appraisal jsonb,
  p_capas jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_audit public.tqph_audits%rowtype;
  v_appraisal public.tqph_appraisals%rowtype;
  v_capa public.tqph_capa_tasks%rowtype;
  v_capa_json jsonb;
  v_capa_ids text[] := '{}';
  v_expected_capa_codes text[];
  v_submitted_capa_codes text[] := '{}';
  v_audit_items integer;
  v_applicable_items integer;
  v_invalid_audit_items integer;
  v_audit_points numeric;
  v_audit_codes text[];
  v_required_audit_codes text[];
  v_appraisal_criteria integer;
  v_invalid_criteria integer;
  v_appraisal_points integer;
  v_appraisal_codes text[];
  v_required_appraisal_codes text[];
  v_supervisor_name text;
begin
  if v_user_id is null or public.current_app_role() <> 'supervisor' then
    raise exception 'Only an authenticated supervisor may submit an evaluation';
  end if;
  if p_audit is null or p_appraisal is null or p_capas is null
     or jsonb_typeof(p_audit) <> 'object'
     or jsonb_typeof(p_appraisal) <> 'object'
     or jsonb_typeof(p_capas) <> 'array' then
    raise exception 'Invalid evaluation payload';
  end if;

  v_audit := jsonb_populate_record(null::public.tqph_audits, p_audit);
  v_appraisal := jsonb_populate_record(null::public.tqph_appraisals, p_appraisal);

  if v_audit.id is null or v_audit.branch_id is null
     or v_appraisal.id is null or v_appraisal.pharmacist_id is null
     or v_appraisal.branch_id is distinct from v_audit.branch_id then
    raise exception 'Audit, pharmacist and matching branch are required';
  end if;
  if not exists (
    select 1 from public.supervisor_branches sb
    where sb.supervisor_user_id = v_user_id
      and sb.branch_id::text = v_audit.branch_id
  ) then
    raise exception 'Supervisor is not assigned to this branch';
  end if;
  select nullif(btrim(profile.full_name), '') into v_supervisor_name
  from public.app_user_profiles profile
  where profile.user_id = v_user_id and profile.is_active;
  if v_supervisor_name is null then
    raise exception 'Supervisor full name is required before submission';
  end if;

  -- Never trust a browser-provided score or pass flag. The scoring version in
  -- this function matches the current equal-weight checklist and A*/A/B/C/F
  -- appraisal rules. A future rule change needs a versioned migration.
  select count(*),
         count(*) filter (where item.value->>'status' <> 'not_applicable'),
         count(*) filter (where item.value->>'status' not in
           ('fully_compliant', 'partially_compliant', 'non_compliant', 'not_applicable')
           or item.value->>'status' is null),
         coalesce(sum(case item.value->>'status'
           when 'fully_compliant' then 1::numeric
           when 'partially_compliant' then 0.5::numeric
           when 'non_compliant' then 0::numeric
           else 0::numeric end), 0)
    into v_audit_items, v_applicable_items, v_invalid_audit_items, v_audit_points
  from jsonb_array_elements(v_audit.sections) section
  cross join lateral jsonb_array_elements(section.value->'items') item;
  if v_audit_items = 0 or v_invalid_audit_items <> 0 then
    raise exception 'Audit checklist is incomplete or has invalid statuses';
  end if;
  select coalesce(array_agg(item.value->>'code' order by item.value->>'code'), '{}'::text[])
    into v_audit_codes
  from jsonb_array_elements(v_audit.sections) section
  cross join lateral jsonb_array_elements(section.value->'items') item;
  select array_agg(format('%s.%s', expected.section_number, item_number) order by
                   format('%s.%s', expected.section_number, item_number))
    into v_required_audit_codes
  from unnest(array[4, 4, 3, 3, 4, 4, 3, 4])
       with ordinality expected(item_count, section_number)
  cross join lateral generate_series(1, expected.item_count) item_number;
  if v_audit_codes is distinct from v_required_audit_codes then
    raise exception 'Audit checklist does not match the current 29-item version';
  end if;
  v_audit.compliance_score := case when v_applicable_items = 0 then 100
    else round(v_audit_points * 100 / v_applicable_items, 1) end;

  select count(*),
         count(*) filter (where criterion.value->>'grade' not in ('A*', 'A', 'B', 'C', 'F')
           or criterion.value->>'grade' is null
           or criterion.value->>'points' is distinct from
             (case criterion.value->>'grade'
               when 'A*' then 5 when 'A' then 4 when 'B' then 3
               when 'C' then 2 when 'F' then 1 end)::text),
         coalesce(sum(case criterion.value->>'grade'
           when 'A*' then 5 when 'A' then 4 when 'B' then 3
           when 'C' then 2 when 'F' then 1 else 0 end), 0)
    into v_appraisal_criteria, v_invalid_criteria, v_appraisal_points
  from jsonb_array_elements(v_appraisal.sections) section
  cross join lateral jsonb_array_elements(section.value->'criteria') criterion;
  if v_appraisal_criteria <> 30 or v_invalid_criteria <> 0 then
    raise exception 'Appraisal requires 30 valid graded criteria';
  end if;
  select coalesce(array_agg(criterion.value->>'code' order by criterion.value->>'code'), '{}'::text[])
    into v_appraisal_codes
  from jsonb_array_elements(v_appraisal.sections) section
  cross join lateral jsonb_array_elements(section.value->'criteria') criterion;
  select array_agg(format('%s.%s', expected.section_id, criterion_number) order by
                   format('%s.%s', expected.section_id, criterion_number))
    into v_required_appraisal_codes
  from unnest(array['I', 'II', 'III', 'IV', 'V', 'VI']::text[],
              array[7, 4, 5, 7, 3, 4]) expected(section_id, item_count)
  cross join lateral generate_series(1, expected.item_count) criterion_number;
  if v_appraisal_codes is distinct from v_required_appraisal_codes then
    raise exception 'Appraisal criteria do not match the current 30-item version';
  end if;
  v_appraisal.total_credit_score := v_appraisal_points;
  v_appraisal.passed := v_appraisal_points >= 95;

  select coalesce(array_agg(item.value->>'code' order by item.value->>'code'), '{}'::text[])
    into v_expected_capa_codes
  from jsonb_array_elements(v_audit.sections) section
  cross join lateral jsonb_array_elements(section.value->'items') item
  where item.value->>'status' = 'non_compliant'
     or (item.value->>'status' = 'partially_compliant'
         and item.value->>'requires_corrective_action' = 'true');
  if not exists (
    select 1 from public.pharmacists p
    where p.id::text = v_appraisal.pharmacist_id
      and p.branch_id::text = v_audit.branch_id
      and p.is_active = true
  ) then
    raise exception 'Pharmacist is not active in this branch';
  end if;

  for v_capa_json in select value from jsonb_array_elements(p_capas)
  loop
    if jsonb_typeof(v_capa_json) <> 'object' then
      raise exception 'Invalid CAPA task';
    end if;
    v_capa := jsonb_populate_record(null::public.tqph_capa_tasks, v_capa_json);
    if v_capa.id is null then
      raise exception 'CAPA task ID is required';
    end if;
    v_capa_ids := array_append(v_capa_ids, v_capa.id);
    v_submitted_capa_codes := array_append(v_submitted_capa_codes, v_capa.element_code);
  end loop;
  if v_expected_capa_codes is distinct from
     (select coalesce(array_agg(code order by code), '{}'::text[])
      from unnest(v_submitted_capa_codes) code) then
    raise exception 'CAPA tasks do not match checklist violations';
  end if;

  v_audit.supervisor_id := v_user_id::text;
  v_audit.supervisor_name_snapshot := v_supervisor_name;
  v_audit.submitted_by := v_user_id::text;
  v_audit.status := 'locked_submitted';
  v_audit.violations_list := v_capa_ids;
  v_audit.amended := false;
  v_audit.created_at := v_now;
  v_audit.updated_at := v_now;
  v_audit.locked_at := v_now;

  v_appraisal.supervisor_id := v_user_id::text;
  v_appraisal.supervisor_name_snapshot := v_supervisor_name;
  v_appraisal.submitted_by := v_user_id::text;
  v_appraisal.status := 'locked_submitted';
  v_appraisal.amended := false;
  v_appraisal.created_at := v_now;
  v_appraisal.updated_at := v_now;
  v_appraisal.locked_at := v_now;

  insert into public.tqph_audits select (v_audit).*;
  insert into public.tqph_appraisals select (v_appraisal).*;

  for v_capa_json in select value from jsonb_array_elements(p_capas)
  loop
    v_capa := jsonb_populate_record(null::public.tqph_capa_tasks, v_capa_json);
    if nullif(btrim(v_capa.violation), '') is null
       or nullif(btrim(v_capa.required_action), '') is null
       or nullif(btrim(v_capa.assigned_to), '') is null then
      raise exception 'CAPA reason, action and assignee are required';
    end if;
    v_capa.audit_id := v_audit.id;
    v_capa.severity := case split_part(v_capa.element_code, '.', 1)
      when '1' then 'Critical'
      when '7' then 'Critical'
      when '8' then 'Critical'
      when '5' then 'Major'
      when '6' then 'Major'
      else 'Minor' end;
    v_capa.status := 'open';
    v_capa.resolved_by := null;
    v_capa.resolved_at := null;
    v_capa.resolution_proof_url := null;
    v_capa.created_at := v_now;
    v_capa.due_date := v_now + interval '48 hours';
    insert into public.tqph_capa_tasks select (v_capa).*;
  end loop;
end;
$$;

revoke all on function private.submit_tqph_evaluation(jsonb, jsonb, jsonb) from public, anon;
grant execute on function private.submit_tqph_evaluation(jsonb, jsonb, jsonb) to authenticated;

-- The exposed endpoint has invoker rights; the narrowly scoped implementation
-- lives in the unexposed private schema.
create or replace function public.submit_tqph_evaluation(
  p_audit jsonb,
  p_appraisal jsonb,
  p_capas jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.submit_tqph_evaluation(p_audit, p_appraisal, p_capas)
$$;

revoke all on function public.submit_tqph_evaluation(jsonb, jsonb, jsonb) from public;
revoke all on function public.submit_tqph_evaluation(jsonb, jsonb, jsonb) from anon;
grant execute on function public.submit_tqph_evaluation(jsonb, jsonb, jsonb) to authenticated;
