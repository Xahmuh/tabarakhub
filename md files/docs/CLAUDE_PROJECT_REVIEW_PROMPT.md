# Claude Project Review Prompt For Tabarak Hub

Copy this entire prompt into Claude.

## Role

You are Claude, acting as a senior product strategist, CTO advisor, pharmacy operations consultant, security reviewer, and pragmatic software architect.

Review the project described below and give professional insights and recommendations. The project owner wants to know how strong the product is, what must be improved before production, what features are worth adding, what should not be built yet, and what can be handed to Codex for implementation.

## Very Important Workflow Instruction

Your response is not meant to directly modify the codebase.

If you recommend any buildable feature, fix, refactor, or production-hardening work, write it as an implementation-ready Markdown prompt for Codex.

Codex will receive those Markdown prompts and implement them. Therefore:

- Write implementation prompts as instructions to Codex, not to Claude.
- Make each Codex prompt scoped, concrete, and testable.
- Include objective, context, files to inspect, implementation scope, out-of-scope items, security notes, data/RLS notes, verification steps, and acceptance criteria.
- Do not produce vague prompts like "improve dashboard". Convert recommendations into specific tasks Codex can execute.
- If multiple features are recommended, produce one separate Codex prompt per feature or milestone.
- Use filenames such as `docs/CODEX_PROMPT_01_PRODUCTION_READINESS.md`.
- Respect all project constraints below.

## Project Summary

The project is `Tabarak Hub`, also configurable as a client-branded `Operations Hub`.

It is a dedicated-client internal operations platform for pharmacy groups, currently focused on Tabarak Pharmacy Group in Bahrain using BHD currency. It combines branch operations, lost sales tracking, shortage logging, dashboards, HR workflows, cash tracking, customer rewards, quality feedback, company policies, and operational command-center workflows.

This is not a shared multi-tenant SaaS product. The intended commercial deployment model is:

- One separate Supabase project per client.
- One separate frontend deployment URL per client.
- One separate Auth user set per client.
- One separate database, storage setup, environment config, and branding config per client.
- No shared `organization_id`, tenant routing, or cross-client shared data model.

Do not recommend adding multi-tenancy unless you clearly describe it as a separate future product model, not as the current implementation path.

## Current Release State

Current status from the repo docs:

```text
B) dedicated-client staging-ready only
```

Do not describe the project as production-ready yet.

Production cannot be claimed until:

- All migrations are applied to a real dedicated-client Supabase project.
- Supabase Auth users are provisioned.
- `app_user_profiles` rows are provisioned for admin, manager, accounts, and branch users.
- `FUNCTION_SECRET` is configured in Supabase Edge Function secrets.
- `docs/POST_MIGRATION_SECURITY_CHECKS.sql` passes.
- `docs/OPERATIONS_TASK_SECURITY_CHECKS.sql` passes.
- Manual RLS/auth tests pass.
- Operations task manual tests pass.
- Manual smoke tests pass on the real deployment URL.
- No frontend secrets are exposed.
- ExcelJS/uuid npm audit risk is resolved or formally accepted.
- Storage bucket policies are reviewed per client.
- Server-side reward fraud/rate limiting is validated.

The next required milestone is a real demo-client deployment validation from scratch.

## Tech Stack

Frontend:

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 3
- Lucide React icons
- Recharts
- SweetAlert2
- QR code generation through `qrcode.react`
- Document generation through `docx`
- Excel import/export through `exceljs`
- File download through `file-saver`
- HTML image export through `html-to-image`
- PDF parsing through `pdfjs-dist`

Backend/platform:

- Supabase Auth
- Supabase Postgres
- Supabase RLS
- Supabase Storage
- Supabase Edge Functions
- Supabase RPC functions for secure reward flows

Build scripts:

```json
{
  "dev": "vite --host",
  "build": "vite build",
  "typecheck": "tsc --noEmit",
  "preview": "vite preview"
}
```

Important gap: there is no lint script and no automated test suite beyond typecheck/build style verification.

## Codebase Shape

Key files and folders:

```text
App.tsx
types.ts
config/clientConfig.ts
lib/supabaseClient.ts
lib/supabase.ts
services/
app/
app/command-center/
app/modules/quality-feedback/
supabase/migrations/
supabase/functions/
db/migrations/
docs/
public/
```

The current app uses `App.tsx` as the main app shell and state-based router. It does not appear to use React Router. The app switches between internal tabs such as dashboard, POS, HR, cash flow, reward hub, settings, feedback, and command center.

