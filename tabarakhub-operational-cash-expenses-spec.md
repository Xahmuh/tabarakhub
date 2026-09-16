# TABARAKHUB — OPERATIONAL CASH EXPENSES MODULE
## Full Product & Engineering Specification

> **Agent instructions:** This spec is written for an AI coding agent (Antigravity / Codex) working inside the existing TabarakHUB repository. Read the entire spec before writing any code. Inspect the existing codebase first (see Section 52) before implementing anything. Do not skip the "critical instruction" and "do not" sections — they define hard boundaries for this module.

You are working on an existing ERP/operations system called:

**TABARAKHUB**

Your task is to **CREATE** a new module called:

**"Operational Cash Expenses"**

This module must be implemented **INSIDE** the existing TabarakHUB system.

---

## 1. CRITICAL INSTRUCTION — EXISTING SYSTEM UI/UX

- DO NOT redesign TabarakHUB.
- DO NOT introduce a new visual language.
- DO NOT create a separate standalone application.
- DO NOT create a different dashboard style.
- DO NOT introduce a new navigation pattern.

The new module MUST look and behave as if it has always been part of the original TabarakHUB system.

Before implementing anything, inspect the existing TabarakHUB codebase and identify the existing:

- Design system
- Typography
- Colors
- Spacing
- Border radius
- Shadows
- Cards
- Buttons
- Inputs
- Selects
- Tables
- Modals / Dialogs
- Drawers
- Dropdowns
- Toast notifications
- Empty states
- Loading states
- Skeleton loaders
- Icons
- Page headers
- Breadcrumbs
- Filters
- Calendar components
- Responsive behavior
- Sidebar/navigation
- Permission patterns
- Data fetching patterns
- Form validation patterns

Reuse the EXISTING components wherever possible. If an existing component already solves a problem, USE IT. Do not duplicate components unnecessarily.

The result must be visually indistinguishable from other TabarakHUB modules.

**"Keep and follow same UI UX of TabarakHUB my original system" is a HARD REQUIREMENT.**

---

## 2. MODULE PURPOSE

Operational Cash Expenses is a simple operational reference module.

Its purpose is ONLY:

> "Record operational cash expenses paid by each pharmacy branch."

The module is **NOT**:
- an accounting system
- a sales tracking system
- a petty cash accounting system
- an approval workflow
- a reimbursement system
- a sales reconciliation system

It simply records: **"What operational cash expenses were paid by the branch?"**

The records are used as a reference for Accounts/Finance.

---

## 3. ABSOLUTELY NO SALES TRACKING

DO NOT connect this module to:

- Total Daily Sales
- Daily Sales
- POS Sales
- Cash Sales
- Sales Revenue
- Daily Deposit
- Bank Deposit
- Sales Reconciliation
- Sales Balance
- Net Sales
- Sales-to-expense calculations

- Do NOT display sales anywhere in this module.
- Do NOT calculate: `Sales - Expenses`.
- Do NOT show: "Expected Deposit"
- Do NOT create any sales-related KPI.

This module is COMPLETELY independent from the sales module. Even if another TabarakHUB module contains Daily Sales data, DO NOT use it here.

The only financial value this module tracks is: **EXPENSE AMOUNT**.

---

## 4. NO APPROVAL / REJECTION WORKFLOW

There is NO:

- Approval
- Rejection
- Pending Approval
- Approved
- Rejected
- Approval Queue
- Approval Workflow

Once the user saves an expense, it is immediately recorded. Status should effectively be: **RECORDED**.

Do not build unnecessary workflow logic.

---

## 5. MODULE NAVIGATION

Add the module to the existing TabarakHUB navigation according to the existing navigation architecture.

Suggested name: **Operational Cash Expenses**

Possible internal structure:

```
Operational Cash Expenses
│
├── Dashboard
├── Expenses
├── Fuel
└── Reports
```

Do not force this exact navigation if TabarakHUB has an established navigation pattern. Follow the existing system.

---

## 6. CORE EXPENSE CATEGORIES

The initial categories are:

