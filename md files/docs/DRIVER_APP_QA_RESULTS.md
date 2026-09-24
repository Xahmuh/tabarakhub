# Driver App QA Results

Checked on: 2026-06-16

Final status:

```text
B) dedicated-client staging-ready only
```

## Driver Mobile Preview QA - 2026-06-16

Preview:

```text
https://tabarakhub-8zesyh2lw-ames-projects-7ab0c189.vercel.app
```

Commit:

```text
152a429 feat: improve driver mobile transfer and history UX
```

- protected preview access: public `curl` returns Vercel Authentication `401`; authenticated `vercel curl` returns the React app shell with `#root` and asset bundle `index-B3hZgrbj.js`.
- app shell: pass through `vercel curl`; no Vercel 404 observed for `/`, `/delivery`, `/driver`, `/driver-mobile`, `/delivery-driver`, `/mobile`, or `/apps/driver-mobile`.
- driver app route: not independently proven on this root Vercel preview; candidate paths return the same root SPA shell, and the deployed root asset scan did not find the new `Open order details` / `tabarak-driver-mobile` strings. The Expo driver app remains runnable locally with `cd apps/driver-mobile && npm run web`.
- history UX: code/validation pass for tappable compact history rows and read-only order detail sheet with assigned/picked-up/delivered pathway timestamps; authenticated driver browser QA on the preview remains pending.
- transfer UX: code/validation pass for opening Internal Transfer setup while preserving the active-duty create guard and branch-list RPC path; authenticated driver browser QA on the preview remains pending.
- production promotion recommendation: not safe to promote from this preview QA alone until an approved authenticated driver session validates History and Transfer behavior on a reachable driver app runtime.

## Driver History Delivered Validation - 2026-06-16

Status:

```text
B) dedicated-client staging-ready only
```

- code review: pass; delivered/picked-up/cancelled orders are added to local closed-history state immediately after a successful online driver status mutation.
- merge behavior: pass; server history rows are merged with recently closed local rows and deduplicated by stable order id before sorting by delivered/cancelled/picked-up/assigned/created time.
- filters: pass by code review; History keeps Time first, then `All`, `Picked up`, `Delivered`, `Cancelled`, and `Internal transfer`. Local fallback rows use the same status/time/kind filter path as server rows.
- empty/loading/error states: pass by code review; existing loading, error, and empty states remain visible and backend/RPC errors are not swallowed.
- responsive layout: pass by code review and Expo web shell smoke; mobile uses one column, tablet/web use a responsive card grid, and page width is capped on wide layouts.
- Expo web smoke: pass at `http://localhost:8083`; app shell opened, Login screen rendered, `#root` mounted, mobile/tablet/web viewport smoke had no horizontal overflow, and no console error logs were captured.
- authenticated Delivered -> History browser QA: pending; no approved authenticated driver session/test order was available in the browser smoke, so no production data was created, edited, deleted, or transitioned.
- after-refresh server-history result: pending; because no authenticated delivered-order browser QA was run, backend/RPC persistence after reload was not proven in this pass.
- backend/RPC review: not triggered by runtime evidence in this pass; if delivered rows appear immediately but disappear after refresh in an authenticated session, review the pending driver history RPC migration before applying any migration.

## Driver Notifications Validation - 2026-06-16

Status:

```text
B) dedicated-client staging-ready only
```

- Notifications screen implemented for all active/incoming driver route orders; the bell icon opens the screen instead of showing a temporary alert.
- Notifications screen uses a top-header back button and hides the bottom nav while preserving safe-area spacing for top and bottom system UI.
- Incoming assigned orders are sourced from the driver-scoped `app_driver_get_active_orders` RPC; no fake/demo order data is shown in production paths.
- Clean empty state is present when no active assigned orders exist; loading/error states remain in the existing driver workspace patterns.
- Alarm sound is bundled at `apps/driver-mobile/src/assets/sounds/driver.mp3` and is 113,899 bytes.
- In-app alarm playback uses `expo-audio`; it is one-shot, does not loop forever, catches playback failures, and can be manually replayed from the Notifications header/hero.
- Native notification sound is registered through `expo-notifications` in `apps/driver-mobile/app.json`; custom push notification sounds may require a native/dev build and may not fully work in Expo Go.
- Driver delivery flow is status-only: assigned orders show the pharmacy name, `Picked up` is required before `Delivered`, and the app no longer asks for or compares a delivered block number.
- Driver active orders and pharmacy Dispatch both auto-refresh every 10 seconds while open, so assigned/picked-up/delivered changes surface without manual refresh in the normal app flow.
- Pending migration `20260616033000_driver_mobile_history_status_flow.sql` keeps driver History and hardens the driver RPC to `assigned -> picked_up -> delivered` without block-confirmation columns.
- Pickup-batch delivery-run implementation is local: selected same-pharmacy assigned orders can share one pickup run and one pickup timestamp; Dispatch exposes pickup wait, driver delivery time, total time, run ID, run size, and stop sequence.
- Pending migration `20260616060000_delivery_pickup_batches.sql` must be reviewed/applied before pickup batches are live on the linked database.
- Expo validation passed after adding required direct peer dependencies (`expo-asset`, `react-native-worklets`) and removing the unsupported `newArchEnabled` app config field.
- `npx expo-doctor` passed 21/21 checks, `npx expo config --type public` passed, and Expo web smoke returned HTTP 200 for the app shell.
- Authenticated browser/device validation of the Notifications screen with a live assigned order remains pending until an approved driver session/test order is available.
- Driver app audit still reports the known Expo transitive `uuid` moderate advisory through Expo CLI/config tooling; the available npm fix requires `--force` and a breaking Expo downgrade, so no force fix was used.

