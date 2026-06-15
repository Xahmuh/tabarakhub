# QA Account Setup Checklist

Checked on: 2026-06-15

Current status:

```text
B) dedicated-client staging-ready only
```

Use this operator checklist to prepare authenticated browser sessions for Phase 1 Delivery Dispatch QA. This document is a setup checklist only; it does not authorize automatic account creation, deployment, migrations, RLS changes, or production data mutation.

## Required QA Sessions

| Role | Required | Notes |
| --- | --- | --- |
| Admin | Yes | Full-control QA |
| Branch | Yes | Prefer T001 |
| Owner | Yes | Read-only executive QA |
| Supervisor | Optional/Recommended | If role should be browser-tested |
| Warehouse | Optional/Recommended | If role should be browser-tested |
| Accounts | Optional/Recommended | If role should be browser-tested |

## Safe Setup Rules

- Create accounts only via Supabase Auth UI or secure Admin API.
- Do not store passwords in migrations.
- Do not commit passwords.
- Do not paste passwords in chat.
- Do not write passwords into docs, SQL, migrations, screenshots, or terminal logs.
- Do not expose tokens, secrets, env values, or service-role keys.
- Use temporary QA accounts only if approved.
- Mark accounts clearly as QA/test.
- If using Supabase Auth UI, set/confirm email according to project Auth settings.
- After an Auth user exists, assign the profile role through the app Admin panel or safe SQL/RPC only if approved.
- Keep owner, supervisor, warehouse, and accounts behavior read-only/scoped unless the approved role model says otherwise.

## Suggested QA Emails

Use real/controlled test emails if login confirmation is required.

Examples only:

```text
qa.admin@tabarak.local
qa.branch.t001@tabarak.local
qa.owner@tabarak.local
qa.supervisor@tabarak.local
qa.warehouse@tabarak.local
qa.accounts@tabarak.local
```

If the Auth project requires email confirmation, use real accessible emails or admin-confirmed users. Do not rely on unreachable `.local` emails unless email confirmation is disabled or the users are admin-confirmed.

## Operator Steps

1. Confirm the target Supabase project and frontend URL are the intended dedicated-client environment.
2. Confirm migrations are aligned through `20260615070000`.
3. Confirm existing admin, T001 branch, and owner profiles can be used, or approve temporary QA account creation.
4. Create or confirm the Auth users through Supabase Auth UI or secure Admin API.
5. Assign or verify app profiles without storing credentials in the repo.
6. Log in once per role and complete `docs/PHASE1_AUTHENTICATED_QA_CHECKLIST.md`.
7. Record only non-sensitive QA evidence: role, branch scope, checklist result, observed event row, console/network status, and cleanup status.
8. Remove or disable temporary QA accounts after testing if the operator requires cleanup.

## Stop Conditions

- A password, token, secret, env value, or service-role key would be copied into docs/chat/commits.
- Account creation requires unapproved SQL, RLS changes, migrations, or deployment.
- The target Supabase project or frontend URL is uncertain.
- A role shows broader access than the documented role model.
- Browser QA would require deleting or altering real production data.
