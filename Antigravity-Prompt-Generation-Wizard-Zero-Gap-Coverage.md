# Prompt for Antigravity — Schedule Generation Wizard: Zero-Gap Coverage & Pre-Generation Capacity Planning

## Context

This extends the existing Automated Duty Scheduler module (see `TabarakHub-Automated-Duty-Scheduler-Spec (2).md`, especially §18 "Schedule Generation Flow" and §11 "Annual Leave Integration"). Do not build this as a parallel/separate feature — it replaces and extends the current "Generate Schedule" popup in `ScheduleMatrixView.tsx`.

## The One Rule Everything Below Serves

**There must be zero gaps in coverage.** Every branch's every configured shift, on every day inside the selected period, must end up staffed. This is the single most important outcome of the whole module — every screen described below exists to help the manager see, in advance, whether the current pharmacist pool and rest settings can actually achieve that, and to fix it before generation runs rather than discovering gaps after.

---

## The Generation Popup — Required Flow (Multi-Step Wizard, Same Modal)

Turn the current single-step "pick dates and click generate" popup into a wizard with the following steps. Do not let the manager skip straight to generation without seeing the capacity summary in Step 3 — it's the whole point.

### Step 1 — Period Selection

- From-date / to-date pickers, as today.
- (Keep whatever region/branch scoping already exists in the modal alongside this.)

### Step 2 — Annual Leave Capture for This Period

Before any capacity math happens, let the manager enter every pharmacist's annual leave that falls inside the selected period, inline in the same popup:

- An "Add" control that opens a row with: pharmacist name (searchable picker, existing pharmacist list), leave start date, leave end date (both via date pickers).
- Support adding multiple pharmacists' leave entries one after another (repeatable rows, with a remove/delete per row before confirming).
- On confirm, write these to the existing interim leave table (`duty_scheduler_leave_records`, §3.3 of the spec) rather than creating a second leave store — this popup is just a fast-entry UI for the same table the engine already reads via `getApprovedLeaveForEmployee`.
- Show a brief loading state while these are saved and while Step 3's numbers are computed.

### Step 3 — Capacity & Coverage Summary (Before Generation Runs)

After the loading state, show a summary screen, computed from the branches/pharmacists in scope and the leave entries just captured:

