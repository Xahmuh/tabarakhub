# Follow-ups — Role Restructure & Delivery Module

Recommended improvements after the role restructure and Delivery Recording &
Traceability release. None of these block production.

1. **Block Coverage Analyzer should use a database-backed admin source.**
   `app/block-analyzer/BlockCoverageAnalyzer.jsx` no longer ships bundled
   coverage, area, or pharmacy maps, but it still stores admin-entered analyzer
   data in browser storage. Move it to `delivery_blocks` plus an approved
   coverage-zone table so manager edits propagate everywhere.

2. **Replace supervisor-name filtering with `supervisor_branches` links.**
   Delivery analytics currently filters by the free-text
   `branch_classifications.supervisor_name`. Once supervisors are assigned in
   Users & Roles, switch the filter (and the classification screen) to
   `supervisor_user_id` + `supervisor_branches` so assignments and analytics
   can never drift apart.

3. **Remove tolerated legacy `admin` / `accounts` role values.**
   `types.ts` (`Role` union), `lib/access.ts` (`ALL_ROLES`/labels), and the
   normalization branch in `services/authService.ts` still tolerate the legacy
   values for transition safety. After production has run on the new model and
   no profile/branch rows carry legacy roles, remove them and add a follow-up
   migration that tightens any remaining check constraints.

4. **RLS regression tests.**
   `supabase/tests/` and `docs/OPERATIONS_TASK_RLS_ROLE_SIMULATION_TESTS.sql`
   show existing DB-test patterns. Add equivalent role-simulation tests for
   `delivery_orders` (insert window, same-day edit/delete, supervisor scoping)
   and the `app_admin_*` RPC guards, and run them after every migration.

5. **In-app audit log viewer.**
   `deliveryService.auditLogs` already exposes the data; today managers verify
   audit history via SQL. A small read-only list in Delivery Settings would
   complete the traceability story.

6. **Inline edit for delivery orders.**
   The branch today-list supports delete; an edit dialog (same-day, RLS already
   permits) would avoid delete-and-retype for typos.

7. **Bundle size.**
   The main chunk is ~3.3 MB minified. Route-level `React.lazy` on heavy
   modules (delivery, dashboard, spin-win, pdf tooling) would cut first-load
   time for branch phones. Existing warning, not introduced by this release.
