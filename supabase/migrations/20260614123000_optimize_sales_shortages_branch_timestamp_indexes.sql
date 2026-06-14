-- Optimize branch-scoped sales/shortage reads under RLS without changing policy scope.
-- Local/prepared migration only until explicitly approved for the linked project.

create index if not exists idx_lost_sales_branch_timestamp_desc
on public.lost_sales (branch_id, "timestamp" desc);

create index if not exists idx_lost_sales_timestamp_desc
on public.lost_sales ("timestamp" desc);

create index if not exists idx_shortages_branch_timestamp_desc
on public.shortages (branch_id, "timestamp" desc);

create index if not exists idx_shortages_timestamp_desc
on public.shortages ("timestamp" desc);

analyze public.lost_sales;
analyze public.shortages;
