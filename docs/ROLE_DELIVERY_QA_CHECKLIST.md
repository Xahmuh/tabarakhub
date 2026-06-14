# QA Checklist — Role Restructure + Delivery Recording & Traceability

Release scope: migrations `20260612180000_role_system_restructure.sql` and
`20260612190000_delivery_recording_traceability.sql`, the centralized permission
model (`lib/access.ts`, Project Settings → Users & Roles), and the
**Delivery Recording & Traceability** module (`app/delivery/`).

There is no lint script in this project; the verification gate is
`npm run typecheck` + `npm run build` (both must pass before deploying).

## 1. Migrations

- [ ] Apply `20260612180000_role_system_restructure.sql` first, then
      `20260612190000_delivery_recording_traceability.sql` (`supabase db push`
      or paste into the SQL editor in that order).
- [ ] Both migrations finish without exceptions. Their built-in post-checks
      raise an exception on failure (legacy roles remaining, RLS missing,
      anon grants, incomplete block seed).
- [ ] Watch the output for the **"No active manager profile exists"** warning.
      If it appears, promote one user before doing anything else:
      `update public.app_user_profiles set role = 'manager', is_active = true where user_id = '<auth-user-uuid>';`
- [ ] Re-running both migrations a second time succeeds (they are idempotent).
- [ ] `select count(*) from public.delivery_blocks;` returns ≥ 458, with no
      null governorates.

## 2. Users & roles (login as **manager**)

- [ ] Log in as the manager — full module suite is visible.
- [ ] Project Settings → **Users & Roles** lists all app users with email,
      role, branch, and active state.
- [ ] Assign each real user their role (owner / supervisor / warehouse / branch).
      Old `accounts` users appear as **deactivated warehouse** — re-assign them here.
- [ ] Branch role requires picking a branch (enforced; the RPC rejects otherwise).
- [ ] You cannot change or deactivate **your own** row (lockout protection).
- [ ] For each supervisor: open the branches dialog and assign their branches.
- [ ] In the **Role Permissions** matrix, confirm seeded defaults match intent
      and adjust (cells cycle none → read → edit; manager column is locked).

## 3. Delivery setup (manager)

- [ ] Delivery hub → **Delivery Settings → Drivers**: create at least one driver.
      It receives a Driver ID automatically and duplicate active driver names are rejected.
- [ ] **Blocks & Areas**: search a known block (e.g. 905 → East Riffa, Southern);
      edit a governorate and confirm it persists; add a brand-new block.
- [ ] **Branch Classification**: set area / supervisor / governorate for EVERY
      branch. Unclassified branches show an amber badge and are flagged in Data
      Quality.
- [ ] **Profitability → Cost settings**: set monthly cost, working days, target
      orders/day for each driver. Set margin % on at least one driver to enable
      loss analysis.

## 4. Branch recording (login as **branch**)

- [ ] Delivery card is visible on the suite; hub opens on **Record**.
- [ ] Date input is limited to **today/yesterday** (manager: any date).
- [ ] Record a CASH order with a known block → area + governorate auto-fill
      read-only under the input.
- [ ] Record a **TALABAT** order → block input is disabled and the order saves
      without a block.
- [ ] Enter an unknown block (e.g. 99999) → warning appears; "Save anyway"
      stores the order with the raw block number and no area (must NOT fail).
- [ ] Re-enter the same value/payment/driver within 10 minutes → duplicate
      warning appears; cancel and confirm paths both work.
- [ ] Delete a today order → allowed. Attempt via API on a yesterday order →
      rejected by RLS.
- [ ] Backdating beyond yesterday via API (modified payload) → rejected by RLS.

## 5. Branch dashboard (branch)

- [ ] Today / Yesterday / This month / Custom filters change the data.
- [ ] Combined vs WhatsApp-Direct vs Talabat views split correctly
      (direct = BP + CARD + CASH).
- [ ] 4 KPI cards: total count, total value, direct count+value, Talabat count+value.
- [ ] Excel export contains exactly the rows of the current view/period.
- [ ] Print/PDF shows the **branch name and selected period** in the header.

## 6. Analytics (manager / owner / supervisor)

- [ ] Each filter (date, branch, supervisor, governorate, payment, driver,
      pharmacist) narrows the KPI row and leaderboards consistently.
- [ ] Geography section counts **WhatsApp/direct orders only** (Talabat excluded).
- [ ] Clicking a governorate drills into areas/blocks sorted by value; the
      breakdown downloads as Excel.
- [ ] Driver weekday heatmap renders; outside-governorate bars match flagged orders.
- [ ] **Supervisor account**: analytics shows ONLY assigned branches (RLS),
      and the branch filter exposes no other branches' data.

## 7. Profitability (manager; owner read-only)

- [ ] Driver with margin % set: estimated net = value × margin − prorated cost;
      negative net classifies as **Loss-making** (red).
- [ ] Driver without margin %: no net column value, classification is
      productivity-based only — order value is never treated as profit.
- [ ] Driver without cost settings shows **No cost data**.
- [ ] Recommendations panel mentions loss-makers, low-efficiency drivers,
      missing cost data, and high outside-governorate share when applicable.
- [ ] Owner sees the ranking but has no cost-settings button.

## 8. Data quality (manager)

- [ ] Orders missing driver / pharmacist are counted.
- [ ] "Missing block (non-Talabat)" counts only non-Talabat orders — Talabat
      orders never appear here.
- [ ] "Unknown block" counts orders whose block has no directory match
      (block set, area empty).
- [ ] Outside-governorate tile matches the analytics view.
- [ ] Unclassified branches are listed by name.

## 9. Audit trail

- [ ] Update then delete a delivery order (as manager). Then in SQL editor:
      `select action, changed_by, changed_at from public.delivery_order_audit_logs order by changed_at desc limit 5;`
      → one `update` and one `delete` row with the old values in `old_row`.
- [ ] As a branch/owner account, `select * from delivery_order_audit_logs`
      via the API returns **zero rows** (manager-only read).
- [ ] Direct `insert into delivery_order_audit_logs ...` as any frontend role
      fails (no insert grant — rows come only from the trigger).

## 10. RLS matrix (test from each account)

| Check | branch | supervisor | owner | warehouse | manager |
|---|---|---|---|---|---|
| Read own-branch delivery orders | ✅ | ✅ (assigned only) | ✅ all | ✅ all | ✅ all |
| Read other branches' orders | ❌ | ❌ (unassigned) | ✅ | ✅ | ✅ |
| Insert delivery order | ✅ own, today/yesterday | ❌ | ❌ | ❌ | ✅ any |
| Edit/delete order | ✅ own, same-day | ❌ | ❌ | ❌ | ✅ |
| Manage drivers / blocks / classifications | ❌ | ❌ | ❌ | ❌ | ✅ |
| Read cost settings | ❌ | ❌ | ✅ | ❌ | ✅ |
| Write cost settings | ❌ | ❌ | ❌ | ❌ | ✅ |
| Finance writes (suppliers/cheques/expenses/revenues) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Approve cash differences | ❌ | ❌ | ❌ | ❌ | ✅ |
| Users & Roles screen / role RPCs | ❌ | ❌ | ❌ | ❌ | ✅ |
| anon (no login) | no access to any of the above |

Known acceptable behavior: owner may see some action buttons inside legacy
screens (e.g. Cash Flow Planner subtabs); any write attempt is rejected by RLS.

## 11. Final gate

- [ ] `npm run typecheck` — clean.
- [ ] `npm run build` — succeeds (chunk-size/browserslist warnings are known
      and non-blocking).
- [ ] Smoke-test login for one account of each role after migration.
