# Tabarak Quality & Performance Hub (TQPH)
### Implementation Specification for Agentic Build (Antigravity)

**Module of:** TabarakHub
**Doc purpose:** Self-contained build brief. An agentic coding tool should be able to execute this phase-by-phase without needing the original conversation for context.

---

## 0. Agent Execution Notes

- Build in the phase order defined in Section 2. Do not skip ahead to PDF export or the Admin dashboard before the data layer and `DropdownSearch` component exist — every later phase consumes them.
- Section 8 ("Assumptions Requiring Sign-Off") lists every place a business rule was inferred rather than explicitly specified in the source brief. These are implemented as **configurable defaults** (constants/config objects, not hardcoded magic numbers) so a human can override them in one place without touching component logic.
- If you hit a genuine blocker not covered by Section 8, stop and surface the question rather than silently guessing — everything else in this doc is intended to be actionable as-is.
- Each phase in Section 2 has a Definition of Done. Treat these as acceptance criteria, not suggestions.

---

## 1. Tech Stack (Decision)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router), TypeScript | Route structure in the brief (`/supervisor/audits/new`, `/admin/tqph-dashboard`, etc.) maps directly to App Router file conventions |
| Styling | Tailwind CSS | Required by brief; theme tokens in Section 3 |
| State | Zustand (local/session state), React Query (server/mock data fetching) | Lightweight, no over-engineering for a module of this size |
| Data layer (initial) | Mock adapter pattern over an in-memory dataset (Section 7.6) | Enables full preview with zero backend |
| Data layer (production path) | Prisma schema mirroring the TS interfaces in Section 6 | Swap the mock adapter for a Prisma-backed one without touching components |
| PDF generation | `@react-pdf/renderer` | Precise, code-defined, multi-page layouts — the right fit for "recreate the exact official form," unlike `html2canvas` (screenshot-quality, not print-quality) or a server-only headless-browser approach (out of scope for a frontend-first build) |
| Fuzzy search (DropdownSearch) | `fuse.js` (or a small custom scorer if avoiding the dependency) | Handles typo-tolerant matching for branch/pharmacist search |

If any of these are already fixed by TabarakHub's existing codebase, use the existing choice instead — this table is a default, not a hard requirement.

---

## 2. Phased Build Plan

### Phase 1 — Foundation
- TypeScript interfaces (Section 6)
- `DropdownSearch` component (Section 7.2)
- Mock dataset: 20 branches, 2 areas, supervisors, sample pharmacists (Section 7.6)
- Scoring/business-logic utilities as pure functions (Section 5), unit-testable in isolation

**Definition of Done:** every interface compiles; `DropdownSearch` works standalone in a demo page with the mock branch list; scoring functions have unit tests covering pass/fail boundaries.

### Phase 2 — Supervisor Evaluation Flow
- `/supervisor/audits/new` — full 4-tab stepper (Section 7.3.1)

**Definition of Done:** a supervisor can complete Tabs A–D end to end against mock data, see the live 150-point indicator update in Tab C, and trigger a lock in Tab D that writes a `locked_submitted` record plus `DistributionLog` entries.

### Phase 3 — Branch & Pharmacist Views
- `/branch/inspections` + CAPA Action Center (Section 7.3.2)
- `/pharmacist/performance` (Section 7.3.3)

**Definition of Done:** both views read from the records created in Phase 2; CAPA proof upload updates `CAPA_Task.status`; pharmacist view renders the 6-pillar breakdown correctly from a locked appraisal.

### Phase 4 — Admin Dashboard
- `/admin/tqph-dashboard` (Section 7.3.4)

**Definition of Done:** KPI ribbon and leaderboards compute correctly from mock data across multiple branches/months; color bands match Section 5.3.

### Phase 5 — PDF Export Engine
- `PDFExportService` + both templates (Section 7.4)

**Definition of Done:** both templates render from a real (mock) `NHRA_Audit` and `Pharmacist_Appraisal` record respectively, paginate correctly, and are downloadable from the Branch and Pharmacist views built in Phase 3.

---

## 3. Design System Tokens (TabarakHub Core)

