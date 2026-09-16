# TABARAKHUB — OPERATIONAL ALERT & RENEWALS
## Production-Ready Module Specification & Implementation Prompt

You are a **Senior Product Designer, Senior UI/UX Engineer, Senior Full-Stack Developer, and ERP Systems Architect**.

You are working on an existing enterprise application called **TabarakHub**, used by a pharmacy group to manage operational activities, employees, branches, vehicles, licenses, documents, and compliance.

Your task is to design and implement a new production-ready module:

# "Operational Alert & Renewals"

The module must feel like a **native part of TabarakHub**, not a separate application.

---

# 1. PRIMARY OBJECTIVE

Create a centralized operational compliance and renewal management system that monitors important expiry dates and generates actionable alerts.

The module should consolidate:

1. Commercial Registration (CR) expiries
2. NHRA licenses / registrations expiries
3. Employee Work Permit (WP) expiries
4. Future operational documents that may require renewal

The system should allow management and authorized users to immediately understand:

- What is expiring
- Who/what it belongs to
- When it expires
- How urgent it is
- What action is required
- Who is responsible
- Whether renewal has started
- Whether renewal is completed
- Whether the item has expired

The goal is to prevent operational disruption caused by expired licenses, registrations, permits, or regulatory documents.

---

# 2. IMPORTANT UX PRINCIPLE

The existing:

**Operational Cash Expenses → Fleet Vehicles → Alerts & Renewals**

already contains an alert/renewal concept.

Use that existing implementation as the **UX/UI reference and design language**.

Do NOT create a completely different visual system.

Reuse:

- Existing cards
- Existing typography
- Existing spacing
- Existing colors
- Existing buttons
- Existing badges
- Existing tables
- Existing modal patterns
- Existing date formatting
- Existing alert severity conventions
- Existing responsive behavior
- Existing navigation patterns

The new module should look like it was built as part of TabarakHub from day one.

If existing components are available in the codebase, **reuse them instead of recreating them**.

---

# 3. MODULE LOCATION

Add the module to the main TabarakHub navigation.

Suggested navigation:

Operations
   ├── Operational Cash Expenses
   ├── Fleet Vehicles
   └── Operational Alert & Renewals

Module name shown in UI:

**Operational Alert & Renewals**

Short description:

**Monitor critical licenses, registrations, permits and operational expiries.**

Use a professional enterprise/ERP naming convention throughout the application.

---

# 4. CORE CONCEPT

The system is based on an entity + renewal type + expiry date model.

Each alert/renewal record should contain:

- Record ID
- Entity Type
- Entity Name
- Document Type
- Document Number
- Branch / Location
- Employee / Vehicle / Company relationship where applicable
- Issue Date
- Expiry Date
- Days Remaining
- Alert Status
- Renewal Status
- Priority
- Responsible Person
- Notes
- Attachments
- Created At
- Updated At

---

# 5. SUPPORTED RENEWAL TYPES

## A. CR EXPIRY

Monitor Commercial Registration expiry.

Fields:

- CR Number
- Company / CR Name
- Branch / CR
- Issue Date
- Expiry Date
- Days Remaining
- Renewal Status
- Responsible Person
- Notes
- Attachment

Example:

Entity:
Tabarak Pharmacy W.L.L.

Document:
Commercial Registration

CR Number:
123456

Expiry:
15/11/2026

---

# 6. NHRA LICENSE EXPIRY

Monitor NHRA-related licenses.

The design must support multiple NHRA license records.

Examples:

- Pharmacy License
- Pharmacist License
- Professional License
- Facility License
- Other NHRA Regulatory License

Fields:

- License Type
- License Number
- License Holder
- Employee / Branch
- Branch
- Issue Date
- Expiry Date
- Days Remaining
- Renewal Status
- Responsible Person
- Notes
- Attachment

The architecture should NOT hard-code only one NHRA license type.

Use a configurable:

`license_type`

field.

---

# 7. EMPLOYEE WORK PERMIT EXPIRY

Monitor employee Work Permit expiry.

Fields:

- Employee Name
- Employee ID
- Job Title
- Department
- Branch
- Work Permit Number
- Issue Date
- Expiry Date
- Days Remaining
- Renewal Status
- Responsible Person
- Notes
- Attachment

The employee should preferably be selected from the existing TabarakHub employee database.

DO NOT create duplicate employee records.

