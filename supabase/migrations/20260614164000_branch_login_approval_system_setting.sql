alter table public.system_settings
  add column if not exists branch_login_approval_required boolean not null default true;

update public.system_settings
set branch_login_approval_required = coalesce(branch_login_approval_required, true)
where id = 'global';

notify pgrst, 'reload schema';
