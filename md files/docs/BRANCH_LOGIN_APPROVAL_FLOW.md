# Branch Login Approval Flow

## Purpose

Branch accounts require a manager-side approval step after Supabase Auth accepts
the username/password. This protects branch accounts when a password is known or
shared unexpectedly: correct credentials alone do not enter the app.

This is not multi-tenancy. Each dedicated client still uses its own Supabase
project, Auth users, database, storage, secrets, and frontend URL.

## Login Flow

1. The branch user enters email/code and password.
2. Supabase Auth validates the password.
3. The app loads the active `app_user_profiles` row.
4. If the role is not `branch`, login continues normally.
5. If the role is `branch`, the app creates a `branch_login_approvals` row with
   `status = pending`.
6. The branch user sees `Waiting for Admin Approval`.
7. The waiting screen polls/subscribes to Supabase for the request status.
8. `approved` enters the app for the current browser session.
9. `rejected`, `expired`, `cancelled`, or verification failure signs the branch
   user out and returns to login.

The browser stores only the current approval request id in `sessionStorage`.
Supabase remains the source of truth for approval status.

## Admin Approval Flow

Project Settings includes `Branch Login Approvals`.

Authorized approvers can see pending requests with:

- branch code/name,
- Auth email/user id,
- device label,
- browser and OS,
- user-agent/device hash,
- requested time,
- expiry time,
- current status.

Approvers can approve or reject. Rejection can include an optional reason.

## RLS Rules

The local migration creates:

```text
supabase/migrations/20260614090000_branch_login_approvals.sql
```

It adds:

- `public.branch_login_approvals`
- RLS enabled
- no anon access
- branch users can insert only their own pending request for their own branch
- branch users can read only their own request status
- branch users cannot approve/reject requests
- admin/manager/owner can read approval requests
- approval/rejection RPCs reject self-approval
- accounts/warehouse/supervisor do not get approval rights

Approval actions are exposed through security-definer RPCs:

```text
branch_login_approval_list_pending()
branch_login_approval_approve(uuid)
branch_login_approval_reject(uuid, text)
branch_login_approval_cancel(uuid)
branch_login_approval_expire_old()
```

## Fail-Closed Behavior

Branch users are not placed into app `authState` while approval is pending.

The app signs the branch user out if:

- no approval request id exists on refresh,
- the request cannot be read,
- the request belongs to another user/branch,
- the request is rejected,
- the request expires,
- the request is cancelled,
- Supabase verification errors.

The user-facing message for verification failure is:

```text
Unable to verify login approval. For security, access is blocked.
```

## Request Expiry

Pending requests default to a 10-minute approval window. Expired pending
requests are marked `expired` by the service/RPC path and must not enter the app.

Approval is for the current login request/session only. This is not persistent
device approval. Closing or losing the browser session request pointer causes the
next branch access attempt to fail closed and require a fresh login/approval.

## Rejection Behavior

When an approver rejects the request:

- the request status becomes `rejected`,
- `rejected_by`, `rejected_at`, and optional `rejection_reason` are stored,
- the waiting branch session signs out,
- the login screen shows:

```text
Your login request was rejected by admin.
```

## Login Approval vs Device Approval

Login approval allows one current login request/session to enter the app after
an approver accepts it.

Device approval is not implemented. The lightweight fingerprint only helps
admins recognize the browser/device and reduce duplicate pending requests. It is
not a trusted security boundary and does not bypass future approvals.

## Manual Test Checklist

```text
Branch enters correct password -> waiting screen appears.
Pending request appears to admin/manager/owner in Project Settings.
Approve request -> branch app opens automatically.
Reject request -> branch signs out and returns to login.
Request expires -> branch signs out.
Branch cannot access modules while pending.
Branch cannot approve own request.
Branch cannot read other users' approval requests.
Admin can approve if an active admin profile exists in the client role model.
Manager can approve.
Owner can approve.
Accounts/warehouse cannot approve.
Supervisor cannot approve unless explicitly changed later.
Anon has no access.
Non-branch users login normally.
Refresh while pending stays on waiting screen.
Refresh after approved keeps access for the current browser session.
Refresh after rejected/expired stays blocked.
Missing sessionStorage request id signs branch out.
Supabase approval check failure signs branch out and blocks access.
```

## Production Status

Implemented and the migration has been applied to the linked dedicated-client
Supabase project. The checklist above must still pass with real role sessions
before production approval.
