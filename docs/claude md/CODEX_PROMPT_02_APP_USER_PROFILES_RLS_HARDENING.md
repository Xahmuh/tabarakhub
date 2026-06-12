# CODEX PROMPT: app_user_profiles RLS Hardening Verification

## Objective
Verify and, if necessary, harden RLS policies on `app_user_profiles` so that no role reachable from the frontend (`authenticated`) can INSERT or UPDATE rows in this table, since it is the source of truth for role and branch scoping used by all other RLS policies.

## Context
Auth uses Supabase Auth plus `public.app_user_profiles` for role (`admin`/`manager`/`accounts`/`branch`) and branch scoping. The stated production rule is that normal users must not be able to mutate `app_user_profiles`; provisioning happens through Supabase Auth plus trusted SQL/service-role tooling only. If this table can be mutated by an authenticated user, every downstream RLS policy that trusts it is compromised (privilege escalation vector).

## Files To Inspect First
- supabase/migrations/ (all migrations touching app_user_profiles)
- docs/POST_MIGRATION_SECURITY_CHECKS.sql
- docs/PRODUCTION_SECURITY_SETUP.md
- docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md

## Scope
- Inspect all existing RLS policies on `public.app_user_profiles` for `INSERT`, `UPDATE`, and `DELETE` on the `authenticated` role.
- If any such policy exists (even one scoped to "own row" for non-role/non-branch columns), document it and assess whether it could be used to escalate role or change branch scope.
- If a gap is found (authenticated users can mutate role/branch fields, or can insert new profile rows), add or modify migrations to remove/restrict these policies so that `app_user_profiles` is writable only by `service_role`.
- Add or extend `docs/POST_MIGRATION_SECURITY_CHECKS.sql` with an explicit check that attempts (and expects to fail) an `UPDATE` of `role` and `branch_id` columns on `app_user_profiles` as an `authenticated` test user.

## Out Of Scope
- Do not change the login screen's email/code mapping logic (`<code>@tabarak.local`).
- Do not modify role definitions or add new roles.
- Do not touch RLS policies on other tables in this prompt (covered by a separate prompt).

## Data And Security Notes
- This is the highest-priority RLS check in the system — `app_user_profiles` is load-bearing for every other policy's role/branch checks.
- Any fix must be expressed as a migration (new file in supabase/migrations/), not a manual dashboard change, so it's reproducible per dedicated-client deployment.
- Service-role access (for admin provisioning tooling) must remain functional.

## Verification
- Apply the migration to a real dedicated-client Supabase project (or a disposable test project with the same schema).
- As an `authenticated` test user with `branch` role, attempt: `UPDATE app_user_profiles SET role = 'admin' WHERE id = auth.uid();` — must fail.
- As the same user, attempt: `UPDATE app_user_profiles SET branch_id = '<other-branch-id>' WHERE id = auth.uid();` — must fail.
- As the same user, attempt: `INSERT INTO app_user_profiles (...) VALUES (...)` for a new profile — must fail.
- Confirm service-role client can still read/write app_user_profiles for provisioning.
- Run the updated `docs/POST_MIGRATION_SECURITY_CHECKS.sql` and confirm it passes.

## Acceptance Criteria
- No `authenticated`-role INSERT/UPDATE/DELETE policy exists on `app_user_profiles` that allows changing `role` or branch-scoping columns.
- `docs/POST_MIGRATION_SECURITY_CHECKS.sql` includes and passes the three negative tests above.
- Service-role provisioning flow remains functional (manually confirmed).
- All changes are expressed as migration files.
