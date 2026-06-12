# Production Deployment Runbook

Current release status: `B) staging-ready only`.

Use this runbook for the production Supabase cutover after the app build has been verified in staging. Do not re-run older ad hoc SQL files after the hardening migration unless they have been reviewed; some legacy SQL files grant public/anon access that this migration intentionally removes.

## A. Pre-deployment backup

1. Test the migration on the staging Supabase project first.
2. Take a production database backup before applying the migration.
3. Export the current schema and policies where possible.

Recommended Supabase CLI commands:

```bash
supabase db dump --linked --file backups/prod-before-security-hardening.sql
supabase db dump --linked --schema public --file backups/prod-public-schema-before-security-hardening.sql
```

Also export Auth users from the Supabase Dashboard if your plan needs a separate Auth inventory. Keep backups private because they may contain sensitive historical data.

## B. Apply migration

Option 1, Supabase CLI:

```bash
supabase db push
```

Option 2, Supabase Dashboard SQL Editor:

1. Open `supabase/migrations/20260612034500_security_auth_rls_hardening.sql`.
2. Paste the full contents into the production project's SQL Editor.
3. Run it once.

The migration backs up non-empty `public.branches.password` values into `public.legacy_branch_password_backups` before dropping the live `branches.password` column. That backup table is RLS-enabled and restricted to `service_role`.

Intentional authenticated-wide reads:

```text
products
pharmacists
pharmacist_branches
corporate_codex
employee_contributions
quality_feedback_settings
```

These are shared internal datasets for signed-in users. They are not public/anon reads, and writes remain manager/admin-gated where applicable.

## C. Run post-migration checks

Run:

```text
docs/POST_MIGRATION_SECURITY_CHECKS.sql
```

Stop immediately if:

```text
Any dangerous anon access appears.
branches.password still exists unexpectedly.
app_user_profiles does not exist.
app_user_profiles does not have RLS enabled.
authenticated has insert/update/delete grants on app_user_profiles.
legacy_branch_password_backups is readable by anon or authenticated.
```

Expected high-level result:

```text
Sensitive tables have RLS enabled.
Anon grant checks return zero unsafe rows.
Anon USING (true) / WITH CHECK (true) checks return zero rows.
branches_password_still_exists is false.
app_user_profiles grants authenticated SELECT only.
```

## D. Create Supabase Auth users

Create users in Supabase Dashboard > Authentication > Users.

Examples:

```text
admin@yourcompany.com
manager@yourcompany.com
branch.tabarak1@yourcompany.com
branch.alhoda1@yourcompany.com
```

Do not hardcode real passwords in docs, source code, migrations, or branch records. Use strong generated passwords and rotate any legacy branch password that was ever stored in the database.

## E. Provision app_user_profiles

Find Auth user IDs:

```sql
select id, email
from auth.users
where email in (
  'admin@yourcompany.com',
  'manager@yourcompany.com',
  'branch.tabarak1@yourcompany.com',
  'branch.alhoda1@yourcompany.com'
);
```

Admin user with `branch_id = null`:

```sql
insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_USER_UUID_HERE', null, 'admin', true);
```

Manager user:

```sql
insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_USER_UUID_HERE', null, 'manager', true);
```

Branch user with `branch_id`:

```sql
insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_USER_UUID_HERE', 'BRANCH_ID_HERE', 'branch', true);
```

Inactive user example:

```sql
insert into public.app_user_profiles (user_id, branch_id, role, is_active)
values ('AUTH_USER_UUID_HERE', 'BRANCH_ID_HERE', 'branch', false);
```

Branch-role users must have `branch_id`. Admin, manager, and accounts users may use `branch_id = null`.

## F. Set FUNCTION_SECRET

Set a long random secret in Supabase:

```bash
supabase secrets set FUNCTION_SECRET="use-a-long-random-secret"
```

Function behavior:

```text
generate-monthly-report requires x-function-secret.
notify-negative-trend requires x-function-secret.
analyze-sentiment uses authenticated caller profile checks and allows admin/manager only.
```

## G. Manual security tests

Without login:

```text
No sensitive data should load.
No branches should be readable.
No pharmacists should be readable unless intentionally public in a future reviewed policy.
No HR requests should be readable.
No feedback/admin data should be readable.
No write operation should work.
```

As branch user:

```text
Can only see allowed branch data.
Cannot see another branch's branch-scoped records.
Cannot update role.
Cannot update branch_id.
Cannot insert/update/delete restricted management tables.
```

As manager/admin:

```text
Can access only intended management screens.
Can perform expected management writes.
Cannot bypass RLS policies from the browser console.
Cannot mutate app_user_profiles from the frontend client.
```

## H. Browser and direct-call tests

Use direct calls with the public anon key to prove the backend blocks access even if the frontend is bypassed.

Anon REST examples:

```bash
curl "$SUPABASE_URL/rest/v1/branches?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl "$SUPABASE_URL/rest/v1/app_user_profiles?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl "$SUPABASE_URL/rest/v1/hr_requests?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Browser console example after signing in as a branch user:

```js
await supabase.from('app_user_profiles').update({ role: 'admin' }).eq('user_id', 'AUTH_USER_UUID_HERE')
```

Expected result: the update is denied by table grants/RLS.

Also test branch scoping from a signed-in branch session:

```js
await supabase.from('lost_sales').select('*').eq('branch_id', 'OTHER_BRANCH_ID_HERE')
```

Expected result: no rows for another branch.

## I. Rollback plan

If the migration causes critical production issues, restore from the database backup taken before deployment.

Do not re-run old insecure SQL migrations as a rollback shortcut. Those files may reintroduce public/anon policies.

If Auth/profile provisioning is wrong, fix `public.app_user_profiles` using trusted SQL or service-role tooling. Do not disable RLS to make users work.

If `branches.password` removal interrupts login, finish creating Supabase Auth users and profile rows. Do not restore frontend password checks.