Use a relationship/reference to the existing employee entity.

When an employee is selected, automatically populate available information such as:

- Employee Name
- Employee ID
- Job Title
- Department
- Branch

Allow only relevant fields to be manually overridden where appropriate.

---

# 8. FUTURE-PROOF ARCHITECTURE

Although the first release supports:

- CR
- NHRA
- Work Permit

build the data model so additional renewal types can be added later without restructuring the module.

Potential future types:

- Municipality License
- Civil Defense Certificate
- Vehicle Registration
- Insurance
- Lease Agreement
- Equipment Certification
- Contract Expiry
- Staff Professional Registration
- Other Regulatory Document

Use a generic renewal/alert architecture.

Example:

`renewal_type`

instead of creating completely separate tables for every document type unless the existing architecture requires otherwise.

---

# 9. DASHBOARD

The main page should open with a professional operational dashboard.

Top KPI cards:

### Total Active
Number of active renewal records.

### Critical
Items requiring immediate attention.

### Expiring Soon
Items approaching expiry.

### Expired
Already expired items.

### Renewal in Progress
Items currently being renewed.

### Renewed
Recently completed renewals.

Use visual hierarchy to make urgent issues immediately visible.

Do not overuse colors.

Use the existing TabarakHub semantic color system.

Suggested semantic states:

- Normal
- Upcoming
- Warning
- Critical
- Expired
- In Progress
- Renewed

---

# 10. ALERT LOGIC

The system must calculate:

`days_remaining = expiry_date - current_date`

Do not manually store days remaining as the source of truth.

Calculate it dynamically from the expiry date.

Suggested severity logic:

### EXPIRED

`days_remaining < 0`

Status:
**Expired**

Highest urgency.

---

### CRITICAL

`0 <= days_remaining <= 7`

Status:
**Critical**

Requires immediate action.

---

### URGENT

`8 <= days_remaining <= 30`

Status:
**Urgent**

Renewal should be initiated.

---

### WARNING

`31 <= days_remaining <= 60`

Status:
**Warning**

Upcoming renewal.

---

### UPCOMING

`61 <= days_remaining <= 90`

Status:
**Upcoming**

Monitor.

---

### NORMAL

`days_remaining > 90`

Status:
**Normal**

No immediate action required.

IMPORTANT:

Make these thresholds configurable in Admin Settings.

Do not hard-code them throughout the application.

---

# 11. DASHBOARD PRIORITY

The dashboard should automatically prioritize records.

Sort priority:

1. Expired
2. Critical
3. Urgent
4. Warning
5. Upcoming
6. Normal

Within the same severity:

Sort by nearest expiry date first.

This allows management to immediately focus on the most important operational risks.

---

# 12. MAIN TABLE

Create a powerful data table.

Columns:

| Column | Description |
|---|---|
| Priority | Severity indicator |
| Entity | Employee / Branch / Company |
| Document Type | CR / NHRA / WP |
| Document Number | Relevant document number |
| Branch | Associated branch |
| Expiry Date | Expiration date |
| Days Remaining | Dynamic calculation |
| Status | Current alert status |
| Renewal Status | Renewal workflow |
| Responsible | Assigned person |
| Actions | View / Edit / Renew |

Do not make the table visually crowded.

Use compact typography and clear spacing.

---

# 13. FILTER SYSTEM

Provide advanced filters.

Filters:

### Document Type

- All
- CR
- NHRA
- Work Permit
- Other

### Alert Status

- All
- Normal
- Upcoming
- Warning
- Urgent
- Critical
- Expired

### Renewal Status

- Not Started
- Renewal Planned
- In Progress
- Submitted
- Awaiting Approval
- Renewed
- Cancelled

### Branch

Dynamic branch list from existing TabarakHub data.

### Responsible Person

Dynamic employee/user list.

### Expiry Period

Quick filters:

- Expired
- Today
- Next 7 Days
- Next 30 Days
- Next 60 Days
- Next 90 Days
- Custom Range

### Search

Global search across:

- Entity
- Document number
- Employee
- Branch
- CR number
- License number

---

# 14. QUICK FILTER BAR

Above the table create a quick filter area.

Example:

`All | Critical | Expired | Next 7 Days | Next 30 Days | Next 90 Days`

Clicking a filter should instantly update the table.

Show the number of records next to each filter when useful.

Example:

**Critical (4)**

