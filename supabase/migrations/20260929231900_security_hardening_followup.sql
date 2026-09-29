begin;

alter function public.fn_set_updated_at() set search_path = '';
revoke all on function public.fn_set_updated_at() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
