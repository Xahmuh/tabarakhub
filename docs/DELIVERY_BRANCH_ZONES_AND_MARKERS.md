# Delivery Branch Zones And Markers

Current status: `B) dedicated-client staging-ready only`

## Purpose

Delivery Coverage can now show two views of the same operational question:

- where delivery orders were actually served, from recorded `delivery_orders.block_number`;
- which branch is configured as the expected origin for each service zone.

This is an internal operational map. It does not use Google Maps, Mapbox, paid map APIs, or stored branch coordinates.

## Origin Block Concept

Each operational branch can have one delivery profile in `public.branch_delivery_profiles`.

The profile stores:

- `branch_id`
- `origin_block_number`
- core, standard, and extended radius settings
- target and warning delivery minutes
- delivery enabled flag
- notes

The app derives the branch marker point from the centroid of `origin_block_number` in:

```text
public/data/bahrain-blocks.geojson
```

No fake coordinates are stored or generated. If the origin block is not present in the GeoJSON, the branch is shown as unmapped.

## Default Branch Mapping

The local migration seeds profiles by `branches.code`:

| Branch code | Origin block |
|---|---:|
| H001 | 711 |
| H002 | 729 |
| H003 | 816 |
| H004 | 745 |
| H005 | 555 |
| T001 | 729 |
| T002 | 255 |
| T003 | 112 |
| T004 | 571 |
| T005 | 904 |
| T006 | 324 |
| T007 | 426 |
| T008 | 113 |
| T009 | 253 |
| T010 | 915 |
| S001 | 743 |
| S002 | 332 |
| S003 | 575 |
| S004 | 745 |
| D002 | 1017 |

Local GeoJSON verification found all provided origin blocks present:

```text
711, 729, 816, 745, 555, 255, 112, 571, 904, 324, 426, 113, 253, 915, 743, 332, 575, 1017
```

## Duplicate Block Behavior

Some branches intentionally share an origin block:

| Origin block | Branches |
|---|---|
| 729 | H002, T001 |
| 745 | H004, S004 |

The map offsets duplicate markers around the same centroid and shows a small connector back to the true centroid. Service rings remain centered on the real block centroid.

## Animated Service Rings

When profiles are available, the map can show three subtle red rings:

- Core zone: stronger red stroke
- Standard zone: medium red stroke
- Extended zone: lighter dashed red stroke

The rings are approximate straight-line visual guides based on GeoJSON centroids. They are not route-time, driving-distance, or SLA guarantees.

Default radius settings:

| Band | Radius |
|---|---:|
| Core | 0-3 km |
| Standard | 3-5 km |
| Extended | 5-8 km |
| Outside recommended range | >8 km |

Default delivery time settings:

| Setting | Minutes |
|---|---:|
| Target delivery time | 25 |
| Warning delivery time | 35 |

## Served Block Zone Detection

For each served block, the app compares:

- centroid of the served delivery block;
- centroid of the dominant branch origin block;
- branch delivery profile radius settings.

Classification:

| Zone | Rule |
|---|---|
| `core` | distance <= core radius |
| `standard` | distance > core and <= standard radius |
| `extended` | distance > standard and <= extended radius |
| `outside_range` | distance > extended radius |
| `unavailable` | missing profile, missing origin geometry, or missing served block geometry |

Recommendations are intentionally cautious:

- Core + high demand: maintain service quality.
- Standard + demand: monitor capacity.
- Extended + repeated demand: review routing or nearby branch support.
- Outside range + repeated demand: candidate for further review.

The app must not say "open a branch here" based on this MVP logic.

## Map Controls

The map includes toggles for:

- Branch Markers
- Service Rings
- Served Blocks

The matrix fallback remains available when geometry is missing or the map is turned off.

## Settings Workflow

Managers/owners can configure branch delivery profiles in:

```text
Project Settings > Delivery Zones
```

Fields:

- origin block number
- core radius km
- standard radius km
- extended radius km
- target delivery minutes
- warning delivery minutes
- delivery enabled
- notes

If the GeoJSON is loaded and the origin block is not found, the UI refuses to save the profile rather than creating a guessed marker.

