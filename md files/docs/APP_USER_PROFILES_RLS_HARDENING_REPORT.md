# app_user_profiles RLS Hardening Report

Date: 2026-06-12

## Summary

`public.app_user_profiles` is the source of truth for application role and branch scope. It must remain readable by authenticated users for app authorization flows, but writable only through trusted SQL or service-role tooling.

The audit found that `supabase/migrations/20260612034500_security_auth_rls_hardening.sql` already revoked `insert`, `update`, and `delete` grants from `authenticated`, which blocks normal frontend mutations. However, the same migration also created an `authenticated` `FOR ALL` policy named `"app profiles manage"`. That policy was gated to `public.current_app_is_admin()`, but it still represented a client-reachable mutation policy artifact on the authorization root table. If grants drifted later, an authenticated admin session could mutate role or branch scope from the browser.

## Changes

- Added `supabase/migrations/20260612083000_app_user_profiles_service_role_only_writes.sql`.
- The new migration drops `"app profiles manage"` on `public.app_user_profiles`.
- The new migration revokes all table and column privileges from `anon` and `authenticated`, then grants only `select` back to `authenticated`.
- The new migration keeps `service_role` write access for provisioning.
- Extended `docs/POST_MIGRATION_SECURITY_CHECKS.sql` with:
  - a zero-row check for authenticated `INSERT`, `UPDATE`, `DELETE`, or `ALL` policies on `app_user_profiles`;
  - negative tests for authenticated branch-user attempts to update `role`;
  - negative tests for authenticated branch-user attempts to update `branch_id`;
  - negative tests for authenticated branch-user attempts to insert a new profile row.

## Scope Guardrails

- No multi-tenancy was implemented.
- No `organization_id` column was added.
- No existing RLS policy was weakened.
- No secrets or project credentials were introduced.
- All hardening is expressed as a reproducible Supabase migration.

## Local Verification

- `npm run typecheck` passed.
- Static inspection confirmed the new migration only targets `public.app_user_profiles`.
- Static inspection confirmed the old `"app profiles manage"` policy is followed by the new migration that drops it.
- The final negative RLS tests were not run locally because they require a real Supabase project with Auth users and branch data.

## Real-Project Verification Status

Pending. A real dedicated-client Supabase project or disposable Supabase project with the same schema is required to execute the final negative tests.

Before running `docs/POST_MIGRATION_SECURITY_CHECKS.sql`, prepare:

- one active `branch` role user in `public.app_user_profiles`;
- at least two branches;
- one disposable Supabase Auth user with no `app_user_profiles` row, so the insert denial test can attempt a real new profile.

Expected results after applying migrations and running the checks:

- authenticated table grants on `app_user_profiles` show `SELECT` only;
- no authenticated mutation policy remains on `app_user_profiles`;
- `authenticated_update_role_denied` returns `passed = true`;
- `authenticated_update_branch_id_denied` returns `passed = true`;
- `authenticated_insert_profile_denied` returns `passed = true`;
- service-role provisioning can still read/write `app_user_profiles`.