1. Fuel
2. Maintenance
3. Supplies
4. Other

These categories must be configurable from the database/settings layer if the existing system supports configurable master data.

But the initial seeded categories MUST be: **Fuel, Maintenance, Supplies, Other**.

---

## 7. DYNAMIC EXPENSE FORM

The expense form MUST dynamically change based on the selected category. Do NOT show irrelevant fields.

### CATEGORY: FUEL

When the user selects `Expense Category = Fuel`, show:

- Vehicle
- Driver
- Last Odometer
- Current Odometer
- Amount
- Receipt
- Receipt Provided to Accounts

Fields:

- **Vehicle** — Required.
- **Driver** — Required.
- **Last Odometer** — READ ONLY. Automatically retrieved from the selected vehicle's odometer history.
- **Current Odometer** — Required. Entered manually by the user.
- **Amount** — Required.
- **Receipt** — Optional file/image upload.
- **Receipt Provided to Accounts** — Checkbox.

Example:

```
Vehicle: BIKE-003
Driver: Ahmed
Last Odometer: 42,850 km
Current Odometer: 42,930 km
Amount: 5.000 BHD
Receipt Provided to Accounts: [ ]
```

### CATEGORY: MAINTENANCE

When category = Maintenance, show only:

- Description
- Amount
- Receipt
- Receipt Provided to Accounts

Example:

```
Description: Replace motorcycle tire
Amount: 8.000 BHD
Receipt: Upload
Receipt Provided to Accounts: [ ]
```

Do NOT show: Driver, Vehicle, Odometer.

### CATEGORY: SUPPLIES

Show:

- Description
- Amount
- Receipt
- Receipt Provided to Accounts

Example:

```
Description: Cleaning materials
Amount: 3.500 BHD
```

### CATEGORY: OTHER

Show:

- Description
- Amount
- Receipt
- Receipt Provided to Accounts

Example:

```
Description: Emergency purchase
Amount: 2.000 BHD
```

---

## 8. RECEIPT TRACKING

Every expense should have:

- `receipt_url` / `receipt_attachment`
- `receipt_provided_to_accounts` (Boolean, default `false`)

The checkbox is **NOT** an approval. It is ONLY a document tracking field.

- Unchecked: Receipt has not yet been provided to Accounts.
- Checked: Receipt has been provided to Accounts.

When the checkbox changes to TRUE, store:

```
receipt_provided_to_accounts = true
receipt_provided_at = timestamp
receipt_provided_by = current_user
```

The checkbox must NOT prevent saving an expense. A receipt itself may be optional depending on the expense. Do not make receipt upload mandatory unless the existing business rules require it.

---

## 9. REFERENCE NUMBER

EVERY expense transaction MUST have a unique Reference Number.

**Format:** `BRANCHCODE-X-DDMMYY-SN`

Example: `T004-X-210826-001`

Meaning:

- `T004` = Branch Code
- `X` = Fixed transaction identifier
- `210826` = DDMMYY
- `001` = Sequential Number

Examples:

```
T004-X-210826-001
T004-X-210826-002
T004-X-210826-003
```

Next day: `T004-X-220826-001`

Another branch on the same day: `T005-X-210826-001`

The serial number is scoped by **Branch + Date**, NOT globally.

---

## 10. REFERENCE NUMBER RULES

The reference number must be:

- Automatically generated
- Unique
- Immutable
- Never reused

Once generated, editing the expense MUST NOT change the reference number.

Deleting an expense MUST NOT make its reference number available again.

Example: `T004-X-210826-001` = deleted. The system must NOT later generate `T004-X-210826-001` again. The next transaction remains `T004-X-210826-002`.

Use a safe database-level mechanism to guarantee uniqueness and prevent race conditions when multiple users create expenses simultaneously.

Do NOT generate the serial number only on the frontend. The backend/database must guarantee uniqueness.

---

## 11. BRANCH CODE

Each branch already exists in TabarakHUB. Use the existing branch master data.

Each branch must have a unique Branch Code. Example: `T004`