```
// Tailwind theme extension
colors: {
  'accent-lime': '#D9F99D',
  'accent-lime-mid': '#A3E635',
  'accent-green': '#10B981',
  'surface-950': '#020617', // bg-slate-950
  'surface-900': '#0F172A', // bg-slate-900
  'surface-border': '#1E293B', // border-slate-800
}
```

- **Cards:** `bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl`
- **Primary action:** lime/green accent background, dark text for contrast (never lime-on-lime)
- **Status colors:** Green `#10B981` (compliant/pass), Amber `#F59E0B` (partial/warning), Red `#EF4444` (non-compliant/fail) — used consistently across audit toggles, CAPA severity, and leaderboard bands
- **Aesthetic:** Flat 2.0 — no heavy drop shadows, no skeuomorphism; depth comes from blur + subtle border, not shadow stacking
- **Strict rule:** no native `<select>` anywhere in the codebase. Every selection surface uses `DropdownSearch`.

---

## 4. Data Model Gaps Filled (vs. original brief)

The source brief's entities were solid but missing a few things every field team will ask for in week one. These are added below and are **not optional**:

1. **`Attachment`** entity — the brief references photo upload (Tab B) and CAPA resolution proof, but never modeled storage. Added in Section 6.
2. **`DistributionLog`** entity — "auto-routes to 3 portals" needs its own auditable record so Admin can see whether routing actually succeeded, not just that a lock happened. Added in Section 6.
3. **Audit timestamps** — `created_at`, `updated_at`, `locked_at`, `submitted_by` added to `NHRA_Audit` and `Pharmacist_Appraisal`. Needed for the Supervisor Completion Tracker KPI (12 visits/month) on the Admin dashboard.
4. **`CAPA_Task.assigned_to`** — branch managers "upload proof," but accountability was implicit. Added `assigned_to: user_id` and `resolved_by`, `resolved_at`.

---

## 5. Business Logic (Scoring, Compliance, Distribution)

### 5.1 NHRA Compliance Score

Each checklist item is scored:
- Fully Compliant = 100%
- Partially Compliant = 50%
- Non-Compliant = 0%
- N/A = excluded from the denominator (not counted as compliant or non-compliant)

```
compliance_score = (Σ item_score / count_of_applicable_items) × 100
```

All items are equally weighted by default. If certain sections (e.g., Controlled Registers) should carry more weight than others (e.g., Signage), expose a `sectionWeights` config object in `scoringService.ts` — do not hardcode weighting into the calculation function itself.

### 5.2 Pharmacist Appraisal Score

- 30 total criteria across 6 sections (7+4+5+7+3+4), each rated 1–5 per the letter-grade scale below.
- `total_credit_score = Σ (criterion rating)`, max 150.
- `passed = total_credit_score >= 95`.

| Grade | Points |
|---|---|
| A* | 5 |
| A | 4 |
| B | 3 |
| C | 2 |
| F | 1 |

### 5.3 Status Color Bands (used on toggles, CAPA severity, and leaderboards)

| Band | Range | Color |
|---|---|---|
| Green | ≥ 95% | `#10B981` |
| Amber | 80–94% | `#F59E0B` |
| Red | < 80% | `#EF4444` |

### 5.4 Auto-CAPA Generation *(assumption — see Section 8)*

- A `CAPA_Task` is auto-created whenever a checklist item is marked **Non-Compliant**.
- Default severity is derived from the section, via a configurable map:
  - Critical → License & Approvals (1.0), Controlled Registers (7.0–8.0)
  - Major → Records & Documentation (5.0), Storage (6.0)
  - Minor → Workplace Standards (2.0), Pricing (4.0), Policies (3.0)
