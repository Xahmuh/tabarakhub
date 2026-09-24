# Architecture Contract: Tabarak Hub

## 1. System Overview

Tabarak Hub is an enterprise operational management platform for Tabarak Pharmacy in Bahrain. The system centralizes and coordinates daily retail pharmacy operations, inventory tracking (lost sales & shortages), customer loyalty & gamification (Spin & Win), staff workforce & HR records, automated duty scheduling, fleet & operational cash expenses, commercial registration & license renewals, delivery logistics tracking & driver mobile integration, BenefitPay reconciliations, and pharmacy quality compliance (TQPH).

---

## 2. Technology Stack

### 2.1 Web Platform (Tabarak Hub)
- **Runtime & Bundler**: Vite 8.0.x with Rolldown / ES2022
- **UI Framework**: React 19.2.x (SPA with client-side state)
- **Language**: TypeScript 5.8.x
- **Styling**: Tailwind CSS 3.4.x + PostCSS 8.x
- **Icons**: Lucide React
- **Data Visualization**: Recharts 3.6.x
- **Document & Spreadsheet Processing**: ExcelJS 4.4.x, Docx 9.5.x, @react-pdf/renderer 4.9.x, pdfjs-dist 4.0.x
- **Validation**: Zod 4.6.x
- **Notifications & Modals**: SweetAlert2 11.26.x, canvas-confetti 1.9.x

### 2.2 Backend-as-a-Service (Supabase)
- **Database Engine**: PostgreSQL 15+ (Hosted on Supabase)
- **Data Client**: `@supabase/supabase-js` v2.45.x
- **Security & Multi-Tenancy**: Row Level Security (RLS) on all base tables
- **Functions & Serverless**: Deno-based Supabase Edge Functions (`supabase/functions/`)
- **Storage**: Supabase Storage buckets (`contributions`, `driver-mobile-assets`, `documents`)

### 2.3 Mobile Application (Driver Mobile)
- **Framework**: React Native 0.74+ via Expo SDK 51+ (`apps/driver-mobile/`)
- **Backend Access**: Direct connection to Supabase instance using driver-scoped credentials

---

## 3. Real Discovered Folder Structure

