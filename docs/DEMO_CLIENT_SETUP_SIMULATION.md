# Demo Client Setup Simulation

This simulation validates onboarding a dedicated single-client installation before selling the product. It does not implement multi-tenancy and does not add `organization_id`.

Demo client:

```text
Demo Pharmacy Group
```

Placeholder users:

```text
admin@demo-client.example
manager@demo-client.example
branch.demo1@demo-client.example
```

Do not use or document real passwords in this simulation.

## 1. Create a new Supabase project

Create a new Supabase project for `Demo Pharmacy Group`.

Record placeholders privately:

```text
DEMO_SUPABASE_PROJECT_REF
DEMO_SUPABASE_URL
DEMO_SUPABASE_ANON_KEY
```

Keep the service-role key private and never place it in frontend environment variables.

## 2. Apply migrations

Link the CLI to the demo project:

```bash
supabase link --project-ref DEMO_SUPABASE_PROJECT_REF
```

Apply migrations:

```bash
supabase db push
```

Confirm the hardening migration is included:

```text
supabase/migrations/20260612034500_security_auth_rls_hardening.sql
```

Do not re-run old ad hoc SQL files after the hardening migration unless reviewed.

## 3. Create storage buckets

Create required buckets for enabled modules.

Current known bucket:

```text
contributions
```

Keep buckets private unless a public policy is intentionally documented. Do not allow unauthenticated writes.

## 4. Configure Supabase Auth users

Create these users in Supabase Dashboard > Authentication > Users:

```text
admin@demo-client.example
manager@demo-client.example
branch.demo1@demo-client.example
```

Use generated passwords and hand them over only through a secure secret-sharing process.

## 5. Insert app_user_profiles

After creating Auth users, copy their UUIDs and run:

```text
docs/DEMO_CLIENT_PROVISIONING_EXAMPLE.sql
```

Use placeholders first, then replace with demo UUIDs and branch IDs in a private working copy.

## 6. Set FUNCTION_SECRET

Set the demo Edge Function secret:

```bash
supabase secrets set FUNCTION_SECRET="use-a-long-random-demo-secret"
```

Protected functions:

```text
generate-monthly-report requires x-function-secret.
notify-negative-trend requires x-function-secret.
analyze-sentiment uses authenticated caller profile checks.
```

## 7. Configure .env.production

Copy:

```text
.env.example.production
```

to:

```text
.env.production
```

Set safe frontend values:

```text
VITE_SUPABASE_URL=DEMO_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=DEMO_SUPABASE_ANON_KEY
VITE_APP_NAME="Pharmacy Operations System"
VITE_CLIENT_NAME="Demo Pharmacy Group"
VITE_SUPPORT_EMAIL="support@demo-client.example"
VITE_COUNTRY="BH"
VITE_CURRENCY="BHD"
VITE_ENVIRONMENT_LABEL="Demo"
```

Do not add `SUPABASE_SERVICE_ROLE_KEY` or `FUNCTION_SECRET` to any `VITE_` variable.

## 8. Configure config/clientConfig.ts

The active app reads:

```text
config/clientConfig.ts
```

For the simulation, use `.env.production` values above. A copyable demo example is also available:

```text
config/clientConfig.demo.ts
```

Do not automatically replace the active config unless a deployment operator intentionally chooses to do so.

## 9. Build the app

Run:

```bash
npm run typecheck
npm run build
```

The build output is:

```text
dist/
```

## 10. Deploy to staging URL

Deploy to a demo staging URL such as:

```text
demo-client-staging.example.com
```

Use provider-specific commands:

```bash
# placeholder
your-deploy-command --source dist --env production --url demo-client-staging.example.com
```

## 11. Run smoke tests

Run:

```text
docs/DEMO_CLIENT_SMOKE_TESTS.md
```

Confirm admin, manager, and branch user flows work.

## 12. Run security acceptance tests

Run:

```text
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
docs/POST_MIGRATION_SECURITY_CHECKS.sql
```

Stop if anon reads/writes sensitive data, `branches.password` still exists, `app_user_profiles` is mutable by authenticated clients, or frontend bundles contain server-only secrets.
