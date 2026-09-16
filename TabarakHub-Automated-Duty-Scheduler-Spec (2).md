# TabarakHub — Automated Duty Scheduler
## Full Technical & Product Specification (v1.0)

**Audience:** AI coding agent (e.g. Gemini Antigravity, Claude Code, Codex) implementing this module inside the existing TabarakHub codebase.
**Status:** Specification only — no implementation code is included. This document is the contract the coding agent must follow.
**Scope:** New module — "Automated Duty Scheduler" — added to the existing TabarakHub application.

---

## 0. How to Use This Document (Read First)

Before writing any code, the implementing agent MUST:

1. Inspect the existing TabarakHub codebase and database schema for: Pharmacies/Branches, Regions, Employees/Pharmacists, Employee Accounts, Users, Roles/Permissions, Shifts, and any existing scheduling/roster tables. **Note:** as of this writing, TabarakHub has no `leave_requests`/`annual_leave` table — only a `VacationRequestFlow.tsx` UI flow that generates a PDF leave request; this module builds a deliberately minimal, temporary interim leave table of its own — see §3.3. **Also note:** TabarakHub has no dedicated `regions` table today — region grouping is not normalized anywhere in the current schema. This is a **foundational, non-Scheduler-specific gap** that must be closed with its own migration before Duty Scheduler work begins — see §3.4. **Also note:** the schema may contain both a `pharmacists` table and an `employees` table with unclear precedence — this must be resolved before any scheduling-profile code is written — see §3.5.
2. Identify the existing design system (component library, tokens, tables, modals, drawers, date pickers, toasts, icons) and reuse it — do not introduce a new visual language.
3. Identify the existing authentication and RBAC mechanism and extend it — do not build parallel auth.
4. Treat every "conceptual" entity name in this document as a *suggestion*, not a mandate. Rename/merge into existing tables wherever an equivalent already exists.
5. Never create duplicate master data for Pharmacies, Branches, Regions, Pharmacists, or Employee Accounts. This module only *references* those entities.

If anything in this document conflicts with the existing schema or design system, the existing system wins — adapt this spec's naming to match, but preserve all business rules, constraints, and behaviors described here.

---

## 1. Product Overview

### 1.1 Purpose

The Automated Duty Scheduler is a module inside TabarakHub that generates, validates, and manages pharmacist duty rosters across all pharmacy branches. It replaces manual, spreadsheet-based roster building with a constraint-driven generation engine that a manager can run, review, adjust, lock, and publish.

### 1.2 Current Business Context

- ~20 pharmacies, grouped into 2 operational regions (both figures are illustrative — the system must scale beyond them, see §31).
- Pharmacies operate either **24 hours** (3 shifts/day, e.g. AM/PM/NIGHT) or **less than 24 hours** (2 shifts/day, e.g. AM/PM).
- Shift names/times are **configurable per branch** and must be read from existing TabarakHub scheduling configuration — never hard-coded.

### 1.3 Core Capability

A manager selects a period (1 week / 2 weeks / 1 month / custom range) and a region (or all regions), and clicks **Generate Schedule**. The engine produces a draft roster that respects all hard constraints, optimizes for fairness and continuity, and clearly reports any coverage gaps.

### 1.4 The Central Business Principle (Non-Negotiable)

> **Do not assume every pharmacist works 6 days and rests 1 day.**

Each pharmacist has an **individual scheduling capacity and work/rest pattern** — fixed, weekly-target, or variable — configured independently of any default assumption. The engine must treat this as first-class data, not an edge case. This principle governs every section below; wherever a design choice could implicitly re-introduce a "6-and-1" default, that choice is wrong.

---

## 2. Business Rules Summary

| Rule | Statement |
|---|---|
| BR-1 | Master data (pharmacies, branches, regions, pharmacists, employee accounts) is never duplicated; always referenced from existing TabarakHub entities. |
| BR-2 | Shift names/times per branch are configurable, never hard-coded. |
| BR-3 | 24-hour branches require 3 shifts/day; non-24-hour branches require 2 shifts/day — both configurable, not fixed labels. |
| BR-4 | Every pharmacist has an individual Work/Rest Pattern: Fixed cycle, Weekly target, Variable cycle, or Custom calendar. |
| BR-5 | Weekly Off Entitlement, Maximum Consecutive Working Days, and Work/Rest Pattern are three distinct, independently configurable constraints. |
| BR-6 | A configured pattern is never allowed to override Minimum Rest or Maximum Consecutive Working Days — those remain hard limits regardless of pattern value. |
| BR-7 | Fixed-branch pharmacists are not auto-reassigned to another branch. |
| BR-8 | Fixed-shift pharmacists (AM only / PM only / NIGHT only) never receive a different shift type automatically. |
| BR-9 | Shift transitions are validated using actual `previous_shift_end_datetime` → `next_shift_start_datetime`, never by comparing shift labels. |
| BR-10 | Relief pharmacists cover rest days, leave, absence, and shortages within their configured allowed-branch pool. |
| BR-11 | Annual leave blocks all assignments for that pharmacist for that period; the engine finds replacement coverage without violating hard constraints. |
| BR-12 | Fairness is measured against each pharmacist's own configured capacity, not a uniform expectation. |
| BR-13 | The previous schedule is a soft input (continuity), never a hard constraint. |
| BR-14 | Generation is deterministic/seeded — same inputs produce the same output. |
| BR-15 | The system must scale beyond current branch/pharmacist/region counts without code changes. |
| BR-16 | Locked assignments always survive regeneration. |
| BR-17 | The engine must never silently produce an incomplete/invalid schedule — it must report unsatisfiable coverage explicitly. |

---

## 3. Existing-Data Integration

### 3.1 Entities to Reuse (Do Not Recreate)

| Concept | Source | Notes |
|---|---|---|
| Pharmacies / Branches | Existing TabarakHub branch table | Must expose: operating hours, 24h flag, region, active status — **note:** the 24h flag, shift-type config, and active-status fields do not exist on the current table yet; see §9.1 for the required additive migration. |
| Regions | **Does not exist yet.** No `regions` table in current migrations; branches have no normalized region reference. | Must be created as a **standalone, foundational prerequisite migration** before Duty Scheduler work begins — not owned by, or specific to, this module. See §3.4. |
| Pharmacists / Employees | **Ambiguous.** The codebase may contain both a `pharmacists` table and a separate `employees` table, with no documented rule for which is canonical. | Must be resolved by inspection before any scheduling-profile code is written — see §3.5. |
| Employee Accounts / Users | Existing auth/user table | Used for permission checks, audit `actor` field |
| Permissions / Roles | Existing RBAC | Extended with new permission keys (§26) |
| Annual Leave | **Does not exist yet as structured data.** `VacationRequestFlow.tsx` only generates a PDF leave request — there is no `leave_requests`/`annual_leave` table in the current migrations, and no separate Leave Management module has been built or scheduled. | This module owns a deliberately minimal, **temporary interim leave table** (see §3.3) scoped only to what scheduling needs — not a general leave/HR system. |
| Shifts / Shift Configuration | Existing shift config (if present) or new `duty_shift_types` if absent | Must be branch-configurable |

