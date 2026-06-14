# CODEX PROMPT: Branch Delivery Zones, Block Markers, and Animated Service Circles

You are working on the main/base product repo for a dedicated-client pharmacy operations platform in Bahrain.

Current status:
`B) dedicated-client staging-ready only`

## Objective

Enhance the Delivery Coverage module so the Bahrain map can show:

1. Branch location markers inside the correct Bahrain block.
2. Each branch's configured delivery origin block.
3. Animated red service circles/rings around each branch.
4. Served delivery blocks compared against each branch's service zones.
5. Data quality indicators for missing/unmapped branches or blocks.

The system already records delivery orders by Bahrain `block_number`, and the Delivery Coverage module displays served areas on the Bahrain block GeoJSON map.

Now we want the map to answer both questions:

```text
Where did we actually deliver?
```

and:

```text
Which branch is expected to serve which zone?
```

This should help managers understand:

- which areas each branch actually served;
- which served blocks are inside the branch's normal service range;
- which served blocks are outside the recommended range;
- which nearby blocks may need marketing campaigns;
- where branch coverage needs operational review.

---

## Important Rules

- Do not implement multi-tenancy.
- Do not add `organization_id`.
- Do not use Google Maps API.
- Do not use Mapbox.
- Do not use paid map APIs.
- Do not invent coordinates.
- Use the existing Bahrain block GeoJSON only:
  `public/data/bahrain-blocks.geojson`
- Marker location must be derived from the matching block polygon centroid.
- Service rings are approximate visual radius rings based on GeoJSON projection/centroids.
- Do not present service rings as exact route-time or driving-distance calculations.
- If a branch origin block cannot be matched to GeoJSON, show “zone unavailable” instead of guessing.
- Do not weaken RLS.
- Do not apply remote migrations without explicit approval.
- Do not deploy.
- Do not commit unless explicitly asked.
- Keep final status:
  `B) dedicated-client staging-ready only`

---

## Product Concept

Each branch has a configured `origin_block_number`.

Example:

```text
Branch: H003
Origin block: 816
Core radius: 3 km
Standard radius: 5 km
Extended radius: 8 km
```

The app should:

1. Find the block polygon for block `816`.
2. Calculate its centroid.
3. Place the branch marker at that centroid.
4. Draw animated red service rings around the marker:
   - Core zone
   - Standard zone
   - Extended zone
5. Compare served delivery blocks against those rings/zones.

---

## Branch Origin Block Mapping

Use this branch code to origin block mapping:

```csv
branch_code,origin_block_number
H001,711
H002,729
H003,816
H004,745
H005,555
T001,729
T002,255
T003,112
T004,571
T005,904
T006,324
T007,426
T008,113
T009,253
T010,915
S001,743
S002,332
S003,575
S004,745
D002,1017
```

Important duplicate block cases:

```text
Block 729 contains: H002, T001
Block 745 contains: H004, S004
```

These must not overlap visually. Show them as clustered, stacked, offset, or grouped markers.

---

## Recommended Default Radius Settings

Use these defaults unless a manager changes them later:

```text
Core zone: 0–3 km
Standard zone: 3–5 km
Extended zone: 5–8 km
Outside recommended range: >8 km
Target delivery time: 25 minutes
Warning delivery time: 35 minutes
```

Important:

- The distance bands are an MVP approximation.
- They are based on block centroids, not route time.
- Future upgrade can use route-time calculation if a paid map/routing API is approved later.

---

## Files To Inspect First

Inspect:

- `app/delivery/DeliveryCoverage.tsx`
- `app/delivery/components/BlockCoverageMap.tsx`
- `app/delivery/bahrainBlockGeometry.ts`
- `services/deliveryCoverageService.ts`
- `services/branchService.ts`
- `types.ts`
- `config/clientConfig.ts`
- `public/data/bahrain-blocks.geojson`
- `public/data/bahrain-blocks.metadata.json`
- `supabase/migrations/`
- `app/project-settings/ProjectSettings.tsx`
- `app/project-settings/AccessControlSection.tsx`

Also inspect whether branches already have any of these fields:

