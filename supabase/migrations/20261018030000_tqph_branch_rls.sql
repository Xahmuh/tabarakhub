-- Replace permissive TQPH policies with branch-scoped reads and RPC-only writes.
-- Apply after the employee RBAC foundation and atomic evaluation migrations.
do $$
declare
  v_unknown text;
begin
  if to_regprocedure('private.current_app_has_branch_scope(text)') is null
     or to_regprocedure('private.submit_tqph_evaluation(jsonb,jsonb,jsonb)') is null then
    raise exception 'TQPH RBAC foundation and atomic submission must be installed first';
  end if;

  select string_agg(tablename || ': ' || policyname, ', ' order by tablename, policyname)
    into v_unknown
  from pg_policies
  where schemaname = 'public'
    and tablename in ('tqph_audits', 'tqph_appraisals', 'tqph_capa_tasks',
                      'tqph_distribution_logs', 'tqph_attachments')
    and policyname not in (
      'Allow authenticated read on tqph_audits',
      'Allow authenticated insert/update on tqph_audits',
      'Allow anon read/write on tqph_audits',
      'tqph_audits authorized roles',
      'Allow authenticated read on tqph_appraisals',
      'Allow authenticated insert/update on tqph_appraisals',
      'Allow anon read/write on tqph_appraisals',
      'tqph_appraisals authorized roles',
      'Allow authenticated read on tqph_capa_tasks',
      'Allow authenticated update on tqph_capa_tasks',
      'Allow anon read/write on tqph_capa_tasks',
      'tqph_capa_tasks authorized roles',
      'Allow authenticated read on tqph_distribution_logs',
      'Allow authenticated insert on tqph_distribution_logs',
      'Allow anon read/write on tqph_distribution_logs',
      'tqph_distribution_logs authorized roles',
      'Allow authenticated read/write on tqph_attachments',
      'Allow anon read/write on tqph_attachments',
      'tqph_attachments authorized roles'
    );
  if v_unknown is not null then
    raise exception 'Review unexpected TQPH policies before applying: %', v_unknown;
  end if;
end $$;

drop policy if exists "Allow authenticated read on tqph_audits" on public.tqph_audits;
drop policy if exists "Allow authenticated insert/update on tqph_audits" on public.tqph_audits;
drop policy if exists "Allow anon read/write on tqph_audits" on public.tqph_audits;
drop policy if exists "tqph_audits authorized roles" on public.tqph_audits;
drop policy if exists "Allow authenticated read on tqph_appraisals" on public.tqph_appraisals;
drop policy if exists "Allow authenticated insert/update on tqph_appraisals" on public.tqph_appraisals;
drop policy if exists "Allow anon read/write on tqph_appraisals" on public.tqph_appraisals;
drop policy if exists "tqph_appraisals authorized roles" on public.tqph_appraisals;
drop policy if exists "Allow authenticated read on tqph_capa_tasks" on public.tqph_capa_tasks;
drop policy if exists "Allow authenticated update on tqph_capa_tasks" on public.tqph_capa_tasks;
drop policy if exists "Allow anon read/write on tqph_capa_tasks" on public.tqph_capa_tasks;
drop policy if exists "tqph_capa_tasks authorized roles" on public.tqph_capa_tasks;
drop policy if exists "Allow authenticated read on tqph_distribution_logs" on public.tqph_distribution_logs;
drop policy if exists "Allow authenticated insert on tqph_distribution_logs" on public.tqph_distribution_logs;
drop policy if exists "Allow anon read/write on tqph_distribution_logs" on public.tqph_distribution_logs;
drop policy if exists "tqph_distribution_logs authorized roles" on public.tqph_distribution_logs;
drop policy if exists "Allow authenticated read/write on tqph_attachments" on public.tqph_attachments;
drop policy if exists "Allow anon read/write on tqph_attachments" on public.tqph_attachments;
drop policy if exists "tqph_attachments authorized roles" on public.tqph_attachments;

alter table public.tqph_audits enable row level security;
alter table public.tqph_appraisals enable row level security;
alter table public.tqph_capa_tasks enable row level security;
alter table public.tqph_distribution_logs enable row level security;
alter table public.tqph_attachments enable row level security;

revoke all on public.tqph_audits, public.tqph_appraisals,
  public.tqph_capa_tasks, public.tqph_distribution_logs,
  public.tqph_attachments from anon;
revoke insert, update, delete on public.tqph_audits, public.tqph_appraisals,
  public.tqph_capa_tasks, public.tqph_distribution_logs,
  public.tqph_attachments from authenticated;
grant select on public.tqph_audits, public.tqph_appraisals,
  public.tqph_capa_tasks, public.tqph_distribution_logs,
  public.tqph_attachments to authenticated;

create policy "tqph_audits scoped read" on public.tqph_audits
  for select to authenticated
  using (private.current_app_has_branch_scope(branch_id));

create policy "tqph_appraisals scoped read" on public.tqph_appraisals
  for select to authenticated
  using (
    (select public.current_app_role()) in ('owner', 'manager', 'admin')
    or ((select public.current_app_role()) = 'supervisor'
        and private.current_app_has_branch_scope(branch_id))
  );

create policy "tqph_capa scoped read" on public.tqph_capa_tasks
  for select to authenticated
  using (exists (
    select 1 from public.tqph_audits audit
    where audit.id = audit_id
      and private.current_app_has_branch_scope(audit.branch_id)
  ));

create policy "tqph_distribution admin read" on public.tqph_distribution_logs
  for select to authenticated
  using ((select public.current_app_role()) in ('owner', 'manager', 'admin'));

create policy "tqph_attachments scoped read" on public.tqph_attachments
  for select to authenticated
  using (
    (select public.current_app_role()) in ('owner', 'manager', 'admin')
    or ((select public.current_app_role()) = 'supervisor' and exists (
      select 1 from public.tqph_audits audit
      where audit.id = audit_id
        and private.current_app_has_branch_scope(audit.branch_id)
    ))
  );

-- A locked audit/appraisal is an immutable historical record, including for
-- service-role writes. Corrections need a later append-only amendment design.
create or replace function private.reject_locked_tqph_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'locked_submitted' then
    raise exception 'Locked TQPH evaluations cannot be edited or deleted';
  end if;
  if tg_op = 'UPDATE' then return new; end if;
  return old;
end;
$$;

create trigger tqph_audits_locked_immutable
  before update or delete on public.tqph_audits
  for each row execute function private.reject_locked_tqph_mutation();
create trigger tqph_appraisals_locked_immutable
  before update or delete on public.tqph_appraisals
  for each row execute function private.reject_locked_tqph_mutation();

-- Evidence paths are not yet tied to an authenticated audit/CAPA owner. Keep
-- the bucket private and closed to browser roles until that mapping exists.
update storage.buckets set public = false where id = 'tqph-evidence';
drop policy if exists "Public Read on tqph-evidence" on storage.objects;
drop policy if exists "Upload on tqph-evidence" on storage.objects;
drop policy if exists "Update on tqph-evidence" on storage.objects;
drop policy if exists "TQPH evidence authorized read" on storage.objects;
drop policy if exists "TQPH evidence authorized insert" on storage.objects;
drop policy if exists "TQPH evidence authorized update" on storage.objects;
drop policy if exists "TQPH evidence authorized delete" on storage.objects;
drop policy if exists "TQPH evidence closed until scoped paths" on storage.objects;
create policy "TQPH evidence closed until scoped paths"
  on storage.objects as restrictive for all to public
  using (bucket_id <> 'tqph-evidence')
  with check (bucket_id <> 'tqph-evidence');

notify pgrst, 'reload schema';
