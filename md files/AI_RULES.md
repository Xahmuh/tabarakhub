# AI Development & Refactoring Rules: Tabarak Hub

You are an AI assistant contributing to the **Tabarak Hub** codebase.
You must adhere strictly to these rules. Any PR, diff, or suggested code modification that violates these rules is considered defective.

---

## 1. General Principles

1. **Inspect Before Modifying**: Always read and understand the entire target file, its callers, its tests, and its database dependencies before making any changes.
2. **Reuse Existing Architecture**: Do not invent new abstractions, design patterns, or layers when an established pattern already exists in the codebase.
3. **No Unilateral Framework Migrations**: Never migrate or introduce frameworks, libraries, databases, or state-management tools (e.g. Redux, Zustand, Next.js, Prisma, Tailwind v4) without explicit user authorization and technical justification.
4. **Small, Focused Diffs**: Keep diffs minimal and focused. Do not reformat untouched lines, reorder unrelated imports, or change variable names across untouched code.
5. **Do Not Rewrite Working Modules**: A large file is not a reason to scrap and rebuild it. Isolate responsibilities incrementally while preserving 100% of existing behavior.
6. **Never Expose Secrets**: Never log, echo, or output environment keys, service role secrets, tokens, passwords, or customer PII.

---

## 2. Database Safety Rules

1. **Never Destroy Production Data**: Never issue `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` in production migrations without verified zero-reference audits and explicit human sign-off.
2. **Additive-First Schema Evolution**:
   - `ADD` column (nullable or with safe default).
   - `MIGRATE` existing data.
   - `VERIFY` application read/write compatibility.
   - `DEPRECATE` old column if applicable.
   - Remove only in a future scheduled cleanup pass.
3. **Preserve Existing Identifiers**: Never change existing primary keys, foreign keys, or established table column names without backward-compatible database views or triggers.
4. **Canonical Migration Location**: Place all new migrations strictly in `supabase/migrations/` using timestamped naming (`YYYYMMDDHHMMSS_description.sql`). Never modify historical migrations.
5. **Never Use `db/migrations/`**: The `db/migrations/` directory contains legacy unhardened SQL files kept for reference only. Never apply them to staging or production.
6. **Timezone Awareness**: The business operates in **Bahrain Time (UTC+3 / Asia/Bahrain)**. Any database queries filtering daily operational windows must use Bahrain dates.

---

## 3. Business Logic Rules

1. **Canonical Location**: Business logic belongs in **Domain Services** (`services/*`) or pure mathematical engines (`services/schedulingEngine/*`, `services/attendancePenaltyEngine.ts`).
2. **No Business Logic in UI Components**: UI components in `app/*` must only handle presentation, form state, and user interactions. They must NOT contain:
   - Penalty calculations
   - Financial aggregations or debt formulas
   - Scheduling constraint algorithms
   - Bulk database sync loops
3. **No Duplication of Business Rules**: If a business rule exists in a service, all components must call that service. Do not reimplement formulas inline.
4. **Preserve Existing Calculations**: Never alter business formulas (e.g. attendance deductions, delivery times, tariff costs, Spin prize probabilities) unless explicitly instructed by a verified change request.

---

## 4. API & Data Access Rules

1. **No Direct Database Access from UI**: UI components must NOT call `supabaseClient.from(...)` directly. All database queries must be encapsulated inside methods in `services/*`.
2. **Preserve API Contracts**: Never change existing service method signatures, return shapes, or Edge Function inputs/outputs without auditing all consumers.
3. **Service Independence**: Services in `services/` must NEVER import from UI folders (`app/*`). Inverted dependencies break reusability and testing.
4. **Defensive Storage Guards**: Browser storage (`localStorage`, `sessionStorage`, `window`, `navigator`) must always be wrapped with `typeof window !== 'undefined'` checks and `try/catch` to ensure tests run smoothly in Node.js environments.

---

## 5. Frontend & UI Rules

1. **Reuse Shared Components**: Check `app/shared/` before creating new headers, footers, buttons, date range pickers, or pagination controls.
2. **Consistent Design Language**: Use the brand primary red (`#B91c1c` / `text-brand` / `bg-brand`), Slate neutrals, and established Tailwind classes.
3. **No Placeholders**: Never leave `TODO: Implement this`, empty handler stubs, or mock data in place of working integrations.
4. **Avoid Monolithic Files**: When adding features to existing large components, extract sub-views, tabs, or dialogs into dedicated sibling component files rather than inflating parent files.

---

## 6. Financial & Money Rules

1. **Currency Unit**: Bahrain Dinar (**BHD**), standard 3 decimal places.
2. **Formatting**: Always format money using `formatBhdAmount(value)` or `formatBhdWithCurrency(value)` from `utils/money.ts`.
3. **No Manual `toFixed(3)`**: Do not write raw `.toFixed(3)` or ad-hoc string concatenation in components or services.

---

## 7. Refactoring Rules

1. **One Logical Task at a Time**: Never combine dead-code deletion, architectural extraction, and UI redesign into a single task.
2. **Safety Net First**: Ensure test suites or validation scripts are run BEFORE making changes.
3. **Verify Immediately After**: Run `npm run typecheck`, affected unit tests, and `npm run build` after every meaningful change.
4. **Zero Regression**: Every refactor must preserve:
   - Existing user workflows
   - Existing database records
   - Existing API contracts
   - Existing permissions and RLS behavior
   - Existing export formats
