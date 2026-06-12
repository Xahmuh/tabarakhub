# Production Gaps

Current status:

```text
B) dedicated-client staging-ready only
```

Do not claim production-ready until a real dedicated client deployment has migrations applied, users provisioned, secrets configured, post-migration checks passed, manual auth/RLS checks passed, and dependency risk resolved or formally accepted.
The operations task workflow also requires client-project RLS validation before production sign-off.

## Remaining Gaps

```text
ExcelJS/uuid audit risk remains open.
Demo deployment still needs validation against the smoke test plan.
Post-migration security checks must be run per client Supabase project.
Operations task security checks must be run per client Supabase project.
Operations task manual tests must be completed per client Supabase project.
Manual auth/RLS tests are required for admin, manager, accounts, and branch users.
Operations task workflow tests are required for admin/manager create, accounts read-only, branch own-branch update/comment, and anon denial.
Fraud/IP logic must be enforced server-side for production; frontend IP lookup is demo-only and not a trusted security control.
Automated tests need to be expanded beyond typecheck/build.
Lint setup is not present yet.
FUNCTION_SECRET must be set in Supabase Edge Function secrets per client.
Storage bucket policies must be reviewed per client.
```

## Operations Task Workflow Boundary

```text
The Daily Command Center can persist saved operations tasks after the migration is applied.
Computed operational alerts are still not server-persisted automatically.
Suggested actions are not persisted until an admin/manager creates a task.
Task events are the audit trail for creation notes, status changes, and comments.
Saved task/event RLS must be validated with real client users before production.
Event history is append-only from the client; audit reporting still needs future hardening and export review.
```

## Demo Mode Boundary

```text
VITE_DEMO_MODE=false is required for staging and production validation.
When demo mode is false, operational services must not silently persist fake business records to localStorage.
When demo mode is true, local demo fallback may be used for non-production demos only.
```

## Fraud And Rate Limiting

Production reward fraud controls should run in a trusted backend path:

```text
Supabase RPC or Edge Function validates token, customer, branch, daily limits, IP/device policy where legally allowed, and prize availability.
The browser may pass contextual hints, but must not be the source of truth.
The customer flow must still succeed without relying on third-party frontend IP lookup services.
```
