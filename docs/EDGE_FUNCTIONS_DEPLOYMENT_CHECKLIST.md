# Edge Functions Deployment Checklist

Current status:

```text
B) dedicated-client staging-ready only
```

This checklist is for configuring Supabase Edge Function secrets and redeploying
the locally hardened functions for a dedicated-client project. Do not redeploy
without explicit approval. Do not paste real secret values into docs, tickets,
chat, terminal logs, screenshots, or committed files.

## Scope

Functions covered:

```text
admin-create-user
analyze-sentiment
generate-monthly-report
notify-negative-trend
```

Prepared local hardening:

```text
Browser-called functions use ALLOWED_ORIGIN / CLIENT_APP_URL CORS allowlist.
Disallowed browser origins fail closed.
OPTIONS preflight behavior is explicit.
Internal email functions require x-function-secret.
Email functions reject placeholder/example sender, recipient, and dashboard URL values.
AI insights remain disabled unless intentionally configured.
```

## Secret Handling Rules

```text
Never print real secret values.
Never commit .env.production with real values.
Never put server-only secrets in VITE_ variables.
Use placeholders in runbooks and tickets.
Use Supabase Dashboard or CLI for real secret entry.
Rotate any secret that is accidentally exposed.
```

Frontend-safe values may use `VITE_` only when they are intended for the
browser, such as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Server-only values must not use `VITE_`:

```text
SUPABASE_SERVICE_ROLE_KEY
FUNCTION_SECRET
RESEND_API_KEY
ANTHROPIC_API_KEY
REPORT_FROM_EMAIL
NOTIFICATION_FROM_EMAIL
ADMIN_EMAIL
CEO_EMAIL
CLIENT_DASHBOARD_URL
AI_INSIGHTS_ENABLED
ALLOWED_ORIGIN
CLIENT_APP_URL
```

## Required Secrets

Required for production-like Edge Function deployment:

| Secret | Required for | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | all functions | Supabase project URL; server context |
| `SUPABASE_SERVICE_ROLE_KEY` | all functions | Server-only; never expose to frontend |
| `FUNCTION_SECRET` | `generate-monthly-report`, `notify-negative-trend` | Strong random value for internal/scheduled calls |
| `ALLOWED_ORIGIN` or `CLIENT_APP_URL` | `admin-create-user`, `analyze-sentiment` | Exact deployed frontend origin for CORS |
| `RESEND_API_KEY` | email functions | Required only when email functions are enabled |
| `REPORT_FROM_EMAIL` | `generate-monthly-report` | Verified sender; no placeholder/example value |
| `NOTIFICATION_FROM_EMAIL` | `notify-negative-trend` | Verified sender; no placeholder/example value |
| `ADMIN_EMAIL` | `generate-monthly-report` | Verified recipient; no placeholder/example value |
| `CEO_EMAIL` | `notify-negative-trend` | Verified recipient; no placeholder/example value |
| `CLIENT_DASHBOARD_URL` | email functions | HTTPS deployed app URL; no localhost/example value |
| `CLIENT_PUBLIC_NAME` | email functions | Optional display name; safe non-secret value |

Optional, only if AI insights are intentionally enabled:

| Secret | Required for | Notes |
| --- | --- | --- |
| `AI_INSIGHTS_ENABLED` | `analyze-sentiment` | Set to `true` only after acceptance |
| `ANTHROPIC_API_KEY` | `analyze-sentiment` | Server-only provider key |

## Function Boundary Table

