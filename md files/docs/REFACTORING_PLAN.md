# Prioritized Refactoring Plan: Tabarak Hub

## Executive Strategy

This refactoring plan is strictly incremental and non-destructive. It addresses architectural drift, inverted dependencies, monolithic files, and scattered data queries without rewriting working modules or risking regression in active pharmacy operations.

---

## Priority Classifications

- **P0 — Critical**: Stability, environment crashes, security vulnerabilities, or severe architectural inversions.
- **P1 — High**: Inverted dependencies, duplicate service layers, and unmounted dead code causing confusion.
- **P2 — Medium**: Leaky data layer (direct `.from()` queries in UI), oversized files (>2,000 lines), and inconsistent formatting.
- **P3 — Low**: Cleanup of legacy artifacts, unused imports, and consolidation of types.

---

## Detailed Task Roadmap

### Phase 1: Foundations & Safety Net (P0)

#### Task 1.1: Guard Browser Storage & Globals in Services
- **Files Affected**:
  - `services/attendanceService.ts`
  - `services/operationalRenewalService.ts`
  - `services/branchLoginApprovalService.ts`
  - `services/__tests__/attendanceEngine.test.ts`
- **Problem**: Direct calls to `localStorage.setItem` crash in Node.js test environments (Node 25+) with `TypeError: localStorage.setItem is not a function`, blocking CI/test automation.
- **Risk**: Very Low.
- **Expected Benefit**: Unit tests run reliably across Node.js, CLI scripts, and CI runners without environment failure.
- **Preconditions**: Verified failing test `npx tsx services/__tests__/attendanceEngine.test.ts`.
- **Validation**: `npx tsx services/__tests__/attendanceEngine.test.ts` passes 100%.
- **Rollback Strategy**: Git checkout modified service files.

#### Task 1.2: Remove Dead Next.js Relic in Vite SPA
- **Files Affected**:
  - `app/api/init-signature/route.ts` (Delete)
  - `app/api/copy-sig/` (Delete empty folder)
  - `tsconfig.json` (Remove `"app/api"` from `"exclude"`)
- **Problem**: `app/api/init-signature/route.ts` imports `'next/server'` and contains a hardcoded local machine brain path (`C:\Users\User\.gemini\...`). It was excluded from `tsconfig.json` to prevent typecheck failure.
- **Risk**: Very Low (Zero external consumers, Vite SPA does not execute Next.js route handlers).
- **Expected Benefit**: Clean tsconfig, eliminates misleading server-route assumptions.
- **Preconditions**: Grep confirms zero references across entire codebase.
- **Validation**: `npm run typecheck` passes with `"app/api"` removed from `tsconfig.json`.
- **Rollback Strategy**: Git checkout deleted files.

---

### Phase 2: Inverted Dependencies & Service Coupling (P1)

#### Task 2.1: Break Inverted Service-to-UI Dependencies
- **Files Affected**:
  - `services/expenseService.ts`
  - `services/crService.ts`
  - `app/operational-expenses/utils/vehicleAlertUtils.ts` -> move to `services/utils/` or `utils/`
  - `app/lib/crEntities.ts` -> move to `services/cr/` or `lib/`
- **Problem**: `services/expenseService.ts` imports from `app/operational-expenses/utils/` and `services/crService.ts` imports from `app/lib/crEntities.ts`. Domain services must never depend on the UI presentation layer.
- **Risk**: Low.
- **Expected Benefit**: True layered architecture; services can be tested and reused independently of the React view hierarchy.
- **Preconditions**: Verify all import sites of `vehicleAlertUtils` and `crEntities`.
- **Validation**: `npm run typecheck` and `npm run build` pass.
- **Rollback Strategy**: Revert moved files and restore previous import paths.

#### Task 2.2: Reconcile Dual Operations/Workflow Task Systems
- **Files Affected**:
  - `services/operationsTaskService.ts`
  - `app/command-center/operationsTaskService.ts`
  - `app/delivery/DeliveryCoverage.tsx`
  - `app/workflow-todo/workflowTodoService.ts`
- **Problem**: `app/delivery/DeliveryCoverage.tsx` writes to `operations_tasks` table, while the user-facing `WorkflowTodoPage` reads from `workflow_tasks`. The operational tasks created by delivery insights are invisible to users in the Todo module!
- **Risk**: Medium.
- **Expected Benefit**: Unifies task management; delivery operational recommendations appear directly in the user's workflow queue.
- **Preconditions**: Audit database schema for `operations_tasks` vs `workflow_tasks`.
- **Validation**: Verify delivery coverage task creation creates a visible task in `workflowTodoService`.
- **Rollback Strategy**: Keep `operationsTaskService` as fallback adapter.

#### Task 2.3: Handle Orphaned `app/command-center` Module
- **Files Affected**:
  - `app/command-center/*` (7 files, ~120 KB)
  - `lib/moduleRegistry.ts`
- **Problem**: `app/command-center` is completely unreferenced by `App.tsx` or `app/index.ts`. It contains an old snapshot of `operationsTaskService` and duplicate map widgets.
- **Risk**: Low.
- **Expected Benefit**: Either formally mount it into `App.tsx` if approved by stakeholders, or archive it into `docs/archive/` to eliminate dead code and maintenance confusion.
- **Preconditions**: Stakeholder review on whether Command Center was meant to be released or replaced by `SuitePage`.
- **Validation**: Application build passes.
- **Rollback Strategy**: Git checkout from branch.