**Required coverage side:**
- Total shifts required in the period (sum across every open branch, every day, every configured shift slot — per branch's `is_24_hour`/`shift_types_required`, §9.2).
- Broken down by shift type: total AM shifts, total PM shifts, total Overnight/Night shifts (only show the Night line if any in-scope branch actually has a night shift configured).

**Pharmacist side:**
- Total pharmacists in scope.
- How many are available vs. how many are on leave during any part of the period (from Step 2's entries plus any pre-existing approved leave already on file).

**Capacity calculation and the surplus/deficit message:**
- For each available pharmacist, compute their expected working days for the period from **their own configured scheduling profile** (work/rest pattern — §6, whatever mode/target they actually have set), not a flat number applied to everyone. Sum this into a total shift-capacity figure.
- Only pharmacists with **no scheduling profile configured yet** should fall back to a Control-Center-configurable default rest-days-per-period value — this default must be a setting, not a hard-coded number in code, and using it should be visibly flagged in the UI (e.g. "using default rest assumption — no profile set") so the manager knows which pharmacists are running on an assumption rather than their real configured pattern.
- Show the comparison in plain language, matching the tone of this example: *"You need 310 shifts this period. With 12 pharmacists and their current rest configuration, you have capacity for 312 shifts. That leaves a surplus of 2."*
- **If there's a surplus:** let the manager pick specific pharmacists (any number) from a list and assign each of them one or more additional rest days for this period, consuming the surplus. Recalculate the surplus live as they pick, so they can see it approach zero. This is a manual, per-period choice — it does not change the pharmacist's permanent scheduling profile, only this period's plan (store it as a period-scoped adjustment, not a profile edit).
- **If there's a deficit** (capacity < required shifts): this is the critical case, given the zero-gap rule. Show a clear, prominent warning — not a soft note — stating the shortfall (e.g. "Deficit of 6 shifts — full coverage is not achievable with current staffing and rest settings") and suggest concrete manager actions: add relief pharmacists, widen someone's allowed branches, or review rest configuration. Do **not** silently proceed to generation as if this is fine, and do not auto-shrink anyone's rest days to force the numbers to balance — that decision belongs to the manager.
- Be explicit in the UI (and to yourself while building this) that this is an **aggregate planning check**, not a guarantee. A global surplus does not prove every individual branch/shift/day will be covered — a specific branch could still come up short if eligible pharmacists don't line up with it. The real, authoritative answer is the Conflict Report produced by actual generation (spec §19). This screen exists to catch obviously-infeasible plans early and let the manager rebalance rest days before running the real solve — it is not a replacement for it.

### Step 4 — Weekend (Friday/Saturday) Distribution

- Show how many Fridays and how many Saturdays fall inside the selected period.
- Ask the manager how they want these specific days distributed: let them select a set of pharmacists (support 3, 4, or 5 names, not a fixed count) among whom these Friday/Saturday days will be split for this period.
- Store this as a period-scoped weekend-distribution input that the engine takes into account when assigning weekend coverage/rest for this run — treat it as a soft preference the solver optimizes toward (per the existing soft-constraint framework in spec §14), not a hard override that could itself reopen a coverage gap. If honoring the manager's exact weekend split would create a gap, the solver should deviate and log it the same way it logs any other soft-constraint deviation (§14.2), not silently break the zero-gap rule to honor a preference.

### Step 5 — Generate

- Only after Steps 1–4 are complete does the actual "Generate Schedule" action fire, using: the period, the freshly captured leave entries, the manager's surplus-absorption choices, and the weekend-distribution input, feeding all of it into the existing engine (per the engine work already specced/underway).

---

## Data/Engineering Notes

- The period-scoped adjustments introduced here (extra surplus-absorption rest days, weekend-distribution picks) are **inputs to a specific generation run**, not permanent profile changes. Model them as their own lightweight record(s) tied to the generation run/schedule period — don't overwrite `pharmacist_scheduling_profiles` with them.
- Reuse the existing shift-requirement and leave data sources — this wizard is a UI/orchestration layer in front of data and logic that should already exist (or is being built) in the engine and services layer; don't create a second calculation path that could drift from what the real solver does.
- The "required shifts" and "capacity" numbers shown in Step 3 should use the exact same shift-slot configuration (branch shift types, staff-required counts) that the real solver uses in Phase 2 of the engine work — if these two calculations diverge, the summary screen will lie to the manager, which is worse than not showing it at all.

## Acceptance Criteria

1. The popup is a wizard (period → leave entry → capacity summary → weekend distribution → generate), not a single form.
2. Annual leave entered in Step 2 lands in the same interim leave table the engine already reads — verify no duplicate leave storage was created.
3. Step 3's required-shifts figure matches, exactly, the shift-slot total the real generation run reports as required (no drift between the "preview" math and the "real" math).
4. Step 3's capacity figure is computed per-pharmacist from actual profile data, with a visibly flagged fallback only for pharmacists with no profile.
5. Surplus distribution lets the manager assign extra rest days to specific chosen pharmacists, scoped to this run only, and the summary recalculates live.
6. A deficit is shown as a hard warning, not a number quietly displayed alongside a "Generate" button that looks equally available.
7. Step 4 correctly counts Fridays/Saturdays in the selected range and accepts a manager-chosen list of 3–5 pharmacists to split them, feeding it into generation as a soft preference.
8. Generation still enforces every existing hard constraint (§13) regardless of what was chosen in Steps 3–4 — none of this wizard is allowed to introduce a way to bypass a hard constraint.