---

# 15. CREATE RENEWAL / ALERT

Primary CTA:

**+ Add Renewal**

Open a professional modal or dedicated form.

First field:

### Renewal Type

Dropdown:

- CR
- NHRA License
- Work Permit
- Other

The form should dynamically change based on the selected type.

---

# 16. DYNAMIC FORM

For:

### Work Permit

Show:

Employee

Then automatically populate:

- Employee ID
- Job Title
- Department
- Branch

Then:

- WP Number
- Issue Date
- Expiry Date
- Responsible Person
- Notes
- Attachment

---

For:

### NHRA License

Show:

- License Type
- License Holder
- Employee / Branch
- License Number
- Issue Date
- Expiry Date
- Responsible Person
- Notes
- Attachment

---

For:

### CR

Show:

- Company / CR
- CR Number
- Issue Date
- Expiry Date
- Responsible Person
- Notes
- Attachment

---

# 17. RENEWAL STATUS WORKFLOW

Use a clear lifecycle:

`Not Started`

↓

`Renewal Planned`

↓

`In Progress`

↓

`Submitted`

↓

`Awaiting Approval`

↓

`Renewed`

Optional:

`Cancelled`

The workflow should be visible in the record details.

---

# 18. RENEWAL ACTION

When a record is approaching expiry, provide a clear action:

**Start Renewal**

Clicking it should:

1. Change Renewal Status to `In Progress`
2. Record the date
3. Record the user
4. Add an activity/history entry

Example activity:

`Ahmed started renewal on 06 Sep 2026`

---

# 19. MARK AS RENEWED

When renewal is completed:

Button:

**Mark as Renewed**

Open confirmation modal.

Ask for:

- New Issue Date
- New Expiry Date
- New Document Number if changed
- Attachment
- Renewal Notes

After confirmation:

- Update the active record
- Preserve the previous renewal information in history
- Reset calculated alert status
- Create renewal history
- Show success notification

Example:

**Renewal completed successfully.**

---

# 20. RENEWAL HISTORY

Every record must maintain historical renewal information.

Do NOT overwrite history.

Example:

### Renewal History

| Date | Previous Expiry | New Expiry | Action | User |
|---|---|---|---|---|
| 06 Sep 2026 | 15 Sep 2026 | 15 Sep 2027 | Renewed | Ahmed |
| 12 Sep 2025 | 15 Sep 2025 | 15 Sep 2026 | Renewed | Mohammed |

This is important for auditability.

---

# 21. RECORD DETAILS DRAWER

Clicking a row should open a right-side details drawer or a dedicated detail page, depending on existing TabarakHub patterns.

Display:

### Header

Entity Name

Document Type

Status Badge

Days Remaining

### Information

Document Number

Branch

Issue Date

Expiry Date

Responsible Person

Renewal Status

### Timeline

Activity history.

Example:

- Created
- Renewal planned
- Renewal started
- Document submitted
- Approved
- Renewed

### Attachments

Display uploaded documents.

### Actions

- Edit
- Start Renewal
- Mark as Renewed
- Add Note
- Upload Document

---

# 22. ALERT CENTER

Create a dedicated alert section.

Title:

**Operational Alerts**

Show the highest-priority issues.

Example:

🔴 **3 Work Permits have expired**

🟠 **2 NHRA licenses expire within 7 days**

🟡 **5 documents expire within 30 days**

Each alert should be clickable and take the user directly to the relevant filtered records.

---

# 23. ALERT NOTIFICATION UX

The module should support notification-ready architecture.

The system should be capable of later supporting:

- In-app notifications
- Email notifications
- WhatsApp notifications
- Scheduled reminders

Do not necessarily implement external messaging in the first version unless the existing TabarakHub infrastructure already supports it.

Build the database/service layer so notifications can be added later.

---

# 24. REMINDER SCHEDULE

Each renewal can optionally have reminder configuration.

Example:

Reminder intervals:

- 90 days
- 60 days
- 30 days
- 14 days
- 7 days
- 1 day

Allow configurable reminders from Admin Settings.

Do not hard-code reminder rules.

---

# 25. RESPONSIBILITY

Each renewal record should have:

`responsible_user_id`

The responsible person should be visible in the table.

Example:

**Responsible: HR Manager**

or

**Responsible: Operations Manager**

This allows management to know who owns the action.

---

# 26. AUDIT LOG

