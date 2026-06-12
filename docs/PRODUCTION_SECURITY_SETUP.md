# Production Security Setup

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

`admin`: Full operational access and the only role that should be allowed to provision or change application roles through trusted SQL/service-role tooling.

`manager`: Can manage operational records and read cross-branch data, but must not be able to grant roles or modify `app_user_profiles` from the client.

`accounts`: Can read cross-branch finance/cashflow data where the migration allows read-all access.

`branch`: Can read and write only records scoped to its own `branch_id` where branch operations are allowed.

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

`analyze-sentiment` uses the caller's Supabase Auth token and allows only `admin` or `manager` profiles.

## 8. Test anon access is blocked

Run `docs/POST_MIGRATION_SECURITY_CHECKS.sql` after applying the migration. The anon grant and anon `USING (true)` checks should return zero unsafe rows for sensitive tables.

You can also test through the REST API with only the anon key. These should fail or return no rows:

```bash
curl "$SUPABASE_URL/rest/v1/branches?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl "$SUPABASE_URL/rest/v1/app_user_profiles?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

## 9. Test authenticated scoping

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

## 10. Known dependency risk

`exceljs@4.4.0` currently has a moderate npm audit finding through `uuid`. Product import parses uploaded `.xlsx` files, so keep that feature restricted to trusted manager/admin users, keep the 5MB upload guard, and replace or upgrade ExcelJS when a patched release is available. Do not claim dependency audit closure until:

```bash
npm audit --audit-level=moderate
```

passes.
