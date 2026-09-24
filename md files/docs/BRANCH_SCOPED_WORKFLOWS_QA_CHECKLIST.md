# Branch-Scoped Workflows QA Checklist

Status: staging QA checklist. Do not mark production-ready until these checks pass on the linked/dedicated Supabase project with real role sessions.

Related automated check script:

`docs/BRANCH_SCOPED_WORKFLOWS_QA_CHECKS.sql`

## Automated Integrity Checks

Run:

```bash
supabase.cmd db query --linked --file docs/BRANCH_SCOPED_WORKFLOWS_QA_CHECKS.sql
```

Expected:

- All data-integrity rows return `status = pass`.
- `Branches / legacy non-branch rows retained` may return `info`; these rows are intentionally retained until a separate impact audit approves deletion.
- `skip` is acceptable only when the workflow table is intentionally absent from the target project.

Latest linked Supabase run: 2026-06-14

- Automated branch-scope integrity checks: passed.
- Operational branch rows: 21.
- Legacy non-branch rows retained in `public.branches`: 3.
- Cleaned and backed up obsolete legacy references:
  - `feature_permissions`: 8 rows.
  - `pharmacist_branches`: 56 rows.
- Branch-scope guard triggers installed for:
  `delivery_orders`, `branch_classifications`, `cash_differences`, `lost_sales`,
  `shortages`, `pharmacist_branches`, `feature_permissions`,
  `supervisor_branches`, `operations_tasks`, and `branch_login_approvals`.

## Delivery Recording

- [ ] Branch user logs in and is approved through the branch login approval flow.
- [ ] Branch recording form opens only for a branch-role user linked to an operational branch.
- [ ] Branch user can create a delivery order for its own branch.
- [ ] Branch user cannot create or update an order for a different branch.
- [ ] Manager can view/manage delivery orders according to current delivery permissions.
- [ ] Talabat order saves with `block_number = null`.
- [ ] Non-Talabat order requires a valid block value or a consciously unresolved block path.
- [ ] Invalid driver/pharmacist/branch combinations are rejected visibly.

## Delivery Coverage

- [ ] Manager/owner can open coverage analytics and see all intended operational branches.
- [ ] Supervisor sees only assigned branch coverage.
- [ ] Branch user sees only its own branch coverage where the module is enabled.
- [ ] Coverage branch filter lists operational branches only; no `admin`, `accounts`, `warehouse`, or legacy identity rows appear.
- [ ] Unknown block, unresolved block, and Talabat/no-block counts are still separated.
- [ ] Creating an operations task from a coverage insight keeps `source_module = delivery_coverage`.
- [ ] Coverage-created operations task either has a real branch id or a deliberate null/global scope.

## Cash Tracker

- [ ] Branch user can create a cash difference only for its own operational branch.
- [ ] Branch user cannot create/update/delete another branch's cash difference.
- [ ] Manager can review all operational branches.
- [ ] Branch picker and reports exclude legacy non-branch rows.
- [ ] Existing cash differences render branch names correctly after branch filtering.

## Live Shift Coverage

This workflow currently derives from branch-scoped operational data such as `lost_sales`, `shortages`, and command-center summaries.

- [ ] Branch user sees only its own live shift/lost-sale/shortage signals.
- [ ] Supervisor sees only assigned branch signals.
- [ ] Manager/owner/warehouse read scopes match the current role model.
- [ ] No legacy non-branch rows appear as branches in dashboard filters, command-center cards, or live coverage summaries.
- [ ] Existing lost sales and shortages still join to operational branch names.

## Pharmacist Branch Assignment

- [ ] Project Settings > People lists only operational branches in assignment multi-select.
- [ ] Assigning a pharmacist to a branch writes only operational `branch_id` values.
- [ ] Delivery/POS pharmacist lookup for a branch returns only active pharmacists assigned to that operational branch.
- [ ] Attempting to use a legacy non-branch row as an assignment target is rejected by database guard/RLS.

## Feature Permissions

- [ ] Project Settings > Access lists only operational branches.
- [ ] Branch-specific feature permissions write only operational branch ids.
- [ ] Role defaults are managed from Users & Roles and are not confused with branch rows.
- [ ] Legacy non-branch rows do not appear as permission targets.
- [ ] Branch-specific overrides still win over role defaults where applicable.

## Supervisor Branch Access

- [ ] Project Settings > Users & Roles supervisor assignment lists only operational branches.
- [ ] Supervisor assigned to Branch A can read Branch A scoped workflows.
- [ ] Same supervisor cannot read Branch B workflows unless Branch B is assigned.
- [ ] Removing supervisor role clears supervisor branch assignments.
- [ ] Attempting to assign a supervisor to a legacy non-branch row is rejected by database guard/RLS.

## Branch Login Approval Flow

- [ ] Branch user signs in by branch code, e.g. `T001`.
- [ ] Branch user signs in by full email, e.g. `tabarakph.t001@gmail.com`.
- [ ] Correct credentials create a pending approval and show waiting screen.
- [ ] Approving request lets branch enter the app with its operational branch only.
- [ ] Rejecting, expiring, cancelling, or verification failure signs the branch user out.
- [ ] Branch cannot approve its own request.
- [ ] `accounts`/warehouse cannot approve requests unless intentionally granted by policy.
- [ ] Anonymous users cannot read or write approval rows.

## Final Gate

- [ ] Automated SQL integrity checks pass.
- [ ] Manual role-session QA passes for branch, supervisor, manager, owner, warehouse/accounts, and anon where relevant.
- [ ] Audit vulnerabilities are accepted or remediated separately.
- [ ] No production-ready claim is made until real role/RLS validation is complete.

Final project status remains: `B) dedicated-client staging-ready only`.
