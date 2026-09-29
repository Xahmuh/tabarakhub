begin;

-- Trigger functions are invoked by PostgreSQL triggers and never need direct
-- Data API execution privileges. Revoking these grants removes them from the
-- callable RPC surface without changing trigger behavior.
do $$
declare
  function_signature text;
begin
  for function_signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      function_signature
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
