# Spin & Win Static QR Flow

## Public URL Pattern

Printed branch QR codes must use the branch code from `public.branches.code`:

```text
https://www.tabarakpharmacy.com/?node=<BRANCH_CODE>
```

Example:

```text
https://www.tabarakpharmacy.com/?node=H003
```

`node` is not a branch UUID and is not the final Spin & Win token. It is only a public branch-code node that the app exchanges for a short-lived session token.

Before printing a QR for a branch code, confirm it exists and Spin & Win is enabled:

```sql
select id, code, name, is_spin_enabled
from public.branches
where code = 'H003';
```

## Exchange Flow

```text
Customer opens https://www.tabarakpharmacy.com/?node=H003
-> App reads node=H003
-> App calls public.generate_spin_session_from_branch_code('H003')
-> RPC validates public.branches.code and branch Spin & Win status
-> RPC creates a short-lived, single-use spin_sessions row
-> App replaces the URL with ?token=<GENERATED_SPIN_TOKEN>
-> Customer completes rating, spin, and voucher flow
```

New printed QR codes must not use `?branch=`. Any legacy handling must still pass through the same branch-code exchange RPC and must not treat the value as a UUID or final token.

## Token Lifecycle

Static QR exchange tokens are:

- generated server-side inside `generate_spin_session_from_branch_code`;
- single-use: `is_multi_use = false`;
- short-lived: `expires_at = now() + interval '10 minutes'`;
- bound to the matching `branches.id` inside `spin_sessions`;
- consumed atomically by `execute_spin_transaction`;
- validated by `validate_spin_token` before the customer enters the flow.

Expired single-use sessions are cleaned by the exchange RPC after a short grace window. Historical reward/voucher records live in `spins`, not in `spin_sessions`.

## Abuse Controls

The SQL RPC includes branch-level abuse controls:

- generic failure for missing, invalid, disabled, inactive, or ambiguous branch codes;
- cleanup of expired single-use sessions;
- cap of 60 active unused single-use sessions per branch in a 10-minute window;
- cap of 240 single-use sessions per branch per hour.

These controls are useful for staging and basic production hygiene, but SQL RPCs cannot see trusted client IP/device metadata. If the release owner requires per-client or network-level throttling, move the exchange behind an Edge Function or WAF/rate-limit layer before production sign-off.

## Google Maps Return Behavior

The customer flow keeps the current token recoverable while the customer leaves the app for Google Maps:

- `sessionStorage` stores only temporary token/URL/draft state for recovery;
- it is not a security boundary;
- no secrets, voucher code, prize logic, or admin data are stored there;
- returning from Google Maps restores the flow and shows `I Have Rated - Continue`;
- recovery state is cleared on invalid/expired token, token mismatch, retry/restart, or voucher generation.

The backend RPCs remain the source of truth for token validity and spin execution.

## Branch/Admin Notes

- Use the Spin & Win QR generator in branch/admin UI to create printed static QR assets.
- Confirm the displayed URL is `https://www.tabarakpharmacy.com/?node=<BRANCH_CODE>` for production printing.
- Do not print URLs containing branch UUIDs.
- Do not print temporary `?token=` URLs unless intentionally using a one-time or time-limited campaign flow.
- If a customer sees a generic QR unavailable message, confirm the branch code exists, the branch has Spin & Win enabled, and the static exchange migration has been applied.

## Printing Instructions

1. Confirm `public.branches.code` for the branch.
2. Confirm `is_spin_enabled = true`.
3. Generate/download the static QR from the Spin & Win branch QR screen.
4. Verify the URL before printing:

```text
https://www.tabarakpharmacy.com/?node=<BRANCH_CODE>
```

5. Scan the printed QR on a phone and confirm the browser URL changes to `?token=<GENERATED_SPIN_TOKEN>`.
6. Complete one full customer flow on staging before production printing.

