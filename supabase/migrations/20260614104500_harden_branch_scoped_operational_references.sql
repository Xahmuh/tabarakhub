-- Harden operational branch-scoped references after separating users from branches.
--
-- This migration does not delete legacy public.branches rows. It backs up and
-- removes obsolete references from operational mapping tables that pointed at
-- non-branch rows, then adds forward-looking guards for affected workflows.

create table if not exists public.legacy_branch_scope_reference_backups (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_pk text not null,
  branch_id uuid,
  branch_code text,
  branch_role text,
  payload jsonb not null,
  captured_at timestamptz not null default now()
);

create unique index if not exists legacy_branch_scope_reference_backups_source_idx
  on public.legacy_branch_scope_reference_backups(source_table, source_pk);

alter table public.legacy_branch_scope_reference_backups enable row level security;
revoke all on public.legacy_branch_scope_reference_backups from anon, authenticated;
grant all on public.legacy_branch_scope_reference_backups to service_role;

do $$
begin
  if to_regclass('public.feature_permissions') is not null then
    insert into public.legacy_branch_scope_reference_backups (
      source_table,
      source_pk,
      branch_id,
      branch_code,
      branch_role,
      payload
    )
    select
      'feature_permissions',
      fp.id::text,
      fp.branch_id,
      b.code,
      b.role,
      to_jsonb(fp)
    from public.feature_permissions fp
    join public.branches b on b.id = fp.branch_id
    where b.role <> 'branch' or b.role is null
    on conflict (source_table, source_pk) do nothing;

    delete from public.feature_permissions fp
    using public.branches b
    where b.id = fp.branch_id
      and (b.role <> 'branch' or b.role is null);
  end if;

  if to_regclass('public.pharmacist_branches') is not null then
    insert into public.legacy_branch_scope_reference_backups (
      source_table,
      source_pk,
      branch_id,
      branch_code,
      branch_role,
      payload
    )
    select
      'pharmacist_branches',
      pb.pharmacist_id::text || ':' || pb.branch_id::text,
      pb.branch_id,
      b.code,
      b.role,
      to_jsonb(pb)
    from public.pharmacist_branches pb
    join public.branches b on b.id = pb.branch_id
    where b.role <> 'branch' or b.role is null
    on conflict (source_table, source_pk) do nothing;

    delete from public.pharmacist_branches pb
    using public.branches b
    where b.id = pb.branch_id
      and (b.role <> 'branch' or b.role is null);
  end if;
end $$;

do $$
begin
  if to_regclass('public.delivery_orders') is not null then
    execute 'drop trigger if exists ensure_delivery_orders_operational_branch on public.delivery_orders';
    execute 'create trigger ensure_delivery_orders_operational_branch
      before insert or update of branch_id
      on public.delivery_orders
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;

  if to_regclass('public.branch_classifications') is not null then
    execute 'drop trigger if exists ensure_branch_classifications_operational_branch on public.branch_classifications';
    execute 'create trigger ensure_branch_classifications_operational_branch
      before insert or update of branch_id
      on public.branch_classifications
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;

  if to_regclass('public.cash_differences') is not null then
    execute 'drop trigger if exists ensure_cash_differences_operational_branch on public.cash_differences';
    execute 'create trigger ensure_cash_differences_operational_branch
      before insert or update of branch_id
      on public.cash_differences
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;

  if to_regclass('public.lost_sales') is not null then
    execute 'drop trigger if exists ensure_lost_sales_operational_branch on public.lost_sales';
    execute 'create trigger ensure_lost_sales_operational_branch
      before insert or update of branch_id
      on public.lost_sales
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;

  if to_regclass('public.shortages') is not null then
    execute 'drop trigger if exists ensure_shortages_operational_branch on public.shortages';
    execute 'create trigger ensure_shortages_operational_branch
      before insert or update of branch_id
      on public.shortages
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;

  if to_regclass('public.pharmacist_branches') is not null then
    execute 'drop trigger if exists ensure_pharmacist_branches_operational_branch on public.pharmacist_branches';
    execute 'create trigger ensure_pharmacist_branches_operational_branch
      before insert or update of branch_id
      on public.pharmacist_branches
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;

  if to_regclass('public.operations_tasks') is not null then
    execute 'drop trigger if exists ensure_operations_tasks_operational_branch on public.operations_tasks';
    execute 'create trigger ensure_operations_tasks_operational_branch
      before insert or update of branch_id
      on public.operations_tasks
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;

  if to_regclass('public.branch_login_approvals') is not null then
    execute 'drop trigger if exists ensure_branch_login_approvals_operational_branch on public.branch_login_approvals';
    execute 'create trigger ensure_branch_login_approvals_operational_branch
      before insert or update of branch_id
      on public.branch_login_approvals
      for each row
      execute function public.ensure_operational_branch_reference()';
  end if;
end $$;