## Data Quality Indicators

The Delivery Coverage data-quality view reports:

- total branch profiles
- mapped branch markers
- unmapped branch markers
- duplicate branch origin block groups
- missing origin blocks
- missing GeoJSON origin blocks
- served blocks mapped
- served blocks outside range
- served blocks with unavailable zone
- total geometry blocks

## RLS

The migration creates `public.branch_delivery_profiles` with RLS enabled.

Policy intent:

- `anon`: no access
- `manager/owner`: read/write
- `supervisor`: read assigned branch profiles through `current_app_can_access_branch`
- `branch`: read own branch profile only
- `warehouse`: read-only through the current read-all helper
- `service_role`: full access for migrations and admin provisioning

Do not weaken these policies for UI convenience.

## Linked Supabase Validation - 2026-06-14

Applied migration:

```text
20260614163000_add_branch_delivery_profiles.sql
```

Validation results on the currently linked Supabase project:

| Check | Result |
|---|---|
| Migration listed local and remote | Pass |
| `branch_delivery_profiles` table exists | Pass |
| RLS enabled | Pass |
| Anon table grants | Pass - 0 grants |
| Seeded expected profiles | Pass - 20 of 20 |
| Missing configured branch codes | Pass - none |
| Expected duplicate block groups | Pass - `729` = H002/T001, `745` = H004/S004 |
| Anon REST read | Pass - denied with permission error |
| Branch T001 own profile visibility | Pass - 1 visible |
| Branch T001 cross-branch H003 visibility | Pass - 0 visible |

Pending validation before any production claim:

- Real manager/owner browser session can read/write profiles.
- Real supervisor session can read only assigned branch profiles.
- Real warehouse session can read profiles and cannot write.
- Real branch browser session confirms own-profile only behavior in the UI.
- Deployed/staging browser smoke confirms markers, duplicate offsets, service rings, toggles, and zone labels.

## Authenticated Browser QA Attempt - 2026-06-14

Local app session:

```text
http://127.0.0.1:5180/
```

Result:

| Check | Result |
|---|---|
| Local Vite app opened in browser | Pass - login page loaded |
| Browser console errors/warnings on login page | Pass - none observed |
| Authenticated manager/owner QA | Pending - no working manager/owner browser session or credentials available |
| Authenticated branch QA | Pending - no branch browser password/session available in the test browser |
| Authenticated supervisor QA | Pending - no supervisor profile/session available |
| Authenticated warehouse/accounts QA | Pending - no warehouse/accounts profile/session available |
| Linked `app_user_profiles` role inventory | Branch only: 20 active branch profiles |
| Delivery Zones settings UI browser QA | Pending - requires manager/owner session |
| Delivery Coverage map markers/rings browser QA | Pending - requires authenticated allowed-role session |
| Deployed production smoke | Pending - no deploy performed |

No Auth users, profiles, passwords, migrations, commits, pushes, or deployments were changed for this QA attempt.

## Updating Origin Blocks Later

Use Project Settings for normal edits. For bulk provisioning, use the local migration pattern:

```sql
insert into public.branch_delivery_profiles (...)
select ...
from public.branches b
where upper(b.code) = '<BRANCH_CODE>'
on conflict (branch_id) do update set ...
```

Use `branches.code`, not branch names.

## Production Validation Checklist

- Apply the migration to each target Supabase project only after explicit approval.
- Confirm `branch_delivery_profiles` has RLS enabled.
- Confirm anon cannot read `branch_delivery_profiles`.
- Confirm manager/owner can read/write profiles.
- Confirm branch user can read only own profile and cannot edit.
- Confirm supervisor can read assigned branch profiles only.
- Confirm all provided origin blocks map to GeoJSON.
- Confirm duplicate origin blocks render offset markers.
- Confirm H002/T001 cluster in block 729.
- Confirm H004/S004 cluster in block 745.
- Confirm service rings render and can be toggled off.
- Confirm served block zone classifications appear in block details.
- Confirm matrix fallback still works.
- Confirm no paid map API or frontend secret was added.

Final status remains:

```text
B) dedicated-client staging-ready only
```