The Reference Number must use the branch's existing code. Do NOT hardcode branch codes in frontend logic.

```
branch.code = "T004"
Reference: T004-X-210826-001
```

---

## 12. EXPENSE DATE / TIME

Every transaction must store:

- `expense_date`
- `expense_time`
- `created_at`
- `created_by`

Use the existing TabarakHUB timezone/date handling. Do NOT hardcode timezone logic if the existing system already provides it.

The date used for the Reference Number must be `expense_date`, format `DDMMYY`.

Example: 21 August 2026 => `210826`

---

## 13. FUEL / ODOMETER LOGIC

Odometer belongs to the **VEHICLE**. NOT the driver. NOT the branch. This is a critical architectural rule.

Relationship:

```
Driver
   ↓
Vehicle Assignment
   ↓
Vehicle
   ↓
Odometer History
```

The selected vehicle determines the last odometer reading.

Example:

```
Vehicle: BIKE-003
Last Odometer: 42,850 km
Current Odometer (entered): 42,930 km
Distance Since Last Reading (calculated): 80 km
```

---

## 14. VEHICLE MASTER

Use the existing TabarakHUB vehicle system if one exists. If no suitable vehicle master exists, create a reusable vehicle master.

Vehicle fields:

- `id`
- `vehicle_code`
- `vehicle_type`
- `plate_number`
- `initial_odometer`
- `status`
- `created_at`
- `updated_at`

Vehicle Type examples: Motorcycle, Car

Example:

```
Vehicle Code: BIKE-003
Vehicle Type: Motorcycle
Plate Number: 12345
Initial Odometer: 42,350
Status: Active
```

---

## 15. INITIAL ODOMETER

When creating a vehicle, require: **Initial Odometer**

This becomes the first odometer history record.

Example:

```
Vehicle: BIKE-003
Initial Odometer: 42,350 km

History:
42,350 km
42,580 km
42,810 km
43,120 km
```

Current Odometer is effectively the latest valid history reading. Do NOT simply overwrite the previous reading without preserving history.

---

## 16. ODOMETER HISTORY

Create or reuse: `vehicle_odometer_history`

Each record should contain at least:

- `id`
- `vehicle_id`
- `odometer_reading`
- `reading_date`
- `reading_time`
- `source_type`
- `source_reference_id`
- `driver_id` (nullable)
- `branch_id` (nullable)
- `created_by`
- `created_at`

For Fuel transactions:

- `source_type`: `FUEL_EXPENSE`
- `source_reference_id`: expense transaction ID.

This creates a complete auditable odometer history.

---

## 17. ODOMETER VALIDATION

Current Odometer MUST NOT be lower than Last Odometer.

Example: Last = 42,930; user enters 42,800 → **Block save.**

Show an existing-system-style validation message such as:

> "Current odometer cannot be lower than the last recorded reading."

If `Current = Last`, allow it or warn according to existing validation conventions. Do not create a negative distance.

---

## 18. DRIVER

The existing TabarakHUB Driver/Employee data should be reused. Do not create duplicate drivers if an existing driver entity exists.

For Fuel: Driver is REQUIRED. Vehicle is REQUIRED. Driver and Vehicle are independent entities. Do not store odometer against the driver.

---

## 19. DRIVER / VEHICLE ASSIGNMENT

There is an existing Delivery / Dispatch module that is associated with drivers. The new module should integrate with that existing Driver/Vehicle relationship if available.

Recommended relationship:

```
Driver
   ↓
Driver-Vehicle Assignment
   ↓
Vehicle
```

A driver may work in multiple branches. A driver may use different vehicles over time.

Therefore: DO NOT make Vehicle permanently belong to one Driver. The vehicle has its own odometer history. The driver is simply the driver associated with the Fuel transaction.

If TabarakHUB already has a Driver-Vehicle Assignment system, reuse it. Do not duplicate the assignment system.

---

## 20. MULTI-BRANCH DRIVER SCENARIO

A driver may work at Branch A and later Branch B using the same vehicle. The odometer history remains **GLOBAL** to the vehicle.

