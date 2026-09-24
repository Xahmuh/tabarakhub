# Tabarak Hub Product Review & Codex Implementation Roadmap

**Prepared for:** Tabarak Hub / Operations Hub  
**Review type:** Product strategy, production readiness, security, architecture, UX, and Codex execution planning  
**Recommended current status:** **B) Dedicated-client staging-ready only**  
**Recommended commercial positioning:** **Pharmacy Operations Command Center**  
**Deployment model:** Dedicated-client / single-tenant private instance per company

---

## 1. Executive Summary

Tabarak Hub is a strong internal operations platform for pharmacy groups. It is not just a dashboard; the direction is now closer to a **Pharmacy Operations Command Center**: a system that helps management detect operational risks, convert them into tasks, track responsibility, and keep an audit trail.

The product serves pharmacy owners, operations managers, branch users, accounts teams, HR/admin teams, and purchasing/stock-control teams. It combines operational modules such as lost sales, shortages, HR workflows, cash tracking, rewards, quality feedback, corporate policies, employee contributions, and a Daily Command Center.

The product has clear commercial potential, especially under a **dedicated-client deployment model**, where every client receives a separate Supabase project, separate database, separate Auth users, separate environment config, and separate frontend deployment. This is the right commercial model for the current stage because it avoids the complexity and risk of shared multi-tenant SaaS.

However, the product should **not** be described as production-ready yet. The correct current status remains:

```text
B) dedicated-client staging-ready only
```

The next milestone should not be another feature. The next milestone should be a **real demo-client deployment validation** from scratch.

### Biggest strategic opportunity

The strongest opportunity is to position the product as the daily operating system for pharmacy groups:

> “Open the system every morning and know what is risky, who owns the next action, and what must be fixed today.”

That is more valuable than presenting many separate modules.

### Biggest risk

The biggest risk is declaring the product production-ready before validating the real deployment path: Supabase migrations, RLS/security checks, Auth users, `app_user_profiles`, `FUNCTION_SECRET`, storage policies, reward fraud controls, smoke tests, and ExcelJS risk acceptance or resolution.

---

## 2. Product Understanding

Tabarak Hub is a pharmacy operations platform for multi-branch pharmacy groups. It centralizes operational reporting, daily branch workflows, staff requests, financial exceptions, customer reward flows, quality feedback, and management decision-making.

### Primary users

| User | Main Need |
|---|---|
| Owner / Executive | See group-wide risk, branch performance, and weekly operational priorities. |
| Operations Manager | Detect shortages, lost sales, feedback issues, cash problems, and pending actions. |
| Branch User | Submit lost sales, shortages, cash differences, reward/voucher actions, and branch-level workflows. |
| Accounts | Review finance/cash differences and cash flow signals. |
| HR/Admin | Handle staff requests, documents, vacations, and policy/codex management. |
| Purchasing / Stock Controller | Use shortage/lost sales signals to decide transfers and purchase actions. |

### Core workflows

1. Branch user logs shortage or lost sale.
2. Dashboard and Command Center generate operational alerts.
3. Admin/manager creates a saved operations task.
4. Task receives owner/status/comment/event history.
5. Branch/admin updates status until resolved.
6. Management reviews branch health and pending actions.
7. Future: notifications, executive digest, reorder suggestions, and AI explanation based only on real records.

### Operational value

The value is not only “data entry.” The value is turning branch-level events into management decisions:

```text
Operational record → Alert → Task → Owner → Status → Audit trail → Decision
```

### Business model fit

The best current business model is:

```text
Dedicated Private Instance + Setup Fee + Monthly Support/Maintenance
```

This is stronger than selling the source code. The client buys a managed deployment and support, not ownership of the software.

### Dedicated-client deployment model

The correct current model is:

```text
Client A = Supabase Project A + Frontend URL A + Auth Users A
Client B = Supabase Project B + Frontend URL B + Auth Users B
```

Do **not** add shared multi-tenancy or `organization_id` at this stage.

---

## 3. Strengths

### 3.1 Product concept

The product solves a real operational problem for pharmacy groups: branch operations are usually scattered across WhatsApp, Excel, paper, POS notes, and manager memory. Tabarak Hub centralizes these signals.

### 3.2 Strong pharmacy-specific fit

The modules are not generic. They match real pharmacy operations:

- Lost sales and unavailable products.
- Shortages and stock pressure.
- Branch cash differences.
- Pharmacist/branch assignments.
- HR document/vacation workflows.
- Quality feedback.
- Branch reward/Spin & Win flows.
- Corporate policies and acknowledgments.