Special URL behavior:

- `?token=...` opens the customer reward flow.
- Legacy static branch QR links using `?node=` or `?branch=` are blocked and ask for a fresh secure QR.
- `/bh_analyzer` or `?bh_analyzer=1` opens the block coverage analyzer.

## Client Configuration

`config/clientConfig.ts` reads safe frontend `VITE_` variables:

- App/client name
- Logo URL
- Brand colors
- Support email
- Locale, currency, country
- Environment label
- `VITE_DEMO_MODE`
- Per-module enable/disable flags

Modules can be enabled/disabled by env:

```text
VITE_MODULE_HR
VITE_MODULE_QUALITY_FEEDBACK
VITE_MODULE_REPORTS
VITE_MODULE_EXCEL_EXPORT
VITE_MODULE_BRANCH_DASHBOARD
VITE_MODULE_MANAGER_DASHBOARD
VITE_MODULE_ADMIN_DASHBOARD
VITE_MODULE_PRODUCTS
VITE_MODULE_SALES
VITE_MODULE_SPIN_WIN
VITE_MODULE_CASH_FLOW
VITE_MODULE_CASH_TRACKER
VITE_MODULE_CORPORATE_CODEX
VITE_MODULE_EMPLOYEE_CONTRIBUTIONS
VITE_MODULE_SETTINGS
VITE_MODULE_WORKFORCE
```

Important: module flags hide/block frontend modules but do not replace Supabase RLS.

`VITE_DEMO_MODE=false` is required for staging and production validation. Demo mode can use localStorage fallbacks only for isolated demos, not production-like validation.

## Auth And Roles

Auth now uses Supabase Auth plus `public.app_user_profiles`.

Roles:

```text
admin
manager
accounts
branch
```

Role meanings:

- `admin`: full operational access; should be the trusted provisioning role.
- `manager`: cross-branch operations and management access, but should not mutate app roles from the browser.
- `accounts`: read-oriented cross-branch finance/cash data where allowed.
- `branch`: branch-scoped operational user.

The login screen accepts either an email or a code. If the user enters a code without `@`, the app maps it to:

```text
<lowercase-code>@tabarak.local
```

Production guidance:

- Do not store branch passwords in public tables.
- Do not expose service-role keys to the frontend.
- Provision users through Supabase Auth and trusted SQL/service-role tooling.
- Normal users must not be able to mutate `app_user_profiles`.

## Core Product Modules

### 1. Daily Command Center

Purpose: turn the app from a module launcher into an operational cockpit.

It answers:

```text
What is risky today?
Which branch needs attention?
What actions are pending?
Who owns each action?
What should be done next?
```

Computed signal sources:

- Shortages
- Lost sales
- Cash differences
- HR requests
- Quality feedback
- Spin & Win reward activity
- Branch list for health grouping

Current behavior:

- Operational alerts are computed in the frontend from real enabled-module data.
- The UI shows warnings if a source cannot be fetched.
- It must not invent fake production alerts.
- Today's Risks, Pending Actions, Branch Health, and Pending Items are shown on the landing page.
- Suggested actions from alerts are not persisted until an admin/manager explicitly chooses `Create task`.

Persistent workflow:

- `operations_tasks`
- `operations_task_events`

Saved task lifecycle:

```text
open -> in_progress -> resolved
open -> dismissed
in_progress -> dismissed
```

Security boundary:

- Admin/manager can create and update tasks.
- Accounts can read all where allowed, but cannot write.
- Branch users can read branch-scoped tasks and update/comment own-branch tasks where RLS allows.
- Anon has no access.
- Events are append-only from the client.

Known gap: alerts are still computed, not server-persisted automatically.

### 2. Lost Sales And Shortage POS

Branch staff select a pharmacist, then log:

- Lost sales
- Shortage reports

Features:

- Product search
- Barcode scanning
- Manual product entry
- Cart-style entry
- Draft persistence in localStorage
- Lost-sale fields such as unit price, quantity, total value, notes, agent, category, internal code
- Alternative suggested flag
- Internal transfer flag
- Shortage statuses: `Low`, `Critical`, `Out of Stock`
- Submitting a lost sale can auto-create/update a shortage record
- Branch/pharmacist identity attached to records

Important production rule: localStorage fallback must not silently persist real operational records unless demo mode is enabled.

### 3. Performance Dashboard

