# Client Handover Checklist

Use this checklist for each dedicated-client handover. Keep all entries client-specific but do not store passwords, service_role keys, FUNCTION_SECRET values, or private customer data in this document.

Current product status before real production sign-off:

```text
B) dedicated-client staging-ready only
```

## Deployment Details

```text
Client name:
Environment: demo / staging / production candidate
Deployment URL:
Supabase project reference:
Release version/build:
Release date:
Handover owner:
Client approver:
```

## Admin Account Handover

```text
Admin account email:
Handover method:
Temporary password shared through approved password manager: yes/no
Password rotation required at first login: yes/no
MFA enabled or scheduled: yes/no
Backup admin account approved: yes/no
```

Do not write real passwords here.

## Enabled Modules

```text
Daily Command Center:
Operations tasks:
Sales / shortages:
Lost sales:
Cash tracker:
Cash flow:
HR:
Quality feedback:
Spin & Win:
Corporate codex:
Employee contributions:
Reports:
Excel import/export:
Project settings:
```

## Known Accepted Risks

```text
Accepted security risks document:
Accepted operational risks:
Accepted browser/support limitations:
Accepted dependency risks:
Risk owner:
Risk review date:
```

## ExcelJS Risk Acceptance

```text
ExcelJS/uuid audit risk status: unresolved / accepted / resolved
Acceptance owner:
Acceptance date:
Expiry/review date:
Business justification:
Mitigation notes:
```

Production cannot be claimed while this remains unresolved unless it is formally accepted by the client/release owner.

## Support Contact

```text
Support email:
Support hours:
Escalation contact:
Incident response target:
Maintenance window:
```

## Backup Responsibility

```text
Database backup owner:
Backup schedule:
Restore test completed: yes/no
Storage backup owner:
Auth/user export process documented: yes/no
Retention policy:
```

## Security Acceptance Result

```text
docs/POST_MIGRATION_SECURITY_CHECKS.sql passed: yes/no
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql passed: yes/no
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md completed: yes/no
docs/OPERATIONS_TASK_MANUAL_TESTS.md completed: yes/no
Anon access blocked: yes/no
Branch scoping verified: yes/no
No frontend secrets found in dist: yes/no
FUNCTION_SECRET configured server-side only: yes/no
```

## Operations Task Validation

```text
Admin can create task from alert: yes/no
Manager can create task from alert: yes/no
Accounts read-only behavior verified: yes/no
Branch user own-branch task update/comment verified: yes/no
Branch user other-branch denial verified: yes/no
operations_task_events append-only verified: yes/no
Suggested actions remain separate until task creation: yes/no
```

## Maintenance Terms Placeholder

```text
Support plan:
Included maintenance:
Excluded maintenance:
Update cadence:
Emergency fix process:
Data retention responsibility:
Client approval process:
Commercial terms reference:
```

## Handover Decision

```text
Handover approved: yes/no
Approved by:
Approval date:
Remaining conditions:
Next review date:
```

Do not mark production-ready unless real migrations, users, secrets, RLS checks, operations task checks, manual smoke tests, and ExcelJS risk decision are complete.