### 3.3 Command Center direction

The Daily Command Center is the most important product decision. It makes the product feel like a decision system, not a menu of modules.

### 3.4 Operations task workflow

The persistent task workflow is a major strength:

- `operations_tasks`
- `operations_task_events`
- Saved vs suggested actions.
- Status workflow.
- Append-only event/audit direction.
- RLS hardening documentation.

This creates operational accountability.

### 3.5 Dedicated-client architecture

Dedicated-client deployment is safer and easier to sell at this stage than shared SaaS:

- Separate client database.
- Separate storage.
- Separate users.
- Lower cross-client data leak risk.
- Easier customization.
- Stronger client trust.

### 3.6 Documentation maturity

The documentation set is unusually strong for a project at this stage. It includes deployment, security setup, production gaps, client setup, command-center design, task workflow, and manual test plans.

### 3.7 Security direction

The project has moved in the right direction:

- Supabase Auth instead of browser password checks.
- `app_user_profiles` role model.
- RLS hardening.
- No service-role key in frontend.
- Demo mode separation.
- Task workflow RLS checks.

---

## 4. Critical Risks

| Severity | Risk | Why It Matters | Recommended Action |
|---|---|---|---|
| P0 | Real deployment not validated | Product may work locally but fail during real client setup. | Create and validate a fresh demo Supabase deployment. |
| P0 | RLS/auth not tested against real roles | RLS mistakes can expose sensitive operational data. | Run post-migration and operations task security SQL plus manual role tests. |
| P0 | Reward fraud/rate limiting not fully server-side | Frontend checks can be bypassed. | Move reward fraud validation to RPC/Edge Function. |
| P1 | ExcelJS/uuid audit risk | `npm audit` fails; import/export touches files. | Formally accept, replace ExcelJS, or move Excel processing server-side. |
| P1 | No lint/test automation | Typecheck/build are not enough for regression safety. | Add ESLint and Playwright smoke tests. |
| P1 | Storage policy review required | File buckets can leak sensitive data if public. | Review Supabase Storage policies per client. |
| P1 | Demo mode/localStorage may mask failures | Production-like validation must fail loudly, not silently persist locally. | Keep `VITE_DEMO_MODE=false` for staging/production validation. |
| P2 | Frontend-computed alerts | Users may assume all alerts are persisted/server-trusted. | Keep clear labels; later move critical alert generation server-side. |
| P2 | UX complexity | Too many modules can overwhelm branch users. | Keep Command Center first; group modules by role and action. |
| P2 | Arabic encoding/localization issues | Looks unprofessional and may reduce trust. | Clean encoding artifacts and implement proper bilingual copy later. |

---

## 5. Recommended Roadmap

### Immediate: next 1-3 days

1. Perform real demo-client deployment validation.
2. Apply all migrations on a fresh Supabase project.
3. Run:
   - `docs/POST_MIGRATION_SECURITY_CHECKS.sql`
   - `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql`
4. Create demo Auth users and `app_user_profiles`.
5. Set `FUNCTION_SECRET`.
6. Deploy frontend with `VITE_DEMO_MODE=false`.
7. Run smoke tests and manual RLS tests.
8. Record issues in deployment issue template.
9. Decide ExcelJS risk status for demo.

### Short term: next 1-2 weeks

1. Add lint and Playwright smoke tests.
2. Add server-side reward fraud/rate limiting validation.
3. Review storage bucket policies.
4. Polish Command Center UX for demo presentation.
5. Add role-based onboarding/handover checklist completion.
6. Clean copy and Arabic encoding artifacts.

### Medium term: next month

1. Notifications foundation:
   - overdue tasks
   - critical task alerts
   - negative feedback alerts
   - cash variance alerts
2. Executive weekly digest foundation.
3. Reorder/purchasing suggestion engine based on repeated shortages and lost sales.
4. PWA/mobile branch mode for faster branch submissions.
5. Campaign builder and ROI tracking for Spin & Win.

### Later

1. AI Operations Copilot based strictly on real records.
2. Client onboarding wizard.
3. Deeper visual regression tests.
4. Optional future SaaS/multi-tenant version as a separate product line, not the current path.

---

## 6. Feature Recommendations

