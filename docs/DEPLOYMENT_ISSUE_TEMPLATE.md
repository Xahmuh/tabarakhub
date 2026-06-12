# Deployment Issue Template

Use this template for any demo, staging, or dedicated-client deployment issue. Do not paste secrets, real passwords, service_role keys, FUNCTION_SECRET values, or private client data.

## Summary

```text
Issue title:
Reported by:
Reported date/time:
Severity:
Current status:
```

## Environment

```text
Environment: demo / staging / production candidate
Deployment URL:
Frontend build/version:
Deployment provider:
Browser/device:
```

## Supabase Project

```text
Supabase project reference:
Supabase URL:
Region:
Fresh project or existing project:
```

Do not include service_role keys, database passwords, or FUNCTION_SECRET values.

## Migration Status

```text
All migrations applied: yes/no
Hardening migration applied: yes/no
operations_tasks migration applied: yes/no
Migration command used:
Migration error output location:
```

## Command Or Check Failed

```text
Command/check name:
Exact command:
Expected result:
Actual result:
Exit code:
Log location:
```

Examples:

```text
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
docs/POST_MIGRATION_SECURITY_CHECKS.sql
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql
manual smoke test
```

## User Role Affected

```text
anon:
admin:
manager:
accounts:
branch:
service role / backend only:
```

## Expected Behavior

```text
Describe what should happen.
Include the relevant role, module, route, table, or policy.
```

## Actual Behavior

```text
Describe what happened instead.
Include exact error text when safe.
Redact sensitive values.
```

## Screenshots Or Logs

```text
Screenshot path/link:
Browser console log path:
Server/deployment log path:
Supabase log path:
SQL result evidence path:
```

Redaction checklist:

```text
No service_role key.
No FUNCTION_SECRET.
No real passwords.
No private customer data.
No database password.
```

## Security Impact

```text
Does this expose sensitive data: yes/no/unknown
Does this allow unauthorized writes: yes/no/unknown
Does this weaken RLS: yes/no/unknown
Does this expose secrets in frontend: yes/no/unknown
Affected tables/modules:
Immediate containment:
```

## Rollback Needed

```text
Rollback needed: yes/no
Frontend rollback only:
Database restore needed:
Auth/profile correction needed:
RLS/policy correction needed:
Owner:
Target resolution date:
```

## Resolution

```text
Root cause:
Fix applied:
Files changed:
Checks rerun:
Residual risk:
Approved by:
Closed date:
```
