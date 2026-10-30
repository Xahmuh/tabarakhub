-- Run only after tqph_atomic_scope_local_setup.sql, the original TQPH schema,
-- and the two 20261018 TQPH migrations in a disposable PostgreSQL database.
insert into public.branches(id) values
  ('30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002');
insert into public.app_user_profiles(user_id, role, branch_id, full_name) values
  ('10000000-0000-4000-8000-000000000001', 'supervisor', null, 'Local Test Supervisor'),
  ('10000000-0000-4000-8000-000000000002', 'branch', '30000000-0000-4000-8000-000000000001', 'Local Test Branch'),
  ('10000000-0000-4000-8000-000000000003', 'manager', null, 'Local Test Manager'),
  ('10000000-0000-4000-8000-000000000004', 'supervisor', null, 'Other Supervisor');
insert into public.supervisor_branches(supervisor_user_id, branch_id) values
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
insert into public.pharmacists(id, branch_id, is_active) values
  ('ph-1', '30000000-0000-4000-8000-000000000001', true),
  ('ph-2', '30000000-0000-4000-8000-000000000002', true);
insert into storage.objects(bucket_id) values ('tqph-evidence');

-- A second-branch row tests both RLS isolation and unauthorized submission.
insert into public.tqph_audits
  (id, branch_id, supervisor_id, date, status, compliance_score, sections, submitted_by, locked_at)
values
  ('other-branch', '30000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000004', current_date,
   'locked_submitted', 70, '[]'::jsonb,
   '10000000-0000-4000-8000-000000000004', now());

do $$
begin
  if has_table_privilege('authenticated', 'public.tqph_audits', 'INSERT')
     or has_table_privilege('authenticated', 'public.tqph_audits', 'UPDATE')
     or has_table_privilege('authenticated', 'public.tqph_audits', 'DELETE') then
    raise exception 'TQPH direct mutations must be revoked';
  end if;
  if (select public from storage.buckets where id = 'tqph-evidence') then
    raise exception 'TQPH evidence bucket must be private';
  end if;
end $$;

set role authenticated;
set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'tqph-evidence') <> 0 then
    raise exception 'Unscoped supervisor evidence read was allowed';
  end if;
end $$;
do $$
declare
  v_sections jsonb;
  v_appraisal_sections jsonb;
  v_audit jsonb;
  v_appraisal jsonb;
  v_capa jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'section_code', section_number::text || '.0',
    'title', 'Local test section',
    'items', (select jsonb_agg(jsonb_build_object(
      'code', section_number::text || '.' || item_number::text,
      'label', 'Local test item',
      'status', case when section_number = 1 and item_number = 1
                     then 'non_compliant' else 'fully_compliant' end,
      'attachment_ids', jsonb_build_array()) order by item_number)
      from generate_series(1, item_count) item_number)
  ) order by section_number) into v_sections
  from unnest(array[4, 4, 3, 3, 4, 4, 3, 4])
       with ordinality sections(item_count, section_number);

  select jsonb_agg(jsonb_build_object(
    'section_id', section_id,
    'title', 'Local test appraisal',
    'criteria', (select jsonb_agg(jsonb_build_object(
      'code', section_id || '.' || criterion_number::text,
      'label', 'Local test criterion',
      'grade', 'A*', 'points', 5) order by criterion_number)
      from generate_series(1, item_count) criterion_number)
  )) into v_appraisal_sections
  from unnest(array['I', 'II', 'III', 'IV', 'V', 'VI']::text[],
              array[7, 4, 5, 7, 3, 4]) sections(section_id, item_count);

  v_audit := jsonb_build_object(
    'id', 'test-audit',
    'branch_id', '30000000-0000-4000-8000-000000000001',
    'date', current_date,
    'status', 'draft',
    'compliance_score', 0,
    'sections', v_sections);
  v_appraisal := jsonb_build_object(
    'id', 'test-appraisal',
    'pharmacist_id', 'ph-1',
    'branch_id', '30000000-0000-4000-8000-000000000001',
    'month', 10, 'year', 2026,
    'status', 'draft',
    'total_credit_score', 0,
    'passed', false,
    'sections', v_appraisal_sections);
  v_capa := jsonb_build_array(jsonb_build_object(
    'id', 'test-capa', 'element_code', '1.1',
    'violation', 'Local test violation',
    'required_action', 'Correct the issue',
    'severity', 'Minor', 'assigned_to', 'branch manager'));

  perform public.submit_tqph_evaluation(v_audit, v_appraisal, v_capa);

  if (select compliance_score from public.tqph_audits where id = 'test-audit') <> 96.6 then
    raise exception 'Server must compute 28/29 checklist score';
  end if;
  if (select supervisor_name_snapshot from public.tqph_audits where id = 'test-audit')
     <> 'Local Test Supervisor' then
    raise exception 'Audit must preserve verified supervisor name';
  end if;
  if not exists (select 1 from public.tqph_appraisals
                 where id = 'test-appraisal' and total_credit_score = 150 and passed) then
    raise exception 'Server must compute appraisal score and pass flag';
  end if;
  if (select count(*) from public.tqph_capa_tasks where audit_id = 'test-audit') <> 1 then
    raise exception 'CAPA must be committed with audit and appraisal';
  end if;
  if (select severity from public.tqph_capa_tasks where id = 'test-capa') <> 'Critical' then
    raise exception 'Server must derive CAPA severity from the audited item';
  end if;

  begin
    perform public.submit_tqph_evaluation(
      v_audit || jsonb_build_object('id', 'wrong-branch',
        'branch_id', '30000000-0000-4000-8000-000000000002'),
      v_appraisal || jsonb_build_object('id', 'wrong-appraisal',
        'pharmacist_id', 'ph-2',
        'branch_id', '30000000-0000-4000-8000-000000000002'),
      '[]'::jsonb);
    raise exception 'Cross-branch submission was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Supervisor is not assigned to this branch' then raise; end if;
  end;
  if exists (select 1 from public.tqph_audits where id = 'wrong-branch') then
    raise exception 'Rejected submission left a partial audit';
  end if;

  begin
    perform public.submit_tqph_evaluation(
      v_audit || jsonb_build_object('id', 'missing-capa'),
      v_appraisal || jsonb_build_object('id', 'missing-capa-appraisal'),
      '[]'::jsonb);
    raise exception 'CAPA mismatch was accepted';
  exception when raise_exception then
    if sqlerrm <> 'CAPA tasks do not match checklist violations' then raise; end if;
  end;
end $$;

do $$
begin
  if (select count(*) from public.tqph_audits) <> 1 then
    raise exception 'Supervisor read scope includes another branch';
  end if;
end $$;

set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
do $$
begin
  if (select count(*) from public.tqph_audits) <> 1
     or (select count(*) from public.tqph_capa_tasks) <> 1
     or (select count(*) from public.tqph_appraisals) <> 0 then
    raise exception 'Branch reader received the wrong TQPH data scope';
  end if;
end $$;

set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
do $$
begin
  if (select count(*) from public.tqph_audits) <> 2 then
    raise exception 'Manager should see both branches';
  end if;
end $$;
reset role;

do $$
begin
  begin
    update public.tqph_audits set compliance_score = 10 where id = 'test-audit';
    raise exception 'Locked audit was edited';
  exception when raise_exception then
    if sqlerrm <> 'Locked TQPH evaluations cannot be edited or deleted' then raise; end if;
  end;
end $$;

select 'TQPH atomic submission, score, scope and immutable lock passed' as result;
