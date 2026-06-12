# Demo Smoke Test Results

Use this template after deploying Demo Pharmacy Group to the demo/staging URL. Do not paste passwords, service_role keys, FUNCTION_SECRET values, or private data.

Current expected status:

```text
B) dedicated-client staging-ready only
```

## Test Context

```text
Client name: Demo Pharmacy Group
Environment: demo/staging
Deployment URL:
Supabase project reference:
VITE_DEMO_MODE=false confirmed: yes/no
Tester:
Test date:
Browser/device:
```

## Result Legend

```text
Pass:
Fail:
Blocked:
Not applicable:
Evidence:
```

## Login And Access

| Test | Role/User | Expected Result | Actual Result | Status | Evidence/Notes |
| --- | --- | --- | --- | --- | --- |
| Login admin | admin@demo-client.example | Admin logs in successfully |  |  |  |
| Login manager | manager@demo-client.example | Manager logs in successfully |  |  |  |
| Login accounts | accounts@demo-client.example | Accounts user logs in successfully |  |  |  |
| Login branch | branch.demo1@demo-client.example | Branch user logs in successfully |  |  |  |

## App Load

| Test | Expected Result | Actual Result | Status | Evidence/Notes |
| --- | --- | --- | --- | --- |
| Dashboard load | Dashboard loads for allowed roles without sensitive errors |  |  |  |
| Daily Command Center load | Daily Command Center loads from real enabled-module data |  |  |  |

## Operations Task Workflow

| Test | Role/User | Expected Result | Actual Result | Status | Evidence/Notes |
| --- | --- | --- | --- | --- | --- |
| Create task from alert | admin or manager | Computed alert becomes saved task |  |  |  |
| Suggested action separation | admin or manager | Suggested action is not persisted until task creation |  |  |  |
| Update task status | admin, manager, or own branch user | Status update succeeds only when role/RLS allows |  |  |  |
| Task event audit trail | admin, manager, or own branch user | operations_task_events receives append-only event |  |  |  |

## Branch Scope And RLS

| Test | Role/User | Expected Result | Actual Result | Status | Evidence/Notes |
| --- | --- | --- | --- | --- | --- |
| Branch own-branch access | branch.demo1@demo-client.example | Own-branch task/data is visible where allowed |  |  |  |
| Branch cross-branch denial | branch.demo1@demo-client.example | Other-branch task/data is denied or invisible |  |  |  |
| Accounts read-only | accounts@demo-client.example | Accounts can read allowed views but cannot create/update operations tasks |  |  |  |
| Anon denial | unauthenticated | Sensitive data is denied or invisible before login |  |  |  |

## Excel Workflows

| Test | Role/User | Expected Result | Actual Result | Status | Evidence/Notes |
| --- | --- | --- | --- | --- | --- |
| Excel export check | trusted admin/manager | Export works if module is enabled |  |  |  |
| Excel import check | trusted admin/manager | Valid .xlsx import works if module is enabled |  |  |  |
| Excel invalid file check | trusted admin/manager | Non-.xlsx or oversized files are rejected |  |  |  |

## Frontend Secret Scan

Run after build/deploy artifact is available:

```bash
rg -n "SUPABASE_SERVICE_ROLE_KEY|FUNCTION_SECRET|service_role|long-random-secret" dist
```

| Test | Expected Result | Actual Result | Status | Evidence/Notes |
| --- | --- | --- | --- | --- |
| Frontend secret scan | No real service_role key, no FUNCTION_SECRET, no secret value in dist |  |  |  |

## Final Smoke Test Decision

```text
Smoke test result: pass/fail/blocked
Blocking issues:
Issue template links:
Approved for demo validation: yes/no
Production-ready claimed: no
```
