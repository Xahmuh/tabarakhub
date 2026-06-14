# CODEX PROMPT: Branch Login Approval Flow

You are working on the main/base product repo for a dedicated-client deployment model.

This project is intentionally NOT a shared multi-tenant SaaS.
Each client gets a separate Supabase project, database, storage, Auth users, environment variables, Edge Function secrets, and frontend URL.

Current status:
B) dedicated-client staging-ready only.

## Objective

Implement a branch login approval flow.

Branch users should not enter the app immediately after entering a correct username/password.

Instead:

1. Branch user enters username/password.
2. Supabase Auth validates credentials.
3. App loads `app_user_profiles`.
4. If role is `branch`, create a login approval request.
5. Branch user sees a waiting screen.
6. Admin/manager/owner receives or sees a pending login request.
7. If admin approves:

   * branch user is automatically allowed into the app.
8. If admin rejects:

   * branch user is signed out,
   * redirected to login,
   * shown a rejection message.

This is required so that even if someone has a branch username/password, they cannot access the branch account unless admin approves the login session.

## Important Rules

* Do not implement multi-tenancy.
* Do not add `organization_id`.
* Do not weaken RLS/security.
* Do not expose secrets.
* Do not store branch passwords in database.
* Do not rely on localStorage as the approval source.
* Approval state must be stored in Supabase.
* Branch users must not approve their own login.
* Branch users must not access app data while waiting.
* If approval check fails, fail closed and block access.
* Admin/manager/owner can approve or reject.
* Accounts role should not approve unless explicitly intended.
* Keep final status:
  `B) dedicated-client staging-ready only`.

## Files To Inspect First

Inspect:

* `app/login/page.tsx`
* `services/authService.ts`
* `lib/supabaseClient.ts`
* `App.tsx`
* `types.ts`
* `app/project-settings/ProjectSettings.tsx`
* current admin/settings screens
* current role helper functions
* current `app_user_profiles` RLS/helper migrations
* `supabase/migrations/`
* `docs/PRODUCTION_SECURITY_SETUP.md`
* `docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md`
* `docs/PRODUCTION_GAPS.md`

## Required Flow

### Branch user flow

After successful Supabase Auth login:

```text
Correct credentials
→ role = branch
→ create pending login approval request
→ show Waiting for Admin Approval screen
→ listen/poll for request status
→ approved = enter app
→ rejected = sign out and return to login
```

### Non-branch user flow

For roles such as admin/manager/owner/accounts:

```text
Correct credentials
→ continue normal app login
```

Do not add approval requirement to managers/admins in this pass.

## Phase 1 — Database Migration

Create a new Supabase migration for:

```sql
branch_login_approvals
```