| Function | Boundary | Auth / secret requirement | CORS |
| --- | --- | --- | --- |
| `admin-create-user` | Authenticated internal browser action | Active manager Bearer token; `SUPABASE_URL`; `SUPABASE_SERVICE_ROLE_KEY` | Allowlisted `ALLOWED_ORIGIN` / `CLIENT_APP_URL`; disallowed origins fail closed |
| `analyze-sentiment` | Authenticated internal browser action, optional AI scope | Active admin/manager Bearer token; `SUPABASE_URL`; `SUPABASE_SERVICE_ROLE_KEY`; `AI_INSIGHTS_ENABLED=true`; `ANTHROPIC_API_KEY` | Allowlisted `ALLOWED_ORIGIN` / `CLIENT_APP_URL`; disallowed origins fail closed |
| `generate-monthly-report` | Internal/scheduled only | `x-function-secret`; `SUPABASE_URL`; `SUPABASE_SERVICE_ROLE_KEY`; Resend/report/dashboard secrets | No browser CORS surface |
| `notify-negative-trend` | Internal/scheduled only | `x-function-secret`; `SUPABASE_URL`; `SUPABASE_SERVICE_ROLE_KEY`; Resend/notification/dashboard secrets | No browser CORS surface |

## Setup Commands

Use placeholders only in shared docs. Enter real values only in the operator's
secure terminal or Supabase Dashboard.

Core server context:

```bash
supabase secrets set SUPABASE_URL="https://CLIENT_PROJECT_REF.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<server-only-service-role-key>"
```

CORS and internal function protection:

```bash
supabase secrets set FUNCTION_SECRET="<long-random-secret>"
supabase secrets set ALLOWED_ORIGIN="https://CLIENT_FRONTEND_URL"
supabase secrets set CLIENT_APP_URL="https://CLIENT_FRONTEND_URL"
```

Email/report configuration:

```bash
supabase secrets set RESEND_API_KEY="<server-only-resend-key>"
supabase secrets set REPORT_FROM_EMAIL="reports@client-domain.example"
supabase secrets set NOTIFICATION_FROM_EMAIL="alerts@client-domain.example"
supabase secrets set ADMIN_EMAIL="admin-recipient@client-domain.example"
supabase secrets set CEO_EMAIL="executive-recipient@client-domain.example"
supabase secrets set CLIENT_DASHBOARD_URL="https://CLIENT_FRONTEND_URL"
supabase secrets set CLIENT_PUBLIC_NAME="Client Public Name"
```

AI insights, only if intentionally enabled:

```bash
supabase secrets set AI_INSIGHTS_ENABLED="true"
supabase secrets set ANTHROPIC_API_KEY="<server-only-provider-key>"
```

If AI insights are not accepted:

```bash
supabase secrets unset AI_INSIGHTS_ENABLED
supabase secrets unset ANTHROPIC_API_KEY
```

## Pre-Redeploy Checklist

```text
Explicit approval to redeploy Edge Functions has been received.
Migration history is clean for the target Supabase project.
Production backup/PITR or recovery point is confirmed where applicable.
All required secrets are entered in Supabase, not committed to files.
ALLOWED_ORIGIN / CLIENT_APP_URL matches the deployed frontend exactly.
Email sender and recipient domains are verified.
CLIENT_DASHBOARD_URL is HTTPS and not localhost/example/placeholder.
AI decision is documented; AI secrets are absent unless intentionally enabled.
Local typecheck/build pass.
Rollback owner and communication channel are known.
```

## Redeploy Commands

Do not run these without explicit approval.

Redeploy all hardened functions:

```bash
supabase functions deploy admin-create-user
supabase functions deploy analyze-sentiment
supabase functions deploy generate-monthly-report
supabase functions deploy notify-negative-trend
```

Redeploy one function at a time when reducing blast radius:

```bash
supabase functions deploy admin-create-user
supabase functions deploy analyze-sentiment
supabase functions deploy generate-monthly-report
supabase functions deploy notify-negative-trend
```

After deployment, do not print secret values. It is acceptable to list secret
names only:

```bash
supabase secrets list
```

## CORS Validation

Use the deployed client URL as the allowed origin.

Allowed preflight should return success and include the deployed origin:

```bash
curl -i -X OPTIONS "https://CLIENT_PROJECT_REF.functions.supabase.co/admin-create-user" \
  -H "Origin: https://CLIENT_FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Disallowed preflight should fail closed:

```bash
curl -i -X OPTIONS "https://CLIENT_PROJECT_REF.functions.supabase.co/admin-create-user" \
  -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Repeat for `analyze-sentiment`.

