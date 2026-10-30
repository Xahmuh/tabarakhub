# Payroll and attendance decisions — 2026-10-18

## Confirmed business scope

- One company with several branches. No multi-company tenancy is required.
- POS is data entry for lost sales and shortages only; it does not sell stock.
- Cashflow reads its own data-entry records; payroll must not assume sales,
  purchases, or other application modules are a cashflow source.
- Owner and Accounts can see all employees' payroll and both must approve a
  payment run. Only Owner may change salary fields. Driver can see only their
  own eventual published payslip.
- Employee clock-in and clock-out require a button press inside the assigned
  branch geofence. Employee modules may move to a separate mobile app.
- Owner sets deduction amounts case by case in the app. No deduction formula,
  penalty amount, shift allowance, overtime multiplier or GOSI percentage may
  be hard-coded. Overtime needs approval before payment.

## Meaning of the attendance button

The employee signs in to their own account. On button press, the app asks the
phone for a fresh location and accuracy, then sends the requested action and
coordinates to an authenticated server endpoint. The server resolves the
employee from the signed-in user, loads assigned branch coordinates from the
database, checks distance and accuracy, and writes **server time** and outcome
to an append-only attendance record. The client cannot choose employee ID,
branch, timestamp or confirmation status. An offline attempt stays pending and
never becomes an official punch until the server accepts it. GPS alone cannot
prove physical presence because device locations can be spoofed; suspicious
attempts need a review path. No absence or lateness amount enters payroll
automatically: an approved deduction is a separate record.

`attendanceService.clockIn/clockOut` now reject every attempt. The previous
client path incorrectly saved a `CONFIRMED` punch in browser localStorage with
a client timestamp. Existing local records are historical preview data, not
verified attendance or payroll evidence. The kiosk buttons remain disabled
until the authenticated server flow is implemented and tested.

## Branch-entry approval example

If branch B1's shared account signs in from a new device, a manager may approve
that session as an administrative control. A real security gate would require
the server to attach the approval to that exact Auth session and check it on
every B1 data operation. An approval flag stored only in the browser or checked
once at login can be bypassed by calling Supabase directly. Branch-entry
approval does not replace an employee's own login for attendance.

## Payroll policy decisions still required

| Decision | Example that needs a company rule |
| --- | --- |
| Pay period and proration | A 300 BHD monthly salary, employee joins mid-month: calendar days, scheduled work days, or fixed 30-day divisor? |
| Unpaid leave and half days | Owner enters any resulting deduction amount; define what evidence and approval are required. |
| Shifts and overtime | Owner enters an exact amount if due; Owner and Accounts approve before the run. |
| Social insurance | Determine eligibility and actual amount from a verified source before adding a deduction proposal. |
| Other deductions | Owner sets the amount and reason per employee and month; Accounts verifies it. |
| Retroactive changes | How are corrections after a published month recorded without overwriting the old run? |
| Bank format | Which bank's actual batch specification and test file are required? |

## Two payroll spreadsheets

The supplied `WPS - Salary File.xlsx` was inspected locally for its column
layout only. Its sample employee rows are not copied into the repository.
Clean, empty workbooks are stored in `docs/templates/Company Payroll - Blank.xlsx`
and `docs/templates/LMRA WPS - Blank.xlsx`.

`services/payrollExportService.ts` builds both files from the **same frozen,
published payroll run**. The internal sheet contains employee identity, branch,
IBAN, LMRA-registered fixed salary, approved earnings (commission/bonus),
approved deductions, the portion allocated to fixed salary, net payable, pay
period and approval references. The LMRA sheet uses the supplied template's
exact ten headers in order. `Currency` is always `BHD`; `Social Allowance` and
`Variable Salary BHD` are numeric `0`; `Total Amount BHD` equals the
LMRA-registered fixed salary. The internal net may be higher because approved
commission and bonuses are handled separately.
The employee name, CPR/GCC ID, IBAN and fixed salary come from the approved run,
not from hard-coded examples.

The LMRA builder permits the internal net to differ from the WPS amount. The
owner confirmed the current rule: a deduction allocated to fixed salary stops
LMRA export for review; the system must not reduce `Total Amount BHD`
automatically. A later change needs confirmation of the WPS field mapping and
the deduction's permissibility. The company sheet keeps the
full deduction breakdown for reconciliation. This distinction was confirmed
by the owner: WPS pays the LMRA-registered fixed salary, while commission and
bonuses are paid outside that sheet.
Both builders reject incomplete identity/bank data, invalid BHD precision,
unreconciled totals, missing publication and missing distinct Owner/Accounts
approvals. These client-side checks are not authorization. A server-side
published-run workflow and private salary read policy remain required before
the UI enables live export.

Values in old screens (5/10/50 BHD, 1%, 1.25x and salary / 30) are examples,
not approved company rules. They are excluded from the current estimate. A
salary estimate cannot become payable until exact amounts and approvals are
saved with their source and tested against real examples.

## Release gate

1. Reconcile migrations against the live schema. The live `employees.salary_matrix`
   exists, but it has no corresponding Git baseline. Confirm backup and restore
   in staging before applying payroll migrations.
2. Move financial fields out of broadly readable `employees.salary_matrix` or
   otherwise restrict their reads at database level. A UI mask is not privacy.
   Database trigger protection of salary **writes** alone does not fix reads.
3. Implement authenticated employee geofence RPC, immutable punches, exception
   review and role/branch RLS. Test inside, outside, inaccurate, missing GPS,
   duplicate, offline and forged-employee cases with real accounts.
4. Implement versioned company rules, draft payroll run, frozen source snapshot,
   Owner and Accounts decisions by different users, then publish. Bank export
   and payslips must read only that same published run.
5. Reconcile one historical month by hand, test bank file with the target bank,
   and run an end-to-end restore drill before first live disbursement.

The repository's new Owner/Accounts migration is prepared but has **not** been
applied to the live project. No payroll payment, attendance deduction, or
official payslip is production-ready at this point.