---

### Phase 3: Leaky Data Layer Encapsulation (P2)

#### Task 3.1: Encapsulate UI `.from()` Queries into Dedicated Services
- **Files Affected**:
  - `app/pos/page.tsx`
  - `app/corporate-codex/CorporateCodex.tsx`
  - `app/cash-flow/BranchCashDifferenceTracker.tsx`
  - `app/spin-win/BranchDashboard.tsx`
  - `app/payroll/StaffPayrollHub.tsx`
- **Problem**: 27 UI component files contain direct `.from('...')` Supabase queries bypassing the service layer, duplicating filtering, sorting, and error handling.
- **Risk**: Medium.
- **Expected Benefit**: Centralized query logic, easier testing, eliminates leaked table column assumptions from React rendering lifecycle.
- **Preconditions**: Document exact query parameters and return shapes.
- **Validation**: UI smoke test on each affected screen + `npm run typecheck`.
- **Rollback Strategy**: Revert per-module component changes.

#### Task 3.2: Consolidate Centralized BHD Currency Formatting
- **Files Affected**:
  - 139 instances of `.toFixed(3)` across `app/` and `services/`
  - `utils/money.ts`
  - `utils/calculations.ts`
- **Problem**: Dual formatting (`BHD 1.000` vs `1.000 BHD`), manual string splicing, and 139 manual calls to `.toFixed(3)`.
- **Risk**: Low.
- **Expected Benefit**: Visual consistency across invoices, receipts, and dashboards; prevents floating-point precision display errors.
- **Preconditions**: Verify user preference for `BHD X.XXX` vs `X.XXX BHD`.
- **Validation**: Visual check on POS, Cash Flow, and Payroll screens.
- **Rollback Strategy**: Revert specific utility modifications.

---

### Phase 4: Oversized Monolithic File Deconstruction (P2 / P3)

#### Task 4.1: Deconstruct `app/hr/WorkforceDirectory.tsx` (5,381 lines)
- **Target File**: `app/hr/WorkforceDirectory.tsx`
- **Current Responsibilities**:
  1. Employee table rendering & multi-criteria filtering
  2. Employee create/edit modal forms
  3. Hardcoded fallback branch and vehicle data
  4. Credential & password reset management
  5. LMRA & Bahrain Labor Law compliance checks
  6. Passport & Visa expiration alerts
  7. Document generation & badge printing
- **Refactoring Decomposition**:
  - `app/hr/workforce-directory/components/EmployeeTable.tsx`
  - `app/hr/workforce-directory/components/EmployeeFilterBar.tsx`
  - `app/hr/workforce-directory/components/EmployeeEditModal.tsx`
  - `app/hr/workforce-directory/components/ComplianceBadges.tsx`
  - `app/hr/workforce-directory/hooks/useWorkforceData.ts`
- **Risk**: Medium.
- **Expected Benefit**: Dramatic reduction in re-render overhead, readable components (<400 lines each), isolated testability.
- **Preconditions**: Create automated snapshot test or visual checklist of all employee tabs.
- **Validation**: Full manual QA of employee search, edit, badge print, and export.
- **Rollback Strategy**: Restore monolithic `WorkforceDirectory.tsx` from git.

#### Task 4.2: Deconstruct `App.tsx` (1,153 lines) & Implement Code-Splitting
- **Target File**: `App.tsx`
- **Current Responsibilities**:
  1. Static synchronous import of 31 page components (1.56 MB initial bundle)
  2. URL query parsing for Spin tokens & branch redirects
  3. Session recovery & branch login approval polling
  4. Real-time delivery notification listener & audio chime
  5. Dynamic brand styling injection
  6. 25-level nested ternary routing switch
- **Refactoring Decomposition**:
  - `AppRouter.tsx`: Dynamic `React.lazy()` imports with `Suspense` for all tabs
  - `hooks/useAppAuth.ts`: Auth initialization, branch profile resolution
  - `hooks/useDeliveryAlerts.ts`: Real-time audio alerts & unread badges
  - `hooks/useSystemMaintenance.ts`: Maintenance polling & fallbacks
- **Risk**: Medium.
- **Expected Benefit**: Drops initial bundle size by over 60%; pages load on-demand; separates concern between auth lifecycle and route rendering.
- **Preconditions**: Verify Rollup manualChunks compatibility with dynamic `import()`.
- **Validation**: `npm run build` chunk inspection; browser verification of all primary routes.
- **Rollback Strategy**: Git checkout `App.tsx`.

#### Task 4.3: Modularize Monolithic `types.ts` (2,246 lines)
- **Target File**: `types.ts`
- **Problem**: 2,246 lines of cross-domain types. Changing one type causes wide recompilation.
- **Decomposition**:
  - `types/auth.ts`: Roles, User, Profile, Permissions
  - `types/delivery.ts`: Orders, Batches, Drivers, Zones
  - `types/scheduler.ts`: Profiles, Shifts, Rules, Roster
  - `types/expenses.ts`: Petty cash, Vehicles, Odometers
  - `types/renewals.ts`: CR, NHRA, LMRA, Tariffs
  - Root `types.ts` re-exports everything for 100% backward compatibility
- **Risk**: Low (Pure type re-exports).
- **Expected Benefit**: Domain boundaries clearly enforced; faster editor TypeScript language server response.
- **Validation**: `npm run typecheck` passes with zero errors.
- **Rollback Strategy**: Git checkout `types.ts`.