Example:

```
BIKE-003
Aug 18: Branch A, Ahmed, 42,850 km
Aug 18: Branch B, Ahmed, 42,910 km
```

The second transaction must show:

```
Last Odometer: 42,850 km
Current: 42,910 km
Distance: 60 km
```

The system must NOT reset odometer based on branch.

---

## 21. EXPENSE DATABASE MODEL

Create/reuse: `expense_transactions`

Suggested fields:

```
id
reference_no
branch_id
category_id

expense_date
expense_time

amount
currency

description

paid_to

driver_id
vehicle_id

receipt_url
receipt_provided_to_accounts
receipt_provided_at
receipt_provided_by

created_by
created_at
updated_by
updated_at

deleted_at
```

Do not include sales-related fields. Do not include approval fields. Do not include rejection fields.

---

## 22. FUEL DATABASE MODEL

Fuel-specific information can be stored in: `fuel_expense_details` or equivalent architecture.

Suggested fields:

```
id
expense_id
vehicle_id
driver_id

previous_odometer
current_odometer
distance_since_previous

liters (nullable)
fuel_price_per_liter (nullable)

created_at
```

Important: Fuel Expense is still an Expense.

Relationship:

```
expense_transaction
        │
        └── fuel_expense_details
```

One expense = one fuel detail record when category = Fuel.

---

## 23. CURRENCY

Use **BHD** as the displayed currency. Do not hardcode currency formatting if TabarakHUB already has a currency utility. Use the existing currency formatting system.

Amounts should support appropriate decimal precision.

Display examples:

```
5.000 BHD
18.500 BHD
428.750 BHD
```

---

## 24. DASHBOARD

Create a dashboard consistent with the existing TabarakHUB dashboard style. The dashboard MUST focus ONLY on expenses. No sales. No deposits. No accounting balances.

---

## 25. DASHBOARD KPI CARDS

At minimum:

1. Today's Expenses
2. This Week
3. This Month
4. Fuel Expenses
5. Maintenance Expenses
6. Supplies Expenses
7. Other Expenses
8. Number of Transactions

Example:

```
Today's Expenses: 18.500 BHD
This Week: 96.300 BHD
This Month: 428.750 BHD
Fuel: 145.000 BHD
Maintenance: 82.000 BHD
Supplies: 73.250 BHD
Other: 128.500 BHD
Transactions: 87
```

Follow the existing TabarakHUB KPI card style. Do NOT invent a new card design.

---

## 26. MONTHLY EXPENSE CALENDAR

The Dashboard MUST contain a monthly calendar.

Purpose: Show the total operational cash expenses recorded for each day.

Each day should display Daily Expense Total. Example:

```
21
18.500 BHD
```

The calendar does NOT display sales, deposits, or cash balance. Only Daily Expenses.

Use the existing TabarakHUB calendar component if available. If no calendar component exists, build one that matches the existing UI exactly.

---

## 27. CALENDAR DAY INTERACTION

Clicking a day should open/show that day's expenses.

Example — 21 August 2026, Total Expenses: 18.500 BHD

```
T004-X-210826-001  Fuel         BIKE-003 / Ahmed        5.000 BHD
T004-X-210826-002  Maintenance  Replace tire             8.000 BHD
T004-X-210826-003  Supplies     Cleaning materials       3.500 BHD
T004-X-210826-004  Other        Emergency purchase       2.000 BHD

TOTAL: 18.500 BHD
```

Use the existing TabarakHUB drawer/modal/detail pattern.

---

## 28. DASHBOARD FILTERS

At minimum: Branch, Date / Month, Category

Optional if consistent with the existing system: Driver, Vehicle

Branch behavior:

- Branch users: Automatically use their permitted branch.
- Admin / authorized users: May select "All Branches" or a specific branch.

Do not create a separate permission architecture if TabarakHUB already has one. Reuse existing RBAC/permission mechanisms.

---

## 29. EXPENSE LIST

Create an Expenses page.

Suggested columns: Ref No., Date, Branch, Category, Description, Driver, Vehicle, Amount, Receipt, Created By

