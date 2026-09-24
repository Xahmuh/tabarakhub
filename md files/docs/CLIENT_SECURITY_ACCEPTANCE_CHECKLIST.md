# Client Security Acceptance Checklist

Run this checklist before approving any dedicated client production release.

Current final-gate status:

```text
B) dedicated-client staging-ready only
```

Reference: `docs/FINAL_PRODUCTION_READINESS_GATE_RESULTS.md`.

## Backend/RLS checks

```text
POST_MIGRATION_SECURITY_CHECKS.sql has been run.
No unsafe anon grants exist on sensitive tables.
The only allowed anon table grant exception is SELECT on active quality_feedback_questions for the public feedback form.
Anon cannot INSERT/UPDATE/DELETE quality_feedback_questions.
Anon cannot read inactive/archived/internal quality_feedback_questions.
Anon has no grants on feedback_responses or quality feedback analytics source tables.
branches.password does not exist.
app_user_profiles exists and has RLS enabled.
authenticated has SELECT only on app_user_profiles.
No authenticated INSERT/UPDATE/DELETE/ALL policy exists on app_user_profiles.
legacy_branch_password_backups is not readable by anon or authenticated.
branch_login_approvals exists and has RLS enabled if branch login approval is in scope.
anon has no grants on branch_login_approvals.
branch login approval RPCs are executable only by authenticated/service_role.
```

## Unauthenticated user tests

```text
Open the client URL in a private/incognito browser.
No sensitive data loads before login.
Branches are not readable.
Pharmacists are not readable unless a future reviewed policy intentionally makes them public.
HR requests are not readable.
Feedback/admin data is not readable.
Public feedback form can load only active QC questions.
Inactive QC questions are not readable before login.
No write operation works.
```

## Direct anon Supabase calls

Use the public anon key:

```bash
curl "$SUPABASE_URL/rest/v1/branches?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl "$SUPABASE_URL/rest/v1/app_user_profiles?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl "$SUPABASE_URL/rest/v1/hr_requests?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Expected: denied or no sensitive rows returned.

## Branch user tests

```text
Branch user can log in.
Branch user with correct password sees Waiting for Admin Approval before app access.
Pending branch login creates a branch_login_approvals row in Supabase.
Branch user cannot access modules while approval is pending.
Branch user cannot approve or reject own login request.
Branch user cannot read another user's login approval request.
Rejected login signs branch user out and returns to login.
Expired login approval signs branch user out and returns to login.
Approval verification failure signs branch user out and blocks access.
Branch user can see only allowed branch data.
Branch user cannot access another branch's branch-scoped records.
Branch user cannot modify own role.
Branch user cannot modify own branch_id.
Branch user cannot insert a new app_user_profiles row.
Branch user cannot insert/update/delete restricted management tables.
```

## Delivery module checks

```text
Delivery module status is locally hardened, pending real Supabase RLS/manual validation.
docs/DELIVERY_RLS_MANUAL_TESTS.md has been run against the target Supabase project.
docs/DELIVERY_COVERAGE_PRODUCTION_QA_CHECKLIST.md has been run against the target frontend URL.
Anon cannot read or write delivery_orders.
Branch user can read and record only own-branch delivery orders.
Branch user cannot create delivery_orders for another branch.
Non-Talabat delivery orders require a block number.
Unknown block save-anyway produces unresolved block data, not invented geography.
Talabat orders store no block and are excluded from block coverage.
Manager can view all intended branch delivery coverage.
Supervisor assigned-branch scope is validated if supervisor role is enabled.
Owner/warehouse/accounts-equivalent delivery access matches the client's accepted role model.
Delivery insight operations task creation respects operations_tasks RLS.
Bahrain block map is internal-use accepted only; external/commercial redistribution license remains unconfirmed.
No customer PII is exposed through Delivery Coverage.
```

Browser console denial test:

```js
await supabase
  .from('app_user_profiles')
  .update({ role: 'admin', branch_id: 'BRANCH_ID_HERE' })
  .eq('user_id', 'AUTH_USER_UUID_HERE')