| Feature | User | Problem Solved | Business Value | Complexity | Dependencies | Risks | Build Timing |
|---|---|---|---|---|---|---|---|
| Demo Deployment Validation | Owner/dev team | Proves product can be installed for a client. | Required before selling. | Medium | Supabase project, migrations, Auth users | Deployment blockers discovered late | Now |
| ESLint + Playwright Smoke Tests | Dev team | Prevents broken releases. | Increases confidence and professionalism. | Medium | Stable flows | Test maintenance | Now |
| Server-side Reward Fraud Validation | Manager/admin | Prevents voucher abuse. | Protects campaign budget. | Medium-high | RPC/Edge Functions | Too strict rules may block real customers | Now/short-term |
| Storage Policy Review | Admin/dev | Prevents file leaks. | Essential for client trust. | Medium | Supabase Storage | Misconfigured policies | Now |
| Overdue Task Notifications | Manager/branch | Ensures tasks do not get ignored. | Converts system into daily workflow tool. | Medium | Operations tasks stable | Notification spam | Short-term |
| Executive Weekly Digest | Owner | Gives weekly summary without opening every module. | Strong executive value. | Medium | Reliable task/alert data | Wrong summaries if data incomplete | Medium-term |
| Reorder Suggestion Engine | Purchasing | Converts shortages/lost sales into purchase decisions. | Very high pharmacy value. | High | Reliable product/shortage data | Poor suggestions if stock data incomplete | Medium-term |
| PWA/Mobile Branch Mode | Branch staff | Faster branch usage on phones. | Improves adoption. | Medium | Stable workflows | UI complexity | Medium-term |
| AI Operations Copilot | Owner/manager | Explains patterns across modules. | High demo appeal. | High | Stable data/task model | Hallucination risk | Later |
| Shared Multi-Tenant SaaS | Platform owner | Lower cost at scale. | Future scalability | Very high | Tenant model, RLS redesign | Cross-client data leak | Not now |

---

## 7. What Not To Build Yet

### 7.1 Shared multi-tenancy

Do not add `organization_id`, tenant routing, or shared client database now. The dedicated-client model is the right path. Multi-tenancy should be treated as a separate future product architecture.

### 7.2 AI Copilot before deployment validation

AI will be impressive, but it should wait until the system has stable real deployment, trusted records, task workflow, and notification foundations. AI must explain real operational data only and must not invent facts.

### 7.3 Fully automatic alert persistence

Do not auto-create tasks for every computed alert yet. That can flood the system and create noise. Keep explicit admin/manager task creation until alert quality is proven.

### 7.4 Full native mobile app

Do not build a native mobile app now. Start with PWA/mobile branch mode. Branch users need fewer clicks, not a large mobile rewrite.

### 7.5 Overly broad analytics

Avoid building more charts before production validation. The product already has many modules. The next value is reliable action and follow-up, not more dashboard visuals.

---

## 8. UX And Product Design Critique

### Is Command Center the right first screen?

Yes. It should remain the first screen for admin/manager users. It answers the most important operational questions before showing the module launcher.

### Are there too many modules?

The module set is powerful but can feel overwhelming. The solution is not removing modules immediately; it is grouping them by user role and daily job:

- **Today:** Command Center, risks, pending tasks.
- **Branch Work:** POS/lost sales, shortages, cash difference, rewards.
- **Management:** Dashboard, quality, HR, workforce, cash flow.
- **Company:** Codex, settings, contributions.

### Branch user experience

Branch users should not see a complex management suite. Their experience should be fast:

1. Select branch/profile if needed.
2. Submit shortage/lost sale.
3. Submit cash difference.
4. Redeem/check voucher.
5. See assigned tasks.

### Manager experience

Managers need fewer cards and more decision density:

- Critical alerts first.
- Overdue/open tasks.
- Branch health.
- High-value lost sales.
- Cash exceptions.
- Negative feedback.

### Before launch simplifications

1. Keep Command Center as the landing screen.
2. Label saved tasks vs suggested actions clearly.
3. Use operational copy, not abstract language.
4. Clean Arabic encoding artifacts.
5. Keep demo mode visually marked if enabled.

---

## 9. Data, Security, And Architecture Critique

### Supabase Auth and `app_user_profiles`

The direction is correct. The app should continue using Supabase Auth and `app_user_profiles`. Normal users must not mutate role or branch assignment from the browser.

### RLS boundaries

RLS is the real backend security boundary. Frontend module flags are convenience only. Every sensitive table must be protected even if frontend routes are hidden.

### Dedicated-client deployment

This is the correct path. Each client gets isolated infrastructure. This lowers cross-client risk and makes commercial delivery easier.

### Service abstraction

Services should continue avoiding silent production localStorage persistence. Demo fallback must remain behind `VITE_DEMO_MODE`.

### Edge Function secrets

