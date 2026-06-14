# Production Security Setup

Current final-gate status:

```text
B) dedicated-client staging-ready only
```

See `docs/FINAL_PRODUCTION_READINESS_GATE_RESULTS.md` and
`docs/MIGRATION_GAP_REPORT.md` before any production sign-off. The linked
project has clean migration history, remediated contributions storage exposure,
remediated unsafe non-allowlisted helper-function anon grants, and passing
Spin Static QR SQL/API checks. Production blockers remain around Edge Function
secrets/CORS, manager/supervisor browser smoke tests, production backup/PITR
confirmation, browser/manual Spin QR validation on the deployed URL, and
unresolved audit risks.

Use `docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md` before configuring Edge
Function secrets or redeploying hardened functions. Do not redeploy Edge
Functions without explicit approval.

This app now uses Supabase Auth for sign-in and `public.app_user_profiles` for application authorization. Do not deploy production traffic until the security migration has been applied and every user has a valid profile row.

## 1. Apply the security migration

Apply this migration to the linked Supabase project:

```bash
supabase db push
```

Migration files:

```text
supabase/migrations/20260612034500_security_auth_rls_hardening.sql
supabase/migrations/20260612083000_app_user_profiles_service_role_only_writes.sql
supabase/migrations/20260614090000_branch_login_approvals.sql
```

Do not re-run older ad hoc SQL files after this migration unless they have been reviewed. Some legacy setup files contain public/anon policies that this hardening migration intentionally removes.

The migration removes `public.branches.password` from live app data. If the column exists, non-empty legacy passwords are first copied to `public.legacy_branch_password_backups`, a service-role-only table with RLS enabled and no authenticated policies. Use that backup only for a one-time Auth account provisioning pass, then delete it after all branch users are confirmed.

Intentional authenticated-wide reads are limited to shared internal datasets: `products`, `pharmacists`, `pharmacist_branches`, `corporate_codex`, `employee_contributions`, and `quality_feedback_settings`. These are not public anon policies, and writes remain manager/admin-gated where applicable.

## 2. Create the first owner/admin user

Create the user in Supabase Dashboard under Authentication > Users.

Recommended email pattern for code-based login:

```text
admin@tabarak.local
```

The login screen accepts either a real email or a branch/code value. If a user enters a code without `@`, the app maps it to:

```text
<lowercase-code>@tabarak.local
```

After creating the Auth user, copy its `auth.users.id` and create an admin profile. Admin, manager, and accounts profiles may use `branch_id = null`; branch-role users must have a branch.

```sql
select id, email
from auth.users
where email = 'admin@tabarak.local';

insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values (
  '00000000-0000-0000-0000-000000000000',
  null,
  'admin',
  true
);
```

## 3. Create branch users

For each branch, create one Supabase Auth user. Use either real emails or the code-based convention:

```text
t01@tabarak.local
t02@tabarak.local
```

Then insert one profile row per Auth user:

```sql
select id, email
from auth.users
where email in ('t01@tabarak.local', 't02@tabarak.local');

insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values (
  '11111111-1111-1111-1111-111111111111',
  (select id from public.branches where code = 'T01'),
  'branch',
  true
);
```

Use a strong random password for each Auth user. Do not store branch passwords in `public.branches` or any frontend-readable table.

## 3A. Enable branch login approval

Apply the local migration `20260614090000_branch_login_approvals.sql` before
enabling branch users in staging/production. Branch users with valid passwords
will create a pending approval request and wait until an admin/manager/owner
approves that current login request.

Security expectations:

```text
anon has no access to branch_login_approvals.
branch users can create/read only their own pending request.
branch users cannot approve/reject/cancel into approved state.
admin/manager/owner can approve/reject through the approval UI/RPCs.
accounts/warehouse/supervisor do not have approval rights.
approval verification failure signs the branch user out.
```

See `docs/BRANCH_LOGIN_APPROVAL_FLOW.md` for the full manual test checklist.

## 4. Required profile columns

`public.app_user_profiles` requires:

```text
user_id   uuid, primary key, references auth.users(id)
branch_id uuid, references public.branches(id), required only for role branch
role      text, one of admin, manager, branch, accounts
is_active boolean, defaults true
```

`created_at` and `updated_at` are maintained as timestamps.

## 5. Role meanings

`owner`: Broad read/approval role where enabled for the dedicated client. Validate before use.

`admin`: Legacy/system administration role. Prefer manager/owner for day-to-day app use unless the client explicitly provisions admin users. Profile provisioning still belongs in trusted SQL/service-role tooling.

`manager`: Can manage operational records and read cross-branch data, but must not be able to grant roles or modify `app_user_profiles` from the client.

`warehouse`: Current accounts-equivalent broad-read role in the linked project. It must not approve branch login requests.

`accounts`: Legacy accounts role. Normalize to the accepted warehouse/accounts-equivalent model before production.

`supervisor`: Assigned-branch-scoped role. It must be provisioned with explicit branch assignments and manually validated before production use.

`branch`: Can read and write only records scoped to its own `branch_id` where branch operations are allowed.

