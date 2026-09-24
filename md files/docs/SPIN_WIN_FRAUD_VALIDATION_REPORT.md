# Spin & Win Fraud Validation Report

Date: 2026-06-12

## Status

Prepared locally. Real Supabase execution is pending.

Prompt 04 requires SQL-level fraud tests and an end-to-end customer flow check against a real or disposable dedicated-client Supabase project. This workspace does not currently have a safe real Supabase target with seeded Spin & Win data and test branch credentials, so no staging pass/fail result is claimed.

## Findings

The current `supabase/migrations/` directory did not contain reproducible definitions for:

- `generate_spin_session`
- `validate_spin_token`
- `execute_spin_transaction`

The frontend already treated production fraud/rate checks as server-side RPC responsibility, but the customer flow still contained a demo-gated frontend IP lookup. Voucher redemption also updated `spins` directly from the browser service, which meant double redemption could not be proven inside a trusted SQL function.

## Changes

- Added `supabase/migrations/20260612093000_spin_win_server_side_fraud_hardening.sql`.
- Added reproducible RPC definitions for `generate_spin_session`, `validate_spin_token`, and `execute_spin_transaction`.
- Added `redeem_spin_voucher` so voucher redemption is atomic and server-side.
- Revoked direct client write grants on `spins` and direct client access to `spin_sessions`, so normal browser clients must use the RPC path.
- Updated `services/spinWin.ts` so spin execution passes no trusted client IP and voucher redemption uses the RPC.
- Updated `app/spin-win/CustomerFlow.tsx` to remove the frontend IP lookup service call entirely.
- Added `supabase/tests/spin_win_fraud_validation.sql` with rollback-only SQL tests for:
  - anon cannot generate branch QR sessions;
  - public customer token validation works for valid tokens;
  - first valid spin succeeds;
  - second same-day spin for the same phone fails server-side even with a different client IP argument;
  - anon cannot redeem vouchers;
  - first authenticated voucher redemption succeeds;
  - second voucher redemption fails server-side.

## Server-Side Enforcement Summary

`generate_spin_session`:

- requires an authenticated app user;
- allows manager/admin or the owning branch user only;
- checks the branch exists and Spin & Win is enabled;
- creates server-side session expiry of 10 minutes for single-use tokens or 7 days for multi-use tokens;
- does not use client IP/device/rate values.

`validate_spin_token`:

- remains public for customer QR flow;
- validates token existence, branch enabled state, expiry, and single-use consumed state from `spin_sessions`;
- returns only branch/session validity metadata needed by the customer flow.

`execute_spin_transaction`:

- remains public for customer QR flow;
- locks the `spin_sessions` row during execution;
- validates expiry, branch enabled state, and single-use consumed state from database state;
- upserts/selects the customer by normalized phone;
- enforces one spin per customer phone per UTC day using `customers` joined to `spins`;
- selects an active prize using server-side weights and daily prize limits;
- generates the voucher code server-side;
- marks single-use tokens as used inside the same transaction;
- accepts but intentionally ignores `p_ip_address` for fraud/rate decisions.

`redeem_spin_voucher`:

- requires an authenticated app user;
- allows manager/admin or the redeeming branch user only;
- locks the `spins` row;
- rejects missing, expired, and already redeemed vouchers;
- writes `redeemed_at` and `redeemed_branch_id` atomically.

## Scope Guardrails

- No multi-tenancy was implemented.
- No `organization_id` column was added.
- No prize/voucher fields or prize types were added.
- No RLS/security boundary was weakened.
- No secrets or project credentials were introduced.
- Frontend IP/device/rate data is not used as a production security boundary.

## Real-Project Preconditions

Before running `supabase/tests/spin_win_fraud_validation.sql`, prepare:

- a real dedicated-client or disposable Supabase project with all migrations applied;
- one active branch-role `app_user_profiles` row with a valid `branch_id`;
- Spin & Win enabled for that branch;
- at least one active `spin_prizes` row, or allow the test script to create a rollback-only test prize;
- trusted SQL/service-role access that can `SET ROLE`;
- a staging frontend configured with `VITE_DEMO_MODE=false`.

## Local Verification

- Focused guard scan passed for touched Prompt 04 files: no frontend IP lookup URL, no `organization_id`/tenant column additions, no secret assignments, and no direct client write grants on `spins`/`spin_sessions`.
- `npm run typecheck` passed.
- `npm run build` passed. Existing build warnings remain for stale Browserslist data, large chunks, and mixed static/dynamic `file-saver` imports.

## Pending Real-Project Verification

Run these steps once a real/disposable Supabase project is available:

1. Apply all migrations through `supabase/migrations/20260612093000_spin_win_server_side_fraud_hardening.sql`.
2. Run `supabase/tests/spin_win_fraud_validation.sql` and confirm every returned row has `passed = true`.
3. Open a staging frontend with `VITE_DEMO_MODE=false`.
4. Generate a branch QR token as a branch user.
5. Complete QR token validation, customer registration, spin, voucher display, voucher lookup, and voucher redemption.
6. Confirm no frontend IP lookup service is called during that flow.
7. Confirm a second same-day spin for the same phone is blocked by `execute_spin_transaction`.
8. Confirm a second redemption of the same voucher is blocked by `redeem_spin_voucher`.