`FUNCTION_SECRET`, third-party API keys, and service-role keys must remain server-side only. They must never be exposed as `VITE_` variables.

### Reward fraud controls

Frontend IP/device checks are not security. Reward fraud and rate-limiting must move to trusted RPC/Edge Function validation.

### Storage policies

Storage bucket policies must be reviewed per client. Any bucket containing documents, contributions, HR docs, or attachments should be private unless intentionally public.

### Quality feedback anonymity

Anonymous feedback is sensitive. The system should avoid accidentally linking anonymous feedback to identifiable user data unless clearly intended and documented.

### Audit trails

`operations_task_events` is a strong start. It should remain append-only. Later, key admin/settings changes should also have audit events.

---

## 10. Codex Implementation Prompts

The following prompts are scoped, implementation-ready tasks for Codex. They should be created as separate Markdown files inside `docs/` and executed in order.

---

# CODEX PROMPT: 01 Demo Deployment Validation Execution Package

**Suggested filename:** `docs/CODEX_PROMPT_01_DEMO_DEPLOYMENT_VALIDATION.md`

## Objective

Prepare and execute a real demo-client deployment validation package for the dedicated-client project. This is not a feature pass. The goal is to prove that a fresh dedicated-client environment can be deployed safely from scratch.

## Context

The project is intentionally not multi-tenant. Each client gets a separate Supabase project, database, storage setup, Auth users, environment variables, and frontend deployment URL.

Current status is:

```text
B) dedicated-client staging-ready only
```

The next milestone is real demo deployment validation using `VITE_DEMO_MODE=false`.

## Files To Inspect First

- `docs/DEMO_DEPLOYMENT_VALIDATION.md`
- `docs/POST_MIGRATION_SECURITY_CHECKS.sql`
- `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql`
- `docs/DEMO_CLIENT_PROVISIONING_EXAMPLE.sql`
- `docs/CLIENT_HANDOVER_CHECKLIST.md`
- `docs/DEPLOYMENT_ISSUE_TEMPLATE.md`
- `.env.example.production`
- `config/clientConfig.ts`
- `supabase/migrations/`

## Scope

- Create or update `docs/DEMO_DEPLOYMENT_EXECUTION_LOG.md`.
- Include sections for Supabase setup, migrations, security checks, Auth users, `app_user_profiles`, `FUNCTION_SECRET`, frontend env, build, deploy URL, smoke tests, RLS tests, issues, and release decision.
- Verify existing docs have all commands and placeholders needed for an operator to execute deployment.
- Update docs only if deployment instructions are missing or ambiguous.

## Out Of Scope

- Do not implement multi-tenancy.
- Do not add `organization_id`.
- Do not modify product features unless a deployment blocker is found.
- Do not add AI.
- Do not expose secrets.

## Data And Security Notes

- Use placeholder emails only.
- Do not include real passwords.
- Service-role keys must never be placed in frontend env.
- `VITE_DEMO_MODE=false` is required for validation.
- RLS checks must be run after migration.

## Implementation Guidance

- Treat this as an operator runbook and execution log.
- Add pass/fail boxes or tables where useful.
- Include exact SQL/check files to run.
- Include a final demo validation decision section.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

If lint/test scripts exist, run them too.

## Acceptance Criteria

- Demo deployment execution log exists.
- Operator can follow docs from fresh Supabase project to staging deploy.
- Security checks are explicitly referenced.
- No real secrets or passwords are added.
- Final status remains `B) dedicated-client staging-ready only` until real deployment passes.

---

# CODEX PROMPT: 02 Add ESLint And Playwright Smoke Tests

**Suggested filename:** `docs/CODEX_PROMPT_02_LINT_AND_SMOKE_TESTS.md`

## Objective

Add minimal professional quality gates: ESLint and Playwright smoke tests for the most important flows.

## Context

The project currently has `dev`, `build`, `typecheck`, and `preview` scripts only. There is no lint script and no automated smoke test suite. Typecheck/build passing is not enough for production confidence.

## Files To Inspect First

- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `App.tsx`
- `app/command-center/`
- `app/login/page.tsx`
- `services/authService.ts`
- `docs/SMOKE_TEST_PLAN.md`

## Scope

- Add ESLint configuration compatible with React 19, TypeScript, and Vite.
- Add `npm run lint`.
- Add Playwright setup.
- Add smoke tests for:
  - login page renders
  - unauthenticated user is blocked/redirected where applicable
  - main dashboard/suite shell renders
  - Daily Command Center renders
  - module launcher renders
  - no obvious frontend secret strings appear in built assets where practical