Dashboard features:

- Lost sales analytics
- Shortage analytics
- Date filters: today, yesterday, 7 days, month, custom, all
- Branch filters for admin/manager
- KPI cards
- Revenue leakage analysis
- Pareto/80-20 analysis
- Temporal risk heatmap
- Daily performance calendar
- Operational trend matrix
- Pharmacist activity
- Product management section
- Excel export/import where enabled

Known risk:

- `exceljs@4.4.0` currently has a moderate npm audit risk through `uuid`.
- Excel upload/import should remain restricted to trusted manager/admin users until fixed or accepted.

### 4. Spin & Win Reward System

Customer reward and branch marketing module.

Features:

- Branch QR token generation
- Secure token validation through Supabase RPC
- Customer registration
- Spin wheel prize assignment
- Voucher creation
- Voucher redemption
- Branch dashboard
- Manager dashboard
- Prize management
- Customer and branch review tracking
- Voucher sharing log

Tables include:

- `spin_prizes`
- `spin_sessions`
- `customers`
- `spins`
- `branch_reviews`
- `voucher_shares`

Important production boundary:

- Fraud/rate limiting must run server-side through trusted RPC or Edge Function.
- Browser IP lookup or frontend-only rate limiting is demo-only and not trusted.
- Customer flow must still work without relying on third-party frontend IP lookup services.

### 5. HR Self-Service And HR Admin

Features:

- Employee document requests
- Vacation requests
- Admin review and status changes
- Document generation using `docx`
- Certificate templates such as experience, employment, and salary certificates
- NHRA/pharmacy license and CR mapping helpers

Tables include:

- `hr_requests`

### 6. Workforce And Relief Calculator

Manager planning tool for pharmacy staffing.

Features:

- Region configuration
- 24h branch shift demand
- Regular branch shift demand
- Public holiday toggle
- Ramadan impact toggle
- Annual leave toggle
- Current headcount input
- Leave-cycle month target
- Required pharmacists/FTE calculation
- Relief force size
- Staffing gap and recommended leave cycle

### 7. Cash Flow Planner

Finance planning and liquidity module.

Features:

- Suppliers
- Cheques
- Expenses
- Actual revenues
- Expected revenues
- Cash flow settings
- Forecast horizon
- Safe threshold
- Risk levels

Tables include:

- `suppliers`
- `cheques`
- `expenses`
- `revenues_actual`
- `revenues_expected`
- `cash_flow_settings`

### 8. Branch Cash Difference Tracker

Branch/accounting workflow for daily cash variance.

Features:

- System cash vs actual cash
- Difference type: increase or shortage
- Reason, invoice evidence, invoice reference
- Status: open, reviewed, closed
- Manager comment
- Branch scoping

Tables include:

- `cash_differences`

### 9. Corporate Codex

Internal policy/circular library.

Features:

- Corporate circulars and policies
- Priority levels
- Published/pinned status
- Departments/tags
- Page attachments or URLs
- Acknowledgments

Tables include:

- `corporate_codex`
- `corporate_codex_acknowledgments`

Future idea already noted in repo docs: policy acknowledgments and training checks.

### 10. Project Settings And Permissions

Manager/admin settings area.

Features:

- Branch management
- Pharmacist management
- Pharmacist-to-branch assignments
- Feature permissions per branch

Tables include:

- `branches`
- `pharmacists`
- `pharmacist_branches`
- `feature_permissions`
- `app_user_profiles`

Important: client-side settings must not allow role escalation or unsafe profile changes.

### 11. Quality Feedback Module

Anonymous quality feedback and analytics module.

Features:

- Feedback form
- Thank-you page
- Admin dashboard
- Dynamic questions
- Module settings
- Anonymity guard
- Dashboard analytics
- Trends
- Heatmaps
- Bar comparisons
- Experience breakdown
- Comments table
- AI insights panel
- Correlation charts
- Data export

Tables include:

- `feedback_responses`
- `quality_feedback_questions`
- `quality_feedback_settings`
- `branch_sales_data`
- `branch_hr_turnover`

Edge Functions:

- `analyze-sentiment`: uses Anthropic/Claude API, allowed for admin/manager authenticated profiles.
- `generate-monthly-report`: protected with `x-function-secret`.
- `notify-negative-trend`: protected with `x-function-secret`.

Required Edge Function secrets:

- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FUNCTION_SECRET` for protected functions

Important: service-role and third-party secrets must never be exposed to frontend `VITE_` env variables.

### 12. Employee Contributions

Internal knowledge-sharing hub.

Features:

- Shared tools, projects, links, training, SOPs, dashboards, automations, AI prompts
- Search and type filters
- Pinned resources
- Archive/delete
- File upload/download through Supabase Storage

Tables/storage include:

- `employee_contributions`
- `contributions` storage bucket

Known production check: storage bucket policies must be reviewed per client.

### 13. Block Coverage Analyzer

Standalone analyzer entry exposed through `/bh_analyzer` or query param.

It appears to be a specialized tool for Bahrain/block coverage analysis. Review whether this belongs in the same product, should be module-gated, or should be split/deployed separately.

## Data Tables And Backend Surface

Known tables or views referenced by the app:

```text
app_user_profiles
branches
pharmacists
pharmacist_branches
feature_permissions
products
manual_products
lost_sales
shortages
lost_sales_excel_export
shortages_excel_export
hr_requests
suppliers
cheques
expenses
revenues_actual
revenues_expected
cash_flow_settings
cash_differences
corporate_codex
corporate_codex_acknowledgments
spin_prizes
spin_sessions
customers
spins
branch_reviews
voucher_shares
feedback_responses
quality_feedback_questions
quality_feedback_settings
branch_sales_data
branch_hr_turnover
operations_tasks
operations_task_events
employee_contributions
```

Known RPC/function behavior:

- `generate_spin_session`
- `validate_spin_token`
- `execute_spin_transaction`
- Sentiment/report/negative-trend Edge Functions

## Important Documentation Already In Repo

Relevant docs:

```text
docs/PRODUCT_ROADMAP.md
docs/RELEASE_READINESS_STATUS.md
docs/PRODUCTION_GAPS.md
docs/PRODUCTION_SECURITY_SETUP.md
docs/NEW_CLIENT_SETUP.md
docs/CLIENT_DEPLOYMENT_RUNBOOK.md
docs/CLIENT_CUSTOMIZATION_GUIDE.md
docs/SMOKE_TEST_PLAN.md
docs/COMMAND_CENTER_DESIGN.md
docs/OPERATIONS_TASK_WORKFLOW.md
docs/OPERATIONS_TASK_SECURITY_CHECKS.sql
docs/OPERATIONS_TASK_MANUAL_TESTS.md
docs/POST_MIGRATION_SECURITY_CHECKS.sql
docs/CLIENT_SECURITY_ACCEPTANCE_CHECKLIST.md
docs/ACCEPTED_SECURITY_RISKS.md
```

## Existing Roadmap From Repo

Week 1 production readiness:

- Keep TypeScript green.
- Separate demo mode from production mode with `VITE_DEMO_MODE`.
- Stop silent localStorage fallback for production operational records.
- Remove or isolate mock dashboard insights.
- Document smoke tests for login, dashboard, POS, feedback, spin flow, scoping, and unauthenticated blocking.
- Track ExcelJS/uuid audit risk until resolved or formally accepted.

Weeks 2-3 Daily Command Center:

- Expand unified operational alerts.
- Add richer action queue with owner, status, due date, source module.
- Improve branch health scoring with weighted signals.
- Add drill-downs from risks to exact module state.
- Keep module launcher below the operational summary.

Month 2 intelligence and automation:

- Persistent task/incident workflow with owner, status, due date, comments, audit trail, source record links.
- Server-side fraud validation for reward tokens, daily customer limits, and voucher redemption.
- Notifications for cash alerts, negative feedback trends, stuck HR requests, and reward fraud signals.
- Executive weekly digest.
- Reorder engine that converts repeated shortages into purchasing suggestions.
- AI Operations Copilot later, after the alert/task model is stable.

Later:

- Client onboarding wizard.
- PWA/mobile branch mode.
- Spin & Win campaign ROI reporting.
- Policy acknowledgments and training checks.
- Deeper automated regression and visual smoke tests.

## Known Risks And Gaps To Consider

Please analyze these carefully and prioritize them:

- The product is staging-ready only, not production-ready.
- Real dedicated-client Supabase deployment validation still needs to happen.
- Manual RLS/auth checks are required for admin, manager, accounts, and branch users.
- Operations task RLS/security/manual tests are required.
- ExcelJS/uuid audit risk remains open.
- No lint setup exists.
- Automated tests are thin or absent.
- Production reward fraud controls must run server-side.
- Frontend IP/device checks are not trusted security controls.
- `FUNCTION_SECRET` must be set per client.
- Storage bucket policies must be reviewed.
- Demo mode/localStorage fallback must not mask production failures.
- Some dashboard and workforce UI text appears to contain encoding artifacts in Arabic text. Recommend whether this should be cleaned, removed, localized properly, or guarded.
- Some modules may be too broad for first commercial release; recommend sequencing.
- Command Center alerts are computed in the frontend, while only tasks/events are persisted.
- AI features should not invent operational facts; they should explain real records only.

## What I Want From You

Please produce a professional review with the following sections.

### 1. Executive Summary

Give a concise, honest assessment of the product:

- What it is.
- Who it serves.
- Whether it has commercial potential.
- Whether it is currently demo-ready, staging-ready, or production-ready.
- The biggest strategic opportunity.
- The biggest risk.

### 2. Product Understanding

Describe the product in your own words to prove you understand it.

Include:

- Primary users
- Core workflows
- Operational value
- Business model fit
- Dedicated-client deployment model

### 3. Strengths

Identify the strongest parts of the project:

- Product concept
- Operational fit
- Existing modules
- Data model
- UX/workflow ideas
- Documentation
- Security direction

### 4. Critical Risks

Prioritize risks by severity:

- Security/RLS
- Production readiness
- Data trust
- Architecture
- UX complexity
- Maintainability
- Testing
- Compliance/privacy
- Deployment operations

Use a table if helpful.

### 5. Recommended Roadmap

Give a practical roadmap:

- Immediate: next 1-3 days
- Short term: next 1-2 weeks
- Medium term: next month
- Later

Prioritize what makes the product sellable and safe.

### 6. Feature Recommendations

Recommend additional features only if they are worth building.

For each feature, include:

- Name
- User
- Problem solved
- Business value
- Complexity
- Dependencies
- Risks
- Acceptance criteria
- Whether to build now, later, or not yet

Please do not list generic SaaS features unless they fit this pharmacy operations product.

### 7. What Not To Build Yet

Explicitly say what should not be built yet and why.

Examples to consider:

- AI copilot before data/task model stabilizes
- Shared multi-tenancy
- Fully automatic alert persistence
- Complex mobile app before PWA/basic mobile branch mode
- Overly broad analytics before production validation

### 8. UX And Product Design Critique

Evaluate the product experience:

- Is the Command Center the right first screen?
- Are modules too many or well grouped?
- Are branch users and managers likely to understand workflows?
- What should be simplified before launch?
- What should be improved after launch?

### 9. Data, Security, And Architecture Critique

Evaluate:

- Supabase Auth and `app_user_profiles`
- RLS boundaries
- Dedicated-client deployment
- Service abstraction
- Demo mode boundaries
- Edge Function secrets
- Reward fraud controls
- Storage policies
- Quality feedback anonymity
- Audit trails

### 10. Codex Implementation Prompts

For every recommendation that should be implemented soon, output implementation-ready Markdown prompts for Codex.

Each prompt must be in this shape:

```markdown
# CODEX PROMPT: <short task title>

