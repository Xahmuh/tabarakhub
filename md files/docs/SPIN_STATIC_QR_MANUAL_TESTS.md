# Spin & Win Static QR Manual Tests

Run these against a real staging deployment after applying the static QR migration. Use `VITE_DEMO_MODE=false`.

## Preconditions

- The frontend is deployed at `https://www.tabarakpharmacy.com`.
- All Spin & Win migrations are applied, including `20260612213000_public_spin_node_token_exchange.sql`.
- At least one branch code exists, for example `H003`.
- That branch has `is_spin_enabled = true`.
- At least one active prize exists.
- A disabled/spin-disabled branch is available for denial testing.
- Browser devtools Network tab is available for checking redirects and secret exposure.

## Tests

1. Valid static node:
   Open `https://www.tabarakpharmacy.com/?node=H003`.
   Expected: no login screen; the app exchanges the node and changes the URL to `?token=<GENERATED_SPIN_TOKEN>`.

2. Node is branch code:
   Confirm the code exists with:

   ```sql
   select id, code, name, is_spin_enabled
   from public.branches
   where code = 'H003';
   ```

   Expected: `H003` matches `branches.code`; the printed QR URL does not contain the branch UUID.

3. Invalid node:
   Open `https://www.tabarakpharmacy.com/?node=NOTREAL`.
   Expected: generic customer message only:

   ```text
   This QR code is not available right now. Please ask the branch team for help.
   ```

   The UI must not reveal whether the code exists, is disabled, or was rate-limited.

4. Disabled branch:
   Temporarily disable Spin & Win for a test branch and open its `?node=<CODE>` URL.
   Expected: same generic customer message as invalid node.

5. Customer flow:
   With a valid node, enter customer details.
   Expected: the customer proceeds to rating/spin flow; no login redirect appears.

6. Google Maps return:
   Tap `Rate Branch to Spin`, leave the app for Google Maps, then return.
   Expected: the app restores the token flow and shows `I Have Rated - Continue`.

7. Voucher generation cleanup:
   Complete the spin and reach voucher result.
   Expected: URL no longer contains `token`, and `sessionStorage` no longer contains:

   ```text
   tabarak_spinwin_return
   tabarak_spinwin_customer_draft
   ```

8. Token cannot be reused:
   Reopen the consumed `?token=<GENERATED_SPIN_TOKEN>` URL.
   Expected: customer-safe invalid-session message; no second spin.

9. Expired token:
   Generate a static token, wait past expiry or expire it in SQL, then open it.
   Expected: customer-safe invalid-session message; no spin.

10. Rapid repeated exchange:
    Call/open the same valid `?node=<CODE>` rapidly enough to exceed the server-side branch cap.
    Expected: exchange fails with the same generic customer message.
    Note: SQL-level branch caps protect session flood, but production per-client throttling still requires Edge Function/WAF/request-metadata controls if required by the release owner.

11. No frontend secret exposure:
    Inspect network requests and built assets.
    Expected: no service-role key, no private provider token, and no branch UUID in the printed `?node=` URL.

12. Talabat skip-rating static URL:
    Open `https://www.tabarakpharmacy.com/?node=H003&skipRating=true`.
    Expected: app exchanges `node` for `token`, keeps `skipRating=true`, and continues without redirecting to login.

## Real-Project Status

Do not mark this flow production-ready until:

- `docs/SPIN_STATIC_QR_SECURITY_CHECKS.sql` has been run on the real/disposable Supabase project;
- every non-pending result passes;
- full manual tests above pass on the deployed URL;
- the release owner accepts the SQL-only branch-level rate limit or adds Edge/WAF throttling.

