# Smoke Test Plan

Run this plan for every dedicated-client staging deployment before production sign-off.

## Preconditions

```text
Supabase migrations applied to the client's dedicated project.
Supabase Auth users provisioned and linked in app_user_profiles.
FUNCTION_SECRET set for protected Edge Functions.
VITE_DEMO_MODE=false for staging and production validation.
```

## 1. Login

```text
Open the app in a clean browser profile.
Login as admin/manager.
Confirm the Daily Command Center loads without fake/demo data.
Logout.
Login as a branch user.
Confirm branch-scoped landing page loads.
```

## 2. Dashboard Load

```text
Open Performance Dashboard.
Confirm lost sales and shortage data load from Supabase.
Confirm filters work for today, month, and custom date range.
Confirm no console errors appear during load.
```

## 3. POS / Sale Submit

```text
Select an active pharmacist.
Open Lost Sales & Shortage.
Search for a real product.
Submit one lost-sale entry.
Confirm the record appears in the dashboard.
Confirm a linked shortage entry is created only when expected.
```

## 4. Quality Feedback

```text
Submit one feedback response from the employee-facing form.
Open Quality Feedback Admin as manager/admin.
Confirm the response appears in analytics.
Confirm sentiment/insight panels show real, empty, or insufficient-data states only.
```

## 5. Spin Token / Customer Flow

```text
Generate a secure QR token from a branch account.
Open the customer flow from the generated token.
Complete customer registration and spin flow.
Confirm production does not call frontend IP lookup services.
Confirm rate/fraud checks are enforced server-side by RPC or Edge Function before production sign-off.
```

## 6. Branch User Scoping

```text
Login as branch A.
Confirm branch A can read/write only its own operational records.
Confirm branch A cannot read branch B records by URL, filters, or direct browser Supabase calls.
Login as manager/admin.
Confirm cross-branch reads work only for allowed roles.
```

## 7. Unauthenticated Blocking

```text
Open the app in an incognito/private window.
Confirm protected internal app data does not load before login.
Call sensitive REST endpoints with only the anon key.
Expected result: denied or no sensitive rows returned.
```

## 8. Command Center

```text
Open the landing page after login.
Confirm Today's Risks, Pending Actions, Branch Health, and Pending Items use real enabled-module data.
Confirm unavailable sources show warnings instead of fake data.
Confirm module cards remain available below the command center.
```
