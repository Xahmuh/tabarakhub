# Spin & Win Google Maps Return Flow QA

Checked on: 2026-06-14

Current status:

```text
B) dedicated-client staging-ready only
```

## Scope

This checklist covers the public customer flow that starts from a static QR URL such as:

```text
https://www.tabarakpharmacy.com/?node=H003
```

The SQL/RPC Spin Static QR security gate is already passed on the linked Supabase project. This file tracks the browser return behavior around the Google Maps rating step.

## Expected Flow

```text
?node=H003
-> exchange node for short-lived token
-> customer enters details
-> customer opens Google Maps rating link in a new tab/window
-> customer returns to the app
-> app restores the same validated token flow
-> customer sees "I Have Rated - Continue"
-> customer clicks Continue
-> spin screen loads
-> voucher is generated
-> recovery state is cleared
```

The frontend recovery state is only a UX bookmark. Token validation and spin execution remain server/RPC-authoritative through `validate_spin_token` and `execute_spin_transaction`.

## Code Hardening Result

The deployed source is hardened for the return flow:

```text
Google Maps opens with window.open(mapsUrl, '_blank', 'noopener,noreferrer')
only temporary recovery state is stored in sessionStorage
refresh before spinning restores the Continue state instead of restarting from the beginning
the wheel does not auto-spin after opening Google Maps
invalid/expired/failed token verification clears recovery state
voucher success clears recovery state and removes the token URL
new node/token flows clear stale recovery state through App.tsx token recovery logic
```

Allowed temporary keys:

```text
tabarak_spinwin_return
tabarak_spinwin_customer_draft
```

Allowed temporary fields:

```text
token
step
phone
firstName
lastName
email
countryCode
hasClickedRate
mapsOpenedAt
savedAt
return url
```

Not stored:

```text
voucher code
final prize
admin data
internal branch UUID from static QR exchange
service-role or function secrets
prize selection logic
```

## Manual Test Checklist

| # | Test | Expected Result | Current Result |
| --- | --- | --- | --- |
| 1 | Open `?node=H003`. | Public customer flow opens without login. | Passed on deployed URL after `vercel deploy --prod --yes`. |
| 2 | Confirm node exchanges to token. | URL changes to `?token=<generated token>` and no branch UUID is exposed by the exchange RPC. | Passed on deployed URL; `?node=H003` exchanged to generated `spin_...` token. SQL/RPC no-UUID check already passed. |
| 3 | Enter customer details. | Customer details are accepted and the flow moves to rating or spin depending on branch/review state. | Passed on deployed URL; test customer reached `Rate Branch to Spin`. |
| 4 | Click Google Maps rating button. | Google Maps opens in a new tab/window using `noopener,noreferrer`. | Partially passed: Google review/sign-in URL opened. Source is deployed with `noopener,noreferrer`. |
| 5 | Return to app. | App does not redirect to login. | Pending: in-app browser lost the app tab when Google opened, so return could not be verified. |
| 6 | Return to app. | App does not restart from the beginning if token is still valid. | Pending for the same browser-tooling limitation. |
| 7 | Return to app after Maps. | `I Have Rated - Continue` appears. | Pending for the same browser-tooling limitation. |
| 8 | Wait after Maps return. | Spin starts only after clicking Continue. | Pending for the same browser-tooling limitation. |
| 9 | Refresh while waiting after Maps. | Continue state is restored if the token is still valid. | Pending for the same browser-tooling limitation. |
| 10 | Close Google Maps tab and return. | Continue state remains visible. | Pending for the same browser-tooling limitation. |
| 11 | Complete voucher generation. | Token URL and both recovery sessionStorage keys are cleared. | Pending because the return/Continue step could not be completed in the available browser tool. |
| 12 | Open invalid token. | Recovery state is cleared and a customer-safe error is shown. | Source hardened; server validation remains authoritative. Browser execution pending. |
| 13 | Open expired token. | Recovery state is cleared and a customer-safe error is shown. | Source hardened; server validation remains authoritative. Browser execution pending. |
| 14 | Start a new token/node flow. | Old recovery state is cleared before the new flow starts. | Source hardened through `App.tsx` recovery logic. Browser execution pending. |
| 15 | Inspect sessionStorage. | No final voucher, final prize, admin data, secret, service role key, or internal prize logic is stored. | Pending after deployed return/voucher pass. Source stores only temporary UX recovery fields. |

## Browser Execution Notes

Deployment and browser automation against the real deployed URL confirmed the early public path:

```text
deployment command: vercel deploy --prod --yes
deployment URL: https://tabarakhub-m13xcl1i5-ames-projects-7ab0c189.vercel.app
production alias checked: https://www.tabarakpharmacy.com
https://www.tabarakpharmacy.com/?node=H003 opened without login
node exchange redirected to ?token=<generated token>
customer details form was visible
test details reached the rating step
Google review/sign-in URL opened after pressing Rate Branch to Spin
```

The in-app browser replaced/lost the app tab after opening the external Google URL. The Chrome fallback was approved, but the Codex Chrome Extension was not installed/enabled in the selected Chrome profile, so Chrome automation could not be used to complete return/refresh/Continue/spin/voucher verification. Do not mark this browser gate passed until the checklist above is executed in a browser that preserves both the app tab and the Google Maps/review tab.

Smoke-test data cleanup on the linked Supabase project:

```text
frontend-qr-smoke customers found: 2
related branch_reviews: 0
related spins: 0
customers deleted: 2
frontend-qr-smoke customers remaining: 0
frontend-qr-deploy-smoke customers found: 2
frontend-qr-deploy-smoke branch_reviews found: 1
frontend-qr-deploy-smoke spins found: 0
frontend-qr-deploy-smoke spin_sessions found: 2
frontend-qr-deploy-smoke customers deleted: 2
frontend-qr-deploy-smoke branch_reviews deleted: 1
frontend-qr-deploy-smoke spins deleted: 0
frontend-qr-deploy-smoke spin_sessions deleted: 2
frontend-qr-deploy-smoke remaining customers/reviews/spins/sessions: 0
```

## Required Cleanup After Browser Smoke

Use unique test customer data and clean it after smoke tests. Suggested pattern:

```text
frontend-qr-smoke-<timestamp>@example.invalid
```

Delete only exact smoke-test records after checking related `branch_reviews`, `spins`, and `customers` rows. Do not delete real customer data.

## Production Decision

```text
SQL/RPC Spin Static QR security: passed on linked Supabase.
Google Maps browser return flow: source hardened and deployed, early browser flow passed through Google opening, return/refresh/Continue/spin/voucher validation pending because available automation could not preserve the app tab after Google opened.
Overall project: B) dedicated-client staging-ready only.
```
