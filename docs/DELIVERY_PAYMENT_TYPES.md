# Delivery Payment Types

## Status - 2026-06-15

```text
B) dedicated-client staging-ready only
```

Dynamic delivery payment types are implemented, committed, pushed, deployed by Vercel from `6d5b2b3`, and the migration has been applied to the linked Supabase project. The feature is database-validated and SQL/RLS-validated, but authenticated browser QA is still pending until approved role sessions are available.

## Default Types

| Code | Label | Active | Requires Block | Sort Order |
| --- | --- | --- | --- | --- |
| `BP` | BP | true | true | 10 |
| `CASH` | Cash | true | true | 20 |
| `CARD` | Card | true | true | 30 |
| `TALABAT` | Talabat | true | false | 40 |
| `INSURANCE` | Insurance | true | true | 50 |

## Behavior

- Admin/legacy-manager can manage payment types from `Delivery Settings > Payments`.
- Branch Recording loads active payment types dynamically instead of using a fixed four-value list.
- Disabled payment types are hidden from new branch order selection.
- Payment codes are stable keys and existing codes are locked in the UI to protect delivery history.
- `requires_block = false` clears block/area/governorate mapping for marketplace/external channels such as `TALABAT`.
- `INSURANCE` is seeded as a normal block-required delivery payment type.

## Code / Label Compatibility

Payment type matching uses stable uppercase machine codes, not display labels:

- `code` is the saved/reporting value in `delivery_orders.payment_type`.
- `label` is display-only text for buttons, filters, and admin settings.
- New orders normalize payment input before saving, so `Cash` saves as `CASH` and `Card` saves as `CARD`.
- Import aliases map labels and common variants such as `cash`, `card`, `visa`, and `mastercard` back to stable codes.
- Historical `CARD` and `CASH` rows match the seeded codes and display as `Card` and `Cash`.
- `Cash` and `CASH`, or `Card` and `CARD`, should not become separate reporting groups because reporting filters use `code`.

## Migration

Applied migration:

```text
20260615110000_delivery_payment_types.sql
```

Safety review:

- Creates `public.delivery_payment_types` without replacing `delivery_orders`.
- Seeds `BP`, `CASH`, `CARD`, `TALABAT`, and `INSURANCE`.
- Adds `is_active`, `requires_block`, and `sort_order`.
- Relaxes `delivery_orders.payment_type` from a fixed enum-style check to a stable uppercase code format check.
- Replaces the delivery-order geo trigger so it validates configured payment types and block-required behavior.
- Does not delete, rewrite, or backfill production `delivery_orders`.

Linked migration history is aligned through `20260615110000`.

## Database Validation

Post-apply checks confirmed:

- `public.delivery_payment_types` exists.
- Defaults are present with expected `requires_block` values.
- Duplicate payment type codes returned zero rows.
- Existing delivery order payment types remain compatible:
  - `BP`: 13 orders
  - `CARD`: 7 orders
  - `CASH`: 2 orders

## RLS Validation

SQL role simulation results:

| Actor | Result |
| --- | --- |
| anon | Read, insert, update, and delete denied. |
| branch | Can read active payment types; insert/update/delete denied. |
| admin | Can create, edit, disable, and delete a temporary QA payment type. |
| owner | Can read active payment types; insert/update/delete denied. |
| supervisor/warehouse/accounts | No active profiles were available on the linked project, so live role simulation remains pending. |

Temporary QA payment rows were cleaned up after validation. No production delivery data was deleted.

## App Validation

- `services/deliveryService.ts` reads `delivery_payment_types`, normalizes codes, rejects inactive/unconfigured payment types, and falls back to safe defaults with a visible console warning if the table cannot be loaded.
- `app/delivery/BranchRecordingPage.tsx` uses dynamic active payment options and applies per-payment block-required behavior.
- `app/delivery/DeliverySettings.tsx` adds the Payments tab for admin management.
- Delivery analytics, coverage, owner dashboard, and import parsing now use payment type configuration for block-exempt classification where applicable.

## Browser QA

Combined authenticated production QA attempt on 2026-06-15:

- Public production route smoke passed for `/` and `/delivery`: both returned HTTP 200, served the React app shell, and did not show Vercel `404: NOT_FOUND`.
- Production shell asset observed: `assets/index-D_9-Xigh.js`, matching the Vercel production build for commit `6d5b2b3`.
- Chrome is installed and running, but the Codex Chrome Extension is not installed/enabled in the selected Chrome profiles, so existing Chrome authenticated sessions could not be used.
- No passwords, tokens, cookies, or local storage were inspected.
- No test payment type or delivery order was created in this pass.

Authenticated browser QA remains pending:

- Admin Payments tab add/edit/disable flow.
- Branch Recording dynamic dropdown.
- `TALABAT` no-block save behavior.
- `INSURANCE` block-required save behavior.
- Console/network smoke under real admin and branch sessions.

No credentials were entered or exposed during this validation pass.
