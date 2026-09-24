# Phase 1 Authenticated QA Checklist

Checked on: 2026-06-15

Current status:

```text
B) dedicated-client staging-ready only
```

Use this checklist to complete the remaining authenticated browser QA for Phase 1 Delivery Dispatch / Lifecycle after approved role sessions are available.

## Guardrails

- Use only approved admin, branch, owner, supervisor, warehouse, and accounts sessions.
- Do not expose, print, copy, or store credentials/secrets in logs, docs, screenshots, or commits.
- Do not delete real production data.
- Do not run destructive SQL or bypass RLS.
- Use a clearly marked test delivery order only if a lifecycle transition must be validated.
- Document any test record created, including branch, order identifier, transition, and cleanup status.

## Role Session Inventory - 2026-06-15

Read-only SQL inventory was run against the linked Supabase project. Passwords, tokens, and full email addresses were not printed.

Active profile counts:

- admin: `1`
- branch: `20`
- owner: `1`
- supervisor: `0`
- warehouse: `0`
- accounts: `0`

Session readiness:

| Role | Active profile exists | Suggested account | Branch scope | Browser QA ready |
| --- | --- | --- | --- | --- |
| Admin | Yes | Existing approved admin account, or `qa.admin@tabarak.local` if temporary QA account creation is approved | All branches | Partial; Chrome Default Admin session completed Payments persistence and Dispatch read/control checks; transition still pending safe test order |
| Branch | Yes | Existing approved T001 branch account, or `qa.branch.t001@tabarak.local` if temporary QA account creation is approved | T001 preferred for own-branch QA; use another branch only for negative cross-branch checks | Pass for T001 controlled flow; Chrome Default T001 session completed payment validation, Talabat no-block save, Dispatch cancellation, event audit, dispatch isolation, and historical closed-order checks |
| Owner | Yes | Existing approved owner account, or `qa.owner@tabarak.local` if temporary QA account creation is approved | Read-only executive view | Pass for read-only dashboard; Chrome Default Owner session completed |
| Supervisor | No | `qa.supervisor@tabarak.local` only if approved | Scoped by approved role model | No; active profile/session missing |
| Warehouse | No | `qa.warehouse@tabarak.local` only if approved | Scoped by approved role model | No; active profile/session missing |
| Accounts | No | `qa.accounts@tabarak.local` only if approved | Scoped by approved role model | No; active profile/session missing |

Required operator action:

- Log in with approved existing admin, T001 branch, and owner sessions, or approve creation of temporary QA accounts through Supabase Auth UI / secure Admin API.
- Create supervisor, warehouse, and accounts QA profiles only if those roles are still required for Phase 1 browser QA.
- Do not store passwords in migrations, docs, commits, screenshots, or chat.

## Combined QA Attempt - 2026-06-15

Attempted combined authenticated production QA for Delivery Payment Types and Phase 1 Dispatch.

Result:

- Production route smoke passed for `https://www.tabarakpharmacy.com/` and `https://www.tabarakpharmacy.com/delivery`.
- Both routes returned HTTP 200, served the React app shell, and did not show Vercel `404: NOT_FOUND`.
- Initial browser QA attempts were blocked because the selected Chrome profiles did not have the Codex Chrome Extension enabled.
- Chrome Default profile alignment later enabled browser control for T001 Branch, Admin, and Owner sessions.
- No credentials were requested, entered, printed, or stored.
- Earlier blocked attempts created no delivery payment type, delivery order, or lifecycle transition. Later Admin browser QA created a clearly marked `QA_TEST_PAYMENT` payment type, edited it, and left it disabled/inactive. Later T001 controlled QA created one `0.001 BHD` `TALABAT` no-block test delivery order and cancelled it through Dispatch with audit note `QA TEST TALABAT NO BLOCK - SAFE TO IGNORE`.
- Read-only SQL confirmed active role inventory remains admin `1`, branch `20`, owner `1`, supervisor `0`, warehouse `0`, accounts `0`.
- Read-only SQL confirmed `delivery_order_events` currently contains `1` aggregate event: `recorded -> cancelled`, actor role `branch`; this event was not created by this pass.

