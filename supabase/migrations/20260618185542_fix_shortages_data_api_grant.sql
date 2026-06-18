-- Keep shortages reachable by the Data API even while the browser session is
-- settling. RLS still exposes no rows to anon because no anon allow policy is
-- defined; authenticated users keep the existing branch-scoped policies.

alter table if exists public.shortages enable row level security;

grant select on table public.shortages to anon;
revoke insert, update, delete on table public.shortages from anon;

grant select, insert, update, delete on table public.shortages to authenticated;
grant all on table public.shortages to service_role;

notify pgrst, 'reload schema';