- For non-Fuel expenses: Driver/Vehicle may show "-".
- For Fuel: Driver and Vehicle should be visible.
- Receipt column: ✓ if receipt provided to Accounts, — if not.

Use the existing TabarakHUB table component/style.

---

## 30. EXPENSE DETAILS

Clicking an expense should show a detail view using the existing TabarakHUB detail pattern.

Example:

```
Reference: T004-X-210826-001
Branch: Janabiya
Date: 21 Aug 2026
Time: 10:42 AM
Category: Fuel
Vehicle: BIKE-003
Driver: Ahmed
Last Odometer: 42,850 km
Current Odometer: 42,930 km
Distance: 80 km
Amount: 5.000 BHD
Receipt: View Receipt
Receipt Provided to Accounts: ✓
Created By: User Name
Created At: 21 Aug 2026 10:42 AM
```

---

## 31. EDITING

Users with appropriate existing permissions may edit expense records.

Reference Number MUST NEVER change.

If Fuel data is edited: the odometer history must remain consistent. Do not create duplicate odometer records. If current odometer changes, update the corresponding odometer history record safely.

If the existing system has audit logging, reuse it.

---

## 32. DELETE

Use soft delete if that is the existing TabarakHUB convention. Do NOT physically delete records if the existing ERP architecture preserves operational records.

Deleted reference numbers must never be reused.

Example: `T004-X-210826-001` deleted → next transaction is `T004-X-210826-002`, NOT `001`.

---

## 33. AUDIT TRAIL

There is no approval workflow. However, operational records should be auditable.

Track: Created By, Created At, Updated By, Updated At

If the existing TabarakHUB supports field-level audit history, reuse it.

Important fields to audit: Amount, Category, Branch, Driver, Vehicle, Odometer, Description, Receipt Provided to Accounts

---

## 34. REPORTS

Create simple operational reports.

### A. Expense Summary

Filters: Branch, Date Range, Category

Output: Category, Transaction Count, Total Amount

Example:

```
Fuel:         34 transactions   145.000 BHD
Maintenance:  12 transactions    82.000 BHD
Supplies:     19 transactions    73.250 BHD
Other:        22 transactions   128.500 BHD

Total: 428.750 BHD
```

### B. Fuel Report

Filters: Branch, Date Range, Driver, Vehicle

Columns: Date, Reference, Branch, Driver, Vehicle, Previous Odometer, Current Odometer, Distance, Amount

Optional: Cost / KM

---

## 35. RECEIPT STATUS REPORT

Provide a simple way to identify receipts NOT provided to Accounts.

Example KPI: `Receipts Pending: 7`

Clicking it should filter the expense list to `receipt_provided_to_accounts = false`.

Again: this is NOT an approval workflow. It is only document tracking.

---

## 36. NO PETTY CASH BALANCE ENGINE

Do NOT create: Opening Petty Cash, Closing Petty Cash, Cash Replenishment, Cash Balance, Cash Variance — unless the existing TabarakHUB architecture already requires these concepts.

For this module, the business requirement is simply: Record Operational Cash Expenses. Do not over-engineer it.

---

## 37. NO SALES INTEGRATION

This is worth repeating: DO NOT query or calculate sales.

DO NOT connect: `daily_sales`, `sales_transactions`, POS, `cash_sales`, deposits, banking, sales reconciliation.

The module should function perfectly even if the sales module does not exist.

---

## 38. USER EXPERIENCE

The primary user is a branch employee. The workflow must be extremely fast.

Ideal workflow:

1. Open Operational Cash Expenses
2. Click New Expense
3. Select Category
4. Fill only relevant fields
5. Save

For Fuel:

1. Select Fuel
2. Select Vehicle
3. Select Driver
4. System shows Last Odometer
5. Enter Current Odometer
6. Enter Amount
7. Optionally upload receipt
8. Tick "Receipt Provided to Accounts" if applicable
9. Save

No unnecessary screens. No confirmation workflow unless the existing UI requires confirmation before destructive actions.

---