### 3.2 Integration Contract

The scheduler module must:

- Query pharmacist identity, active status, and branch/region assignment from the existing employee tables at generation time (not cache stale copies indefinitely).
- Query approved leave ranges from the **interim leave data access interface** (§3.3) for the generation window plus a lookback window (for continuity, see §17).
- Never write to the existing employee, branch, or region tables. All new/derived data lives in new scheduling-specific tables (§30), including the interim leave table.
- Handle "two pharmacists with identical names" by always keying on the existing unique employee ID, never on display name (see also §34 Edge Cases).

### 3.3 Interim Approach: Duty-Scheduler-Owned Leave Table (Temporary, In-Scope)

**Current state.** TabarakHub has no structured leave data today. `VacationRequestFlow.tsx` is a request-submission UI that produces a PDF; there is no `leave_requests` or `annual_leave` table, no approval-state machine, and no link to payroll. A dedicated, HR-integrated Leave Management module is a real future intention but has **no implementation and no committed timeline**.

**Decision (confirmed).** Because there is nothing to depend on yet, the Duty Scheduler will build and own a **minimal, explicitly temporary** leave table as part of its own migrations, scoped to exactly what scheduling needs — not a general leave/HR system.

**Interim entity — `duty_scheduler_leave_records` (name illustrative):**

| Field | Type | Notes |
|---|---|---|
| `employee_id` | FK (existing employee/pharmacist table, per §3.5) | Who the leave applies to |
| `leave_type` | enum | `ANNUAL` \| `SICK` \| `OTHER` — kept intentionally simple |
| `start_date` / `end_date` | date | Inclusive range |
| `status` | enum | `APPROVED` only is meaningful for scheduling purposes — this table does not model a request/approval workflow |
| `created_by` | FK (existing user) | Who entered the record |
| `created_at` | timestamp | Audit only |

**Explicit non-goals for this interim table:**

- No approval workflow, no PDF generation, no leave-balance tracking, no payroll integration. Those remain the responsibility of the future Leave Management module.
- Not a replacement for `VacationRequestFlow.tsx` — that flow continues to operate independently until a real Leave Management module supersedes it.
- No dedicated reporting UI beyond the bare-minimum entry screen a scheduler admin needs to keep the roster accurate (e.g. "record that Dr. X is on leave from A to B").

**Forward-compatibility requirement (important).** All leave reads inside the Scheduling Engine must go through a single data-access interface, e.g. `getApprovedLeaveForEmployee(employeeId, dateRange)` (§11). This is the only integration point that should reference `duty_scheduler_leave_records` directly. When a real Leave Management module is eventually built, this interface's implementation is swapped to query that module instead, the interim table's historical rows are migrated over, and the interim table is retired — with **zero changes required** to the Scheduling Engine, hard constraints (§13), or edge-case handling (§33). See the migration checklist in §36.

**Permission.** Entering/editing interim leave records requires a narrowly scoped permission, e.g. **"Manage Interim Leave Records"** (§26), separate from the eventual Leave Management module's own permission set.

### 3.4 Prerequisite: Regions Table (Foundational, Not Scheduler-Specific)

**Current state.** There is no `regions` table in the TabarakHub schema today; nothing normalizes "Region 1" / "Region 2" as a real entity, so branches cannot cleanly reference a region.

**Decision (confirmed).** Regions is core organizational data, not something specific to duty scheduling — it must be introduced as a **standalone, foundational migration that lands before Duty Scheduler work begins**, not as a scheduler-owned table and not as a quick enum bolted onto the Branch table.

Minimum shape:

```
regions
  id
  name
  code            (short stable identifier, e.g. "R1", "R2")
  is_active
  created_at / updated_at
```

Branches then gain (or correct) a `region_id` foreign key to this table. This migration should be treated as **Phase 0** of the overall project (§36) — it unblocks not just the Duty Scheduler but any future feature that needs to group branches by region, and it must be sized to support more than 2 regions without further schema change (per BR-15 / §32 Scalability).

### 3.5 Resolution Required: `pharmacists` vs `employees`

**Current state.** The real schema may contain a `pharmacists` table, an `employees` table, or both, with no documented rule for which is the source of truth for a working pharmacist's identity.

**Resolution rule for the implementing agent.** Before writing any scheduling-profile code:

1. Inspect both tables (if both exist) and identify which one is the foreign-key target for **Payroll/HRMS** (Tabarak Workforce HRMS), since that module is the authoritative source for an employee's real working status, GOSI/NHRA licensing data, and pay — it is the strongest signal for "source of truth."
2. If only one of the two tables is actively maintained (has recent writes, is referenced by auth/permissions, etc.), treat that one as canonical and the other as legacy/deprecated — flag the legacy table for the team's attention rather than silently ignoring it.
3. Record the decision at the top of the `pharmacist_scheduling_profiles` migration (§31) as a comment, so the choice is traceable, e.g. `-- employee_id references employees.id (chosen over pharmacists.id because HRMS payroll FKs to employees; see spec §3.5)`.
4. If genuinely both tables must be supported (e.g. a migration from one to the other is mid-flight), do not build the scheduling profile against both — pick the eventual target and treat the other as a temporary join, clearly commented as such.

This decision blocks §5 (Pharmacist Scheduling Profile) and must be finalized in Phase 0 alongside §3.4.

---

## 4. Scheduling Architecture

### 4.1 Layered Design

```
TabarakHub UI (Duty Scheduler screens)
        ↓
Scheduler API Layer (existing TabarakHub backend, new controllers/routes)
        ↓
Scheduling Application Service (orchestration: fetch data → build Input Model → invoke engine → persist result)
        ↓
Scheduling Engine (pure, UI-agnostic, independently testable)
   ├─ Input Model Builder
   ├─ Constraint Solver / Optimizer
   ├─ Validation Engine
   └─ Fairness Evaluator
        ↓
Schedule Result (Draft Schedule + Conflict Report + Metrics)
        ↓
Persistence (duty_schedules, duty_schedule_assignments, ...)
        ↓
Excel Renderer (separate concern, consumes persisted schedule only)
```

### 4.2 Architectural Rule

The Scheduling Engine (Input Model Builder → Solver → Validation → Fairness) must have **zero dependency on the UI layer or HTTP framework**. It must be callable as a pure function/service: `generateSchedule(inputModel, options) -> ScheduleResult`, so it can be unit-tested with fixture data independent of the database or UI (see §35 Test Scenarios).

### 4.3 Language/Stack Note for the Implementing Agent

Inspect the existing TabarakHub backend stack before choosing implementation technology for the engine. If TabarakHub's backend is not well-suited to constraint solving (e.g. it's a simple CRUD service), the engine may be implemented as an internal service/module within the same stack, or as a clearly-bounded internal library — but it must not require a second live deployment or a separate database unless the existing architecture already uses that pattern (e.g. if TabarakHub already runs a Python/OR-Tools microservice for another purpose, that pattern may be reused for consistency). Whatever is chosen, the four-stage pipeline in §4.1 must remain intact and independently testable.

---

## 5. Pharmacist Scheduling Profile

### 5.1 Purpose

