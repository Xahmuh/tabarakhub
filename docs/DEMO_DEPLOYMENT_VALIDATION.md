# Demo Deployment Validation

Current status:

```text
B) dedicated-client staging-ready only
```

Use this checklist to validate that a fresh dedicated-client demo environment can be deployed safely from scratch. This is not a production sign-off. Do not add multi-tenancy, `organization_id`, AI features, frontend secrets, or real client data.

Record execution evidence in:

```text
docs/DEMO_DEPLOYMENT_EXECUTION_LOG.md
```

## 1. Supabase Project Setup

```text
Create a fresh Supabase project for the demo client.
Record the project reference in the deployment notes.
Confirm the project URL.
Confirm the public anon key.
Confirm the service_role key is stored only in trusted operator tooling.
Confirm the service_role key is never added to frontend env vars, docs examples, built assets, or screenshots.
```

Expected pass indicators:

```text
Project URL is available.
Anon key is available for frontend configuration.
No service_role key appears in frontend configuration.
```

Fail indicators:

```text
service_role key appears in any VITE_ variable.
Real client credentials or passwords are committed.
Project URL/anon key are missing or point to the wrong Supabase project.
```

## 2. Database Migration

Apply all migrations in order against the fresh demo project.

Supabase CLI path:

```bash
supabase link --project-ref DEMO_PROJECT_REF
supabase db push
```

Verify these migrations are applied:

```text
supabase/migrations/20260612034500_security_auth_rls_hardening.sql
supabase/migrations/20260612062000_operations_tasks_workflow.sql
```

Expected pass indicators:

```text
All migrations apply without errors.
Hardening migration is listed as applied.
operations_tasks workflow migration is listed as applied.
operations_tasks and operations_task_events exist.
```

Fail indicators:

```text
Any migration fails or is skipped.
Hardening migration is missing.
operations task migration is missing.
RLS is disabled on sensitive tables.
```

## 3. Post-Migration Checks

Run:

```text
docs/POST_MIGRATION_SECURITY_CHECKS.sql
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql
```

Expected pass indicators:

```text
RLS is enabled on sensitive tables.
No unsafe anon grants exist.
branches.password does not exist.
app_user_profiles exists and is protected.
operations_tasks has scoped select/insert/update policies.
operations_task_events has select/insert only for authenticated users.
operations_task_events has no authenticated update/delete grants or policies.
Duplicate guard index exists for open/in_progress operations tasks.
Operations task triggers exist.
```

Fail indicators:

```text
Any anon grant exists on sensitive operational tables.
Any broad authenticated delete policy exists.
operations_task_events can be updated or deleted by authenticated users.
Required trigger/helper functions are missing.
Post-migration SQL returns rows in sections marked "Expected: zero rows".
```

## 4. Auth Users

Create placeholder demo users in Supabase Auth:

```text
admin@demo-client.example
manager@demo-client.example
accounts@demo-client.example
branch.demo1@demo-client.example
```

Do not document real passwords. Use a secure out-of-band handover method for temporary credentials if needed.

## 5. app_user_profiles

After Auth users exist, map their Auth user IDs to app roles. Replace all placeholders before running.

Use the fuller operator SQL template in:

```text
docs/DEMO_CLIENT_PROVISIONING_EXAMPLE.sql
```

```sql
-- Demo-only placeholder SQL. Do not use real client emails or passwords here.
-- Replace AUTH_*_UUID_HERE values with Supabase Auth user UUIDs.
-- Replace BRANCH_DEMO_1_UUID_HERE with the UUID of the demo branch row.

insert into public.app_user_profiles (user_id, role, branch_id, is_active)
values
  ('AUTH_ADMIN_UUID_HERE', 'admin', null, true),
  ('AUTH_MANAGER_UUID_HERE', 'manager', null, true),
  ('AUTH_ACCOUNTS_UUID_HERE', 'accounts', null, true),
  ('AUTH_BRANCH_DEMO1_UUID_HERE', 'branch', 'BRANCH_DEMO_1_UUID_HERE', true)
on conflict (user_id) do update
set
  role = excluded.role,
  branch_id = excluded.branch_id,
  is_active = excluded.is_active,
  updated_at = now();
```

Expected pass indicators:

```text
Admin profile has role admin and branch_id null.
Manager profile has role manager and branch_id null unless a reviewed demo branch scope is required.
Accounts profile has role accounts and branch_id null.
Branch profile has role branch and a valid branch_id.
Branch role without branch_id is rejected.
```

## 6. FUNCTION_SECRET

Set the Edge Function secret in the demo Supabase project:

```bash
supabase secrets set FUNCTION_SECRET="long-random-secret"
```

`long-random-secret` is a placeholder. Generate a real long random value for the demo project and never expose it as a frontend `VITE_` variable.

Expected pass indicators:

```text
FUNCTION_SECRET exists in Supabase Edge Function secrets.
FUNCTION_SECRET does not appear in frontend env, source code, docs evidence, or dist assets.
Protected Edge Functions reject missing or invalid x-function-secret where applicable.
```

## 7. Frontend Env

Required `.env.production` values:

```bash
VITE_SUPABASE_URL="https://DEMO_PROJECT_REF.supabase.co"
VITE_SUPABASE_ANON_KEY="DEMO_PUBLIC_ANON_KEY"
VITE_DEMO_MODE=false
```

Expected pass indicators:

```text
Frontend points to the demo Supabase project.
Only the public anon key is present in frontend env.
VITE_DEMO_MODE=false.
No service_role key, FUNCTION_SECRET, database password, or real password appears in frontend env.
```

## 8. Build And Deploy

Run locally before deployment:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Deploy using the selected provider. Placeholder:

```bash
your-deployment-provider deploy --source dist --environment demo
```

Expected pass indicators:

```text
Typecheck passes.
Build passes.
Dependency tree resolves.
Audit result is documented.
Deployment URL loads the built app.
```

Known current audit result:

```text
npm audit fails because exceljs depends on vulnerable uuid versions.
This must be resolved or formally accepted before production.
```

## 9. Manual Smoke Tests

Run these against the deployed demo URL:

```text
Login as admin.
Login as manager.
Login as accounts.
Login as branch.demo1.
Dashboard loads for allowed roles.
Daily Command Center loads.
Create an operations task from a real computed alert.
Update task status.
Verify operations_task_events receives an append-only audit trail entry.
Verify branch user cannot access other branch tasks.
Verify anon cannot read sensitive data.
Verify suggested actions are not persisted until task creation.
Verify saved tasks appear before suggested actions.
Verify accounts can read allowed task data but cannot create/update tasks.
```

Also complete:

```text
docs/DEMO_SMOKE_TEST_RESULTS.md
docs/OPERATIONS_TASK_MANUAL_TESTS.md
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
```

## 10. Release Decision

Pass:

```text
Demo deployment validated.
All migrations applied.
Post-migration checks pass.
Operations task security checks pass.
Manual smoke tests pass.
No frontend secrets exposed.
Audit risk is documented.
Status remains demo/staging validation, not production-ready.
```

Fail:

```text
Staging only.
Do not sell or describe the deployment as production-ready.
Record the issue in docs/DEPLOYMENT_ISSUE_TEMPLATE.md.
Fix the issue, redeploy, and rerun this validation checklist.
```
