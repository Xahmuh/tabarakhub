begin;

-- The old policy granted every signed-in user every branch, bypassing the
-- existing role/branch-scope policies. The latter remain in place.
drop policy if exists "Allow reading branches" on public.branches;

notify pgrst, 'reload schema';

commit;