A **scheduling profile** is new data attached to an existing pharmacist/employee record — it never duplicates the employee record itself.

### 5.2 Fields

| Field | Type | Description |
|---|---|---|
| `employee_id` | FK (existing) | Link to the existing pharmacist/employee. One profile per employee. |
| `role_type` | enum | `FIXED` \| `RELIEF` |
| `primary_branch_id` | FK (existing branch), nullable | Home branch. Required if `role_type = FIXED`. |
| `allowed_branch_ids` | FK list (existing branches) | Branches this pharmacist may be scheduled to. |
| `allowed_shift_types` | enum list | Subset of: `AM_ONLY`, `PM_ONLY`, `NIGHT_ONLY`, `MIXED`. These are eligibility categories, not literal shift codes — they are mapped to the branch's actual `shift_types_required` entries via a configurable mapping in Control Center (§26), e.g. `AM_ONLY` matches any branch shift whose `start_time` falls before noon. |
| `work_rest_mode` | enum | `DAYS_PER_WEEK` \| `FIXED_CYCLE` \| `VARIABLE_CYCLE` \| `CUSTOM_CALENDAR` (see §6). |
| `work_rest_config` | JSON | Mode-specific configuration payload (see §6.2). |
| `pattern_strictness` | enum | `HARD` \| `SOFT` — whether the pattern must be respected or is an optimization target (see §6.5). |
| `minimum_rest_hours` | decimal | Minimum rest between shift end and next shift start. |
| `maximum_consecutive_working_days` | integer | Hard ceiling, independent of pattern value (see §5.4). |
| `weekend_preference` | JSON, optional | Soft preference data (e.g. prefers Fridays off). |
| `is_active` | boolean | Soft-disable without deleting the profile. |
| `effective_from` / `effective_to` | date, nullable | Supports mid-period start/leave (see §34). |

### 5.3 Independence of Concepts (Critical)

`work_rest_config`, `maximum_consecutive_working_days`, and any weekly-off target are **stored and evaluated independently**. A pharmacist may simultaneously have:

- Weekly target: 1 rest day
- Maximum consecutive working days: 8
- Preferred pattern: `6,7,3,8`

The engine evaluates all three every time it considers an assignment; none is derived from another.

### 5.4 Safety Guardrail (Non-Negotiable)

A pattern value (e.g. `8` inside `6,7,3,8`) is a **target for how long a work streak may run before rest is due** — it never authorizes exceeding `maximum_consecutive_working_days` or violating `minimum_rest_hours`. If a pattern's next target exceeds the hard ceiling, the hard ceiling wins and the pattern is flagged as deviated (see §14).

### 5.5 Example Profile (illustrative only)

```
Pharmacist: Dr. Ahmed
Role Type: FIXED
Primary Branch: Sanad 1
Allowed Branches: Sanad 1, Sanad 2
Allowed Shifts: MIXED (AM, PM)
Work/Rest Mode: VARIABLE_CYCLE
Pattern: 6,7,3,8 (Repeating)
Pattern Strictness: SOFT
Minimum Rest: 11 hours
Maximum Consecutive Working Days: 8
```

---

## 6. Work/Rest Pattern Engine

### 6.1 Purpose

A dedicated subsystem that determines, for each pharmacist and each day, whether they are eligible/required to work or rest — independent of branch coverage needs, which are reconciled separately (§14–§15).

### 6.2 The Four Modes

**Mode 1 — Days Per Week**
`{ "target_days_per_week": 3 }` — the engine distributes approximately N working days per calendar week for this pharmacist, adjusted around coverage needs. This is a target, not a rigid weekly quota; §14.2 governs deviation handling.

**Mode 2 — Fixed Work/Rest Cycle**
`{ "work_days": 6, "rest_days": 1 }` (or 5→2, 3→4, etc.) — a repeating cycle of N consecutive work days followed by M consecutive rest days.

**Mode 3 — Variable Work/Rest Cycle**
`{ "cycle": [6, 7, 3, 8], "mode": "REPEATING" }` — each number is the **target streak length** before a rest is due; after each streak, one rest occasion is assigned, then the next number in the cycle becomes the new target. On reaching the end of the array, it restarts at index 0 (if `mode: REPEATING`) or the schedule falls back to a configured default (if `mode: ONE_TIME`).

**Mode 4 — Custom Calendar Pattern**
`{ "calendar": ["W","W","W","W","W","W","O","W","W","W","W","W","W","W","O", ...], "anchor_date": "2026-09-01" }` — an explicit day-by-day sequence anchored to a real date, replayed indefinitely (or for a configured length) from that anchor.

### 6.3 Pattern Interpretation Reference

For pattern `6,7,3,8`:

| Cycle | Target consecutive work days | Then |
|---|---|---|
| 1 | 6 | Assign rest |
| 2 | 7 | Assign rest |
| 3 | 3 | Assign rest |
| 4 | 8 | Assign rest |
| repeat from cycle 1 | ... | ... |

This interpretation still yields to: annual leave, existing locked assignments, minimum rest, branch coverage, shift eligibility, and any other hard constraint (§13).

### 6.4 Rolling State (Required)

Because patterns must survive schedule boundaries (§17), the engine persists, per pharmacist, a rolling state (see §16 for the full field list), most importantly:

- `current_consecutive_working_days`
- `current_consecutive_rest_days`
- `current_pattern_cycle_index` (which position in the pattern array is active)

This state is read at the start of every generation run and updated at the end of it — it is never reset to zero just because a new schedule period begins.

### 6.5 Hard vs. Soft Pattern

`pattern_strictness` on the profile determines behavior on conflict:

- **HARD** — the solver treats the pattern's rest requirement as a hard constraint; if it cannot be honored, the run must surface an unsatisfiable-coverage conflict (§21) rather than silently overriding it.
- **SOFT** (default) — the solver treats the pattern as an optimization target; it may deviate when required for coverage, but must record a **Pattern Deviation** entry (see §14.3) explaining why.

---

## 7. Fixed Pharmacist Rules

- A pharmacist with `role_type = FIXED` and a `primary_branch_id` is prioritized for assignment to that branch.
- The engine must not move a fixed pharmacist to a different branch to solve a coverage gap elsewhere, even if that would improve global fairness — branch fixation is a hard constraint, not a preference.
- A fixed pharmacist may still be included in `allowed_branch_ids` beyond their primary branch (e.g. Sanad 1 primary, Sanad 2 also allowed) — but the solver should prefer the primary branch first, and only use secondary allowed branches when the primary branch's needs are already met or cannot use this pharmacist that day.

---

## 8. Relief Pharmacist Rules

- A pharmacist with `role_type = RELIEF` exists specifically to cover: weekly rest day coverage, annual leave coverage, absence coverage, and general operational shortages.
- Relief pharmacists have their own `allowed_branch_ids` pool, which may be 1, 2, 3, or more branches — never assume relief pharmacists are branch-agnostic.
- Relief assignment priority when covering a gap (see §11.2):
  1. Eligible relief pharmacist within the affected branch's allowed pool.
  2. Eligible non-relief pharmacist within the affected branch's allowed pool (if their own pattern/coverage load permits without violating hard constraints).
  3. Other explicitly configured coverage resource (e.g. a manager-flagged exception; requires the "Manual Override" permission).
