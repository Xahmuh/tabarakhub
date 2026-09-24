# Client Deployment Runbook

Use this runbook for each dedicated single-client installation. This is not a shared multi-tenant SaaS deployment.

Current final-gate decision:

```text
B) dedicated-client staging-ready only
```

The linked project is not production-ready as of the 2026-06-14 final gate.
Migration history is now clean on the current linked Supabase project, and the
known contributions storage/helper-function grant blockers were remediated.
Production deployment remains blocked until Edge Function secrets/CORS, Spin
Static QR checks, browser smoke tests, production backup/PITR confirmation, and
npm audit risk acceptance/remediation are complete. See
`docs/FINAL_PRODUCTION_READINESS_GATE_RESULTS.md`.

## Pre-deployment checklist

```text
Client Supabase project created.
Client deployment URL/subdomain reserved.
.env.production configured from .env.example.production.
config/clientConfig.ts defaults reviewed.
Storage bucket requirements reviewed.
Supabase Auth user list approved.
app_user_profiles provisioning plan prepared.
FUNCTION_SECRET generated.
Edge Function CORS origin configured.
Email sender/recipient/dashboard secrets configured with verified client values.
AI insights decision recorded and disabled unless accepted/configured.
ExcelJS accepted-risk decision recorded if audit issue remains.
```

Before configuring Edge Function secrets or redeploying functions, use:

```text
docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md
```

## Backup procedure

For existing client installations, back up before changes:

```bash
supabase db dump --linked --file backups/client-before-deploy.sql
supabase db dump --linked --schema public --file backups/client-public-schema-before-deploy.sql
```

For a brand-new client project, record that there is no production data yet.

## Migration application

Supabase CLI:

```bash
supabase link --project-ref CLIENT_PROJECT_REF
supabase db push
```

Manual SQL Editor fallback:

```text
Apply the contents of supabase/migrations/20260612034500_security_auth_rls_hardening.sql.
Apply any earlier required migrations that are not yet present in the client database.
```

Do not re-run old insecure SQL files after the hardening migration unless reviewed.

## Post-migration SQL checks

Run:

```text
docs/POST_MIGRATION_SECURITY_CHECKS.sql
```

Expected:

```text
RLS enabled on sensitive tables.
No unsafe anon grants.
branches.password does not exist.
app_user_profiles exists and authenticated has select only.
legacy_branch_password_backups is service_role-only if created.
```

## Auth/profile provisioning

Create Auth users in Supabase Dashboard, then provision profiles with:

```text
docs/CLIENT_PROVISIONING_TEMPLATE.sql
```

Required examples:

```text
Admin profile with branch_id null.
Manager profile with branch_id null or a management branch if desired.
Branch profile with a valid branch_id.
Inactive profile for suspended users.
```

## Secrets setup

Use `docs/EDGE_FUNCTIONS_DEPLOYMENT_CHECKLIST.md` as the operator checklist for
secret entry, CORS validation, redeploy commands, smoke tests, and rollback.
Do not redeploy Edge Functions until explicit approval is recorded.

Set:

```bash
supabase secrets set SUPABASE_URL="https://CLIENT_PROJECT_REF.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<server-only-service-role-key>"
supabase secrets set FUNCTION_SECRET="use-a-long-random-secret"
supabase secrets set ALLOWED_ORIGIN="https://CLIENT_FRONTEND_URL"
supabase secrets set CLIENT_APP_URL="https://CLIENT_FRONTEND_URL"
supabase secrets set CLIENT_PUBLIC_NAME="Client Public Name"
supabase secrets set CLIENT_DASHBOARD_URL="https://CLIENT_FRONTEND_URL"
supabase secrets set RESEND_API_KEY="<server-only-resend-key>"
supabase secrets set REPORT_FROM_EMAIL="reports@client-domain.example"
supabase secrets set NOTIFICATION_FROM_EMAIL="alerts@client-domain.example"
supabase secrets set ADMIN_EMAIL="admin-recipient@client-domain.example"
supabase secrets set CEO_EMAIL="executive-recipient@client-domain.example"
```

Do not place `FUNCTION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or third-party API secrets in frontend `VITE_` variables.

Replace every placeholder before enabling email functions. `generate-monthly-report`
and `notify-negative-trend` reject placeholder/example emails and require
`CLIENT_DASHBOARD_URL` to be an HTTPS production/staging URL.

Edge Function boundaries:

| Function | Boundary | Required auth/secrets |
| --- | --- | --- |
| `admin-create-user` | Browser-called internal manager action | Bearer token for active manager plus Supabase service-role secret server-side |
| `analyze-sentiment` | Browser-called internal admin/manager action | Bearer token for active admin/manager, AI enabled, Anthropic key server-side |
| `generate-monthly-report` | Internal/scheduled only | `x-function-secret` plus Resend/report/dashboard secrets |
| `notify-negative-trend` | Internal/scheduled only | `x-function-secret` plus Resend/notification/dashboard secrets |

Production CORS expectations:

```text
No wildcard CORS.
ALLOWED_ORIGIN or CLIENT_APP_URL must match the deployed frontend origin exactly.
Browser-called functions allow only configured origins.
Exact localhost fallback is for local development only.
Internal/scheduled functions should not be browser-called.
```

If AI insights are accepted for this dedicated client, set these server-only secrets and set `VITE_MODULE_AI_INSIGHTS=true` in frontend env. Otherwise leave them unset/false:

```bash
supabase secrets set AI_INSIGHTS_ENABLED="true"
supabase secrets set ANTHROPIC_API_KEY="<server-only-provider-key>"
```

## Build command

Run:

```bash
npm run typecheck
npm run build
```

Audit before release:

```bash
npm audit --audit-level=moderate
```

If the ExcelJS audit issue remains, record explicit client approval before production.

## Deployment command placeholders

Use the provider-specific production deploy command:

```bash
# Vercel example placeholder
vercel --prod

# Generic static hosting placeholder
your-deploy-command --source dist --prod
```

Set frontend env vars in the hosting provider to match `.env.production`.

For Vercel-hosted deployments, the Vercel CLI is required for deployment, env, and log commands. Install it only when deployment is explicitly authorized:

```bash
npm i -g vercel
vercel env pull
vercel deploy
vercel logs <deployment-url>
```

## Smoke test checklist

```text
Open the client URL.
Confirm logo, app name, client name, country, and environment label.
Confirm disabled modules are hidden.
Login as admin.
Login as manager.
Login as branch user.
Confirm branch user cannot read another branch's records.
Confirm app_user_profiles cannot be modified from the browser.
Confirm anon direct Supabase calls fail.
Confirm storage bucket behavior matches the documented policy.
Confirm protected Edge Functions reject missing/invalid x-function-secret.
Confirm browser-called Edge Functions reject disallowed origins and work from the deployed client URL.
Confirm email functions reject missing or placeholder/example sender, recipient, and dashboard URL config in staging, then pass after verified values are set.
Confirm AI insights are hidden/disabled unless intentionally enabled with server-only secrets.
Confirm Excel import/export works only for trusted users if enabled.
```

## Rollback notes

If deployment fails before data changes, roll back the frontend deployment.

If migration causes critical issues, restore the database backup.

If Auth/profile provisioning is wrong, fix `app_user_profiles`; do not disable RLS.

Do not restore legacy client-side password checks or reintroduce `branches.password`.
