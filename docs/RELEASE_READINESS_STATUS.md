# Release Readiness Status

Current status:

```text
B) dedicated-client staging-ready only
```

This project remains a dedicated-client deployment model. It is intentionally not a shared multi-tenant SaaS. Each client must receive a separate Supabase project, database, storage setup, Auth users, environment variables, branding config, and frontend URL.

## Next Required Milestone

```text
Real demo deployment validation
```

The next milestone is to deploy a fresh demo-client environment from scratch and complete:

```text
docs/DEMO_DEPLOYMENT_VALIDATION.md
docs/POST_MIGRATION_SECURITY_CHECKS.sql
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql
docs/OPERATIONS_TASK_MANUAL_TESTS.md
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
```

## Current Verification State

```text
Daily Command Center exists.
Unified alerts exist.
Persistent operations tasks exist.
operations_task_events are append-only audit trail from normal client access.
Operations task RLS hardening pass is complete in the repo.
Typecheck passes locally.
Production build passes locally.
npm audit still fails on ExcelJS -> uuid.
No lint/test scripts currently exist.
```

## Production Cannot Be Claimed Until

```text
All migrations are applied to the real dedicated-client Supabase project.
Supabase Auth users are provisioned.
app_user_profiles are provisioned for admin, manager, accounts, and branch users.
FUNCTION_SECRET is set in Supabase Edge Function secrets.
docs/POST_MIGRATION_SECURITY_CHECKS.sql passes.
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql passes.
Manual RLS/auth tests pass.
Operations task manual tests pass.
Manual smoke tests pass on the real deployment URL.
No frontend secrets are exposed.
ExcelJS/uuid audit risk is resolved or formally accepted.
```

## Release Decision Rules

Pass for demo validation:

```text
Fresh demo Supabase project is configured.
Migrations apply cleanly.
Security SQL checks return expected safe results.
Demo Auth users and app_user_profiles work.
Frontend env uses VITE_DEMO_MODE=false.
Build deploys successfully.
Manual smoke tests pass.
Known audit risk is documented.
```

Fail:

```text
Remain staging-only.
Do not sell or describe the release as production-ready.
Record issues with docs/DEPLOYMENT_ISSUE_TEMPLATE.md.
Fix, redeploy, and rerun demo deployment validation.
```