## 39. EMPTY STATES

Follow existing TabarakHUB empty-state design.

Examples: "No expenses this month.", "No fuel transactions found.", "No receipts pending."

Do not create a new empty-state style.

---

## 40. LOADING STATES

Use the existing TabarakHUB skeleton/loading patterns. Do not use arbitrary spinners if the system already has standardized loaders.

---

## 41. ERROR HANDLING

Use existing TabarakHUB error/toast patterns.

Examples:

- "Please select a vehicle."
- "Please select a driver."
- "Current odometer cannot be lower than the last recorded reading."
- "Amount is required."
- "Unable to save expense."

Do not expose raw database errors to users.

---

## 42. RESPONSIVE DESIGN

The module must work with the existing TabarakHUB responsive behavior.

- Desktop: Full dashboard and tables.
- Tablet: Adapt filters and calendar.
- Mobile: Cards stack. Tables may become responsive list/card views if that is the existing TabarakHUB pattern.

Do not create a completely separate mobile UX. Follow existing TabarakHUB responsive conventions.

---

## 43. SECURITY

Use existing TabarakHUB authentication and authorization. Users must only see branches they are authorized to access.

- Branch users: Only their authorized branch.
- Admin/management: According to existing permissions.

Do not create duplicate auth logic. Do not trust `branch_id` from the client blindly. The backend must derive/validate permitted branch access.

---

## 44. DATABASE INTEGRITY

Important constraints:

- `reference_no` UNIQUE
- `branch_id` NOT NULL
- `category_id` NOT NULL
- `amount > 0`
- Fuel requires `vehicle_id`
- Fuel requires `driver_id`
- Fuel requires `current_odometer`
- `current_odometer >= previous_odometer`

Reference number generation must be atomic. Prevent duplicate serial numbers during concurrent creation.

---

## 45. REFERENCE NUMBER GENERATION ALGORITHM

```
branch.code + "-X-" + DDMMYY + "-" + 3-digit sequential number
```

Example: `T004-X-210826-001`

The serial should increment within `branch + expense_date`.

Pseudo logic:

```
get branch code
get expense date
find next available sequence for that branch/date
generate: ${branchCode}-X-${DDMMYY}-${sequence}
```

Then enforce a database unique constraint. Handle concurrent inserts safely with transaction/locking/sequence strategy.

---

## 46. COMPONENT ARCHITECTURE

Reuse existing TabarakHUB components.

Suggested conceptual components:

```
OperationalCashExpensesPage
ExpenseDashboard
ExpenseKpiCards
ExpenseCalendar
ExpenseFilters
ExpenseList
ExpenseForm
FuelExpenseFields
MaintenanceExpenseFields
SuppliesExpenseFields
OtherExpenseFields
ExpenseDetails
ReceiptStatusBadge
OdometerHistory
FuelHistory
ExpenseReports
```

These are conceptual names only. If equivalent existing components already exist, reuse them.

---

## 47. DATA FLOW

**Normal Expense:**

```
User → Expense Form → Validate → Create Expense Transaction
→ Generate Reference Number → Save → Update Dashboard
```

**Fuel:**

```
User → Select Vehicle → Fetch latest Vehicle Odometer → Display Last Odometer
→ User enters Current Odometer → Validate → Create Expense Transaction
→ Create Fuel Detail → Create Vehicle Odometer History Record → Update Dashboard
```

All writes should happen safely in a transaction where appropriate.

---

## 48. PERFORMANCE

Dashboard should NOT fetch every historical transaction unnecessarily.

Use efficient aggregation queries for: Today's total, Weekly total, Monthly total, Category totals, Daily calendar totals.

Calendar should query aggregated daily expense totals rather than loading every transaction into the frontend.

Expense list should be paginated. Reports should use server-side filtering/aggregation.

---

## 49. UX DETAILS