Every important action must be logged.

Examples:

- Created
- Edited
- Status changed
- Renewal started
- Document uploaded
- Renewal completed
- Record archived
- Responsible person changed

Each event:

- User
- Date/time
- Action
- Previous value
- New value

This is an enterprise system and auditability is important.

---

# 27. DUPLICATE PREVENTION

Prevent accidental duplicate records.

Before creating a renewal, check for existing active records using appropriate identifiers.

Examples:

CR:

`CR Number + Renewal Type`

WP:

`Employee ID + WP Number`

NHRA:

`License Number + License Type`

If a possible duplicate is detected:

Show:

**A similar active renewal already exists.**

Allow the user to review the existing record.

Do not silently create duplicates.

---

# 28. PERMISSIONS

Integrate with the existing TabarakHub permission system.

Suggested permissions:

### View Operational Renewals

Can view records.

### Create Operational Renewals

Can create records.

### Edit Operational Renewals

Can edit records.

### Manage Renewals

Can start/complete renewals.

### Delete Operational Renewals

Restricted permission.

### Manage Renewal Settings

Admin-only.

### View Audit History

Management/Admin.

Do not bypass the existing authorization system.

---

# 29. SOFT DELETE

Do not permanently delete important compliance records.

Use:

`is_active`

or archival status.

Important operational history must remain available.

---

# 30. ATTACHMENTS

Support document attachments.

Examples:

- CR certificate
- NHRA license
- Work permit
- Renewal receipt
- Approval document

Display:

- File name
- File type
- Upload date
- Uploaded by
- View/download action

Use the existing TabarakHub file/storage infrastructure if available.

---

# 31. RESPONSIVE DESIGN

Desktop-first because this is an operational ERP.

But it must remain usable on:

- Desktop
- Laptop
- Tablet
- Mobile

On mobile:

Convert the large table into cards.

Example:

**Pharmacist Name**

Work Permit

🔴 Critical

Expires:
12 Sep 2026

**5 days remaining**

Responsible:
HR

[View]

---

# 32. EMPTY STATES

Do not show empty blank screens.

Example:

### No operational alerts

**Everything is up to date.**

No licenses, permits, or registrations require immediate attention.

CTA:

**View All Renewals**

---

# 33. LOADING STATES

Use proper skeleton loaders.

Do not freeze the interface.

Avoid unnecessary spinners.

---

# 34. ERROR HANDLING

Create professional error states.

Examples:

**Unable to load renewal records.**

Please try again.

[Retry]

For save failures:

**Changes could not be saved.**

Your data has not been lost.

[Try Again]

---

# 35. CONFIRMATION DIALOGS

Use confirmation dialogs for destructive or important actions.

Example:

### Mark as Renewed?

You are about to close the current renewal and create a new renewal period.

This action will be recorded in the renewal history.

[Cancel]

[Confirm Renewal]

---

# 36. SEARCH PERFORMANCE

Search/filtering should happen efficiently.

Avoid fetching the entire database to the browser if the dataset can become large.

Use server-side filtering/pagination where appropriate.

Indexes should be considered for:

- expiry_date
- renewal_type
- renewal_status
- employee_id
- branch_id
- responsible_user_id
- document_number

---

# 37. DATA MODEL

Design a scalable relational model.

Suggested main table:

`operational_renewals`

Possible fields:

```text
id
renewal_type
entity_type
entity_id
document_type
document_number
branch_id
issue_date
expiry_date
renewal_status
responsible_user_id
notes
is_active
created_by
created_at
updated_by
updated_at
```

Do not blindly use this schema if TabarakHub already has an established database architecture.

First inspect the existing schema and reuse existing entities.

Suggested related tables:

```text
operational_renewal_history
operational_renewal_attachments
operational_renewal_reminders
operational_renewal_activity
```

Use foreign keys wherever possible.

---

# 38. DATABASE INTEGRATION

Before writing new database tables:

INSPECT THE EXISTING TABARAKHUB DATABASE.

Look for:

- employees
- branches
- companies
- CR records
- NHRA records
- vehicles
- users
- permissions
- attachments
- audit logs

Reuse existing entities.

Do not duplicate existing master data.

---

# 39. IMPORTANT IMPLEMENTATION RULE

Do NOT build fake/demo data as the final implementation.

If mock data is required temporarily for UI development, clearly isolate it and replace it with real database queries before completion.

