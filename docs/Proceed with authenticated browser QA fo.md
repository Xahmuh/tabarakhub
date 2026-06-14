Proceed with authenticated browser QA for the Branch Delivery Zones and Markers feature.

Current known state:

* Migration `20260614163000_add_branch_delivery_profiles.sql` was applied to linked Supabase.
* Migration list is clean through `20260614163000`.
* `branch_delivery_profiles` exists and has 20/20 seeded profiles.
* GeoJSON validation passed: 20 mapped, 0 unmapped.
* Duplicate groups validated:

  * `729`: H002/T001
  * `745`: H004/S004
* Branch T001 RLS check passed: own profile only.
* Typecheck/build/npm ls passed.
* Code is still local.
* No commit, push, or deploy has been done.

## Objective

Run authenticated browser QA for the new Delivery Zones and Branch Markers UI before commit/push/deploy.

Focus on:

* Delivery Coverage map
* branch markers inside blocks
* duplicate marker clusters
* animated red service rings
* map toggles
* zone labels/details
* Delivery Zones settings UI
* role-based access behavior

## Important Rules

* Do not commit.
* Do not push.
* Do not deploy.
* Do not apply migrations.
* Do not change unrelated code.
* Do not weaken RLS.
* Do not fake browser results.
* If browser tooling cannot test something, mark it pending clearly.
* Keep final status:
  `B) dedicated-client staging-ready only`

## Step 1 — Preflight

Run:

```bash
git status --short
supabase migration list --linked
npm run typecheck
npm run build
npm ls --depth=0
```

Confirm:

* migration history still clean;
* no unexpected package changes;
* app still builds.

## Step 2 — Start Local Preview

Start the app locally using the normal project command.

Use either:

```bash
npm run dev
```

or the project’s existing preview command if preferred.

Open the app in a browser session that can authenticate against the linked Supabase project.

## Step 3 — Manager/Owner QA

Login as manager or owner.

Check:

### Project Settings > Delivery Zones

Verify:

* Delivery Zones section loads.
* 20 branch delivery profiles appear.
* H001 = block 711
* H002 = block 729
* H003 = block 816
* H004 = block 745
* H005 = block 555
* T001 = block 729
* T002 = block 255
* T003 = block 112
* T004 = block 571
* T005 = block 904
* T006 = block 324
* T007 = block 426
* T008 = block 113
* T009 = block 253
* T010 = block 915
* S001 = block 743
* S002 = block 332
* S003 = block 575
* S004 = block 745
* D002 = block 1017

Verify settings can be edited by manager/owner:

* origin block
* core radius
* standard radius
* extended radius
* target minutes
* warning minutes
* delivery enabled
* notes

Only do a safe test update if it can be restored immediately.

If you update any value, restore it to the original value before finishing.

### Delivery Coverage Page

Verify:

* page loads without crash;
* Bahrain map loads;
* served blocks still appear;
* branch markers appear inside origin blocks;
* H002/T001 cluster or offset correctly in block 729;
* H004/S004 cluster or offset correctly in block 745;
* animated red service rings appear;
* service rings do not hide the heatmap;
* toggles work:

  * Show Branch Markers
  * Show Service Rings
  * Show Served Blocks
* selected block detail panel shows:

  * block number
  * dominant branch
  * zone label
  * approximate distance if available
  * recommendation
* data-quality chips show mapped/unmapped markers correctly.

## Step 4 — Branch User QA

Login as branch user T001 if available.

Verify:

* branch user can read own branch delivery profile only;
* branch user cannot edit Delivery Zone settings;
* branch user cannot see manager-only controls;
* Delivery Coverage does not expose other branches in a way that violates existing role rules.

If T001 browser login is unavailable, use available branch user and document which branch was tested.

## Step 5 — Supervisor QA

Login as supervisor if available.

Verify:

* supervisor can read assigned branch delivery profiles only;
* supervisor cannot edit profiles unless explicitly allowed by current role model;
* supervisor Delivery Coverage view respects assigned branches.

If supervisor credentials/session are not available, mark pending.

## Step 6 — Warehouse/Accounts QA

Login as warehouse/accounts if available.

Verify:

* read-only behavior if current role model allows read access;
* no write access to branch delivery profiles.

If unavailable, mark pending.

## Step 7 — Console / Error Review

During browser QA, check:

* browser console errors;
* failed network requests;
* RLS permission errors;
* map rendering errors;
* missing GeoJSON warnings.

Document any issue clearly.

## Step 8 — Documentation Update

Update:

```text
docs/DELIVERY_BRANCH_ZONES_AND_MARKERS.md
docs/DELIVERY_COVERAGE_ANALYTICS.md
docs/PRODUCTION_GAPS.md
docs/RELEASE_READINESS_STATUS.md
```

Mark:

* migration applied: passed
* seed validation: passed
* manager browser QA: passed/failed/pending
* branch browser QA: passed/failed/pending
* supervisor browser QA: passed/failed/pending
* warehouse/accounts browser QA: passed/failed/pending
* map markers: passed/failed/pending
* animated rings: passed/failed/pending
* deployed production smoke: still pending until deploy

## Final Verification

Run:

```bash
npm run typecheck
npm run build
npm ls --depth=0
```

Run audit only if package files changed.

## Final Response Format

Return:

```markdown
## Summary
<summary>

## Browser QA
### Manager/Owner
- Delivery Zones settings:
- Delivery Coverage map:
- branch markers:
- duplicate clusters:
- animated rings:
- toggles:
- zone details:
- data quality:

### Branch User
- branch tested:
- own profile read:
- cross-profile visibility:
- edit blocked:

### Supervisor
- result:

### Warehouse/Accounts
- result:

## Console / Network Issues
<issues or none>

## Files Changed
- <file>

## Verification
- typecheck:
- build:
- npm ls:
- audit if run:

## Pending Approval
- commit:
- push:
- deploy:

## Remaining Blockers
- <blocker>

## Final Status
B) dedicated-client staging-ready only
```
