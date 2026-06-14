# Spin Static QR Security Results

Checked on: 2026-06-14

Current status:

```text
B) dedicated-client staging-ready only
```

## Linked Supabase Result

The approved remediation was applied to the linked Supabase project:

```text
supabase/migrations/20260614150000_harden_spin_static_qr_exchange_rpc.sql
```

Command:

```bash
supabase.cmd migration up --linked --yes
```

`supabase.cmd migration list --linked` now shows `20260614150000` in both local and remote history.

## Backup / Recovery Evidence

Before applying, the linked project backup command was checked:

```text
supabase.cmd backups list --project-ref rvoqfhvdwadauoeemyvs
WALG: true
PITR: false
```

The pre-apply function definition was also captured from the linked database.
It was the earlier implementation that returned `out_branch_id`, raised
`BRANCH_NOT_FOUND` / `SPIN_DISABLED_FOR_BRANCH`, and had no branch-level static
QR exchange throttle. Since the remediation is function-only, rollback is
available by restoring the captured function definition or using Supabase
physical backup restore procedures.

## Migration Scope

The applied migration:

```text
redefines public.generate_spin_session_from_branch_code(text)
returns only out_token, out_expires_at, out_created_at
uses public.branches.code for lookup
raises SPIN_QR_UNAVAILABLE for missing, invalid, inactive, disabled, or ambiguous codes
adds branch-level active-session and hourly exchange throttles
keeps the intentional public customer-flow EXECUTE grant for anon/authenticated/service_role
does not alter unrelated table RLS policies
does not broaden anon access beyond the reviewed public Spin QR RPC
does not delete storage objects or business data
does not require frontend changes
```

Frontend compatibility was confirmed: `spinWinService.sessions.generateFromBranchCode` reads only `out_token`, `out_expires_at`, and `out_created_at`, so removing `out_branch_id` from the exchange response does not break the static QR path.

## Security Check

Command:

```bash
supabase.cmd db query --linked --file docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql
```

Result: passed.

```text
rpc_exists: passed
rpc_execute_grants: passed
rpc_uses_branch_code: passed
anon_node_exchange_allowed: passed
generated_token_lifecycle: passed
generated_token_validates: passed
invalid_code_denied_generic: passed
disabled_branch_denied_generic: passed
expired_token_fails_validation: passed
single_use_consumed_on_spin: passed
branch_session_rate_limit: passed
```

## Smoke Check

Additional linked-project SQL smoke checks passed:

```text
no_branch_uuid_output: passed
valid_h003_exchange: passed
generated_token_validates: passed
invalid_node_generic: passed
invalid_token_fails_safely: passed
voucher_generation: passed
disabled_branch_generic: passed
rapid_exchange_throttled: passed
```

Cleanup verification:

```text
leftover_rate_sessions: 0
leftover_smoke_customers: 0
leftover_smoke_spins: 0
```

Source review confirms the existing customer flow remains compatible:

```text
?node=<BRANCH_CODE> is exchanged for ?token=<SPIN_TOKEN>
token validation still comes from validate_spin_token
rating flow and Google Maps return still use the validated session and google_maps_link
voucher generation still goes through execute_spin_transaction
```

## Remaining Follow-Up

Run the browser/manual checks in `docs/SPIN_STATIC_QR_MANUAL_TESTS.md` and
`docs/SPIN_GOOGLE_MAPS_RETURN_FLOW_QA.md` on the real deployed frontend URL
before production sign-off. The SQL/API Spin Static QR security gate is closed
on the current linked Supabase project. The approved frontend build was deployed
with `vercel deploy --prod --yes` and aliased to
`https://www.tabarakpharmacy.com`. Deployed browser smoke passed through public
load, node-to-token exchange, customer detail entry, rating step, and opening
the Google review/sign-in URL. The return/refresh/Continue/spin/voucher portion
remains pending because the in-app browser lost the app tab after Google opened,
and the approved Chrome fallback could not run because the Codex Chrome
Extension is not installed/enabled in the selected Chrome profile. The overall
project remains staging-ready only until the remaining production gates close.