- **Amount fields:** Use BHD formatting.
- **Odometer:** Use km.
- **Receipt:** Allow image/PDF if supported by existing file upload infrastructure.
- **Vehicle selector:** Show useful information such as "BIKE-003 — Motorcycle — Plate 12345".
- **Driver selector:** Use existing employee/driver data.
- **Last Odometer:** Clearly marked "Last Recorded Odometer". Read-only.
- **Current Odometer:** Clearly editable.

After save, show the generated Reference Number:

> "Expense recorded successfully — T004-X-210826-001"

Use the existing TabarakHUB toast/notification style.

---

## 50. DO NOT OVERBUILD

Do NOT add:

- Accounting journal
- GL entries
- Sales integration
- Deposit tracking
- Approval workflow
- Reimbursement workflow
- Employee payroll deductions
- Vendor accounting
- Petty cash replenishment workflow
- Complex budgeting
- Purchase orders
- Inventory transactions

These are outside the scope of this module.

---

## 51. ACCEPTANCE CRITERIA

The module is considered complete only if:

- [ ] It visually matches TabarakHUB.
- [ ] It uses existing TabarakHUB UI components.
- [ ] It is integrated into the existing navigation.
- [ ] Users can create an Operational Cash Expense.
- [ ] Categories are: Fuel, Maintenance, Supplies, Other
- [ ] Form fields change dynamically by category.
- [ ] Fuel requires Vehicle and Driver.
- [ ] Fuel automatically displays the last vehicle odometer.
- [ ] User enters Current Odometer.
- [ ] Odometer history is preserved.
- [ ] Current Odometer cannot be lower than the previous reading.
- [ ] Vehicle owns the odometer history, not Driver or Branch.
- [ ] Initial Odometer can be entered when creating a vehicle.
- [ ] Every expense receives a unique Reference Number.
- [ ] Reference format is: `T004-X-210826-001`
- [ ] Serial is scoped by Branch + Date.
- [ ] Reference numbers are immutable.
- [ ] Deleted reference numbers are never reused.
- [ ] Receipt upload is supported.
- [ ] "Receipt Provided to Accounts" checkbox exists.
- [ ] Receipt tracking is independent of approval.
- [ ] No approval/rejection exists.
- [ ] Dashboard has expense KPIs.
- [ ] Dashboard has monthly expense calendar.
- [ ] Calendar shows daily expense totals.
- [ ] Clicking a day shows that day's transactions.
- [ ] Expense list exists.
- [ ] Expense details exist.
- [ ] Expense reports exist.
- [ ] Pending receipt tracking exists.
- [ ] No Sales data is displayed.
- [ ] No Sales data is queried.
- [ ] No Deposit tracking exists.
- [ ] No Accounting Ledger is created.
- [ ] Existing authentication/permissions are reused.
- [ ] Existing TabarakHUB responsive behavior is preserved.

---

## 52. IMPLEMENTATION PROCESS

Before coding:

1. Inspect the repository.
2. Identify the existing TabarakHUB architecture.
3. Identify existing database/schema conventions.
4. Identify existing Branch model.
5. Identify existing Employee/Driver model.
6. Identify existing Vehicle model.
7. Identify existing Dispatch module.
8. Identify existing UI component library.
9. Identify existing calendar/table/form components.
10. Identify existing authentication and RBAC.
11. Identify existing file upload/storage.
12. Identify existing audit-log conventions.

Then produce a concise implementation plan. Then implement the module.

Do NOT rebuild existing functionality. Do NOT duplicate existing entities. Reuse existing infrastructure wherever possible.

---

## 53. FINAL DESIGN PRINCIPLE

The module should feel like: **"One more native TabarakHUB module."**

NOT: **"A new application inside TabarakHUB."**

The final user experience should be:

```
Open Module
→ See expense KPIs
→ See monthly expense calendar
→ Click New Expense
→ Select category
→ Enter only relevant information
→ Save
→ Receive Reference Number
→ Done.
```

For Fuel:

```
Select Vehicle
→ System shows Last Odometer
→ Select Driver
→ Enter Current Odometer
→ Enter Amount
→ Receipt tracking
→ Save.
```

Keep it operational, fast, clean, auditable, and simple.

---

**END OF SPECIFICATION**
