# Client Security Acceptance Checklist

Run this checklist before approving any dedicated client production release.

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
Branch user can see only allowed branch data.
Branch user cannot access another branch's branch-scoped records.
Branch user cannot modify own role.
Branch user cannot modify own branch_id.
Branch user cannot insert a new app_user_profiles row.
Branch user cannot insert/update/delete restricted management tables.
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
