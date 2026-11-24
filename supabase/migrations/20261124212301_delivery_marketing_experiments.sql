create table public.delivery_marketing_experiments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  block_number text not null references public.delivery_blocks(block_number),
  comparison_block_number text not null references public.delivery_blocks(block_number),
  starts_on date not null,
  ends_on date not null,
  budget_bhd numeric(12,3) not null check (budget_bhd between 0 and 999999999.999),
  goal_metric text not null check (goal_metric in ('additional_orders', 'order_growth_pct', 'recorded_value_bhd')),
  goal_target numeric(12,3) not null check (goal_target between 0.001 and 999999999.999),
  created_at timestamptz not null default now(),
  check (block_number <> comparison_block_number),
  check (ends_on >= starts_on),
  check (goal_metric <> 'additional_orders' or goal_target = trunc(goal_target))
);

alter table public.delivery_marketing_experiments enable row level security;
revoke all on public.delivery_marketing_experiments from public, anon, authenticated;
grant select on public.delivery_marketing_experiments to authenticated;
grant insert (branch_id, block_number, comparison_block_number, starts_on, ends_on, budget_bhd, goal_metric, goal_target)
  on public.delivery_marketing_experiments to authenticated;
grant update (branch_id, block_number, comparison_block_number, starts_on, ends_on, budget_bhd, goal_metric, goal_target)
  on public.delivery_marketing_experiments to authenticated;
create index delivery_marketing_experiments_created_idx on public.delivery_marketing_experiments (created_at desc, id desc);

create function public.app_delivery_marketing_experiment_access(p_write boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with identity as (
    select auth.uid() as user_id, public.current_app_role() as role
  )
  select coalesce(user_id is not null and (
    role in ('admin', 'manager') or (
      role = 'owner' and coalesce(
        (select p.access_level::text from public.app_user_feature_permissions p
          where p.user_id = identity.user_id and p.feature_name = 'delivery'),
        (select p.access_level::text from public.role_permissions p
          where p.role = identity.role and p.feature_name = 'delivery'),
        (select case when bool_or(p.access_level = 'edit') then 'edit' else 'read' end
          from public.app_user_feature_permissions p
          where p.user_id = identity.user_id and p.feature_name like 'delivery:%'
            and p.access_level in ('read', 'edit')
          having count(*) > 0),
        'none'
      ) in ('edit', case when p_write then 'edit' else 'read' end)
    )
  ), false)
  from identity;
$$;

revoke all on function public.app_delivery_marketing_experiment_access(boolean) from public, anon, authenticated;
grant execute on function public.app_delivery_marketing_experiment_access(boolean) to authenticated;

create policy "Marketing experiments read" on public.delivery_marketing_experiments
  for select to authenticated using ((select public.app_delivery_marketing_experiment_access(false)));

create policy "Marketing experiments insert" on public.delivery_marketing_experiments
  for insert to authenticated with check (
    (select public.app_delivery_marketing_experiment_access(true))
    and public.current_app_can_access_branch(branch_id)
  );

create policy "Marketing experiments update" on public.delivery_marketing_experiments
  for update to authenticated
  using ((select public.app_delivery_marketing_experiment_access(true)))
  with check (
    (select public.app_delivery_marketing_experiment_access(true))
    and public.current_app_can_access_branch(branch_id)
  );