- Using a relief pharmacist must never violate that relief pharmacist's own hard constraints (rest, leave, allowed branches/shifts).

---

## 9. Branch Requirements

### 9.1 Branch Coverage Configuration

**Gap confirmed.** As of this specification, the existing Branch table has **none** of the following columns — this is not an "existing or lightly-extended" situation, it is a required **additive migration** on the existing table (new nullable/defaulted columns, never a new parallel branch table):

- `is_24_hour: boolean` — does not exist; add with a sensible default and backfill per branch before relying on it.
- `shift_types_required: [{ code, name, start_time, end_time, staff_required }]` — does not exist; configurable per branch, not hard-coded to "AM/PM/NIGHT" labels. Likely modeled as a related table (e.g. `branch_shift_types`) rather than a JSON column, depending on the existing schema's conventions.
- `region_id` — depends on §3.4's Regions migration landing first; this column is added/corrected once `regions` exists.
- `is_active: boolean` — does not exist; supports temporary closure, see §34.

This migration should be sequenced in Phase 0 (§36), immediately after or alongside the Regions migration (§3.4), since both are additive changes to the same table and should not be done as two separate uncoordinated migrations.

### 9.2 Coverage Rule

For every open day, every configured shift on that branch requires `staff_required` (default 1, but configurable to support multi-pharmacist shifts) eligible pharmacists assigned. 24-hour branches: 3 shift slots/day by default configuration. Non-24-hour branches: 2 shift slots/day by default configuration. Both counts are derived from `shift_types_required`, never hard-coded as "3" or "2" in code.

### 9.3 Allowed Branches Per Pharmacist

Each pharmacist has `allowed_branch_ids`. The engine must never assign a pharmacist outside this list unless an authorized manual override is performed by a user holding the "Manual Override" permission, and that override is logged (§27).

---

## 10. Shift Rules

### 10.1 Fixed Shift Types

A pharmacist's `allowed_shift_types` may restrict them to exactly one of `AM_ONLY`, `PM_ONLY`, `NIGHT_ONLY` — in which case the engine must never assign a different shift type to them, ever, including as emergency coverage (that requires a manual override with explicit logging, not an automatic engine decision).

### 10.2 Mixed Shift Pharmacists

`MIXED` pharmacists may receive different shift types on different days, subject to §10.3.

### 10.3 Shift Transition Safety (Hard Constraint)

The engine must never schedule a transition where the actual rest between `previous_shift_end_datetime` and `next_shift_start_datetime` is less than `minimum_rest_hours`. This is computed from real timestamps, not shift labels — e.g. a NIGHT shift ending at 08:00 followed by an AM shift starting at 08:00 the same "day label" is evaluated by elapsed hours, not by comparing "NIGHT" to "AM" as strings.

At minimum, PM → AM (next calendar day) must be blocked whenever the computed rest gap is insufficient. Example:

- Monday PM → Tuesday AM: **allowed** only if the actual gap ≥ `minimum_rest_hours`.
- Monday PM → Tuesday AM: **blocked** if the gap is insufficient.

**Timezone safety (required).** All shift start/end timestamps must be stored and compared in a single canonical timezone — Bahrain local time (UTC+3, no daylight-saving changes) — before any rest-hour arithmetic. If the underlying database stores timestamps in UTC (common default), the engine must consistently convert to Bahrain local time (or consistently work in UTC end-to-end) before computing gaps; it must never compare a naive local-time string on one side of the calculation against a UTC value on the other. This matters specifically for NIGHT shifts that cross midnight and for any future multi-country expansion — treat timezone as an explicit, tested part of §10.3, not an implementation detail left to chance.

---

## 11. Annual Leave Integration

### 11.1 Behavior

- The engine reads approved annual leave via the `getApprovedLeaveForEmployee(employeeId, dateRange)` interface (§3.3), backed today by the interim `duty_scheduler_leave_records` table, for the generation window (plus a small buffer to catch leave starting/ending mid-window). This interface is the only thing the engine ever depends on — the underlying table may be replaced later without touching this logic.
- During any approved leave date, the pharmacist receives **zero** shift assignments. This is a hard constraint (§13).
- The scheduler must never write to or duplicate leave data — it is read-only from this module's perspective, and it must never fall back to reading `VacationRequestFlow.tsx`'s PDF output as a data source.

### 11.2 Coverage Search on Leave

When a pharmacist is unavailable due to leave, the engine searches for replacement coverage using the priority order in §8, and never breaks a hard constraint to fill the gap. If no valid replacement exists, the gap is reported as an unsatisfiable-coverage conflict (§21), not silently left unfilled without explanation.

---

## 12. Weekly Rest Logic

- "Weekly rest" is **not** interpreted as "exactly every 7 days." It is one input among several:
  - Weekly rest target (from `DAYS_PER_WEEK` mode, if used)
  - Minimum rest frequency implied by the pattern mode in use
  - Maximum consecutive working days (independent hard ceiling)
  - The individual pharmacist's configured pattern
- These are evaluated together per pharmacist, not as a single global rule applied uniformly to everyone.

---

## 13. Hard Constraints (Never Automatically Violated)

1. Approved annual leave for the pharmacist on that date.
2. Inactive employee / inactive scheduling profile.
3. Branch not in the pharmacist's `allowed_branch_ids`.
4. Fixed-branch pharmacist assigned away from their primary branch (without manual override).
5. Fixed-shift pharmacist assigned a disallowed shift type.
6. Overlapping shifts for the same pharmacist on the same day.
7. Insufficient minimum rest between consecutive shifts (computed from actual timestamps, §10.3).
8. Required shift coverage left below `staff_required` when a valid assignment existed but was skipped (i.e. the solver must not leave a fillable gap unfilled).
9. Locked assignments must not be altered by an automated generation/regeneration run.
10. Invalid employee/branch combination not present in the eligible pool.
11. Any additional rule explicitly configured as hard by Control Center settings.

Hard constraints can only be overridden by an explicit, permissioned Manual Override action (§20), never by the automated engine.

---

## 14. Soft Constraints (Optimized, May Trade Off)

1. Workload fairness relative to each pharmacist's own configured capacity (§18).
2. Adherence to the configured work/rest pattern, when `pattern_strictness = SOFT`.
3. Weekend/Friday/Saturday fairness distribution.
4. AM/PM balance for MIXED pharmacists.
5. Night-shift distribution fairness.
6. Branch continuity (minimizing unnecessary branch switching for a given pharmacist).
7. Previous-schedule continuity (§17).
8. Relief workload balance among relief pharmacists.
9. Minimizing unnecessary branch changes across the whole roster.
10. Individual pharmacist preferences (e.g. weekend preference), lowest priority.

### 14.1 Constraint Priority Order (used when trade-offs are required)

1. Safety (rest, transitions)
2. Availability (leave, active status)
3. Leave
4. Branch eligibility
5. Shift eligibility
6. Required coverage
7. Rest requirements (duplicated emphasis intentional — never traded away)
8. Configured work pattern
9. Fairness
10. Individual preferences