## T001 Branch QA Attempt - 2026-06-15

Current Chrome Default session was confirmed as T001 Branch before testing.

Result:

- Branch Recording opened inside Delivery Recording & Traceability.
- Dynamic active payment options were visible: `BP`, `Cash`, `Card`, `Talabat`, and `Insurance`.
- Delivery Settings / Payments management controls were not visible to the branch session; no add/edit/disable payment-type controls appeared.
- `Talabat` could be selected and the form changed block/area to not required (`Disabled for Talabat`, `Not required for Talabat`).
- `Insurance` could be selected; clicking `RECORD ORDER` with a value but no block showed `Block required` / `Block number is required for Insurance delivery orders.`
- No order was saved during the negative validation; delivery history remained `1` order / `10.500 BHD`.
- Dispatch tab was visible; T001 saw a T001/Jerdab dispatch queue with one closed/cancelled order and an append-only lifecycle trace.
- No branch selector, cross-branch data, delete/hard-delete control, payment settings, or admin settings control was visible in the T001 Dispatch view.
- In this earlier read-only pass, no lifecycle transition was performed because only a closed/cancelled order was visible.
- In this earlier read-only pass, no test records were created and no production data was deleted.
- One browser automation console error was observed from the extension clipboard shim (`Cannot redefine property: clipboard`); no app crash was observed.

## Controlled T001 Test Order QA - 2026-06-15

Current Chrome Default session was confirmed as T001 Branch before the controlled mutation test.

Result:

- Branch Recording form did not expose customer name, phone, or notes fields, so the test order marker is the controlled T001/Jerdab context: `0.001 BHD`, `TALABAT`, block omitted, and the lifecycle note.
- Exactly one T001/Jerdab `0.001 BHD` `Talabat` test order was created with block omitted; no false `Block required` validation appeared.
- The new order appeared in Branch history and Dispatch with payment `TALABAT`, driver `ABBAS`, status `RECORDED`, and no block/area.
- Dispatch showed no cross-branch data, branch selector, payment settings, admin settings, delete, or hard-delete controls.
- One safe terminal lifecycle transition was performed on the test order only: `recorded -> cancelled`.
- Cancellation note used: `QA TEST TALABAT NO BLOCK - SAFE TO IGNORE`.
- Browser trace showed the QA cancellation note, the test order became `CANCELLED` / `CLOSED`, and the success modal reported `Delivery marked as cancelled.`
- Read-only SQL audit found order short id `cc9f3541`, branch `T001`, `block_omitted=true`, `delivery_status=cancelled`, `event_count=1`, `recorded_to_cancelled_events=1`, `event_branch_matches_order=true`, `event_actor_populated=true`, `event_actor_roles=branch`, `event_sources=internal_dispatch_phase1`, and `cross_branch_note_events=0`.
- The test order was not hard-deleted and remains as a clearly documented QA/audit record.

## Admin QA Attempt - 2026-06-15

Current Chrome Default session was confirmed as Admin before testing.

Result:

- Delivery module opened for Admin with Analytics, Dispatch, Block Coverage, Profitability, and Delivery Settings tabs visible.
- `Delivery Settings > Payments` opened successfully.
- Default payment labels/codes were visible: `BP`, `Cash/CASH`, `Card/CARD`, `Talabat/TALABAT`, and `Insurance/INSURANCE`.
- Admin payment-management controls were visible: `ADD PAYMENT`, `Edit`, and `Deactivate`.
- `QA_TEST_PAYMENT` was created through the Add payment dialog and appeared in the Payments list as active.
- Edit payment dialog showed the existing payment code as read-only, protecting historical order codes.
- The test payment label was edited to `QA_TEST_PAYMENT_UPDATED`, display order was changed, and `requires_block` was toggled off; the row then showed `No block required`.
- The test payment type was deactivated and now remains disabled/inactive for traceability; default payment types were not altered.
- Admin Dispatch opened and showed all operational branches for today with dispatch rows, action buttons (`ASSIGNED`, `CANCELLED`), lifecycle tracking text, and no hard-delete control.
- No lifecycle transition was performed because no clearly marked safe test order was available.
- No delivery orders were created and no production delivery data was deleted.
- No app crash or unexpected failed state was observed; one Chrome extension clipboard shim error was present in console logs and is not an app-side failure.