Suggested columns:

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
branch_id uuid not null references branches(id) on delete cascade
device_fingerprint_hash text null
device_label text null
browser_name text null
os_name text null
user_agent_hash text null
last_ip text null
status text not null default 'pending'
requested_at timestamptz default now()
expires_at timestamptz not null default (now() + interval '10 minutes')
approved_by uuid null references auth.users(id)
approved_at timestamptz null
rejected_by uuid null references auth.users(id)
rejected_at timestamptz null
rejection_reason text null
created_at timestamptz default now()
updated_at timestamptz default now()
```

Allowed statuses:

```text
pending
approved
rejected
expired
cancelled
```

Add indexes:

* `user_id`
* `branch_id`
* `status`
* `requested_at`
* `expires_at`
* `device_fingerprint_hash`

Add a constraint if practical to avoid multiple active pending requests for the same user/device:

```text
one active pending request per user_id + branch_id + device_fingerprint_hash
```

If partial unique index is used, only apply it to `status = 'pending'`.

## Phase 2 — RLS Policies

Enable RLS on `branch_login_approvals`.

Rules:

### anon

* no access.

### branch users

* can insert a pending request for their own `user_id` and own `branch_id`.
* can read their own request status.
* cannot approve/reject/cancel by changing status to approved/rejected.
* cannot read other users’ requests.
* cannot create a request for another branch.

### admin/manager/owner

* can read all pending login requests.
* can approve requests.
* can reject requests.
* can add rejection reason.
* can see request metadata such as branch, requested time, device label.

### accounts

* no approval rights.
* read-only only if current product policy intentionally allows it; otherwise no access.

Use existing helper functions where available:

* current role helper
* current branch helper
* `current_app_can_manage()`
* `current_app_can_read_all()`
* related profile helper functions

Do not weaken `app_user_profiles`.

## Phase 3 — Login Approval Service

Create:

```text
services/branchLoginApprovalService.ts
```

Functions:

```ts
createBranchLoginApprovalRequest(input)
getBranchLoginApprovalStatus(requestId)
subscribeToBranchLoginApproval(requestId, onChange)
listPendingBranchLoginApprovals()
approveBranchLoginApproval(requestId)
rejectBranchLoginApproval(requestId, reason?)
cancelBranchLoginApproval(requestId)
expireOldBranchLoginApprovals()
```

Behavior:

* Use Supabase as source of truth.
* No production localStorage approval.
* If Realtime is available, use it to subscribe to status changes.
* If Realtime is not available or too risky, use safe polling every few seconds.
* If request expires, sign the branch user out.
* If request is rejected, sign the branch user out.
* If approval check fails, fail closed and block access.

## Phase 4 — Device Info / Fingerprint

Add lightweight device info capture.

Use:

* browser user agent,
* platform,
* screen size,
* timezone,
* language.

Hash sensitive/stable values with SHA-256 where practical.

Do not add third-party fingerprinting libraries.

This fingerprint is not the only security boundary. It is used to help admins recognize devices and reduce duplicate pending requests.

## Phase 5 — Branch Waiting Screen

Add a screen after branch login:

```text
Waiting for Admin Approval
```

Screen should show:

* branch name if safe,
* device/browser label,
* requested time,
* expiry countdown if practical,
* message:

```text
Your login request is waiting for admin approval.
Please contact your manager if this was not expected.
```

If approved:

* automatically enter the app.

If rejected:

* sign out,
* return to login,
* show:

```text
Your login request was rejected by admin.
```

If expired:

* sign out,
* return to login,
* show:

```text
Login approval expired. Please try again.
```

If verification error:

* block access,
* show:

```text
Unable to verify login approval. For security, access is blocked.
```

## Phase 6 — Admin/Manager Approval UI

Add a section in Project Settings or Admin Settings:

```text
Branch Login Approvals
```

Show pending requests:

* branch name
* user/email/code
* device label
* browser/OS
* last IP if available
* requested at
* expires at
* status
* Approve button
* Reject button
* optional rejection reason

Only admin/manager/owner can approve/reject.

Branch/accounts should not see approval controls.

Admin should receive/see the request quickly. If app already uses a notification/toast system, add a manager-side toast or badge when there are pending requests. If not, showing a pending approvals panel is acceptable for MVP.

Do not implement SMS/WhatsApp/push notifications in this pass.

## Phase 7 — App Access Guard

Update the app auth guard so that:

* branch user with pending approval cannot access modules.
* branch user with rejected/expired approval is signed out.
* branch user only enters app after approval.
* non-branch roles continue normally.
* page refresh while pending keeps showing waiting screen.
* page refresh after approval keeps app access as long as the approved approval/session is still valid.

Define whether approval lasts:

Option A:

* only for the current login request/session.

Option B:

* also creates an approved device record.

For this pass, implement the safer/simple option:

```text
approval is for the current login session/request only
```

If you decide to persist device approval too, document clearly and do not bypass this login approval flow without explicit approval.

## Phase 8 — Expiry / Cleanup

Pending approvals should expire automatically after a short time, such as 10 minutes.

Implement:

* request `expires_at`.
* frontend checks expiry.
* service can mark expired requests if needed.
* expired request must not allow app access.

Do not rely only on frontend timer for security; approval query should verify status and expiry.

## Phase 9 — Documentation

Create:

```text
docs/BRANCH_LOGIN_APPROVAL_FLOW.md
```

Include:

* purpose
* login flow
* admin approval flow
* RLS rules
* fail-closed behavior
* request expiry
* rejection behavior
* difference between login approval and device approval
* manual test checklist

Update:

```text
docs/PRODUCTION_SECURITY_SETUP.md
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
docs/PRODUCTION_GAPS.md
docs/RELEASE_READINESS_STATUS.md
```

## Phase 10 — Manual Test Checklist

Add tests for:

* branch enters correct password → waiting screen appears.
* pending request appears to admin/manager.
* approve request → branch app opens automatically.
* reject request → branch signs out and returns to login.
* request expires → branch signs out.
* branch cannot access modules while pending.
* branch cannot approve own request.
* branch cannot read other requests.
* admin can approve.
* manager can approve.
* accounts cannot approve unless intentionally allowed.
* anon has no access.
* non-branch users login normally.
* refresh while pending stays pending.
* refresh after rejected stays blocked.
* Supabase approval check failure blocks access.

## Out Of Scope

* Do not add MFA in this pass.
* Do not add SMS/WhatsApp notifications.
* Do not add push notifications.
* Do not add IP allowlist.
* Do not add GPS/location verification.
* Do not add native app.
* Do not add third-party fingerprinting libraries.
* Do not implement multi-tenancy.
* Do not add `organization_id`.
* Do not change manager/admin login approval flow.
* Do not deploy.
* Do not apply remote migrations.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

If lint/test scripts exist, run:

```bash
npm run lint
npm test
```

Do not claim audit is clean unless it passes.

## Final Response Format

Return:

```markdown
## Summary
<short summary>

## Files Changed
- <file>
- <file>

## Migration / RLS Summary
<summary>

## Branch Login Flow Summary
<summary>

## Admin Approval UI Summary
<summary>

## Fail-Closed Security Behavior
<summary>

## Documentation
<docs created/updated>

## Verification
- typecheck:
- build:
- audit:
- npm ls:
- lint/test:

## Remaining Blockers
- <blocker>

## Final Status
B) dedicated-client staging-ready only
```

## Acceptance Criteria

* Branch users do not enter the app immediately after password login.
* A pending approval request is created.
* Admin/manager/owner can approve or reject.
* Approval makes the waiting branch session enter the app.
* Rejection signs the branch user out and returns to login.
* Expired request signs the branch user out.
* Branch user cannot access app while pending.
* Branch user cannot approve own request.
* Approval state is stored in Supabase.
* Verification failures fail closed.
* Documentation exists.
* Typecheck passes.
* Build passes.
* Final status remains:
  `B) dedicated-client staging-ready only`.

```
```