- **Partially Compliant** items do *not* auto-generate a CAPA unless the supervisor explicitly flags it via a "Requires Corrective Action" checkbox in Tab B.
- `due_date` defaults to `locked_at + 48 hours` (matches the brief's CAPA Action Center copy).

### 5.5 Post-Lock Immutability *(assumption — see Section 8)*

- Once `status = 'locked_submitted'`, the `NHRA_Audit` and `Pharmacist_Appraisal` records are **immutable**.
- Corrections are handled via an `Addendum` record referencing the original `id`, requiring Admin approval before it's visible to the branch/pharmacist.
- An addendum does **not** re-trigger the multi-portal distribution; it flags the original record as `amended: true` with a link to the addendum.

### 5.6 Distribution on Lock

On transition to `locked_submitted`:
1. `NHRA_Audit` PDF → Branch Account portal
2. `Pharmacist_Appraisal` PDF → Pharmacist Personal Portal
3. Both PDFs → Executive Admin
4. Each of the above creates a `DistributionLog` row with `status: 'pending' | 'sent' | 'failed'`. The lock confirmation modal should not claim success until logs resolve — surface failures, don't swallow them.

---

## 6. TypeScript Interfaces

```typescript
// ── Core Entities ─────────────────────────────────────────

export type UserRole = 'admin' | 'supervisor' | 'pharmacist' | 'branch_manager';

export interface Area {
  id: string;
  name: string; // "Area 1", "Area 2"
  supervisor_id: string;
}

export interface Branch {
  id: string;
  name: string;
  area_id: string;
  license_no: string;
  manager_name: string;
}

export interface User {
  id: string;
  name: string;
  cpr: string; // Bahrain national ID — treat as sensitive PII, see Section 9
  role: UserRole;
  branch_id?: string; // present for pharmacist / branch_manager
}

// ── Attachments ───────────────────────────────────────────

export type AttachmentOwnerType = 'nhra_audit_item' | 'capa_task';

export interface Attachment {
  id: string;
  owner_type: AttachmentOwnerType;
  owner_id: string;
  url: string;
  file_type: 'image/jpeg' | 'image/png' | 'application/pdf';
  uploaded_by: string; // user id
  uploaded_at: string; // ISO timestamp
}

// ── NHRA Audit ────────────────────────────────────────────

export type ComplianceStatus = 'fully_compliant' | 'partially_compliant' | 'non_compliant' | 'not_applicable';
export type AuditStatus = 'draft' | 'locked_submitted';

export interface NHRAChecklistItem {
  code: string; // e.g. "1.1", "5.4"
  label: string;
  status: ComplianceStatus;
  notes?: string;
  requires_corrective_action?: boolean; // manual flag for partially-compliant items
  attachment_ids: string[];
}

export interface NHRASection {
  section_code: string; // "1.0" through "8.0"
  title: string;
  items: NHRAChecklistItem[];
}

export interface NHRA_Audit {
  id: string;
  branch_id: string;
  supervisor_id: string;
  date: string; // ISO date
  status: AuditStatus;
  sections: NHRASection[]; // 1.0 License & Approvals, 2.0 Workplace Standards,
                            // 3.0 Policies & Procedures, 4.0 Medicine Price Compliance,
                            // 5.0 Records & Documentation, 6.0 Storage,
                            // 7.0 Semi-Controlled Register, 8.0 Controlled Register
  compliance_score: number; // 0–100, see Section 5.1
  violations_list: string[]; // CAPA_Task ids
  created_at: string;
  updated_at: string;
  locked_at?: string;
  submitted_by?: string; // user id
  amended: boolean;
}

// ── Pharmacist Appraisal ──────────────────────────────────

export type LetterGrade = 'A*' | 'A' | 'B' | 'C' | 'F';

export interface AppraisalCriterion {
  code: string; // e.g. "I.3", "IV.7"
  label: string;
  grade: LetterGrade;
  points: number; // 1–5, derived from grade
}

export interface AppraisalSection {
  section_id: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  title: string; // "Job Knowledge & Operational Skills", etc.
  criteria: AppraisalCriterion[];
}

export interface Pharmacist_Appraisal {
  id: string;
  pharmacist_id: string;
  branch_id: string;
  supervisor_id: string;
  month: number; // 1–12
  year: number;
  sections: AppraisalSection[]; // I–VI, 7+4+5+7+3+4 = 30 criteria
  total_credit_score: number; // max 150
  passed: boolean; // total_credit_score >= 95
  comments_and_improvement: string;
  status: AuditStatus;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  submitted_by?: string;
  amended: boolean;
}

// ── CAPA ──────────────────────────────────────────────────

export type CAPASeverity = 'Critical' | 'Major' | 'Minor';
export type CAPAStatus = 'open' | 'resolved';

export interface CAPA_Task {
  id: string;
  audit_id: string;
  element_code: string; // links back to NHRAChecklistItem.code
  violation: string;
  required_action: string;
  severity: CAPASeverity;
  due_date: string; // ISO date, defaults to locked_at + 48h
  status: CAPAStatus;
  assigned_to: string; // branch_manager user id
  resolution_proof_url?: string;
  resolved_by?: string;
  resolved_at?: string;
}

// ── Distribution / Audit Trail ────────────────────────────

export type DistributionRecipient = 'branch_portal' | 'pharmacist_portal' | 'executive_admin';
export type DistributionStatus = 'pending' | 'sent' | 'failed';

export interface DistributionLog {
  id: string;
  source_type: 'nhra_audit' | 'appraisal';
  source_id: string;
  recipient_type: DistributionRecipient;
  recipient_id: string;
  channel: 'in_app' | 'email';
  status: DistributionStatus;
  sent_at?: string;
  error_message?: string;
}

// ── Addendum (post-lock correction path, Section 5.5) ─────

export interface Addendum {
  id: string;
  source_type: 'nhra_audit' | 'appraisal';
  source_id: string;
  reason: string;
  changes: Record<string, unknown>;
  approved_by?: string; // admin user id
  approved_at?: string;
  created_by: string;
  created_at: string;
}
```

---

## 7. Components & Views

### 7.1 Folder Structure

```
/src
  /app
    /supervisor/audits/new/page.tsx
    /branch/inspections/page.tsx
    /pharmacist/performance/page.tsx
    /admin/tqph-dashboard/page.tsx
  /components
    /ui
      DropdownSearch.tsx
      StatusBadge.tsx
      RatingCard.tsx
      KPIStat.tsx
      Stepper.tsx
      ConfirmModal.tsx
    /audit
      NHRAChecklistSection.tsx
      NHRAItemToggle.tsx
      PhotoUpload.tsx
    /appraisal
      AppraisalSectionCard.tsx
      CreditScoreIndicator.tsx
    /capa
      CAPACard.tsx
      CAPAProofUpload.tsx
    /pdf
      NHRAReportTemplate.tsx
      AppraisalTemplate.tsx
  /hooks
    useDropdownSearch.ts
    useAuditDraft.ts
    useAppraisalDraft.ts
  /types
    index.ts (Section 6 contents)
  /services
    scoringService.ts       (Section 5.1, 5.2)
    capaService.ts           (Section 5.4)
    distributionService.ts   (Section 5.6)
    pdfExportService.ts      (Section 7.4)
  /data
    mockBranches.ts
    mockAreas.ts
    mockUsers.ts
    mockAudits.ts
    mockAppraisals.ts
  /lib
    utils.ts
```

### 7.2 `DropdownSearch` — Reusable Component Spec

**Props:**
```typescript
interface DropdownSearchProps<T> {
  items: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  groupBy?: (item: T) => string; // e.g. group branches by area
  disabled?: boolean;
  clearable?: boolean;
  emptyStateLabel?: string; // "No branches found"
}
```

**Required behavior:**
- Fuzzy substring match on `getLabel(item)`, case-insensitive, typo-tolerant (via `fuse.js` or equivalent)
- Full keyboard nav: `↓/↑` to move highlight, `Enter` to select, `Esc` to close, type-to-filter while focused
- Click-outside dismissal (via a `useRef` + document listener, cleaned up on unmount)
- Clear button (✕) visible only when `clearable` and a value is selected
- Empty-state fallback message when filter yields zero results
- ARIA: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, listbox `role="listbox"` with `role="option"` children — this is a compliance-adjacent tool used by field staff; accessibility is not optional
- Visual: matches Section 3 tokens — `bg-slate-900/80 backdrop-blur-md border border-slate-800`, lime accent on focus ring and selected option

This is the **only** selection pattern used anywhere in the module — branch pickers, pharmacist pickers, area filters, severity filters, month/year pickers on the Admin dashboard.

### 7.3 UI Views

#### 7.3.1 `/supervisor/audits/new` — Supervisor Evaluation Flow

4-tab stepper (`Stepper.tsx` drives tab state; each tab persists to a draft via `useAuditDraft` / `useAppraisalDraft` so a supervisor can leave and resume).

- **Tab A — Branch Selection:** `DropdownSearch` over `Branch[]`, filterable by Area via a second `DropdownSearch` (Area 1 / Area 2). Selecting a branch is required before Tab B unlocks.
- **Tab B — NHRA Simulated Checklist:** renders all 8 `NHRASection`s from Section 6. Each `NHRAChecklistItem` gets a 3-state toggle (Fully / Partially / Non-Compliant, plus N/A), an optional notes field, and conditional photo upload (`PhotoUpload.tsx`, wired to `Attachment`). Marking Non-Compliant immediately shows an inline violation-tag input (feeds `CAPA_Task.violation` / `required_action`). Section-level completion indicator (e.g. "6/8 sections started") in the tab header.
- **Tab C — Staff Appraisal:** `DropdownSearch` to pick the on-duty pharmacist (filtered to the selected branch). Renders all 6 `AppraisalSection`s as 5-point rating cards (`RatingCard.tsx`, A*–F per Section 5.2 table). `CreditScoreIndicator.tsx` recalculates the running total live and shows a pass/fail preview against the 95-point threshold as ratings are entered.
- **Tab D — Confirmation & Lock:** summary of both the audit and appraisal, compliance score preview, credit score preview. Lock button opens `ConfirmModal` warning explicitly that locking triggers immediate, irreversible multi-portal distribution (Section 5.6). On confirm: set `status = 'locked_submitted'`, stamp `locked_at`/`submitted_by`, run `distributionService`, auto-generate CAPAs per Section 5.4.

#### 7.3.2 `/branch/inspections` — Branch Manager View

- Read-only list of received `NHRA_Audit` records for the manager's branch, newest first.
- Each record: compliance score with color band (Section 5.3), a prominent "Download Official NHRA PDF" button (`pdfExportService`), and violation count.
- **CAPA Action Center:** list of open `CAPA_Task`s for the branch, grouped by severity. Each card (`CAPACard.tsx`) shows the violation, required action, due date (with overdue styling past 48h), and a proof-upload control (`CAPAProofUpload.tsx`) that sets `status = 'resolved'`, `resolved_by`, `resolved_at` on submit.

#### 7.3.3 `/pharmacist/performance` — Pharmacist Personal View

- Historical list of the pharmacist's own `Pharmacist_Appraisal` records, most recent first, month/year labeled.
- Breakdown view (on selecting a record): all 6 `AppraisalSection`s with per-criterion grades, `total_credit_score`, `StatusBadge` (Passed ≥95 / Did Not Pass <95), and `comments_and_improvement` from the supervisor.
- "Download Performance Sheet (PDF)" action via `pdfExportService`.

#### 7.3.4 `/admin/tqph-dashboard` — Executive Command & Ranking Board

- **KPI ribbon:** Overall Network Compliance % (avg `compliance_score` across locked audits in period), Passed Appraisals % (locked appraisals with `passed = true` / total), Pending CAPAs (open count), Area 1 vs Area 2 comparative index (avg compliance per area, side by side).
- **Monthly Ranking Leaderboard:**
  - Branches ranked 1–20 by `compliance_score`, `StatusBadge` colored per Section 5.3 bands.
  - Pharmacists Top Performers ("Wall of Fame") ranked by `total_credit_score`.
  - Supervisor Completion Tracker: visits completed this month (count of `NHRA_Audit.locked_at` this month per supervisor) vs. target of 12, as a progress bar.
- Month/year filter uses `DropdownSearch`, not a native picker.

### 7.4 `PDFExportService` — Dynamic PDF Generation

Built on `@react-pdf/renderer`. Two templates, each a pure function of a data record → PDF document:

```typescript
// pdfExportService.ts
export function generateNHRAReportPDF(audit: NHRA_Audit, branch: Branch, supervisor: User): Blob;
export function generateAppraisalPDF(appraisal: Pharmacist_Appraisal, pharmacist: User, branch: Branch): Blob;
```

**Template 1 — NHRA Official Inspection Simulation Report:**
- Cover section: TabarakHub logo placeholder, branch name, license no., inspection date, supervisor name
- One page (or section) per NHRA section (1.0–8.0), each rendered as a table: item code | label | status | notes
- Violations summary page: all `CAPA_Task`s tied to this audit, with severity and due date
- Signature lines: Supervisor / Branch Manager, at the foot of the final page
- Compliance score displayed prominently on the cover, color-coded per Section 5.3

**Template 2 — Tabarak Pharmacist Performance Appraisal Form:**
- Header: pharmacist name, CPR (masked — see Section 9), branch, month/year, supervisor name
- Six section tables (I–VI), each criterion with its letter grade and points
- Credit total and Passed/Did Not Pass indicator, styled prominently
- Supervisor comments section
- Signature lines: Supervisor / Pharmacist

Both templates should accept the real `NHRA_Audit` / `Pharmacist_Appraisal` shapes directly — no intermediate flattening layer — so Phase 5 has zero coupling risk with Phases 2–3.

> **Note on fidelity:** these templates are built from the section list in this spec, not from the actual NHRA/Tabarak paper forms. If the real forms exist as a reference file, layout should be matched against them directly rather than this doc's structure.

### 7.5 Ratings/Status Display Conventions

- `StatusBadge.tsx`: single component used for both audit compliance bands and appraisal pass/fail, driven by the Section 5.3 color map — don't fork this into separate badge components per feature.
- `RatingCard.tsx`: used for both NHRA 3-state toggles and appraisal 5-point grades — accepts a `variant: 'compliance' | 'grade'` prop rather than being duplicated.

### 7.6 Mock Data Requirements

- **2 Areas:** Area 1, Area 2
- **20 Branches** across Bahrain, split across the two areas (suggested realistic-sounding but fictional distribution — Manama, Muharraq, Riffa, Hamad Town, Isa Town, Sitra, Budaiya, A'ali, Jidhafs, Sanad, Saar, Tubli, Zinj, Adliya, Juffair, Salmabad, Dair, Karranah, Askar, Durrat Al Bahrain)
- **2 Supervisors** (one per area)
- **~10 pharmacists** distributed across branches
- **A handful of seeded `NHRA_Audit` and `Pharmacist_Appraisal` records** across at least 2 different months, with a mix of pass/fail and compliance bands, so the Admin dashboard has real variance to render (a dashboard seeded with all-green data doesn't validate the color-band logic).

---

## 8. Assumptions Requiring Sign-Off

These defaults were inferred to keep the build unblocked. Flip/edit them in one place (the relevant service file) if the real business rule differs:

| # | Assumption | Where implemented |
|---|---|---|
| 1 | NHRA items are equally weighted within `compliance_score` unless a section weight is configured | `scoringService.ts` |
| 2 | Non-Compliant auto-generates a CAPA; Partially-Compliant only does so if manually flagged | `capaService.ts` |
| 3 | CAPA severity defaults are License/Controlled=Critical, Records/Storage=Major, Workplace/Pricing/Policies=Minor | `capaService.ts` |
| 4 | CAPA due date = lock time + 48 hours | `capaService.ts` |
| 5 | Locked audits/appraisals are immutable; corrections go through an Admin-approved `Addendum`, not a direct edit | `distributionService.ts`, Addendum flow |
| 6 | Compliance color bands (≥95 Green / 80–94 Amber / <80 Red) apply to both the branch leaderboard *and* individual audit `compliance_score` display | `StatusBadge.tsx` |

---

## 9. Security Note (flagged, not implemented in mock phase)

`User.cpr` (Bahrain national ID) and the controlled-substance register data in `NHRA_Audit` sections 7.0/8.0 are sensitive PII/regulatory data. The mock/preview build has no reason to implement this, but the production Prisma-backed version should:
- Encrypt `cpr` at rest
- Log access to controlled-register sections
- Mask CPR in PDF exports except where a full unmasked copy is the explicit point of the document (e.g., the appraisal form header may need it — confirm with compliance before finalizing Template 2)

---

## 10. Open Items for Human Sign-Off Before Phase 5

- [ ] Confirm PDF library choice (`@react-pdf/renderer` assumed) if TabarakHub already has an existing PDF pipeline
- [ ] Confirm section weighting for `compliance_score` (equal-weight assumed)
- [ ] Confirm CAPA severity-by-section mapping (Section 8, #3)
- [ ] Provide reference files for the actual NHRA and Tabarak paper forms if pixel-level fidelity is required
- [ ] Confirm CPR masking policy for PDF exports
