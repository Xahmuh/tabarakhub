# Phase 1 Authenticated QA Checklist

Checked on: 2026-06-15

Current status:

```text
B) dedicated-client staging-ready only
```

Use this checklist to complete the remaining authenticated browser QA for Phase 1 Delivery Dispatch / Lifecycle after approved role sessions are available.

## Guardrails

- Use only approved admin, branch, owner, supervisor, warehouse, and accounts sessions.
- Do not expose, print, copy, or store credentials/secrets in logs, docs, screenshots, or commits.
- Do not delete real production data.
- Do not run destructive SQL or bypass RLS.
- Use a clearly marked test delivery order only if a lifecycle transition must be validated.
- Document any test record created, including branch, order identifier, transition, and cleanup status.

## Admin QA

- Login succeeds.
- Delivery module opens.
- Dispatch tab appears.
- Dispatch board loads.
- Lifecycle rows show data or a clean empty state.
- Safe lifecycle transition creates event.
- No hard delete is exposed in the branch lifecycle flow.
- No console/network errors appear during load or transition.

## Branch QA

- Branch user sees own branch lifecycle data only.
- Cross-branch data is blocked.
- Cross-branch transition is blocked.
- Historical/old records are protected.
- Hard delete is blocked.
- No console/network errors appear during branch-scoped lifecycle checks.

## Owner QA

- Owner dashboard opens if an approved owner profile/session exists.
- Owner is read-only.
- No lifecycle transition buttons are visible or usable.
- No user/settings management is visible or usable.
- Owner cannot mutate delivery lifecycle state through the UI.

## Supervisor/Warehouse/Accounts QA

- No unexpected write access is available.
- Read-only/scoped behavior matches the approved role model.
- Delivery/Dispatch visibility matches the configured module permissions.
- No role can mutate lifecycle state unless explicitly approved by the role model.

## Event/Audit QA

- Lifecycle event is created on an allowed transition.
- Actor/source is recorded if available.
- Event branch/order context matches the transitioned order.
- No cross-branch event leakage is visible.
- Direct event writes remain unavailable from authenticated clients.

## Cleanup Rules

- Use a clearly marked test order only if needed.
- Do not delete real production data.
- Document any test record created.
- Prefer reversing only safe status changes through approved lifecycle flows when cleanup is necessary.
- Leave `delivery_order_events` append-only; do not delete audit rows.

## Evidence Capture

Record QA evidence in the relevant release/readiness docs:

```text
Role:
Session source:
Branch/order used:
Checks completed:
Transition performed:
Event row observed:
Console/network errors:
Data cleanup required:
Result:
Reviewer:
Timestamp:
```

## Stop Conditions

- Unexpected write access appears for owner, supervisor, warehouse, or accounts.
- Branch user can view or mutate another branch's lifecycle data.
- Historical protected records can be updated or deleted by branch users.
- RLS errors indicate a policy mismatch with the documented role model.
- Browser/network errors block Dispatch board load or lifecycle event validation.
- Credentials, tokens, or secrets appear in logs, screenshots, docs, or terminal output.
