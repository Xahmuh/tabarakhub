# Delivery RLS Manual Tests

Status:

```text
Pending real dedicated-client Supabase execution.
```

Run these tests after migrations are applied to a real Supabase project with `VITE_DEMO_MODE=false`. Do not mark the Delivery module production-ready until every expected denial/allowance is verified with real Auth sessions.

## Test Data Needed

- One active manager user.
- One owner user if the client uses owner read access.
- One supervisor user assigned to exactly one test branch.
- Two branch users, each assigned to a different branch.
- One warehouse/legacy accounts-equivalent user if enabled for the client.
- One unauthenticated/anon session.
- Two active branches: `BRANCH_A` and `BRANCH_B`.
- At least one active pharmacist assigned to `BRANCH_A` only.
- At least one active delivery driver.
- At least one known delivery block in `delivery_blocks`.
- One intentionally unknown block number not in `delivery_blocks`.

## Anon Tests

| ID | Action | Expected Result |
|---|---|---|
| D-RLS-ANON-01 | From anon REST/client, select `delivery_orders`. | Denied or zero sensitive rows; no delivery data returned. |
| D-RLS-ANON-02 | From anon REST/client, insert `delivery_orders`. | Denied. |
| D-RLS-ANON-03 | From anon REST/client, select delivery reference tables. | Denied unless a future reviewed public exception exists. |
| D-RLS-ANON-04 | From anon REST/client, select `operations_tasks` where `source_module = delivery_coverage`. | Denied. |

## Branch User Tests

| ID | Action | Expected Result |
|---|---|---|
| D-RLS-BR-01 | Branch A user records a non-Talabat order for Branch A with known block. | Allowed. Area/governorate snapshot is set by trigger. |
| D-RLS-BR-02 | Branch A user records a Talabat order for Branch A with no block. | Allowed. `block_number`, `area_name`, `governorate` are null. |
| D-RLS-BR-03 | Branch A user records a non-Talabat order for Branch A with unknown block via save-anyway flow. | Allowed. `block_number` is set; `area_name`/`governorate` remain null and analytics flags unresolved. |
| D-RLS-BR-04 | Branch A user attempts to insert an order with `branch_id = BRANCH_B`. | Denied by RLS. |
| D-RLS-BR-05 | Branch A user selects `delivery_orders` for Branch B. | Denied or returns no Branch B rows. |
| D-RLS-BR-06 | Branch A user attempts to update/delete a Branch B order. | Denied. |
| D-RLS-BR-07 | Branch A user attempts to insert a non-Talabat order with no block. | Denied by validation/constraint. |
| D-RLS-BR-08 | Branch A user attempts to use a pharmacist assigned only to Branch B. | Denied by service validation and should also fail any direct policy/trigger review if hardened later. |
| D-RLS-BR-09 | Branch A user attempts to create an operations task from a delivery insight. | Denied; branch users cannot create delivery insight tasks. |

## Manager Tests

| ID | Action | Expected Result |
|---|---|---|
| D-RLS-MGR-01 | Manager selects delivery orders across Branch A and Branch B. | Allowed. |
| D-RLS-MGR-02 | Manager views Delivery Coverage with all-branch filter. | Allowed; results include all visible branches. |
| D-RLS-MGR-03 | Manager creates/updates delivery reference data. | Allowed. |
| D-RLS-MGR-04 | Manager creates an operations task from a coverage insight. | Allowed; task has `source_module = delivery_coverage`. |
| D-RLS-MGR-05 | Manager tries to create a duplicate open/in-progress task for the same insight. | UI warns; DB duplicate guard prevents accidental duplicate if exact key repeats. |

## Owner Tests

| ID | Action | Expected Result |
|---|---|---|
| D-RLS-OWN-01 | Owner views delivery analytics/coverage/profitability. | Allowed read-only where `current_app_can_read_all` applies. |
| D-RLS-OWN-02 | Owner attempts to create a delivery reference row or operations task. | Denied unless the target project intentionally grants owner write access. Current role restructure makes owner read-only. |

## Supervisor Tests

| ID | Action | Expected Result |
|---|---|---|
| D-RLS-SUP-01 | Supervisor assigned to Branch A selects Branch A delivery orders. | Allowed. |
| D-RLS-SUP-02 | Same supervisor selects Branch B delivery orders. | Denied or no rows returned. |
| D-RLS-SUP-03 | Same supervisor opens Delivery Coverage. | Only assigned-branch data appears, regardless of UI branch filter. |
| D-RLS-SUP-04 | Same supervisor attempts to create an operations task from delivery coverage. | Denied/read-only. |

## Warehouse / Legacy Accounts Tests

Run only if the client enables warehouse/accounts-equivalent access.

| ID | Action | Expected Result |
|---|---|---|
| D-RLS-WH-01 | Warehouse user attempts to open Delivery module. | Hidden/denied by default role permissions unless the client intentionally enables it. |
| D-RLS-WH-02 | Warehouse user selects delivery orders directly. | Current `current_app_can_read_all` may allow read-broad access; confirm intended client behavior. |
| D-RLS-WH-03 | Warehouse user attempts to insert/update/delete delivery orders or tasks. | Denied. |

## Direct SQL/REST Checks

Use the same browser session or Supabase client session for each role.

```js
await supabase.from('delivery_orders').select('*')
await supabase.from('delivery_orders').insert([{ branch_id: 'OTHER_BRANCH_ID', order_date: '2026-06-14', value_bhd: 1, payment_type: 'CASH', block_number: '999' }])
await supabase.from('operations_tasks').insert([{ source_module: 'delivery_coverage', title: 'RLS probe', severity: 'low', priority: 'low', related_record_type: 'delivery_insight', related_record_id: 'rls-probe' }])
```

Record actual allow/deny results in the client handover notes.

## Sign-Off

Delivery module RLS sign-off requires:

- Anon denied.
- Branch user own-branch only.
- Branch user cannot create orders for another branch.
- Manager can read all and create delivery coverage tasks.
- Owner/supervisor/warehouse behavior matches the target role model.
- Operations task creation respects RLS.
- No browser-only UI hiding is treated as sufficient security.