The final module must be connected to the real TabarakHub data architecture.

---

# 40. ADMIN SETTINGS

Add configurable settings under:

**Admin Settings → Operational Alerts & Renewals**

Settings:

### Alert Thresholds

Normal:
> 90 days

Upcoming:
61–90 days

Warning:
31–60 days

Urgent:
8–30 days

Critical:
0–7 days

Expired:
< 0

### Reminder Settings

Enable/disable reminder intervals.

### Renewal Types

Admin can activate/deactivate renewal types.

### Default Responsible User

Optional.

---

# 41. DASHBOARD VISUALIZATION

Add a simple visual summary.

Preferred:

**Expiry Distribution**

Normal
Upcoming
Warning
Urgent
Critical
Expired

Use a clean chart consistent with TabarakHub.

Avoid excessive dashboards and unnecessary charts.

The primary goal is action, not analytics.

---

# 42. SORTING

Default:

Most urgent first.

Allow sorting by:

- Expiry Date
- Days Remaining
- Entity
- Document Type
- Branch
- Renewal Status
- Responsible Person

---

# 43. EXPORT

Provide:

**Export**

Options:

- Excel
- CSV
- PDF if existing system supports it

Export should respect current filters.

Example:

If user filters:

`Work Permit + Critical + Branch = Tabarak 3`

the exported file should contain only those records.

---

# 44. PRINT-FRIENDLY VIEW

Provide a clean print layout for:

**Operational Renewal Report**

Include:

- Report date
- Filters
- Summary
- Critical items
- Expired items
- Upcoming renewals

---

# 45. UX DETAILS

Use professional micro-interactions.

Examples:

When changing renewal status:

Show a subtle success toast.

When saving:

Disable the submit button briefly to prevent duplicate submissions.

When uploading:

Show upload progress.

When changing filters:

Maintain the selected filters.

When navigating back:

Preserve the user's previous filter/search state where practical.

---

# 46. ACCESSIBILITY

Follow modern accessibility practices.

Ensure:

- Keyboard navigation
- Visible focus states
- Proper labels
- Semantic buttons
- Accessible modal behavior
- Sufficient contrast
- Tooltips for icon-only buttons
- Screen-reader-friendly status labels

Do not rely only on color to communicate urgency.

Example:

Instead of only a red dot:

`Critical · 4 days remaining`

---

# 47. DESIGN LANGUAGE

The visual design should communicate:

**Professional + Operational + Regulatory + Reliable**

Avoid:

- excessive gradients
- excessive animations
- oversized cards
- childish colors
- unnecessary decorative graphics
- excessive rounded components
- dashboard clutter

The interface should feel like a serious enterprise pharmacy operations system.

---

# 48. ICONOGRAPHY

Use the existing TabarakHub icon library.

If the application uses Lucide icons, continue using Lucide.

Suggested icons:

CR:
Building / FileText

NHRA:
ShieldCheck / BadgeCheck

Work Permit:
UserCheck / IdCard

Expiry:
CalendarClock

Critical:
TriangleAlert

Expired:
CircleX

Renewed:
CircleCheck

Do not introduce another icon library unnecessarily.

---

# 49. PERFORMANCE

The module must be production-ready.

Avoid:

- unnecessary database calls
- duplicate API requests
- excessive re-rendering
- loading entire datasets unnecessarily
- client-side filtering of large datasets

Use:

- pagination
- debounced search
- indexed queries
- caching where appropriate
- optimistic UI only when safe

---

# 50. SECURITY

Do not expose sensitive information unnecessarily.

Enforce authorization on the backend/server side.

Do not rely only on frontend permissions.

Validate:

- record ownership/access
- user permissions
- uploaded files
- allowed status transitions
- date values
- duplicate records

---

# 51. DATE HANDLING

Use one consistent timezone throughout the application.

Be careful with timezone conversion when calculating expiry dates.

Expiry should be based on the organization's configured timezone.

Do not allow browser timezone differences to change the calculated expiry status.

Display dates consistently with the rest of TabarakHub.

---

# 52. STATUS BADGES

Use compact badges.

Example:

`NORMAL`

`UPCOMING`

`WARNING`

`URGENT`

`CRITICAL`

`EXPIRED`

Renewal status:

`NOT STARTED`

`PLANNED`

`IN PROGRESS`

`SUBMITTED`

