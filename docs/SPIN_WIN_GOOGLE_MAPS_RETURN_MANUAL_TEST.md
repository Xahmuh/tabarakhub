# Spin & Win Google Maps Return Flow

## Safety Notes

- `sessionStorage` is used only for temporary customer-flow recovery after leaving the app for Google Maps. It is not a security boundary.
- Token validity remains enforced by the server-side RPC validation and spin execution flow. Invalid, expired, reused, or tampered tokens must still be rejected by the backend.
- The temporary recovery state does not store secrets, the final voucher code, prize selection logic, admin data, or sensitive operational records.
- Recovery state is cleared when:
  - the server rejects a token as invalid, expired, reused, or missing,
  - spin execution fails because the token became invalid, expired, reused, or missing,
  - the customer presses the retry/restart path after an error,
  - a new token URL starts a different flow,
  - a different token draft is detected and the previous draft no longer matches,
  - the voucher is generated and the result screen is reached,
  - the saved recovery state is older than the configured recovery window.

## Manual Test Note

1. Scan or open a valid Spin & Win QR token URL.
2. Enter customer data and continue to the review step.
3. Tap `Rate Branch to Spin` to open Google Maps.
4. Return to the app/domain in a state where the URL may no longer include `?token=...`.
5. Confirm the Spin & Win flow restores and shows `I Have Rated - Continue`.
6. Continue, spin, and generate a voucher.
7. Confirm the token is removed from the URL after voucher generation.
8. Confirm `sessionStorage` no longer contains `tabarak_spinwin_return` or `tabarak_spinwin_customer_draft`.

Browser automation verification is pending when the local sandbox browser cannot launch; `typecheck` and production `build` are the automated acceptance checks for this change.
