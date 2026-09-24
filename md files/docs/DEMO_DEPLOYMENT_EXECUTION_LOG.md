# Demo Deployment Execution Log

Use this log while executing the real demo-client deployment validation for Demo Pharmacy Group. Do not paste secrets, passwords, service_role keys, FUNCTION_SECRET values, or private data.

Current status before execution:

```text
B) dedicated-client staging-ready only
```

## Deployment Context

```text
Client name: Demo Pharmacy Group
Environment: demo/staging
Deployment model: dedicated-client single-tenant
VITE_DEMO_MODE=false confirmed: yes/no
Operator:
Execution date:
```

## Supabase Project Created

```text
Supabase project created: yes/no
Project reference:
Project URL:
Region:
Anon key recorded in secure deployment env only: yes/no
service_role key kept out of frontend/docs/screenshots: yes/no
Evidence/log link:
```

## Migration Application Result

```text
Command used:
All migrations applied: yes/no
Hardening migration applied: yes/no
operations_tasks migration applied: yes/no
Migration output/evidence:
Issues:
```

## Post-Migration Check Result

```text
docs/POST_MIGRATION_SECURITY_CHECKS.sql run: yes/no
Result: pass/fail
Zero-row expectation sections clean: yes/no
RLS enabled on sensitive tables: yes/no
No unsafe anon grants: yes/no
Evidence/log link:
Issues:
```

## Operations Task Security Check Result

```text
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql run: yes/no
Result: pass/fail
operations_tasks RLS enabled: yes/no
operations_task_events append-only verified: yes/no
Duplicate guard index exists: yes/no
Triggers exist: yes/no
Evidence/log link:
Issues:
```

## Auth Users Created

```text
admin@demo-client.example created: yes/no
manager@demo-client.example created: yes/no
accounts@demo-client.example created: yes/no
branch.demo1@demo-client.example created: yes/no
Temporary credentials handed over securely: yes/no/not applicable
No real passwords stored in docs: yes/no
Issues:
```

## app_user_profiles Provisioned

```text
docs/DEMO_CLIENT_PROVISIONING_EXAMPLE.sql used: yes/no
Admin profile provisioned: yes/no
Manager profile provisioned: yes/no
Accounts profile provisioned: yes/no
Branch profile provisioned: yes/no
Branch profile has valid branch_id: yes/no
Verification query passed: yes/no
Evidence/log link:
Issues:
```

## FUNCTION_SECRET Set

```text
FUNCTION_SECRET set in Supabase secrets: yes/no
Secret value excluded from frontend env: yes/no
Secret value excluded from docs/logs/screenshots: yes/no
Protected Edge Function check completed: yes/no/not applicable
Issues:
```

## Frontend Env Configured

```text
VITE_SUPABASE_URL points to demo Supabase project: yes/no
VITE_SUPABASE_ANON_KEY configured: yes/no
VITE_DEMO_MODE=false: yes/no
No service_role key in frontend env: yes/no
No FUNCTION_SECRET in frontend env: yes/no
Issues:
```

## Frontend Build Result

```text
npm run typecheck result:
npm run build result:
npm audit --audit-level=moderate result:
npm ls --depth=0 result:
Build artifact location:
Issues:
```

## Staging URL

```text
Deployment provider:
Staging URL:
Deployment result: pass/fail
Deployment log link:
Issues:
```

## Smoke Test Results

```text
docs/DEMO_SMOKE_TEST_RESULTS.md completed: yes/no
Admin login: pass/fail
Manager login: pass/fail
Accounts login: pass/fail
Branch login: pass/fail
Dashboard loads: pass/fail
Daily Command Center loads: pass/fail
Operations task workflow: pass/fail
Anon denial: pass/fail
Frontend secret scan: pass/fail
Issues:
```

## Manual RLS Test Results

```text
docs/OPERATIONS_TASK_MANUAL_TESTS.md completed: yes/no
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md completed: yes/no
Branch own-branch access allowed: pass/fail
Branch cross-branch denial: pass/fail
Accounts read-only behavior: pass/fail
operations_task_events append-only: pass/fail
app_user_profiles escalation denied: pass/fail
Issues:
```

## Known Issues

```text
Issue ID/link:
Summary:
Severity:
Security impact:
Rollback needed: yes/no
Owner:
Target date:
```

Use `docs/DEPLOYMENT_ISSUE_TEMPLATE.md` for each issue.

## Release Decision

```text
Decision: pass for demo validation / fail, remain staging only
Decision owner:
Decision date:
Conditions:
ExcelJS/uuid risk documented: yes/no
Production-ready claimed: no
```

Final allowed status after successful demo validation:

```text
Demo deployment validated; not production-ready.
```
