# CODEX PROMPT: Spin and Win Server-Side Fraud and Rate Limit Validation

## Objective
Verify that `generate_spin_session`, `validate_spin_token`, and `execute_spin_transaction` enforce fraud prevention and rate limiting entirely server-side (within the RPC/SQL function bodies), with no reliance on client-supplied IP, device, or rate-limit data as a security boundary, and add tests proving bypass attempts fail.

## Context
Spin & Win is a customer-facing reward module with real monetary value (vouchers/prizes). The explicit production rule is that fraud/rate limiting must run server-side through trusted RPC or Edge Function; browser IP lookup or frontend-only rate limiting is demo-only and not trusted; the customer flow must still work without relying on third-party frontend IP lookup services.

## Files To Inspect First
- supabase/migrations/ (RPC function definitions for generate_spin_session, validate_spin_token, execute_spin_transaction)
- services/ (frontend code calling these RPCs)
- app/ (Spin & Win customer flow components)

## Scope
- Read the current SQL definitions of `generate_spin_session`, `validate_spin_token`, and `execute_spin_transaction`.
- Document what limits each function currently enforces (e.g., one spin per customer per day, one voucher redemption per token, session expiry) and whether enforcement is inside the SQL function (server-side) or depends on values passed from the client.
- For any limit that currently depends on client-supplied data (IP address, "last spin time" computed in the frontend, device fingerprint passed as a parameter and trusted), rewrite the function to compute that check server-side from existing tables (`spins`, `spin_sessions`, `customers`) using `auth.uid()` or the validated customer identifier — not client-passed values.
- Add SQL-level tests (as a new migration or a test script under supabase/) that: attempt to call `execute_spin_transaction` twice for the same customer within the restricted window and confirm the second call is rejected by the function itself; attempt to redeem the same voucher token twice and confirm rejection; attempt to call these RPCs as `anon` where the workflow requires authentication and confirm rejection per the actual intended customer-auth model.
- Confirm the customer flow (QR token -> validate -> spin -> voucher) works end-to-end without any frontend IP lookup service call remaining in the code path.

## Out Of Scope
- Do not change the prize/voucher data model or add new prize types.
- Do not change the QR token generation format for branches.
- Do not build a new admin UI for fraud monitoring (that is a separate feature, not in this prompt's scope).

## Data And Security Notes
- `customers` table contains real customer identity data tied to reward redemption — ensure any new server-side checks do not log or expose this data beyond what's already stored.
- If a frontend IP lookup call currently exists anywhere in the Spin & Win flow, remove it as part of this work (per the explicit constraint that the flow must work without it) and confirm no functionality regresses.
- Any RPC changes must remain callable with the same signatures expected by the existing frontend `services/` code, or the frontend call sites must be updated in the same change.

## Verification
- Run the new SQL-level fraud tests against a real or disposable dedicated-client Supabase project; all bypass attempts must fail as expected.
- Manually run the full customer Spin & Win flow (QR scan -> token validate -> spin -> voucher) on a staging deployment and confirm it completes successfully with no frontend IP service dependency.
- `npm run typecheck` and `npm run build` pass if any frontend service code changed.

## Acceptance Criteria
- All three RPC functions enforce their respective limits using only server-side data (no trusted client-supplied IP/device/rate values).
- New SQL-level tests exist proving double-spin and double-redemption attempts fail.
- The customer Spin & Win flow works end-to-end without any frontend IP lookup dependency.
- `npm run typecheck` and `npm run build` pass.