- Add documentation for running smoke tests locally.

## Out Of Scope

- Do not create fake tests that always pass.
- Do not require a real production Supabase project for basic UI smoke tests.
- Do not weaken auth/RLS.
- Do not rewrite routing.

## Data And Security Notes

- Tests must not use real client credentials.
- Use mock/demo-safe testing patterns only.
- Do not commit secrets.

## Implementation Guidance

- Prefer a minimal test set that can run reliably.
- If Supabase-dependent flows cannot run without credentials, document them as manual tests rather than faking them.
- Keep lint rules practical and avoid massive formatting churn.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm run lint
npm test
npm audit --audit-level=moderate
npm ls --depth=0
```

## Acceptance Criteria

- `npm run lint` exists and passes.
- `npm test` or `npm run test:e2e` exists and runs smoke tests.
- Typecheck and build still pass.
- No real secrets are introduced.
- Existing ExcelJS audit risk is not falsely marked as fixed.

---

# CODEX PROMPT: 03 Server-Side Reward Fraud Validation

**Suggested filename:** `docs/CODEX_PROMPT_03_REWARD_FRAUD_SERVER_VALIDATION.md`

## Objective

Move reward fraud/rate-limiting controls into trusted Supabase RPC or Edge Function logic. Frontend IP/device checks must not be treated as production security.

## Context

Spin & Win uses secure token validation and reward flow tables, but production fraud controls must be server-side. Browser IP lookup or frontend-only rate limiting is demo-only.

## Files To Inspect First

- `app/spin-win/CustomerFlow.tsx`
- `app/spin-win/SpinWinHub.tsx`
- `services/spinWin.ts`
- `supabase/migrations/`
- Supabase RPC references:
  - `generate_spin_session`
  - `validate_spin_token`
  - `execute_spin_transaction`
- `docs/PRODUCTION_GAPS.md`
- `docs/ACCEPTED_SECURITY_RISKS.md`

## Scope

- Inspect current reward token/session/spin/voucher flow.
- Add or update server-side RPC/Edge Function validation for:
  - token validity
  - single-use or controlled-use tokens
  - daily customer limit
  - repeated customer/device/phone/email pattern where available
  - stale token/session handling
  - voucher redemption validation
- Ensure frontend calls trusted backend validation only.
- Keep frontend IP lookup demo-only or remove it from production path.
- Add docs explaining fraud/rate-limiting rules.

## Out Of Scope

- Do not add third-party paid fraud service.
- Do not add AI.
- Do not block legitimate customers aggressively without clear rules.
- Do not expose service-role key in frontend.

## Data And Security Notes

- Fraud validation must run in trusted database/RPC/Edge Function context.
- Any service-role use must be server-side only.
- RLS must still protect reward tables.
- Client-side checks are UX hints only, not security.

## Implementation Guidance

- Prefer simple clear rules first.
- Add clear error messages for blocked/expired/used tokens.
- Log suspicious attempts if a suitable table exists; otherwise document future audit log table.
- Avoid collecting unnecessary personal data.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Manual checks:

- Fresh valid token works.
- Expired/invalid token fails.
- Reused voucher/token fails where intended.
- Daily limit is enforced server-side.
- Frontend cannot bypass by editing localStorage/browser state.

## Acceptance Criteria

- Production reward validation is server-side.
- Frontend IP lookup is not a trusted production control.
- No secrets are exposed.
- Docs updated.
- Typecheck/build pass.

---

# CODEX PROMPT: 04 Storage Bucket Policy Review

**Suggested filename:** `docs/CODEX_PROMPT_04_STORAGE_POLICY_REVIEW.md`

## Objective

Review and harden Supabase Storage policies for all client-deployed buckets, especially contributions, documents, HR files, attachments, and exported files.

## Context

The product uses Supabase Storage for employee contributions and may use files for HR, documents, attachments, policies, or exports. Storage policy review is required per client before production.

## Files To Inspect First

- `services/`
- `app/employee-contributions/` or related contribution module paths
- `supabase/migrations/`
- `docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md`
- `docs/PRODUCTION_GAPS.md`
- Any file upload/download code

## Scope

- Inventory all storage buckets referenced by the app.
- Identify which buckets must be private vs public.
- Add or update migration/policy docs for bucket access.
- Ensure anon cannot read private files.
- Ensure branch users cannot access unauthorized files.
- Ensure upload restrictions are documented.
- Add storage policy verification SQL/checklist if possible.

## Out Of Scope

- Do not move files to a new storage provider.
- Do not make private files public for convenience.
- Do not expose service-role key.

## Data And Security Notes

- HR documents and operational attachments should be private by default.
- Public assets should be explicitly separated from private documents.
- Signed URLs should be used where appropriate.

## Implementation Guidance

- If exact policies cannot be fully automated, create a per-client checklist.
- Keep docs explicit about which buckets are allowed public.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Manual checks:

- Anon cannot read private files.
- Branch user cannot read unrelated files.
- Admin/manager can access intended files.
- Public files, if any, are intentionally public.

## Acceptance Criteria

- Storage bucket inventory exists.
- Private/public policy expectations are documented.
- Security checklist updated.
- No secrets exposed.

---

# CODEX PROMPT: 05 Command Center UX Polish For Sales Demo

**Suggested filename:** `docs/CODEX_PROMPT_05_COMMAND_CENTER_UX_POLISH.md`

## Objective

Polish the Daily Command Center UX for a sales/demo environment without redesigning the entire app.

## Context

The Command Center is now the correct first-screen concept. It should be easy for managers to scan and understand: risks, saved tasks, suggested actions, branch health, and pending items.

## Files To Inspect First

- `app/command-center/DailyCommandCenter.tsx`
- `app/command-center/types.ts`
- `app/command-center/useCommandCenterSummary.ts`
- `app/suite/SuitePage.tsx`
- `config/clientConfig.ts`
- `docs/COMMAND_CENTER_DESIGN.md`

## Scope

- Improve scanability of Today’s Risks, Saved Tasks, Suggested Actions, and Branch Health.
- Ensure saved tasks and suggested actions are visually distinct.
- Make owner/status/priority visible but not noisy.
- Add concise empty states.
- Use operational copy instead of abstract labels.
- Keep module launcher below Command Center.
- Respect module flags.

## Out Of Scope

- Do not add AI.
- Do not add new database tables.
- Do not implement notifications.
- Do not perform a full design-system rewrite.

## Data And Security Notes

- Do not add fake production data.
- Demo-only sample content must be gated behind demo mode.
- UI visibility is not security; do not weaken RLS.

## Implementation Guidance

- Prefer compact cards/tables over huge cards.
- Make critical/high risks prominent.
- Add module-level links only when safe.
- Keep branch users focused on assigned/branch-scoped work.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Manual checks:

- Admin/manager can scan risks quickly.
- Branch user sees only relevant action/task UI.
- Empty states are honest.
- Suggested actions are not implied to be saved.

## Acceptance Criteria

- Command Center is clearer and more demo-ready.
- No fake production data.
- Typecheck/build pass.
- Dedicated-client model preserved.

---

# CODEX PROMPT: 06 ExcelJS Risk Decision And Safer Excel Path

**Suggested filename:** `docs/CODEX_PROMPT_06_EXCELJS_RISK_DECISION.md`

## Objective

Resolve or formally document the remaining `exceljs -> uuid` audit risk and prepare a safer path for Excel import/export.

## Context

`npm audit --audit-level=moderate` fails because `exceljs@4.4.0` depends on a vulnerable `uuid` path. There is no safe automatic fix currently. Excel import/export is useful but must be controlled.

## Files To Inspect First

- `package.json`
- `package-lock.json`
- `utils/excelUtils.ts`
- Product import/export components
- `docs/ACCEPTED_SECURITY_RISKS.md`
- `docs/PRODUCTION_GAPS.md`

## Scope

Choose one safe path:

A. Keep ExcelJS temporarily and document formal accepted risk.
B. Replace ExcelJS with a safer maintained alternative if feasible without breaking features.
C. Move risky Excel processing server-side or prepare implementation plan if too large.

Also verify:

- Only trusted roles can import `.xlsx`.
- File size guard remains.
- Errors are clear.
- Audit status is not falsely marked clean.

## Out Of Scope

- Do not remove Excel functionality without replacement unless explicitly documented.
- Do not use unsafe dependency overrides blindly.
- Do not claim audit passes if it does not.

## Data And Security Notes

- Imported Excel files are untrusted input.
- Manager/admin-only access should be enforced by RLS and UI.
- Server-side parsing is safer long-term.

## Implementation Guidance

- If replacing ExcelJS is too risky, improve docs and acceptance process.
- If using an alternative, preserve current export/import behavior.
- Keep bundle size in mind.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Manual checks:

- Export still works.
- Import still respects size guard.
- Unauthorized users cannot import.
- Audit status is accurately documented.

## Acceptance Criteria

- ExcelJS risk has a clear decision.
- Docs updated.
- No false claim that audit is clean.
- Typecheck/build pass.

---

# CODEX PROMPT: 07 PWA Mobile Branch Mode Foundation

**Suggested filename:** `docs/CODEX_PROMPT_07_PWA_MOBILE_BRANCH_MODE.md`

## Objective

Create a lightweight mobile-first branch mode/PWA foundation for branch users without building a native mobile app.

## Context

Branch users need fewer clicks and faster workflows on phone/tablet: lost sale, shortage, cash difference, voucher/reward actions, and assigned tasks.

## Files To Inspect First

- `App.tsx`
- `app/suite/SuitePage.tsx`
- `app/command-center/DailyCommandCenter.tsx`
- POS/lost sales module files
- Cash difference module files
- Spin & Win branch files
- `config/clientConfig.ts`

## Scope

- Add a branch-focused mobile entry experience when role is `branch`.
- Prioritize quick actions:
  - log shortage/lost sale
  - submit cash difference
  - view own branch tasks
  - reward/voucher flow shortcuts
- Improve responsive layout for branch workflows.
- Add PWA manifest/service worker only if safe and minimal.

## Out Of Scope

- Do not build native app.
- Do not add push notifications yet.
- Do not add offline production persistence unless designed safely.
- Do not weaken RLS.

## Data And Security Notes

- Branch users must remain branch-scoped.
- LocalStorage drafts are not production persistence.
- Demo mode fallback must remain gated.

## Implementation Guidance

- Keep admin/manager desktop experience intact.
- Prefer role-based layout simplification.
- Use clientConfig/module flags.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Manual checks:

- Branch user sees quick actions.
- Admin/manager UI is not broken.
- Mobile viewport is usable.
- Branch user cannot access other branch data.

## Acceptance Criteria

- Branch mode is faster and clearer.
- No native app complexity.
- No fake offline persistence.
- Typecheck/build pass.

---

# CODEX PROMPT: 08 Notifications Foundation For Operations Tasks

**Suggested filename:** `docs/CODEX_PROMPT_08_TASK_NOTIFICATIONS_FOUNDATION.md`

## Objective

Create a safe notification foundation for operations tasks without sending real WhatsApp/email/push messages yet.

## Context

Now that operations tasks exist, the next product step is overdue/critical task notifications. The foundation should produce trusted notification payloads and scheduling rules before integrating channels.

## Files To Inspect First

- `app/command-center/operationsTaskService.ts`
- `app/command-center/types.ts`
- `supabase/migrations/20260612062000_operations_tasks_workflow.sql`
- `supabase/functions/`
- `docs/OPERATIONS_TASK_WORKFLOW.md`
- `docs/PRODUCT_ROADMAP.md`

## Scope

- Add computed notification candidates for:
  - overdue tasks
  - critical open tasks
  - stuck in-progress tasks
  - unresolved cash/feedback/HR-related tasks
- Create typed notification payload model.
- Add docs for future channels: email, WhatsApp, push.
- Do not send real messages yet unless explicitly configured.
- Optionally create a database table for notification log only if needed and safe.

## Out Of Scope

- Do not integrate WhatsApp provider yet.
- Do not send production notifications.
- Do not add AI summaries.
- Do not spam users.

## Data And Security Notes

- Notifications must not expose sensitive data to unauthorized users.
- Future scheduled functions should require `FUNCTION_SECRET`.
- Notification logs must respect RLS if stored.

## Implementation Guidance

- Start with preview/dry-run mode.
- Show notification candidates to admin/manager only.
- Keep rules explainable.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Manual checks:

- Overdue task candidate appears.
- No real notification is sent.
- Branch users do not see unauthorized data.

## Acceptance Criteria

- Notification foundation exists.
- No real messages are sent by default.
- Rules are documented.
- Typecheck/build pass.

---

# CODEX PROMPT: 09 Policy Acknowledgement And Training Checks

**Suggested filename:** `docs/CODEX_PROMPT_09_CODEX_ACKNOWLEDGEMENT_TRAINING.md`

## Objective

Enhance Corporate Codex from a static policy library into an accountability tool with acknowledgments and optional mini training checks.

## Context

Corporate Codex currently stores policies/circulars and acknowledgments. A stronger commercial feature is requiring staff to acknowledge policies and optionally answer simple training questions.

## Files To Inspect First

- Corporate Codex module files
- `services/codexService.ts`
- `types.ts`
- `supabase/migrations/`
- `docs/PRODUCT_ROADMAP.md`

## Scope

- Review existing `corporate_codex` and `corporate_codex_acknowledgments` behavior.
- Add or refine acknowledgment workflow.
- Add optional mini-quiz/training-check design if safe.
- Add manager/admin visibility of acknowledgment status.
- Add branch/user scoping where relevant.

## Out Of Scope

- Do not add complex LMS features.
- Do not add AI-generated quizzes yet.
- Do not weaken RLS.

## Data And Security Notes

- Acknowledgments should be auditable.
- Branch users should not forge other users’ acknowledgments.
- Admin/manager views must respect role permissions.

## Implementation Guidance

- Keep workflow simple: read → acknowledge → optional questions → record timestamp.
- Make pending acknowledgments visible in Command Center later.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Manual checks:

- User can acknowledge assigned policy.
- User cannot acknowledge for another user.
- Admin can see completion status.
- RLS protects records.

## Acceptance Criteria

- Policy acknowledgment workflow is clearer.
- Auditability improved.
- Typecheck/build pass.

---

# CODEX PROMPT: 10 Reorder Suggestion Engine Foundation

**Suggested filename:** `docs/CODEX_PROMPT_10_REORDER_ENGINE_FOUNDATION.md`

## Objective

Create the foundation for a purchasing/reorder suggestion engine based on repeated shortages and lost sales, without automatically creating purchase orders.

## Context

Pharmacy groups lose revenue when fast-moving products are unavailable. The product already captures lost sales and shortages. The next high-value purchasing feature is to convert repeated signals into suggested reorder actions.

## Files To Inspect First

- Lost sales service/module files
- Shortage service/module files
- Product management files
- `app/command-center/alertGenerators.ts`
- `app/command-center/types.ts`
- Dashboard analytics files

## Scope

- Add computed reorder suggestions based on:
  - repeated shortage for same product
  - high lost sales value
  - branch pressure
  - agent/category grouping where available
- Show suggestions in a manager/purchasing view or Command Center section.
- Include suggested action, affected branches, product, value impact, and confidence label.
- Do not auto-create purchase orders.

## Out Of Scope

- Do not integrate supplier ordering.
- Do not add AI.
- Do not claim exact demand forecasting.
- Do not use fake production data.

## Data And Security Notes

- Suggestions must be based on real records.
- Branch users should not see cross-branch purchasing analytics unless allowed.
- RLS remains the backend boundary.

## Implementation Guidance

- Keep scoring explainable.
- Use “suggestion” language, not automatic decision.
- Add empty states for insufficient data.

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

Manual checks:

- Repeated shortage creates suggestion.
- High-value lost sales increases priority.
- No fake suggestions in production.
- Suggestions respect role visibility.

## Acceptance Criteria

- Reorder suggestion foundation exists.
- Suggestions are explainable and real-data based.
- No automatic purchase order creation.
- Typecheck/build pass.

---

## 11. Recommended Execution Order

Use this sequence:

1. `CODEX_PROMPT_01_DEMO_DEPLOYMENT_VALIDATION`
2. `CODEX_PROMPT_02_LINT_AND_SMOKE_TESTS`
3. `CODEX_PROMPT_03_REWARD_FRAUD_SERVER_VALIDATION`
4. `CODEX_PROMPT_04_STORAGE_POLICY_REVIEW`
5. `CODEX_PROMPT_05_COMMAND_CENTER_UX_POLISH`
6. `CODEX_PROMPT_06_EXCELJS_RISK_DECISION`
7. `CODEX_PROMPT_08_TASK_NOTIFICATIONS_FOUNDATION`
8. `CODEX_PROMPT_07_PWA_MOBILE_BRANCH_MODE`
9. `CODEX_PROMPT_09_CODEX_ACKNOWLEDGEMENT_TRAINING`
10. `CODEX_PROMPT_10_REORDER_ENGINE_FOUNDATION`

Do not start AI Copilot until at least prompts 1-6 are complete and a real demo deployment has passed.

---

## 12. Final Recommendation

Tabarak Hub is worth continuing. The concept is strong and commercially meaningful. The product should be sold as a **dedicated private operations hub for pharmacy groups**, not as a shared SaaS product yet.

The product is not production-ready today, but it is much closer than before. The next step is not more features; it is proving real deployment repeatability and hardening the product delivery process.

The strongest launch positioning is:

> “A private Pharmacy Operations Command Center that detects daily risks, turns them into tasks, tracks ownership, and gives management a clear view of branch health.”

If the demo-client deployment passes, the project can move from “staging-ready” to “pilot-client ready.”