## 5A. Final gate blockers from the linked project

The 2026-06-14 final gate found these production blockers:

```text
Migration history is clean on the current linked Supabase project after applying 20260614150000_harden_spin_static_qr_exchange_rpc.sql.
Unsafe non-allowlisted anon EXECUTE grants were remediated; keep POST_MIGRATION security checks in the production validation runbook for each future target project.
Spin Static QR SQL/API security checks pass after applying 20260614150000_harden_spin_static_qr_exchange_rpc.sql. Browser/manual Static QR checks on the real deployed URL remain pending.
Linked Edge Function secrets/CORS are incomplete: FUNCTION_SECRET, ALLOWED_ORIGIN/CLIENT_APP_URL, RESEND/email settings, and optional AI provider settings are not configured.
The contributions storage bucket public-exposure blocker is remediated on the linked project; manager Storage API write smoke remains pending.
Manager browser credentials were not available; manager access passed only by SQL role simulation.
Supervisor role/session scope is not provisioned and remains untested.
```

Do not weaken RLS, broaden policies, disable RLS, or add frontend secrets to
clear these blockers. Fix the underlying configuration/policies or document a
formal production risk acceptance where appropriate.

Applied linked-project remediation:

```text
supabase/migrations/20260614133000_harden_contributions_storage_and_rpc_grants.sql
```

Applied with approval on 2026-06-14 using `supabase.cmd db query --linked --file`.

Recovery notes:

```text
docs/CONTRIBUTIONS_STORAGE_RPC_GRANTS_RECOVERY_20260614133000.md
```

Expected storage behavior after approval/application:

```text
anon cannot upload to contributions.
anon cannot list/select/download contributions objects.
authenticated users can read internal contribution files.
manager/app-management sessions can upload/update/delete contribution files.
employee contribution downloads use authenticated Supabase Storage download, not public bucket URLs.
```

Allowed public RPCs after approval/application:

```text
validate_spin_token(text)
execute_spin_transaction(text, text, text, text, text)
execute_spin_transaction(text, text, text, text, text, text)
generate_spin_session_from_branch_code(text)
```

All internal helper/RLS functions should be denied direct anon execution.

Applied Spin Static QR remediation:

```text
supabase/migrations/20260614150000_harden_spin_static_qr_exchange_rpc.sql
docs/SPIN_STATIC_QR_SECURITY_RESULTS.md
```

This remediation was applied to the linked project with explicit approval using
`supabase.cmd migration up --linked --yes`. It redefines only the static QR
branch-code exchange RPC and preserves the reviewed public Spin customer-flow
RPC boundary.

Verification after application:

```text
contributions bucket public=false.
legacy public contribution storage policies count=0.
anon upload is denied.
anon public URL read is denied.
authenticated contribution download works.
unsafe non-allowlisted anon EXECUTE count=0.
Spin public QR/token RPCs still work.
Spin Static QR security checks pass; browser/manual deployed-URL checks remain pending.
manager Storage API write smoke is pending until valid manager credentials are available.
```

## 6. Prevent role escalation

The migrations grant authenticated users `select` on `public.app_user_profiles`, revoke `insert`, `update`, and `delete`, and remove authenticated mutation policies from the table. Normal users cannot update their own profile row or change their role from the browser.

Keep profile provisioning in one of these trusted paths only:

```text
Supabase SQL editor run by an owner
Server-side code using the service-role key
Supabase Edge Function protected by a server-only secret
```

Never expose the Supabase service-role key or profile mutation endpoints to the frontend.

## 7. Edge Function secret

Operational checklist:

```text
docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md
```

Follow that checklist for secret setup, CORS validation, redeploy commands,
post-deploy smoke tests, and rollback guidance. Do not print real secret values
and do not redeploy without explicit approval.

Set `FUNCTION_SECRET` in Supabase Edge Function secrets before enabling scheduled/server-only functions:

```bash
supabase secrets set FUNCTION_SECRET="<strong-random-secret>"
```

Call protected functions with:

```text
x-function-secret: <strong-random-secret>
```

Current protected functions:

```text
supabase/functions/generate-monthly-report
supabase/functions/notify-negative-trend
```

Browser-callable functions:

```text
supabase/functions/admin-create-user
supabase/functions/analyze-sentiment
```

Function boundary table:

| Function | Boundary | Required auth/secrets | CORS behavior |
| --- | --- | --- | --- |
| `admin-create-user` | Authenticated internal browser call | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, caller Bearer token, active `manager` profile | Dynamic allowlist from `ALLOWED_ORIGIN`/`CLIENT_APP_URL`; disallowed origins fail closed |
| `analyze-sentiment` | Authenticated internal browser call, optional AI scope | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, caller Bearer token, active `admin` or `manager` profile, `AI_INSIGHTS_ENABLED=true`, `ANTHROPIC_API_KEY` | Dynamic allowlist from `ALLOWED_ORIGIN`/`CLIENT_APP_URL`; disallowed origins fail closed |
| `generate-monthly-report` | Internal/scheduled only | `FUNCTION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, `ADMIN_EMAIL`, `CLIENT_DASHBOARD_URL` | No browser CORS surface; call with `x-function-secret` only |
| `notify-negative-trend` | Internal/scheduled only | `FUNCTION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `CEO_EMAIL`, `CLIENT_DASHBOARD_URL` | No browser CORS surface; call with `x-function-secret` only |