## Objective
<What Codex should implement.>

## Context
<Relevant project facts and constraints.>

## Files To Inspect First
- <file path>
- <file path>

## Scope
- <specific build item>
- <specific build item>

## Out Of Scope
- <things Codex must not do>

## Data And Security Notes
- <RLS, Supabase, secrets, demo mode, role behavior>

## Implementation Guidance
- <specific engineering notes>

## Verification
- <commands and manual checks>

## Acceptance Criteria
- <testable criteria>
```

Also suggest a filename for each prompt, for example:

```text
docs/CODEX_PROMPT_01_PRODUCTION_READINESS.md
```

## Constraints Claude Must Respect

- Do not recommend shared multi-tenancy for the current product path.
- Do not recommend frontend service-role keys.
- Do not recommend storing passwords in `branches`.
- Do not recommend fake production data.
- Do not recommend localStorage as production persistence.
- Do not recommend AI outputs that invent operational facts.
- Do not recommend skipping RLS validation.
- Do not recommend claiming production-ready before the required validation passes.
- Do not recommend building everything at once.
- Prefer phased, high-impact, low-risk implementation prompts.

## Desired Tone

Be direct, professional, and practical.

The project owner wants expert insight, not compliments. Be encouraging but honest. If something is risky, say so clearly. If something is valuable, explain why. If a feature should wait, say why.