- block number
- latitude/longitude
- google maps link
- delivery area data
- delivery enabled flag

Do not assume fields exist.

---

## Phase 1 — Data Model

Check whether a clean branch delivery profile/settings table already exists, such as:

```text
branch_delivery_profiles
```

If it exists, use it.

If it does not exist, create a local migration for:

```text
branch_delivery_profiles
```

Suggested columns:

```sql
create table if not exists public.branch_delivery_profiles (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  origin_block_number text not null,
  core_radius_km numeric not null default 3,
  standard_radius_km numeric not null default 5,
  extended_radius_km numeric not null default 8,
  target_delivery_minutes integer not null default 25,
  warning_delivery_minutes integer not null default 35,
  is_delivery_enabled boolean not null default true,
  notes text null,
  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id)
);
```

Do not store fake coordinates.

The branch location must be derived from the centroid of `origin_block_number` in the GeoJSON.

---

## Phase 2 — RLS

Enable RLS if a new table is created.

RLS requirements:

- `anon`: no access.
- `manager/admin/owner`: read/write all branch delivery profiles.
- `supervisor`: read assigned branch profiles if supervisor role is active.
- `branch user`: read own branch delivery profile only.
- `branch user`: cannot edit.
- `accounts/warehouse`: read-only only if existing role model allows.

Use existing role helper functions where possible.

Do not create broad public access.

Do not weaken existing policies.

---

## Phase 3 — Seed / Upsert Branch Origin Blocks

Create a safe local seed/upsert SQL section that maps `branches.code` to the origin block number.

Use `branches.code`, not branch names.

Pattern:

```sql
with branch_blocks(branch_code, origin_block_number) as (
  values
    ('H001', '711'),
    ('H002', '729'),
    ('H003', '816'),
    ('H004', '745'),
    ('H005', '555'),
    ('T001', '729'),
    ('T002', '255'),
    ('T003', '112'),
    ('T004', '571'),
    ('T005', '904'),
    ('T006', '324'),
    ('T007', '426'),
    ('T008', '113'),
    ('T009', '253'),
    ('T010', '915'),
    ('S001', '743'),
    ('S002', '332'),
    ('S003', '575'),
    ('S004', '745'),
    ('D002', '1017')
)
insert into public.branch_delivery_profiles (
  branch_id,
  origin_block_number,
  core_radius_km,
  standard_radius_km,
  extended_radius_km,
  target_delivery_minutes,
  warning_delivery_minutes,
  is_delivery_enabled
)
select
  b.id,
  bb.origin_block_number,
  3,
  5,
  8,
  25,
  35,
  true
from branch_blocks bb
join public.branches b
  on b.code = bb.branch_code
where coalesce(b.role, 'branch') = 'branch'
on conflict (branch_id)
do update set
  origin_block_number = excluded.origin_block_number,
  core_radius_km = excluded.core_radius_km,
  standard_radius_km = excluded.standard_radius_km,
  extended_radius_km = excluded.extended_radius_km,
  target_delivery_minutes = excluded.target_delivery_minutes,
  warning_delivery_minutes = excluded.warning_delivery_minutes,
  is_delivery_enabled = excluded.is_delivery_enabled,
  updated_at = now();
```

Before applying remotely, only prepare this locally and report it.

---

## Phase 4 — Service Layer

Create or update:

```text
services/branchDeliveryProfileService.ts
```

Required functions:

```ts
listBranchDeliveryProfiles()
getBranchDeliveryProfile(branchId: string)
upsertBranchDeliveryProfile(input)
```

Rules:

- no localStorage production fallback;
- no fake/demo fallback unless `VITE_DEMO_MODE=true`;
- surface Supabase errors clearly;
- do not fail open;
- if no profile exists for a branch, return a clear “profile missing” state.

---

## Phase 5 — Geometry Helpers

Update or extend:

```text
app/delivery/bahrainBlockGeometry.ts
```

Add or confirm helpers:

```ts
getBlockPolygon(blockNumber: string)
getBlockCentroid(blockNumber: string)
getBranchMarkerPoint(branchCode: string, originBlockNumber: string)
calculateDistanceKm(pointA, pointB)
classifyDistanceZone(distanceKm, profile)
```