The internal email functions check `x-function-secret` before email/provider
configuration and fail safely. They reject placeholder/example sender,
recipient, and dashboard URL values; `CLIENT_DASHBOARD_URL` must be HTTPS.

## 8. Edge Function CORS and server-only config

Set a client-specific allowed origin before testing browser-called Edge Functions:

```bash
supabase secrets set ALLOWED_ORIGIN="https://CLIENT_FRONTEND_URL"
supabase secrets set CLIENT_APP_URL="https://CLIENT_FRONTEND_URL"
```

Do not use wildcard CORS for production. Local development may use the localhost fallback, but production must set the exact deployed frontend origin.

Implementation notes for the prepared local Edge Function code:

```text
No Edge Function uses wildcard Access-Control-Allow-Origin.
Browser-callable functions validate the request Origin dynamically.
Allowed production origins come only from ALLOWED_ORIGIN and/or CLIENT_APP_URL.
Exact localhost fallbacks are limited to http://localhost:5173 and http://127.0.0.1:5173, and only when no production origin is configured.
OPTIONS preflight returns 204 for allowed browser origins and 403 for disallowed browser origins.
Internal/scheduled functions do not expose a browser CORS surface.
This code must be deployed only after explicit deployment approval.
```

Configure email/report functions with verified values:

```bash
supabase secrets set RESEND_API_KEY="<server-only-resend-key>"
supabase secrets set REPORT_FROM_EMAIL="reports@client-domain.example"
supabase secrets set NOTIFICATION_FROM_EMAIL="alerts@client-domain.example"
supabase secrets set ADMIN_EMAIL="admin-recipient@client-domain.example"
supabase secrets set CEO_EMAIL="executive-recipient@client-domain.example"
supabase secrets set CLIENT_DASHBOARD_URL="https://CLIENT_FRONTEND_URL"
supabase secrets set CLIENT_PUBLIC_NAME="Client Public Name"
```

The email functions fail safely if required sender, recipient, dashboard URL, or
API key values are missing. They also reject placeholder/example values such as
`client-domain.example`, `example.com`, `CLIENT_FRONTEND_URL`, localhost URLs,
and `onboarding@resend.dev`.

AI insights are existing optional scope only. Keep them disabled unless the client/release owner accepts this scope and provider secrets are configured:

```bash
supabase secrets set AI_INSIGHTS_ENABLED="true"
supabase secrets set ANTHROPIC_API_KEY="<server-only-provider-key>"
```

Do not put `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `FUNCTION_SECRET` in frontend `VITE_` variables.

Current linked-project secret validation:

```text
supabase secrets list: only Supabase default secrets are present.
Missing for production: FUNCTION_SECRET, ALLOWED_ORIGIN or CLIENT_APP_URL, RESEND_API_KEY, REPORT_FROM_EMAIL, NOTIFICATION_FROM_EMAIL, ADMIN_EMAIL, CEO_EMAIL, CLIENT_DASHBOARD_URL, and optional AI_INSIGHTS_ENABLED/ANTHROPIC_API_KEY.
```

## 9. Test anon access is blocked

Run `docs/POST_MIGRATION_SECURITY_CHECKS.sql` after applying the migration. The anon grant and anon `USING (true)` checks should return zero unsafe rows for sensitive tables.

You can also test through the REST API with only the anon key. These should fail or return no rows:

```bash
curl "$SUPABASE_URL/rest/v1/branches?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl "$SUPABASE_URL/rest/v1/app_user_profiles?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

## 10. Test authenticated scoping

Use at least two branch accounts and one manager/admin account.

Branch user checks:

```text
Sign in as branch T01.
Confirm the app loads the T01 branch profile.
Confirm T01 can read/write its own lost sales, shortages, manual products, and cash differences where applicable.
Confirm T01 cannot read T02 branch-scoped rows.
Confirm T01 cannot insert or update app_user_profiles.
```

Manager/admin checks:

```text
Sign in as manager or admin.
Confirm cross-branch operational dashboards load.
Confirm branch management writes still work.
Confirm app_user_profiles changes are performed only through trusted SQL/service-role tooling, not from the browser client.
```

Accounts checks:

```text
Sign in as accounts.
Confirm finance/cashflow read paths work.
Confirm manager-only writes are denied.
```

## 11. Known dependency risk

`exceljs@4.4.0` currently has moderate npm audit findings through `uuid`. The current audit also reports high-severity Vite/esbuild build-tool findings. Product import parses uploaded `.xlsx` files, so keep that feature restricted to trusted manager/admin users, keep the 5MB upload guard, and replace or upgrade ExcelJS when a patched release is available. Do not claim dependency audit closure until:

```bash
npm audit --audit-level=moderate
```

passes.