```text
tabarakhub/
├── app/                                 # Feature modules & UI presentation
│   ├── attendance/                      # Staff geofenced clock-in/out & penalties
│   ├── benefit-pay/                     # BenefitPay ledger & delivery reconciliation
│   ├── block-analyzer/                  # Bahrain geographic block coverage heatmap
│   ├── cash-flow/                       # Cash flow forecasting & daily difference tracker
│   ├── command-center/                  # [ORPHANED/DEAD CODE] Unmounted command center
│   ├── control-center/                  # Duty scheduler configuration & zone rules
│   ├── corporate-codex/                 # Policies, circulars, operating protocols
│   ├── dashboard/                       # Executive/Manager/Branch sales & shortages analytics
│   ├── delivery/                        # Delivery recording, batches, block analysis, settings
│   ├── duty-scheduler/                  # Automated pharmacist duty scheduler wizard & matrix
│   ├── employee-contributions/          # Staff submitted tools, ideas, knowledge base
│   ├── hr/                              # Staff portal, requests, workforce directory (5.3k lines)
│   ├── hr-letter-generator/             # Official employment certificate generation
│   ├── leave-management/                # Annual leave requests & labor law rest compliance
│   ├── lib/                             # [ARCHITECTURAL SMELL] Document generator helpers
│   ├── login/                           # Login screen, device fingerprinting, approval wait
│   ├── maintenance/                     # System maintenance banners and settings
│   ├── modules/                         # [ARCHITECTURAL SMELL] Nested modules (quality-feedback)
│   │   └── quality-feedback/            # Anonymous feedback form & admin review
│   ├── notifications/                   # Real-time delivery notification alerts
│   ├── operational-expenses/            # Petty cash expenses & fleet vehicle management
│   ├── operational-renewals/            # CR, NHRA, LMRA tariff tracking & renewal alerts
│   ├── owner-dashboard/                 # Read-only executive KPIs
│   ├── payroll/                         # Staff & driver payroll calculations and export
│   ├── pos/                             # Branch lost sales & shortages entry terminal
│   ├── project-settings/                # RBAC access control, CR entities, zones, login approvals
│   ├── select-pharmacist/               # Shift pharmacist duty selection on branch login
│   ├── shared/                          # Shared UI widgets (Header, Footer, DateRange, Charts)
│   ├── spin-win/                        # Customer loyalty reward wheel & branch QR generator
│   ├── suite/                           # Module launcher grid
│   ├── tqph/                            # Tabarak Quality Pharmacy Hub (inspections & audits)
│   ├── workflow-todo/                   # Operational tasks, approvals, and recurring checklists
│   └── workforce/                       # Staffing capacity calculator & relief planning
│
├── apps/
│   └── driver-mobile/                   # Expo React Native delivery driver mobile app
│
├── config/                              # Client configuration & module feature flags
│   ├── clientConfig.ts                  # Brand theme, enabled modules, client branding
│   └── clientConfig.demo.ts             # Demo mode overrides
│
├── db/                                  # [DEPRECATED / DANGER] Historical unhardened migrations
│   └── migrations/                      # Reference SQL only - DO NOT RUN IN PRODUCTION
│
├── docs/                                # Project documentation, security audits, specs
│   ├── ACCEPTED_SECURITY_RISKS.md       # Documented security caveats & dependencies
│   ├── ARCHITECTURE.md                  # This document
│   └── REFACTORING_PLAN.md              # Prioritized safe refactoring roadmap
│
├── hooks/                               # React custom hooks (currently sparse: useDashboardKPIs)
├── lib/                                 # Core infrastructure & shared registries
│   ├── access.ts                        # Permission checking & RBAC resolution engine
│   ├── deliveryPaymentTypes.ts          # Payment type normalization
│   ├── deviceFingerprint.ts             # Browser device hashing for branch login security
│   ├── moduleDisplay.ts                 # Module badge & ordering logic
│   ├── moduleRegistry.ts                # Master feature & sub-feature definitions
│   ├── roleRegistry.ts                  # System roles & labels
│   ├── supabase.ts                      # [DEPRECATED GOD OBJECT] Legacy service bundle
│   └── supabaseClient.ts                # Canonical Supabase JS client instance
│
├── services/                            # Domain services & data access layer
│   ├── attendancePenaltyEngine.ts       # Disciplinary deduction & warning calculation
│   ├── attendanceService.ts             # Clock-in, geofence, daily records
│   ├── authService.ts                   # Supabase auth, session recovery, user profile
│   ├── benefitPayService.ts             # BenefitPay transaction ledger operations
│   ├── branchDeliveryProfileService.ts  # Delivery zones & radius configurations
│   ├── branchLoginApprovalService.ts    # 2FA-like branch device authorization
│   ├── branchService.ts                 # Branch directory & operating status
│   ├── codexService.ts                  # Policies & circulars storage
│   ├── contributionService.ts           # Employee submissions & attachments
│   ├── crService.ts                     # Commercial Registrations (CR) management
│   ├── deliveryCleanExportService.ts    # Operational Excel export formatting
│   ├── deliveryCoverageService.ts       # Geographical block & catchment analysis
│   ├── deliveryNotificationService.ts   # Audio/visual delivery alerts
│   ├── deliveryService.ts               # Core delivery order lifecycle & driver shifts
│   ├── dutyScheduleExportService.ts     # Duty roster Excel builder
│   ├── dutySchedulerService.ts          # Shift assignments & schedule persistence
│   ├── expenseService.ts                # Cash expenses & vehicle odometer tracking
│   ├── financeService.ts                # Cash flow and difference reconciliation
│   ├── hrService.ts                     # HR requests & ticket statuses
│   ├── leaveManagementService.ts        # Annual leave balance calculation & approval
│   ├── leaveSyncService.ts              # Duty scheduler & leave reconciliation
│   ├── operationalRenewalService.ts     # CR/NHRA/LMRA renewals & budget forecasting
│   ├── operationsTaskService.ts         # Operations task state machine
│   ├── ownerTraceabilityCleanService.ts # Sanitized order history for owners
│   ├── permissionService.ts             # User/role permission grants
│   ├── pharmacistService.ts             # Pharmacist staff records
│   ├── productService.ts                # Products master catalog
│   ├── saleService.ts                   # Lost sales and shortages operations
│   ├── schedulingEngine/                # Pure mathematical scheduler constraint solver
│   ├── spinWin.ts                       # Customer wheel spin verification & prize exchange
│   ├── systemSettingsService.ts         # Maintenance mode, branding, footer settings
│   └── workforceService.ts              # Employee master directory & branch assignments
│
├── supabase/
│   ├── functions/                       # Deno edge functions (admin-create-user, sentiment, etc.)
│   ├── migrations/                      # Canonical production migrations (136 SQL files)
│   └── tests/                           # Database integrity & RLS validation test scripts
│
├── utils/                               # Shared formatting & math utilities
│   ├── calculations.ts                  # Currency formatting wrapper
│   ├── cashFlowUtils.ts                 # Cash projection calculations
│   ├── deliveryImportUtils.ts           # CSV/Excel delivery order bulk importer
│   ├── excelUtils.ts                    # Sheet parsing & sanitization helpers
│   ├── money.ts                         # Bahrain Dinar (3 decimal) formatting & math
│   ├── uiPerformance.ts                 # Render scheduling & RAF throttling
│   ├── uuid.ts                          # Client UUID generation
│   └── vat.ts                           # Bahrain 10% VAT computation
│
├── App.tsx                              # [OVERSIZED GOD COMPONENT] 1,153 lines top router
├── AI_RULES.md                          # Mandatory agent rules for AI assistance
├── index.css                            # Global Tailwind directives & design tokens
├── package.json                         # Project dependencies and test scripts
├── tsconfig.json                        # Relaxed TypeScript compiler options
├── types.ts                             # [MONOLITHIC TYPES] 2,246 lines of cross-domain types
└── vite.config.ts                       # Build optimization, aliases, manual chunking
```

