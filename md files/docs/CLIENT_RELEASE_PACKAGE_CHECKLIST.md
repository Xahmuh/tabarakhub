# Client Release Package Checklist

Complete this checklist for each dedicated client release package.

## Delivery details

```text
Client name:
Deployment URL:
Staging URL:
Production URL:
Supabase project reference:
Release version/build:
Release date:
Release owner:
```

## Admin login handover

```text
Admin user email:
Handover method:
Password manager item/shared secret reference:
MFA status:
Temporary password rotation confirmed:
```

Do not place real passwords in this checklist.

## Configured modules

```text
HR:
Quality feedback:
Reports:
Excel export:
Branch dashboard:
Manager dashboard:
Admin dashboard:
Products:
Sales:
Spin & Win:
Cash flow:
Cash tracker:
Corporate codex:
Employee contributions:
Settings:
Workforce:
```

## clientConfig summary

```text
appName:
clientName:
logoUrl:
primaryColor:
accentColor:
supportEmail:
defaultLocale:
currency:
country:
environmentLabel:
```

## Environment variables checklist

Frontend-safe:

```text
VITE_SUPABASE_URL configured:
VITE_SUPABASE_ANON_KEY configured:
VITE_APP_NAME configured:
VITE_CLIENT_NAME configured:
VITE_CLIENT_LOGO_URL configured:
Module flags configured:
```

Server-only:

```text
SUPABASE_SERVICE_ROLE_KEY not exposed to frontend:
FUNCTION_SECRET not exposed to frontend:
Third-party API keys stored only in trusted server/Edge Function secrets:
```

## FUNCTION_SECRET confirmation

```text
FUNCTION_SECRET configured in Supabase secrets:
generate-monthly-report tested with x-function-secret:
notify-negative-trend tested with x-function-secret:
analyze-sentiment tested with authenticated admin/manager:
```

## Database and migration status

```text
Supabase migrations applied:
Hardening migration applied:
branches.password removed:
legacy_branch_password_backups reviewed and restricted:
Storage buckets created:
Storage policies reviewed:
```

## Post-migration checks

```text
POST_MIGRATION_SECURITY_CHECKS.sql run:
No unsafe anon grants:
app_user_profiles protected:
RLS enabled on sensitive tables:
Result evidence location:
```

## Security acceptance

```text
CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md completed:
Unauthenticated access blocked:
Branch scope verified:
Role/branch escalation blocked:
Anon direct Supabase calls blocked:
Frontend bundle secret scan passed:
Storage bucket review passed:
```

## Known accepted risks

```text
ExcelJS/uuid audit risk resolved or formally accepted:
Accepted risk owner:
Accepted risk expiry/review date:
Release notes include accepted risk:
```

## Support and maintenance terms

```text
Support contact:
Support hours:
Maintenance window:
Incident escalation path:
Backup/restore ownership:
Update cadence:
```