### 14.2 Deviation Handling

If honoring a soft pattern or weekly target would break coverage, the engine must:

1. Preserve all hard constraints.
2. Generate the best feasible schedule given that trade-off.
3. Record a **Pattern Deviation** entry.
4. Attach a human-readable explanation.

Example deviation record:

```
Pattern deviation
Pharmacist: Dr. Ahmed
Target: 6 consecutive work days
Actual: 7
Reason: Sanad 2 PM coverage required and no other eligible pharmacist was available.
```

### 14.3 3-Days-Per-Week Guardrail

A pharmacist configured for `DAYS_PER_WEEK: 3` must not be silently forced toward a 6-day pattern by any default logic. Their expected workload baseline (used for fairness comparisons, §18) is derived from their own configured 3-day target — not from a global default.

---

## 15. Fairness Algorithm

### 15.1 Definition

Fairness is **not** "everyone works the same number of days." It is measured against each pharmacist's **own configured workload expectation and scheduling capacity**, accounting for differing patterns, contracted days, shift/branch eligibility, fixed assignments, relief responsibilities, and leave.

### 15.2 Workload Metrics Tracked Per Pharmacist

- Total working days
- Total shifts
- AM / PM / NIGHT shift counts
- Friday / Saturday shift counts
- Weekend assignment count
- Branch-change count
- Relief-assignment count
- Consecutive working days (current streak and historical)
- Rest day count
- Annual leave day count
- Composite **Workload Score**

### 15.3 Workload Score

Configurable weights, stored in Control Center (§26), example defaults (all overridable, never hard-coded):

```
AM weight: 1.0
PM weight: 1.0
NIGHT weight: 1.25
Weekend additional weight: configurable
```

`workload_score = Σ (shift_count_by_type × weight_by_type) + weekend_bonus`

### 15.4 Fairness Evaluation

For each pharmacist, compute `variance = actual_workload_score − expected_workload_score` (expected derived from their own configured capacity over the period). The optimizer seeks to minimize the spread of variance across pharmacists who share comparable configured capacity — it never directly compares a 3-day/week pharmacist's raw count against a 6-day/week pharmacist's raw count.

Fairness is evaluated per the priority order in §14.1 — it never overrides a hard constraint.

---

## 16. Previous Schedule Continuity & Rolling State

### 16.1 Rolling State Per Pharmacist

Persisted and updated after every generation run:

```
current_consecutive_working_days
current_consecutive_rest_days
current_pattern_cycle_index
last_shift_type
last_branch_id
last_shift_end_datetime
total_workload_score (period-to-date)
recent_workload_score (rolling window)
weekend_assignment_count
upcoming_annual_leave (cached lookahead)
```

### 16.2 Use as Input, Not Hard Constraint

When generating a new period using a previous schedule as input, the engine considers: previous branch, previous shift, previous workload, previous rest day, AM/PM pattern, recent consecutive workdays, and recent branch changes — all as soft-optimization inputs. The previous schedule must never become a hard constraint that blocks an otherwise-valid new assignment.

### 16.3 Schedule Boundary Rule (Critical)

Work/rest counters are **never reset to zero** just because a new schedule generation begins. If Dr. Ahmed worked Mon–Sat (6 consecutive days) in the previous schedule and the new schedule begins Sunday, the engine must treat Sunday as **day 7 of the current streak**, not day 1. This applies across week boundaries, month boundaries, and year boundaries alike (see also §17.2 and §34).

---

## 17. Variable Work Patterns — Cross-Period Behavior

### 17.1 Monthly Generation Example

If the previous month ended with a pharmacist at 5 consecutive working days, the first day of the new month is evaluated as day 6 of that streak, not day 1 of a fresh count.

### 17.2 Example Rolling Application of `6,7,3,8`

```
Week 1: W W W W W W O        (streak target 6 reached, rest assigned)
Week 2: W W W W W W W O      (streak target 7 reached, rest assigned)
Week 3: W W W O              (streak target 3 reached, rest assigned)
Week 4: W W W W W W W W O    (streak target 8 reached, rest assigned)
```

The actual generated schedule may differ from this idealized pattern because branch coverage and other hard constraints take priority (see §6.5, §14.2) — the pattern is an optimization target unless configured as `pattern_strictness = HARD`.

---

## 18. Schedule Generation Flow

### 18.1 Generation Options

The manager selects:

- Period: **1 Week / 2 Weeks / 1 Month / Custom Date Range**
- Scope: **Region 1 / Region 2 / All Regions** (regions come from existing TabarakHub data — never hard-coded to exactly two)
- Optionally: previous schedule to use as continuity input (defaults to the most recent published schedule for the overlapping branches, if any)

### 18.2 Generation Pipeline

```
Existing TabarakHub Data (branches, pharmacists, leave, users)
        ↓
Branch Requirements (coverage needs per day/shift)
        ↓
Pharmacist Profiles (eligibility, patterns, limits)
        ↓
Work/Rest Pattern Evaluation (per-pharmacist rolling state)
        ↓
Annual Leave Exclusion
        ↓
Previous Schedule Continuity (soft input)
        ↓
Locked Assignments (carried forward as fixed)
        ↓
Candidate Assignment Generation
        ↓
Hard Constraint Validation
        ↓
Optimization Pass (constraint solver)
        ↓
Fairness Evaluation
        ↓
Soft Constraint Scoring
        ↓
Draft Schedule + Conflict Report + Metrics
```

### 18.3 Determinism

Given identical input data, rules, previous schedule, locked assignments, and generation settings (including any solver seed), the result must be reproducible. No uncontrolled randomness is permitted; if the algorithm uses any randomized tie-breaking, it must be seeded and the seed stored with the generation run (§29).

### 18.4 Atomicity (Non-Negotiable)

A generation run is an **atomic operation**. The engine must persist the draft schedule (all `duty_schedule_assignments`), the conflict report, the generation run metadata, **and** the updated rolling state (§16) in a single database transaction. If any step fails — constraint violation, database error, timeout — the entire run rolls back to the pre-generation state. Partial schedules with updated rolling state (or vice versa) must never exist in the database.

This applies equally to regeneration (§22): a partial-scope regeneration commits the regenerated assignments and their corresponding rolling-state updates atomically, or not at all.

---

## 19. Conflict Detection

### 19.1 Unsatisfiable Coverage

If the engine cannot fill a required slot without violating a hard constraint, it must not silently produce an invalid or incomplete schedule. It must record a structured conflict:

```
Schedule cannot be fully generated.
Branch: Sanad 3
Date: 12 Sep 2026
Shift: PM
Required: 1 Pharmacist
Eligible: 0
Reason: All eligible pharmacists are:
  - On annual leave
  - Already assigned
  - Outside allowed branch list
  - Or unavailable due to rest constraints
```

### 19.2 Conflict Resolution Actions Offered to the Manager

- Assign an eligible relief pharmacist (if one becomes available/is added).
- Adjust allowed-branch configuration (requires "Manage Scheduling Profiles" permission).
- Adjust shift eligibility (requires the same permission).
- Modify the weekly rest rule for that pharmacist (requires "Manage Scheduling Rules").
- Perform a manual override (requires "Manual Override" permission) with mandatory reason text.
- Adjust leave coverage assignment.