---

## 4. Architectural Layers & Boundaries

```text
┌────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                   │
│   (app/*, apps/driver-mobile, shared components)        │
│   - Pure UI rendering, local form state, modals        │
│   - MUST NOT execute raw SQL queries via .from()       │
│   - MUST delegate all business logic to Services       │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│                      SERVICE LAYER                     │
│   (services/*, services/schedulingEngine/*)            │
│   - Pure business logic, calculations, validations     │
│   - Domain workflows, audit logging, transactions      │
│   - NEVER import UI components or presentation files   │
│   - Talks to Database via Supabase Client              │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│                    INFRASTRUCTURE LAYER                │
│   (lib/supabaseClient, lib/access, utils/*)            │
│   - Supabase connection singleton                      │
│   - RBAC resolution engine                             │
│   - Math, Money, Date, UUID utilities                  │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│                     DATABASE LAYER                     │
│   (PostgreSQL on Supabase, RLS Policies, Functions)    │
│   - Row Level Security (RLS) enforcement on all tables │
│   - Triggers, sequences, stored procedures (RPC)       │
│   - 136 production migrations in supabase/migrations/  │
└────────────────────────────────────────────────────────┘
```

### Layer Rules:
1. **Presentation -> Service**: Allowed. UI components invoke service functions.
2. **Service -> Presentation**: **STRICTLY FORBIDDEN**. Services must never import from `app/` or UI components.
3. **Presentation -> Database (`supabaseClient.from()`)**: **FORBIDDEN (Architectural Violation)**. All database access must be encapsulated inside a domain service.
4. **Service -> Service**: Allowed only when one service orchestrates another (e.g. `leaveSyncService` orchestrating `dutySchedulerService` and `leaveManagementService`). Circular dependencies are strictly forbidden.

---

## 5. Data Flow & State Management Rules