```

Expected: denied by grants/RLS.

## Manager/admin tests

```text
Manager/admin can access intended management screens only.
Manager/admin/owner can see pending branch login approvals.
Manager/admin/owner can approve a pending branch login request.
Manager/admin/owner can reject a pending branch login request with optional reason.
Accounts/warehouse cannot approve branch login requests unless explicitly changed later.
Manager/admin can perform expected management writes.
Manager/admin cannot bypass policies from the browser console.
Profile provisioning remains a trusted SQL/service-role operation.
```

## Storage checks

```text
Storage buckets are private by default.
Public buckets are documented with business justification.
No bucket allows unauthenticated writes.
Signed URL/public URL behavior is tested for client handover.
```

Linked project final-gate finding:

```text
Bucket `contributions` previously had public SELECT plus public INSERT/upload policies.
Linked remediation was applied with approval: supabase/migrations/20260614133000_harden_contributions_storage_and_rpc_grants.sql.
Current verified behavior: private bucket, anon denied, authenticated internal read, manager/app-management policies configured.
Pending: real manager Storage API upload/update/delete smoke once valid manager credentials are available.
Recovery notes: docs/CONTRIBUTIONS_STORAGE_RPC_GRANTS_RECOVERY_20260614133000.md.
```

## Final gate blockers

```text
Migration history is reconciled/clean in the linked project after applying 20260614150000_harden_spin_static_qr_exchange_rpc.sql.
Unsafe non-allowlisted POST_MIGRATION helper-function anon EXECUTE grants were remediated in the linked project.
Spin Static QR SQL/API checks pass after applying supabase/migrations/20260614150000_harden_spin_static_qr_exchange_rpc.sql. Browser/manual Static QR checks on the real deployed URL remain pending.
Edge Function production secrets/CORS are incomplete on the linked project: only Supabase default secrets are currently listed. Local code uses non-wildcard dynamic CORS for browser-called functions and placeholder-safe protected email configuration.
The contributions bucket public-exposure blocker is remediated; manager Storage API write smoke remains pending.
Manager browser approval flow and supervisor assigned-branch session are pending.
npm audit still fails and production acceptance is not recorded.
```

## Edge Function checks

```text
No wildcard Access-Control-Allow-Origin exists in Edge Functions.
ALLOWED_ORIGIN or CLIENT_APP_URL is set to the deployed frontend origin.
admin-create-user accepts only active manager Bearer sessions from an allowed Origin.
analyze-sentiment accepts only active admin/manager Bearer sessions from an allowed Origin and remains disabled unless AI_INSIGHTS_ENABLED=true plus ANTHROPIC_API_KEY are configured.
generate-monthly-report rejects missing/invalid x-function-secret before checking email provider configuration.
notify-negative-trend rejects missing/invalid x-function-secret before checking email provider configuration.
Email functions reject placeholder/example sender, recipient, and dashboard URL values.
Internal/scheduled functions are not browser-called.
```

## RPC allowlist checks

```text
Only these anon-callable RPCs are intentionally public:
- validate_spin_token(text)
- execute_spin_transaction(text, text, text, text, text)
- execute_spin_transaction(text, text, text, text, text, text)
- generate_spin_session_from_branch_code(text)

All internal current_app_* helpers, app_admin_* RPCs, branch_login_approval_* RPCs, and trigger/helper functions must not be directly executable by anon.
```

## Secret and source checks

```text
No SUPABASE_SERVICE_ROLE_KEY appears in frontend env or built assets.
No FUNCTION_SECRET appears in frontend env or built assets.
No hardcoded passwords exist in source code.
No branches.password usage exists in application code.
No real client credentials are committed.
```

## Client customization checks

```text
Client logo displays correctly.
Client app name and client name display correctly.
Disabled modules are hidden from top-level navigation.
Enabled modules still require Supabase authorization.
Country/currency values are correct for the client.
```
