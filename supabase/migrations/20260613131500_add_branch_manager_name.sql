-- Adds an editable branch manager display name to each branch identity.
-- This is single-tenant branch metadata and does not change the deployment model.

alter table public.branches
  add column if not exists branch_manager_name text;

comment on column public.branches.branch_manager_name is 'Branch manager display name for branch profile cards and operational handover.';