Zone classification:

```text
core: <= core_radius_km
standard: > core_radius_km and <= standard_radius_km
extended: > standard_radius_km and <= extended_radius_km
outside_range: > extended_radius_km
unavailable: missing geometry/profile
```

Rules:

- centroid must come from the actual GeoJSON polygon;
- support block number as string;
- normalize block numbers safely;
- if block not found, return unmapped state;
- do not guess location;
- document that centroid distance is approximate straight-line distance.

---

## Phase 6 — Project Settings UI

Add a manager/admin settings section:

```text
Project Settings > Delivery Zones
```

For each branch, manager/admin can configure:

- origin block number;
- core radius km;
- standard radius km;
- extended radius km;
- target delivery minutes;
- warning delivery minutes;
- delivery enabled;
- notes.

UI behavior:

- validate origin block exists in loaded GeoJSON if possible;
- show branch origin status:
  - mapped
  - unmapped
  - missing profile
- show save success/error;
- branch/accounts users should not edit;
- branch users may read only their own configured delivery profile if allowed by RLS.

Do not redesign all settings.

---

## Phase 7 — Map Branch Markers

Update:

```text
app/delivery/components/BlockCoverageMap.tsx
```

or related map component.

Show branch markers inside blocks.

Marker requirements:

- Marker should be placed at the centroid of the branch origin block.
- Marker should show branch code, e.g. `H003`.
- Marker should be visually clear but not hide the block heatmap.
- Marker should have tooltip/details:
  - branch code
  - branch name if available
  - origin block number
  - delivery enabled status
  - zone/radius summary if available

Duplicate block behavior:

- if multiple branches have the same centroid/block, do not place exact overlapping markers;
- use a small cluster badge, offset markers, stacked markers, or grouped tooltip;
- clicking/hovering should show all branches in that block.

Required duplicate groups:

```text
Block 729:
- H002
- T001

Block 745:
- H004
- S004
```

---

## Phase 8 — Animated Red Service Circles

If radius settings exist for a branch profile, show animated red rings around the branch marker:

- Core ring
- Standard ring
- Extended ring

Visual requirements:

- branch marker: red/dark accent dot;
- core ring: stronger red stroke;
- standard ring: medium red stroke;
- extended ring: lighter red dashed stroke;
- pulse animation should be subtle;
- preferably pulse selected branch only, or use a very gentle pulse for all;
- do not make the map visually noisy;
- respect reduced motion if possible;
- do not add new animation libraries unless absolutely necessary.

Important:

- These are approximate visual service rings based on block centroid/projection.
- Do not claim they are exact driving distance.
- Do not claim they are exact route-time areas.

---

## Phase 9 — Map UI Controls

Add map toggles:

```text
Show Branch Markers
Show Service Rings
Show Served Blocks
```

Default:

- branch markers: on
- served blocks: on
- service rings: on only if branch delivery profiles exist

If performance is affected, allow service rings to be turned off.

---

## Phase 10 — Delivery Coverage Zone Detection

Update delivery coverage analytics to compare served blocks against branch zones.

For each served block and dominant/selected branch:

- get served block centroid;
- get branch origin centroid;
- calculate approximate km distance;
- classify zone:
  - core
  - standard
  - extended
  - outside_range
  - unavailable

Add metrics:

```ts
servedCoreBlocks
servedStandardBlocks
servedExtendedBlocks
servedOutsideRangeBlocks
unmappedServedBlocks
missingBranchProfiles
mappedBranchMarkers
unmappedBranchMarkers
duplicateBranchBlockGroups
```

Add recommendations:

- Core + high demand:
  `Strong natural service area. Maintain service quality.`
- Standard + demand:
  `Normal delivery coverage. Monitor capacity.`
- Extended + repeated demand:
  `Extended coverage pressure. Review routing or nearby branch support.`
- Outside range + repeated demand:
  `Coverage review candidate. Consider routing review, campaign test, or future expansion study.`
- Missing profile:
  `Branch delivery zone is not configured.`