Expected:

```text
Allowed origin: 204 and Access-Control-Allow-Origin equals the deployed frontend origin.
Disallowed origin: 403 and no wildcard CORS.
No response uses Access-Control-Allow-Origin: *.
```

## Post-Deploy Smoke Tests

Run these after approved redeploy.

### `admin-create-user`

```text
OPTIONS preflight succeeds from allowed deployed origin.
OPTIONS preflight fails from disallowed origin.
POST without Authorization returns 401.
POST with branch/accounts/supervisor token returns 403.
POST with active manager token can create an allowed role.
Invalid role is rejected.
Branch role without branchId is rejected.
Supervisor branch ids must point to real branch rows.
```

### `analyze-sentiment`

```text
OPTIONS preflight succeeds from allowed deployed origin.
OPTIONS preflight fails from disallowed origin.
If AI_INSIGHTS_ENABLED is unset/false, request returns disabled response.
If AI is enabled without ANTHROPIC_API_KEY, request fails safely as not configured.
Unauthenticated request returns 401.
Branch/accounts/supervisor token returns 403.
Admin/manager token can run only when AI is intentionally enabled and configured.
No provider key is visible in frontend or logs.
```

### `generate-monthly-report`

```text
Missing x-function-secret returns 401 before email configuration details.
Invalid x-function-secret returns 401.
Valid x-function-secret with missing/placeholder email config fails safely.
Placeholder/example REPORT_FROM_EMAIL, ADMIN_EMAIL, or CLIENT_DASHBOARD_URL is rejected.
Verified production/staging values can send a report when data exists.
No browser CORS behavior is required or expected.
```

### `notify-negative-trend`

```text
Missing x-function-secret returns 401 before email configuration details.
Invalid x-function-secret returns 401.
Valid x-function-secret with missing/placeholder email config fails safely.
Placeholder/example NOTIFICATION_FROM_EMAIL, CEO_EMAIL, or CLIENT_DASHBOARD_URL is rejected.
Verified production/staging values can send a notification only when trend logic triggers.
No browser CORS behavior is required or expected.
```

## Placeholder Scan

Before sign-off, scan source, deployment env, and Supabase secrets names/values
in the secure operator environment:

```text
your-app.com
admin@example.com
onboarding@resend.dev
CLIENT_FRONTEND_URL
client-domain.example
localhost in production URLs
Access-Control-Allow-Origin: *
```

Expected:

```text
No placeholder values are configured as live secrets.
Placeholder strings in source appear only in denylist/checklist examples.
No production URL uses localhost.
No wildcard CORS exists.
```

## Rollback Guidance

If a redeployed function fails:

```text
1. Disable the affected workflow in frontend flags if available.
2. Restore the previous function source from git history or the last known good artifact.
3. Redeploy only the affected function after explicit approval.
4. Rotate FUNCTION_SECRET, RESEND_API_KEY, or provider keys if any value was exposed.
5. Re-run the smoke tests for the affected function.
6. Record the incident and final status in readiness docs.
```

If CORS blocks the deployed frontend:

```text
1. Verify the browser Origin exactly matches ALLOWED_ORIGIN or CLIENT_APP_URL.
2. Fix the Supabase secret value; do not change code to wildcard CORS.
3. Re-test allowed and disallowed preflight.
```

If email functions reject configuration:

```text
1. Replace placeholder/example sender, recipient, or dashboard URL values.
2. Confirm sender domain is verified with the email provider.
3. Confirm CLIENT_DASHBOARD_URL uses HTTPS.
4. Re-run x-function-secret smoke tests before sending real emails.
```

## Production Sign-Off Boundary

Do not mark production-ready until:

```text
Secrets are configured for the target Supabase project.
Hardened functions are redeployed with approval.
CORS smoke tests pass.
Function auth/secret smoke tests pass.
No real secrets appear in frontend env, dist, docs, logs, or screenshots.
Remaining non-function production blockers are resolved or formally accepted.
```