Still pending:

- Admin Dispatch lifecycle transition/event QA when a safe active test order exists.
- Supervisor/warehouse/accounts browser QA if those role sessions are approved and available.

## Owner QA Attempt - 2026-06-15

Current Chrome Default session was confirmed as `OWNER` / `Owner / Read-only Executive` before testing.

Results:

- Owner module launcher showed only `Owner Dashboard`; no Delivery Settings, Branch Recording, payment-management, or admin module controls were visible.
- Owner Dashboard opened and showed the `Read-only owner view` banner plus `No write actions`.
- Overview loaded executive KPIs for orders, delivery value, direct/Talabat split, lost sales/customers, critical shortages, owner attention, and lowest pharmacy health.
- Delivery Map loaded Bahrain map/zones with demand layer, branch markers, service rings, served blocks, mapped/unmapped stats, and hot block shortcuts.
- Traceability loaded a read-only delivery log with date, branch, driver, payment, block, area, and value columns.
- Drivers loaded driver KPI/cost-efficiency rows with no editable cost-setting controls.
- Pharmacies loaded pharmacy health KPIs combining delivery, lost sales, unknown block %, outside governorate %, no-recovery, and shortage risk.
- Export/print/filter controls were visible and considered non-mutating; no export or print action was triggered.
- No record, save, assign, cancel, edit, deactivate, or hard-delete controls were visible in the Owner Dashboard.
- No app console errors were observed during Owner checks.
- No test records were created and no production data was changed.

## Admin QA

- Login succeeds.
- Delivery module opens.
- Dispatch tab appears.
- Dispatch board loads.
- Lifecycle rows show data or a clean empty state.
- Safe lifecycle transition creates event.
- No hard delete is exposed in the branch lifecycle flow.
- No console/network errors appear during load or transition.

## Branch QA

- Branch user sees own branch lifecycle data only.
- Cross-branch data is blocked.
- Cross-branch transition is blocked.
- Historical/old records are protected.
- Hard delete is blocked.
- No console/network errors appear during branch-scoped lifecycle checks.

## Owner QA

- Owner dashboard opened in the approved Chrome Default Owner session.
- Owner is read-only.
- No lifecycle transition buttons were visible or usable.
- No user/settings management was visible or usable.
- Owner could not mutate delivery lifecycle state through the UI.

## Supervisor/Warehouse/Accounts QA

- No unexpected write access is available.
- Read-only/scoped behavior matches the approved role model.
- Delivery/Dispatch visibility matches the configured module permissions.
- No role can mutate lifecycle state unless explicitly approved by the role model.

## Event/Audit QA

- Lifecycle event is created on an allowed transition.
- Actor/source is recorded if available.
- Event branch/order context matches the transitioned order.
- No cross-branch event leakage is visible.
- Direct event writes remain unavailable from authenticated clients.

## Cleanup Rules

- Use a clearly marked test order only if needed.
- Do not delete real production data.
- Document any test record created.
- Prefer reversing only safe status changes through approved lifecycle flows when cleanup is necessary.
- Leave `delivery_order_events` append-only; do not delete audit rows.

## Evidence Capture

Record QA evidence in the relevant release/readiness docs:

```text
Role:
Session source:
Branch/order used:
Checks completed:
Transition performed:
Event row observed:
Console/network errors:
Data cleanup required:
Result:
Reviewer:
Timestamp:
```

## Stop Conditions

- Unexpected write access appears for owner, supervisor, warehouse, or accounts.
- Branch user can view or mutate another branch's lifecycle data.
- Historical protected records can be updated or deleted by branch users.
- RLS errors indicate a policy mismatch with the documented role model.
- Browser/network errors block Dispatch board load or lifecycle event validation.
- Credentials, tokens, or secrets appear in logs, screenshots, docs, or terminal output.
