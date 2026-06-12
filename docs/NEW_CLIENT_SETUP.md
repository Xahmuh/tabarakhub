# New Client Setup

This project is designed for a single-tenant commercial deployment model: every customer gets a separate Supabase project, database, storage, Auth user set, environment, and deployment URL. Do not add shared multi-tenant tables or `organization_id` columns for this deployment model.

## 1. Create a Supabase project

Create a new Supabase project for the client. Record:

```text
Project URL
Anon public key
Project ref
Dashboard access owner
Database password
```

Keep service-role keys private and out of frontend env files.

## 2. Apply migrations

Apply all project migrations to the new Supabase project:

```bash
supabase link --project-ref CLIENT_PROJECT_REF
supabase db push
```

The security hardening migration is:

```text
supabase/migrations/20260612034500_security_auth_rls_hardening.sql
```

Do not re-run older ad hoc SQL files after hardening unless they have been reviewed.

## 3. Create storage buckets

Create any required storage buckets for enabled modules. Current known bucket:

```text
contributions
```

Keep buckets private unless public access is intentionally documented for the client. If files need public delivery, prefer signed URLs or a reviewed public policy.

## 4. Configure RLS and run checks

After migrations, run:

```text
docs/POST_MIGRATION_SECURITY_CHECKS.sql
```

Stop if anon access, `branches.password`, or unprotected `app_user_profiles` grants appear.

## 5. Create Supabase Auth users

Create the first users in Supabase Dashboard > Authentication > Users:

```text
CLIENT_ADMIN_EMAIL_HERE
manager@client-domain.example
branch.tabarak1@client-domain.example
```

Use generated passwords. Do not store real passwords in source, SQL files, docs, or branch rows.

## 6. Provision app_user_profiles

Use:

```text
docs/CLIENT_PROVISIONING_TEMPLATE.sql
```

Admin/manager/accounts users may use `branch_id = null`. Branch users must have a valid `branch_id`.

## 7. Set FUNCTION_SECRET

Configure Edge Function secrets:

```bash
supabase secrets set FUNCTION_SECRET="use-a-long-random-secret"
```

`generate-monthly-report` and `notify-negative-trend` require `x-function-secret`. `analyze-sentiment` uses authenticated caller profile checks.

## 8. Configure production env

Copy:

```text
.env.example.production
```

to:

```text
.env.production
```

Set the client's `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, branding, country, currency, and module flags.

## 9. Configure clientConfig.ts

Review:

```text
config/clientConfig.ts
```

The file reads safe `VITE_` variables and provides defaults. For a dedicated client deployment, prefer `.env.production` overrides so the same codebase can be deployed repeatedly without source edits.

## 10. Deploy the frontend

Build:

```bash
npm run build
```

Deploy using your hosting provider's production flow:

```bash
# placeholder
your-deploy-command --prod
```

Point the client's subdomain to the deployed frontend:

```text
client-a.example.com -> Client A frontend deployment
```

## 11. Run smoke tests

Run:

```text
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
```

Also verify:

```text
Login works for admin, manager, and branch users.
Branch user sees only allowed branch data.
Enabled modules appear.
Disabled modules do not appear.
Exports/imports work only where enabled and authorized.
Edge Functions reject calls without required secrets/auth.
```

## 12. Handover credentials safely

Handover through a secure password manager or approved secret-sharing channel:

```text
Admin user credentials
Manager user credentials
Branch user credentials
Deployment URL
Support contact
Operational runbook
Known accepted risks
```

Never send service-role keys, database passwords, or `FUNCTION_SECRET` through chat or email.