`AWAITING APPROVAL`

`RENEWED`

---

# 53. MAIN USER FLOW

The ideal workflow:

User opens:

**Operational Alert & Renewals**

↓

Dashboard immediately shows:

**4 Critical**

**2 Expired**

**8 Expiring within 30 Days**

↓

User clicks:

**Critical**

↓

Table filters automatically.

↓

User selects:

**Pharmacist — Work Permit**

↓

Details drawer opens.

↓

User clicks:

**Start Renewal**

↓

Status becomes:

**In Progress**

↓

User uploads renewal documentation.

↓

User completes renewal.

↓

Clicks:

**Mark as Renewed**

↓

Enters new expiry date.

↓

System records renewal history.

↓

Alert disappears from critical list.

↓

Dashboard automatically updates.

This flow should feel extremely fast and intuitive.

---

# 54. IMPORTANT: DO NOT OVER-ENGINEER THE FIRST VERSION

Version 1 should focus on:

1. Reliable expiry tracking
2. Clear alerts
3. Renewal workflow
4. Employee/branch/company integration
5. Audit history
6. Attachments
7. Filtering/search
8. Dashboard KPIs

Do not add unnecessary features simply because they are technically possible.

---

# 55. DEVELOPMENT PROCESS

Before coding:

### STEP 1 — Inspect Existing Application

Understand:

- current folder structure
- routing
- components
- design system
- database
- authentication
- permissions
- API/service architecture
- existing Fleet Vehicles Alerts & Renewals implementation

### STEP 2 — Identify Reusable Components

Reuse existing:

- Cards
- Tables
- Modals
- Drawers
- Forms
- Badges
- Date pickers
- Toasts
- Upload components
- Filters
- Pagination
- Permission utilities

### STEP 3 — Design Data Model

Integrate with existing entities.

### STEP 4 — Implement Backend/Data Layer

Create real CRUD functionality.

### STEP 5 — Implement Dashboard

Build KPI and alert logic.

### STEP 6 — Implement Main Table

Search/filter/sort/pagination.

### STEP 7 — Implement Details

Drawer/detail page.

### STEP 8 — Implement Renewal Workflow

Statuses and history.

### STEP 9 — Implement Attachments

Use existing storage.

### STEP 10 — Implement Permissions

Connect to existing RBAC.

### STEP 11 — Test

Test:

- creating
- editing
- filtering
- expiry calculations
- status transitions
- duplicate prevention
- permissions
- renewal completion
- history
- attachments
- responsive layouts

---

# 56. ACCEPTANCE CRITERIA

The module is considered complete only when:

### Functional

- CR expiries can be managed.
- NHRA expiries can be managed.
- Employee WP expiries can be managed.
- Expiry status is automatically calculated.
- Critical items are prioritized.
- Renewal workflow works.
- Renewal history is preserved.
- Attachments work.
- Filters work.
- Search works.
- Permissions work.
- Audit trail works.

### UX

- Looks native to TabarakHub.
- Matches Fleet Vehicles Alerts & Renewals.
- Requires minimal clicks.
- Critical items are immediately visible.
- Mobile layout works.
- Empty/error/loading states exist.
- No visual clutter.

### Technical

- Real database integration.
- No unnecessary duplicate master data.
- Server-side authorization.
- Proper validation.
- Efficient queries.
- No hard-coded business rules where configuration is appropriate.
- Maintainable component architecture.
- No console errors.
- No broken routes.
- No fake production data.

---

# 57. FINAL INSTRUCTION TO GEMINI ANTIGRAVITY

Do not simply create a visual prototype.

You are implementing a **real production module inside the existing TabarakHub application**.

First inspect the existing application architecture and especially the current:

**Operational Cash Expenses → Fleet Vehicles → Alerts & Renewals**

implementation.

Use it as the primary UX and architectural reference.

Then implement:

**Operational Alert & Renewals**

as a reusable, scalable, enterprise-grade module.

Prioritize:

**Consistency → Usability → Data Integrity → Compliance → Performance → Maintainability**

Do not modify unrelated modules.

Do not break existing functionality.

Do not introduce a new design system.

Do not duplicate existing master data.

Do not replace existing architecture unnecessarily.

If an existing TabarakHub component/service already solves a problem, reuse it.

The final result should look and behave as if:

**Operational Alert & Renewals has always been a core TabarakHub module.**