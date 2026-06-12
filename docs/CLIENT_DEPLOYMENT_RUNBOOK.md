# Client Deployment Runbook

Use this runbook for each dedicated single-client installation. This is not a shared multi-tenant SaaS deployment.

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
ExcelJS accepted-risk decision recorded if audit issue remains.
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

Set:

```bash
supabase secrets set FUNCTION_SECRET="use-a-long-random-secret"
```

Do not place `FUNCTION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or third-party API secrets in frontend `VITE_` variables.

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
Confirm Excel import/export works only for trusted users if enabled.
```

## Rollback notes

If deployment fails before data changes, roll back the frontend deployment.

If migration causes critical issues, restore the database backup.

If Auth/profile provisioning is wrong, fix `app_user_profiles`; do not disable RLS.

Do not restore legacy client-side password checks or reintroduce `branches.password`.
