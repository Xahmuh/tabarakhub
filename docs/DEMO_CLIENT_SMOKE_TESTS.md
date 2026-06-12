# Demo Client Smoke Tests

Run these checks after deploying `Demo Pharmacy Group` to the demo staging URL.

## Environment and branding

```text
Open the demo staging URL.
Confirm app name is Pharmacy Operations System.
Confirm client name is Demo Pharmacy Group.
Confirm environment label is Demo where displayed.
Confirm support email is support@demo-client.example.
Confirm country/currency are BH/BHD where visible.
```

## Login tests

Admin:

```text
Login as admin@demo-client.example.
Confirm the admin/manager dashboard path loads if enabled.
Confirm admin screens that are intended for the demo appear.
Logout.
```

Manager:

```text
Login as manager@demo-client.example.
Confirm manager dashboard loads.
Confirm HR/admin modules appear according to clientConfig.
Confirm management writes are limited by Supabase policies.
Logout.
```

Branch user:

```text
Login as branch.demo1@demo-client.example.
Confirm branch user lands in the branch suite.
Confirm branch user can access only enabled branch modules.
Confirm branch user cannot see another branch's branch-scoped records.
Logout.
```

## Module visibility

Check visible modules against:

```text
config/clientConfig.demo.ts
.env.production module flags
```

Expected for the demo: all current available module flags are enabled.

## Dashboard and admin screens

```text
Dashboard loads without console errors.
Admin/manager screens load for admin/manager only.
Branch user cannot open admin screens from URL, navigation, or browser console.
```

## Excel workflows

```text
Excel export works for trusted admin/manager users when VITE_MODULE_EXCEL_EXPORT=true.
Product template download works.
Product list export works.
Product import accepts a valid .xlsx under 5MB.
Product import rejects files over 5MB.
Product import rejects non-.xlsx files.
```

## Unauthenticated access

```text
Open the app in an incognito/private window.
Confirm protected app data does not load before login.
Confirm unauthenticated user is redirected to or blocked by login.
```

## Direct anon Supabase calls

Use only the public anon key:

```bash
curl "$SUPABASE_URL/rest/v1/branches?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl "$SUPABASE_URL/rest/v1/app_user_profiles?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl "$SUPABASE_URL/rest/v1/hr_requests?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Expected: denied or no sensitive rows returned.

## Bundle secret scan

After build, scan `dist/`:

```bash
rg -n "SUPABASE_SERVICE_ROLE_KEY|FUNCTION_SECRET|service_role|use-a-long-random-demo-secret" dist
```

Expected: no real `service_role` key, no `FUNCTION_SECRET`, and no secret value in the frontend bundle.

## Security acceptance

Finish by running:

```text
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
docs/POST_MIGRATION_SECURITY_CHECKS.sql
```

Do not approve the demo simulation if any security acceptance check fails.