Any action that changes master/profile data requires the corresponding permission and is captured in the audit log (§27).

---

## 20. Manual Override & Manual Adjustment

### 20.1 Post-Generation Manual Actions

- Change pharmacist on an assignment
- Change branch on an assignment
- Change shift on an assignment
- Mark a weekly off
- Mark unavailable
- Add emergency coverage
- Lock an assignment
- Unlock an assignment

### 20.2 Manual Validation Rules

- **Hard constraint violated →** the action is **blocked** with a clear message, e.g. *"Cannot assign Dr. Ahmed because he is on annual leave."* An authorized "Manual Override" permission holder may still force it, but must supply a reason, and the system logs it as an explicit override, distinct from a normal edit.
- **Soft constraint affected →** the action is **allowed with a warning**, e.g. *"Warning: this change will increase Dr. Ahmed's workload above the current comparable average."*

---

## 21. Locking

- Locks may be applied at three granularities: individual assignment, pharmacist+date, or branch+date (locking the whole day's roster for that branch).
- Locked assignments are excluded from any automatic solve/regeneration — the engine treats them as pre-fixed inputs, not as candidates to change.
- Locking/unlocking is a permissioned, audited action ("Lock Schedule" permission).

---

## 22. Regeneration

### 22.1 Supported Regeneration Scopes

- Regenerate entire schedule (within a version)
- Regenerate a selected date
- Regenerate a selected branch
- Regenerate a selected pharmacist's remaining assignments

### 22.2 Rule

Regeneration of any scope never modifies locked assignments; the solver treats them as fixed inputs in every scope above.

### 22.3 Concurrent Editing Guard

A schedule version in DRAFT or UNDER REVIEW status must not be silently modified by two users simultaneously. The system must enforce one of:

- **Pessimistic locking (recommended for v1):** When a user enters edit mode on a schedule version, a lightweight lock is acquired (stored in the schedule version record, e.g. `editing_user_id` + `editing_started_at`). Other users see a read-only view with a message: *"Schedule is being edited by [user]. View-only mode."* The lock expires after a configurable inactivity timeout (e.g. 15 minutes) or is released explicitly when the user exits edit mode.
- **Optimistic concurrency (alternative):** Each assignment carries a version counter; on save, the system checks that the counter has not changed since the user loaded it, and rejects stale writes with a merge prompt.

Either approach must also guard against a user editing a draft while another user triggers a regeneration (§22.1) on the same version — the regeneration must either wait for the edit lock to release, or be blocked with an explanatory message.

---

## 23. Versioning

- Every generation run produces a new **Schedule Version** under the schedule for that period (e.g. September 2026 → v1; after regeneration → v2; after a batch of manual changes the manager chooses to snapshot → v3).
- Version history is retained for audit and rollback reference; only one version per period is ever "Published" at a time, but prior versions remain queryable.

---

## 24. Schedule Status Lifecycle

```
DRAFT → UNDER REVIEW → PUBLISHED → ARCHIVED
```

- **DRAFT** — freshly generated, not yet reviewed.
- **UNDER REVIEW** — manager actively adjusting.
- **PUBLISHED** — official, operational schedule; drives the Excel export and any downstream operational views.
- **ARCHIVED** — superseded by a later published version or period has passed; retained for history/continuity input.

---

## 25. Audit

### 25.1 Events Tracked

- Schedule generation (including inputs used)
- Manual changes to assignments
- Lock / unlock actions
- Publish actions
- Regeneration actions
- Scheduling rule changes (Control Center)
- Scheduling profile changes

### 25.2 Fields Recorded Per Event

- Acting user (from existing TabarakHub user/account)
- Timestamp
- Old value
- New value
- Reason (mandatory for hard-constraint overrides; optional otherwise)

---

## 26. Control Center — Duty Scheduler Settings

New settings section: **Control Center → Duty Scheduler**, containing:

### 26.1 Scheduling Rules

- Default Minimum Rest (hours)
- Default Maximum Consecutive Working Days
- Default Work Pattern (fallback when a profile has no explicit pattern configured — used only as an explicit administrator choice, never as an implicit "6 and 1" assumption baked into code)
- Weekend definition/rules (e.g. which days count as weekend per region)
- Shift weights (AM/PM/NIGHT/weekend, used in Workload Score §15.3)
- Fairness weight (relative importance in the optimizer's objective function)
- Continuity weight (relative importance of previous-schedule continuity)
- Relief priority rules (ordering logic from §8)

All of the above are editable data, not constants in code.

---

## 27. Permissions

New/extended permission keys (added to the existing RBAC system, not a parallel one):

| Permission | Grants |
|---|---|
| View Duty Scheduler | Read-only access to schedules and dashboards |
| Generate Schedule | Trigger a new generation run |
| Edit Draft Schedule | Make manual changes to a DRAFT/UNDER REVIEW schedule |
| Manual Override | Force a hard-constraint-violating change, with mandatory reason |
| Lock Schedule | Lock/unlock assignments |
| Publish Schedule | Move a schedule to PUBLISHED |
| Manage Scheduling Profiles | Create/edit pharmacist scheduling profiles |
| Manage Scheduling Rules | Edit Control Center scheduling settings |
| Export Schedule | Produce the Excel export |
| View Audit History | Read the audit log for this module |
| Manage Interim Leave Records | Enter/edit rows in the temporary `duty_scheduler_leave_records` table (§3.3) — distinct from any future Leave Management module's own permissions |

Backend authorization must enforce every one of these server-side; UI-level hiding of controls is not sufficient.

---

## 28. UI/UX

### 28.1 Principle

The module must feel native to TabarakHub — reuse the existing design system's typography, colors, buttons, tables, modals, drawers, date pickers, toasts, icons, and responsive behavior. No new visual language.

### 28.2 Manager Workflow (Minimal-Click Priority)

1. Review staffing configuration
2. Review upcoming annual leaves
3. Select scheduling period
4. Select region
5. Click Generate Schedule
6. See coverage immediately
7. See conflicts
8. See fairness
9. Adjust manually
10. Lock assignments
11. Validate
12. Publish
13. Export to Excel

### 28.3 Post-Generation Summary Panel

Shown immediately after a run:

```
Schedule Generated
Period: 01–30 Sep 2026
Region: Region 1
Branches: 10
Pharmacists: 15
Required Shifts: 450
Covered: 448
Coverage: 99.56%
Hard Conflicts: 0
Soft Warnings: 4
Fairness: Good
```

### 28.4 Dashboard KPI Cards

Branches • Pharmacists • Required Shifts • Covered Shifts • Coverage % • Hard Conflicts • Soft Warnings • Annual Leave (count in period) • Relief Assignments (count in period).

**Filters and navigation.** The dashboard must support filtering by: Region (from §3.4), Branch, Pharmacist, and Date Range. Period navigation (Previous / Next period) must be available via clear controls. Comparison mode between two periods is deferred to Phase 2 (Appendix A).

### 28.5 Pharmacist Workload View

| Pharmacist | Work Days | Shifts | AM | PM | Night | Fri | Sat | Rest Days | Leave | Workload |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|

Plus: Expected workload, Actual workload, Variance (per §15).

### 28.6 Branch Coverage View

| Branch | Date | AM | PM | Night | Coverage |
|---|---|---|---|---|---|

### 28.7 Main Schedule Matrix

Resembles the existing TabarakHub operational schedule view. Supports columns/indicators for: Date, Day, Pharmacist, Location, Time, Leave, Weekly Off, Relief indicator, Lock indicator, Conflict indicator. Optimized for desktop operational use (this is a dense operational tool, not a mobile-first flow).

---

## 29. Schedule Matrix — Data Model Behind the UI

The matrix is a rendering of `duty_schedule_assignments` for the selected period/branch/region, joined with pharmacist display data, leave data, and lock/conflict flags computed at read time (or denormalized at generation time for performance — implementer's choice, but conflict/lock flags must always reflect current state, not stale cached state).

---

## 30. Excel Export

### 30.1 Requirement

The system must export the generated/published schedule to Excel, matching the **existing operational schedule format already in use** — not a generic flat table dump.

### 30.2 Mandatory Implementation Step

The implementing agent must inspect the actual reference workbook (to be provided separately) and reproduce:

- Sheet structure
- Header rows
- Merged cells
- Pharmacist columns
- LOCATION / TIME sub-structure per pharmacist block
- Date and Day rows
- Cell formatting, borders, column widths, row heights
- Print settings, freeze panes, page orientation
- Any existing formulas that must be preserved

Reference structure (conceptual only — exact structure must come from the real workbook):

```
DATE
DAY

DR.DALIA
LOCATION
TIME

DR.BASHA
LOCATION
TIME

DR.ELKINAWI
LOCATION
TIME
...
```

### 30.3 Status Mapping

WEEKLY OFF and ANNUAL LEAVE are distinct statuses and must be rendered distinctly per the existing workbook's conventions (not merged into a generic "off" cell).

### 30.4 Relief Indication

When a pharmacist is covering another, the Excel output must indicate this using the existing workbook's convention if one exists — do not invent a new notation ahead of inspecting the reference file.

---

## 31. Database Architecture

### 31.1 Mandatory First Step

Before creating any new tables, the implementing agent must inspect the existing TabarakHub schema and reuse: Employees, Employee Accounts, Branches, Regions, Users, Permissions, and any existing Shift configuration table. Only create new tables for genuinely new, scheduling-specific concepts.

**Leave storage is interim and deliberately minimal.** Per §3.3, the Duty Scheduler owns a single, narrowly-scoped `duty_scheduler_leave_records` table purely to feed the scheduling engine — it must not grow balance-tracking, approval-workflow, or payroll fields. Access it only through the `getApprovedLeaveForEmployee` interface so it can be swapped out cleanly if/when a full Leave Management module is eventually built (see the migration checklist in §36).

### 31.2 Conceptual New Entities (Names Are Illustrative — Adapt to Existing Conventions)

```
pharmacist_scheduling_profiles
pharmacist_allowed_branches
pharmacist_allowed_shifts
pharmacist_work_patterns
pharmacist_rolling_state
duty_shift_types                  (only if branch-level shift config doesn't already exist)
duty_schedules
duty_schedule_assignments
duty_schedule_locks
duty_schedule_generation_runs
duty_schedule_changes             (audit trail for manual edits)
duty_schedule_conflicts           (structured conflict/deviation records)
duty_scheduler_leave_records      (interim, temporary — see §3.3; retire once a real Leave Management module exists)
```

The implementing agent must adapt naming, normalization, and foreign keys to match the existing TabarakHub database architecture and conventions (naming style, ID types, soft-delete pattern, timestamps, etc.).

---

## 32. Performance & Scalability

- The system must not hard-code current counts (illustrative: 20 pharmacies, 29 pharmacists, 2 regions). It must continue to function correctly as these scale (e.g. 30+ branches, 50+ pharmacists) without code changes — only data growth.
- Generation for a full month across all regions/branches at realistic scale should complete within a UI-reasonable time (define and document an internal SLA appropriate to the chosen solver technology, e.g. seconds to low tens of seconds); if the solver approach risks exceeding this at scale, the implementing agent should note the chosen mitigation (e.g. decomposing by region, incremental solving) in its implementation notes.
- Reads for dashboards/matrix views should be indexed appropriately (by branch, date range, pharmacist) to remain responsive as history accumulates.

---

## 33. Security

- Use the existing TabarakHub authentication and RBAC exclusively — no parallel auth mechanism.
- Enforce every permission in §27 server-side.
- Manual overrides and any hard-constraint bypass require both the specific permission and a recorded reason.
- All new endpoints must validate that the acting user's role/permissions match the action being performed, independent of what the UI displays.

---

## 34. Edge Cases

The implementation must explicitly handle:

1. Pharmacist starts mid-month → profile `effective_from` used; no assignments before that date, no false "gap" reported for pre-start days.
2. Pharmacist leaves mid-month → profile `effective_to` used; no assignments after that date; existing assignments before it remain valid.
3. Annual leave starts/ends mid-schedule → partial-period exclusion, not all-or-nothing.
4. New pharmacist added mid-period → included in subsequent regeneration scopes, not retroactively conflicting with already-locked history.
5. Pharmacist becomes inactive → immediately excluded from future candidate pools; existing published assignments are not silently deleted (require explicit handling/reassignment).
6. Branch temporarily closed → excluded from coverage requirements for the closed dates; existing assignments during closure flagged for review.
7. Branch temporarily changes operating hours (e.g. 24h → reduced hours) → shift requirement count for those dates adjusts accordingly (§9).
8. Shift time changes → transition/rest calculations use the shift times in effect at the time of the assignment, not retroactively recalculated unless explicitly regenerated.
9. Emergency absence → manual "mark unavailable" + emergency coverage flow (§20.1), fully audited.
10. Relief pharmacist unavailable → falls through the priority chain in §8; if exhausted, surfaces as an unsatisfiable-coverage conflict (§19).
11. Two pharmacists with identical display names → always resolved and stored by existing unique employee ID; UI must disambiguate visually (e.g. branch, employee ID suffix) wherever both could appear together.
12. Missing branch eligibility (pharmacist has none configured) → profile is flagged incomplete and excluded from auto-generation until configured; not silently defaulted to "all branches."
13. Missing shift eligibility → same treatment as above.
14. Conflicting work patterns (e.g. two hard constraints that cannot both hold) → surfaced as a configuration-level conflict at profile save time, not discovered only during generation.
15. Insufficient total staffing for required coverage → surfaced as unsatisfiable-coverage conflicts per branch/date/shift (§19), not partially hidden.
16. Schedule generation across month boundaries → rolling state continuity applies (§16.3, §17.1).
17. Schedule generation across year boundaries → same continuity logic; date handling must be calendar-year-agnostic.
18. Leap year / date handling → all date arithmetic must use a real calendar library, never manual day-count assumptions (e.g. don't assume 28-day February).

---

## 35. Acceptance Criteria & Test Scenarios

### 35.1 Acceptance Criteria (Summary)

- The engine never violates a hard constraint (§13) in an automated run.
- The engine never silently produces an incomplete schedule; every gap is a reported conflict (§19).
- Locked assignments are never altered by generation/regeneration.
- Individual work/rest patterns are respected as configured, subject to the hard/soft strictness setting (§6.5).
- Fairness is evaluated against each pharmacist's own configured capacity (§15).
- The same inputs always produce the same output (§18.3).
- Excel export matches the reference operational workbook format (§30).

### 35.2 Test Scenarios

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Pharmacist with pattern `6,7,3,8` scheduled across multiple periods | Rolling pattern is correctly maintained across period boundaries, per §16–§17 |
| 2 | Pharmacist configured for 3 workdays/week | Never forced into a 6-day/week schedule (§14.3) |
| 3 | Pharmacist on approved annual leave | Receives zero assignments during the leave window |
| 4 | PM shift → AM shift next day | Blocked if computed rest gap violates minimum rest (§10.3) |
| 5 | Fixed AM-only pharmacist | Never receives a PM assignment |
| 6 | Fixed-branch pharmacist | Never auto-moved to a different branch |
| 7 | Relief pharmacist | Only assigned within their configured allowed branches |
| 8 | 24-hour branch | Receives 3 shift slots/day per its configuration |
| 9 | Non-24-hour branch | Receives 2 shift slots/day per its configuration |
| 10 | Previous schedule provided as input | Influences the newly generated schedule (continuity, §16) |
| 11 | Schedule boundary continuation | Consecutive-day counter continues correctly from the previous schedule, not reset to zero |
| 12 | Manual change causing a hard violation | Blocked, with an explanatory message |
| 13 | Manual change causing a soft violation | Allowed with a warning; authorized users may proceed |
| 14 | Locked assignment present during regeneration | Assignment survives regeneration unchanged |
| 15 | No valid coverage exists for a slot | System shows an explainable conflict report instead of an invalid/incomplete schedule |

---

## 36. Implementation Guidance for the Coding Agent

### 36.0 Phase 0 — Prerequisites (Do Before Any Scheduler Code)

These four items were surfaced by a schema review and must be closed before Phase 1 (§36 item 9) begins:

1. **Create the Regions migration** (§3.4) — standalone, foundational, not owned by the Scheduler.
2. **Extend the Branches table** with `is_24_hour`, `shift_types_required` (or equivalent related table), and `is_active` (§9.1) — additive migration, sequenced together with #1 since both touch the Branch table.
3. **Resolve `pharmacists` vs `employees`** (§3.5) and document the decision in the `pharmacist_scheduling_profiles` migration itself.
4. **Stand up the interim `duty_scheduler_leave_records` table** (§3.3) and the `getApprovedLeaveForEmployee` interface, so the Scheduling Engine never has a direct dependency on a leave table's shape.

None of the remaining implementation phases below should begin until these four are in place — building against guessed/assumed schema here is exactly what produced the original gap analysis this section responds to.

### 36.1 General Guidance

1. **Inspect before building.** Read the existing TabarakHub database schema, API structure, and frontend design system fully before writing any new code. This document's entity names are conceptual — the real schema is the source of truth for naming and structure.
2. **Build the engine as a pure, testable module first.** Implement §4's Scheduling Engine independent of any HTTP/UI code, with a clear function signature accepting an Input Model and returning a Schedule Result + Conflict Report + Metrics. Write the test scenarios in §35.2 against this pure engine before wiring up the UI.
3. **Do not hard-code any business figures** mentioned in this document (shift counts, branch counts, pharmacist counts, region counts, default patterns, rest hours, weights). All must be configurable data, sourced from the database or Control Center settings (§26).
4. **Implement hard constraints as non-bypassable validation** inside the engine (rejected candidates never reach the optimizer's output) — implement soft constraints as scored objectives inside the optimizer, not as post-hoc filters.
5. **Persist rolling state (§16) transactionally** with each generation run, so that concurrent or repeated runs cannot corrupt continuity counters.
6. **Build the Excel exporter as a separate, later phase**, gated on receiving and inspecting the real reference workbook (§30) — do not guess its structure in a first pass.
7. **Wire permissions (§27) into every new API endpoint** from the start, reusing the existing RBAC middleware/pattern already present in TabarakHub.
8. **Log every audit event (§25) at the point of the state-changing action**, not reconstructed after the fact from other tables.
9. **Favor incremental delivery**: (a) profiles + Control Center config, (b) pure engine + tests, (c) generation API + draft persistence, (d) matrix UI + manual edit/lock/publish, (e) Excel export, (f) dashboards/audit views. Each phase should be independently demoable.
10. **When in doubt between "simplify to 6-and-1" and "support the individualized model," always choose the individualized model** — this is the explicit, most important business rule governing this entire module (see §1.4).
11. **Handle initial setup gracefully.** When no previous schedule exists (first-ever generation run), all rolling state fields (§16) default to zero — the engine generates a fresh schedule without continuity input. This must not surface as an error or require manual pre-seeding of rolling state.

---

## Appendix A — Phase 2 / Future Enhancements (Deferred, Not Blocking)

A schema/code review also surfaced additional enhancement ideas beyond the core MVP scope above. These are intentionally kept out of the core specification so Phase 1 stays focused — they should be scoped as their own follow-up work once the module in this document is live. Known items:

- **Notifications.** Notify pharmacists (and/or managers) when a new schedule is published, when a manual change affects them, or when a conflict needs attention — via whatever notification channel TabarakHub already uses (email/push/in-app), not a new channel built for this module alone.
- **Public Holidays.** A configured public-holidays calendar that the engine treats as a special coverage/fairness input (e.g. different staffing requirements, holiday-pay-adjacent weighting in the Workload Score, §15.3) — distinct from both weekly rest and annual leave.
- **Pharmacist Mobile View.** A read-only (or lightly interactive) view for individual pharmacists to see their own upcoming assignments, likely surfaced through whatever mobile/self-service surface TabarakHub already has (the existing HR self-service module inside [[tabarak-hub]] may be the natural home for this rather than a new mobile app).
- **Shift Swap / Exchange Requests.** Allow two pharmacists to request swapping their assigned shifts. The system validates both sides against all hard constraints (§13) before presenting the swap to a manager for approval. Swaps are audited (§25) and update rolling state (§16) for both pharmacists.
- **Dashboard Period Comparison.** Side-by-side comparison of two schedule periods — workload variance, coverage trends, fairness drift — to help managers identify patterns over time.
- **Bulk Data Import.** CSV/Excel import for initial pharmacist scheduling profiles when onboarding the module, and for bulk updates to allowed branches/shifts.
- **Shift Handover Notes.** Optional free-text notes attached to a shift assignment, visible to the incoming pharmacist — e.g. "Patient X's prescription is pending verification."
- **Reporting & Analytics.** Exportable reports beyond the schedule itself: pharmacist utilization rates, branch coverage trends, pattern deviation frequency, relief pharmacist demand forecast.

None of these affect the Phase 0 prerequisites or the core engine design in §4–§21 — they can be layered on afterward without schema rework, provided Phase 0 and the core module are built as specified.

---

*End of specification.*