1. **Client-Side State**: State is currently local to components via `useState` and `useEffect`, with top-level session/routing state in `App.tsx`.
2. **No Ad-Hoc Global Contexts**: Do NOT introduce new state-management libraries (Zustand, Redux, Jotai) unless justified and approved.
3. **Offline & Fallback Storage**: `localStorage` and `sessionStorage` must always be wrapped in defensive try/catch blocks with Node.js/SSR-safe guards (`typeof window !== 'undefined'`).
4. **Server as Single Source of Truth**: Cached data in browser storage must never override active Supabase row state.

---

## 6. Authentication & Authorization (RBAC)

### 6.1 Authentication
- Auth is powered by Supabase Auth (`supabaseClient.auth`).
- Branch logins use a synthetic email pattern (`loginIdentifierToEmailCandidates` in `services/authService.ts`).
- New branch logins require manager approval when `branchLoginApprovalRequired` is enabled (device fingerprinting via `lib/deviceFingerprint.ts`).

### 6.2 Roles
- Canonical roles defined in `lib/roleRegistry.ts`:
  `admin` | `owner` | `branch` | `supervisor` | `warehouse` | `accounts` | `driver` | `worker`
- `manager` is a legacy alias mapped to `admin`.

### 6.3 Authorization Enforcement
- Authorization is evaluated at two levels:
  1. **Database Level (Mandatory)**: PostgreSQL Row Level Security (RLS) policies based on `auth.uid()` and `app_user_profiles`.
  2. **UI Level (Convenience & UX)**: `lib/access.ts` (`resolveAccessLevel`, `buildPermissionChecker`) controls menu visibility, edit buttons, and route guards.

---

## 7. Database Conventions & Safety

1. **Migration Source of Truth**: `supabase/migrations/` is the SOLE canonical location for production migrations.
2. **Legacy Migrations**: Files in `db/migrations/` are historical artifacts only. They MUST NOT be executed.
3. **Additive-First Schema Evolution**:
   - `ADD COLUMN` (with nullable or default values)
   - `MIGRATE DATA`
   - `VERIFY WORKFLOWS`
   - `DEPRECATE`
   - Never perform destructive `DROP TABLE` or `DROP COLUMN` in production without verified zero-reference audits.
4. **Timezone Rule**: The business operates in **Bahrain Time (UTC+3 / Asia/Bahrain)**.
   - All operational daily windows, order numbering, and shift dates must use Bahrain calendar dates, NOT local browser UTC dates (`toISOString().split('T')[0]` causes date drift between 00:00 and 03:00 AST).

---

## 8. Financial & Money Conventions

1. **Currency**: Bahrain Dinar (**BHD**).
2. **Precision**: Standard 3 decimal places (1 BHD = 1,000 fils).
3. **Canonical Utility**: All financial amounts must be processed through `utils/money.ts` (`formatBhdAmount`, `truncateBhd`).
4. **Manual Formatting**: Never use raw `toFixed(3)` or custom string concatenation in components. Use `formatBhdAmount(value)` or `formatBhdWithCurrency(value)`.
5. **VAT**: Standard Bahrain VAT is 10% calculated via `utils/vat.ts`.

---

## 9. Error Handling & User Feedback

1. **Service Errors**: Services must throw or return typed errors with clear operational messages.
2. **User Alerts**: Modal dialogues and confirmations should use consistent SweetAlert2 options matching brand colors (`#B91c1c` for primary brand red).
3. **Silent Failures**: Never suppress errors with empty `catch {}` blocks without logging or user notification, especially around database mutations.

---

## 10. Testing Strategy

1. **Execution**: Automated unit tests are run via `tsx` directly:
   `npx tsx <path-to-test-file>`
2. **Coverage Areas**:
   - Scheduling constraint solver & capacity planning (`services/schedulingEngine/__tests__/`)
   - Attendance & lateness penalty rules (`services/__tests__/attendanceEngine.test.ts`)
   - Delivery classification & block geography (`app/delivery/components/__tests__/`)
   - TQPH inspection scoring (`app/tqph/__tests__/`)
   - Control center validation (`app/control-center/__tests__/`)
   - Database RLS and order lifecycle validation (`supabase/tests/*.sql`)
3. **Regression Requirement**: Before and after any refactoring task, affected test suites and `npm run typecheck` + `npm run build` must be executed and confirmed green.