- Missing geometry:
  `Distance unavailable because block geometry is missing.`

Do not say:
`Open a branch here.`

Use:
`Candidate for further review.`

---

## Phase 11 — Block Details Panel

In Delivery Coverage block details, show:

- selected block number;
- order count;
- dominant branch;
- branch zone relative to dominant branch;
- approximate distance km;
- whether block is inside core/standard/extended/outside;
- recommended action;
- if unavailable, explain why:
  - branch profile missing;
  - branch origin block not mapped;
  - served block not mapped;
  - GeoJSON unavailable.

---

## Phase 12 — Data Quality Panel

Add data quality indicators:

- total branch profiles;
- mapped branch markers;
- unmapped branch markers;
- duplicate block groups;
- missing origin block;
- missing GeoJSON block;
- served blocks mapped;
- served blocks outside range;
- served blocks with unavailable zone;
- total geometry blocks.

For this provided list, explicitly report whether all these blocks exist in GeoJSON:

```text
711,729,816,745,555,255,112,571,904,324,426,113,253,915,743,332,575,1017
```

Expected behavior:

- If all exist, report all mapped.
- If any are missing, list exact missing blocks and affected branches.
- Do not create fake markers for missing blocks.

---

## Phase 13 — Documentation

Create:

```text
docs/DELIVERY_BRANCH_ZONES_AND_MARKERS.md
```

Include:

- purpose;
- origin block concept;
- branch code to block mapping;
- duplicate block behavior;
- branch marker behavior;
- animated red service circles;
- default radius bands;
- served block zone detection;
- centroid-based limitation;
- no paid map API;
- no fake geography;
- unmapped block handling;
- how manager configures branch zones;
- how to update branch origin blocks later;
- production validation checklist.

Update if relevant:

```text
docs/DELIVERY_BRANCH_ZONES.md
docs/DELIVERY_BRANCH_MARKERS.md
docs/DELIVERY_COVERAGE_ANALYTICS.md
docs/DELIVERY_COVERAGE_ADVANCED_ANALYTICS.md
docs/PRODUCTION_GAPS.md
docs/RELEASE_READINESS_STATUS.md
```

If the separate docs do not exist, create only the combined doc and update the existing coverage/readiness docs.

---

## Phase 14 — Verification

Run:

```bash
npm run typecheck
npm run build
npm ls --depth=0
```

Run audit only if package files changed.

If a migration is created locally, do not apply it remotely unless explicitly approved.

---

## Final Response Format

Return:

```markdown
## Summary
<summary>

## Branch Marker Mapping
- total provided branches:
- mapped branches:
- unmapped branches:
- duplicate block groups:

## Data Model
<table/migration summary>

## RLS
<summary>

## Branch Zone Logic
<summary>

## Map UI
<branch markers and animated red circles summary>

## Settings UI
<summary>

## Delivery Coverage Analytics
<zone classification summary>

## Data Quality
<summary>

## Files Changed
- <file>

## Documentation
- <file>

## Verification
- typecheck:
- build:
- npm ls:
- audit if run:

## Remaining Blockers
- <blocker>

## Final Status
B) dedicated-client staging-ready only
```

---

## Acceptance Criteria

- Branch marker appears inside each mapped branch block.
- Marker location comes from GeoJSON block centroid.
- H002/T001 cluster correctly in block 729.
- H004/S004 cluster correctly in block 745.
- Missing blocks show unmapped state instead of fake marker.
- Manager can configure branch origin block and radius settings.
- Map shows animated red service circles/rings.
- Service rings are subtle and enterprise-friendly.
- Served blocks are classified as:
  - core
  - standard
  - extended
  - outside_range
  - unavailable
- Map has toggles for:
  - branch markers
  - service rings
  - served blocks
- Data quality panel reports mapped/unmapped markers and duplicate block groups.
- No paid map API is added.
- No fake coordinates are added.
- No RLS is weakened.
- Matrix fallback remains.
- Documentation exists.
- Typecheck passes.
- Build passes.
- Final status remains:
  `B) dedicated-client staging-ready only`