## Summary

The driver mobile MVP is implemented, migrated, deployed in the production web bundle, and runnable locally through Expo web. A controlled driver-assigned QA order was created and completed through the driver-scoped mobile RPC path. No passwords, auth tokens, or cookies are stored in tracked files.

Credential cleanup note: a driver test email/password was briefly placed in `.env.example.production` before this pass. The values were not committed or pushed according to current `git log --all -S` checks, and the file now contains placeholders/comments only. Because the password touched a tracked file in the working tree, reset the driver password as a precaution through Supabase Auth/Admin UI and do not commit the replacement password.

## Production Deploy

- latest deployed: `origin/main` and local `HEAD` are `be3e1e1 feat: implement permission service and delivery lifecycle board with associated documentation`; production JS contains the Driver role UI, linked-driver UI, and driver assignment RPC call.
- domain: `https://www.tabarakpharmacy.com/`
- result: `/` and `/delivery` return HTTP 200 and serve the React app shell, not Vercel 404.

## Driver User Setup

- driver role available: yes, in `types.ts`, `lib/access.ts`, Admin create-user Edge Function, DB role constraints, and Settings UI.
- user created: yes, operator-created before this pass.
- linked delivery driver: yes; read-only aggregate SQL reported one linked active delivery driver.
- credentials stored: no.

## Test Order

- order created: yes.
- short id: `5066ffca`.
- branch: `T001`.
- driver: linked driver profile.
- payment: `TALABAT`.
- test marker: `QA DRIVER APP TEST - SAFE TO IGNORE`.
- initial status: `assigned`.

## Driver App QA

- run mode: local browser / Expo web at `http://localhost:8091`.
- login: pass in the prior credential check against the linked Supabase project.
- start shift: pass.
- assigned order visible: driver-scoped active-order/lifecycle path accepted the assigned QA order.
- picked up: pass; QA order moved to `picked_up`.
- delivered: pass; QA order moved to `delivered`.
- end shift: pass; linked driver final online count is `0` and offline count is `1`.

## RLS / Audit

- assigned-only access: pass; after delivery the driver active-order RPC returned `0` active rows for the completed QA order.
- cross-driver blocked: read-only comparison returned `visible_other_driver_orders = 0`.
- cross-branch leakage: read-only comparison returned `visible_branch_mismatch = 0`.
- event/audit: pass; QA order has `3` events: `assigned,picked_up,delivered`.
- actor/source: pass; `2` driver actor events and `2` `driver_mobile_mvp` source events.
- final status: QA order `5066ffca` is `delivered`; no production data was deleted.

## Verification

- `git status --short`: only `.env.example.production` and documentation updates remained dirty during documentation work.
- `git log --oneline -5`: latest commit is `be3e1e1`.
- `git log --all -S` for the removed driver credential key names: no commit hits.
- `supabase migration list --linked`: aligned through `20260616020000`.
- `npm run typecheck`: pass.
- `npm run build`: pass with existing Vite chunk/dynamic-import warnings only.
- `npm ls --depth=0`: pass.
- `git diff --check`: pass; line-ending warnings only for already edited docs before final verification.
- `npm run typecheck --prefix apps\driver-mobile`: pass.
- `npx expo install --check`: pass.
- local driver app: `http://localhost:8091` returned HTTP 200 and the Expo bundle returned HTTP 200.

## Remaining Blockers

- Reset the operator-created driver password as a precaution because it was briefly stored in a tracked working-tree file before cleanup, even though it was not committed or pushed.
- Do not place the new password in chat, docs, migrations, env examples, or commits.
- Future QA should repeat a browser-clicked Driver App pass after password reset if an operator can enter the replacement password interactively.

## Cleanup / Final State

One controlled QA order was created and left `delivered` for audit traceability. The linked driver shift was ended and the linked driver is offline. No production data was deleted.
