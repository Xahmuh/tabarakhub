# CODEX PROMPT: Enterprise UI Polish for Bahrain Block Delivery Coverage Map

You are working inside an existing React/Vite project.

The project is an internal pharmacy operations platform for Bahrain. It includes a Delivery Coverage module that uses real Bahrain block geometry from:

```text
public/data/bahrain-blocks.geojson
```

The current map is already functional and based on real GeoJSON polygons. Your task is to improve the **visual quality and user experience of the map only** so it feels like an enterprise-grade manager dashboard.

This is a UI/UX polish task only.

## Objective

Improve the Bahrain block coverage map UI so it looks professional, polished, and useful for managers.

The map should clearly show delivery intensity by Bahrain block, support hover/selection states, show a legend, show selected block details, include loading/error/empty states, and work well on desktop and mobile.

## Very Important Constraints

* Do NOT add Google Maps.
* Do NOT add Mapbox.
* Do NOT add paid map APIs.
* Do NOT add external map services.
* Do NOT invent any geography.
* Do NOT create fake blocks.
* Do NOT modify the GeoJSON data.
* Use the existing file:
  `public/data/bahrain-blocks.geojson`
* Keep the existing matrix fallback if map loading fails.
* Do NOT change Supabase logic.
* Do NOT change RLS.
* Do NOT change migrations.
* Do NOT add new database tables.
* Do NOT add AI.
* Do NOT add large new features.
* Do NOT deploy.
* Do NOT commit unless explicitly asked.
* Keep this scoped to map and delivery coverage UI polish only.
* Final project status remains:
  `B) dedicated-client staging-ready only`

## Files To Inspect First

Before coding, read these files:

```text
app/delivery/DeliveryCoverage.tsx
app/delivery/components/BlockCoverageMap.tsx
app/delivery/bahrainBlockGeometry.ts
services/deliveryCoverageService.ts
docs/DELIVERY_COVERAGE_ANALYTICS.md
```

Also inspect any local types used by the map, such as `types.ts`, only if needed.

## Current Context

The Delivery Coverage module already has:

* Bahrain block GeoJSON geometry.
* A map rendering layer.
* Matrix fallback.
* Delivery orders aggregated by block number.
* Block coverage metrics.
* Manager-facing delivery analytics.
* Internal-use accepted map status.
* External/commercial redistribution license not confirmed.

Do not change the data model or analytics logic unless a tiny UI-facing type refinement is absolutely necessary.

## Required UI/UX Improvements

### 1. Enterprise Map Container

Improve the map container to feel like a polished dashboard card:

* clear title area,
* short subtitle,
* compact KPI strip,
* map status indicator,
* responsive layout,
* professional spacing,
* consistent visual hierarchy.

Suggested title:

```text
Bahrain Block Delivery Coverage
```

Suggested subtitle:

```text
Real block geometry loaded for internal operational analysis.
```

Keep legal/license messaging subtle and non-blocking for internal users.

### 2. Color Scale / Heat Intensity

Improve block coloring so delivery order intensity is obvious.

Use a clear scale such as:

* no orders / inactive: very light neutral
* low: light blue/green
* medium: stronger blue/green
* high: amber/orange
* very high: red/dark accent

Do not use colors that make the map unreadable.

Make sure the selected block remains visually distinct.

### 3. Legend

Add a clear legend.

The legend should explain:

* no orders,
* low activity,
* medium activity,
* high activity,
* very high activity,
* selected block,
* unmapped served block if relevant.

The legend should be compact and usable on mobile.

### 4. Hover States

Add hover behavior for blocks:

* highlight hovered block,
* show cursor pointer for interactive blocks,
* show block number and order count in a tooltip or floating info area,
* make hover accessible enough for desktop users.

If mobile hover is not possible, tap/selection should still work.

### 5. Selected Block Details

When a manager clicks a block, show a professional details panel.

The panel should include:

* block number,
* total orders,
* share of selected-period orders,
* dominant branch,
* branch breakdown,
* trend if available,
* mapped/unmapped status,
* recommended action if available,
* button or text to view related matrix details if already supported.

Do not invent missing data.

If no block is selected, show a helpful empty state:

```text
Select a block on the map to inspect delivery activity and branch breakdown.
```

### 6. Data Quality Indicators

Add clear but non-intrusive data-quality indicators near the map:

* total geometry blocks,
* mapped served blocks,
* unmapped served blocks,
* unknown block orders if available,
* unresolved block count if available.

These should help managers trust the map.

Use wording like:

```text
491 geometry blocks loaded
42 served blocks mapped
4 served blocks unmapped
```

### 7. Loading State

Improve loading state while GeoJSON is loading.

Show:

* skeleton/card loading state,
* short text:
  `Loading Bahrain block geometry...`

Do not show a broken or empty map during loading.

### 8. Error State

If GeoJSON fails to load:

* show a clear but calm error message,
* keep matrix fallback available,
* do not crash the page.

Example:

```text
Block geometry could not be loaded. Matrix view is still available.
```

### 9. Empty State

If there are no delivery orders in the selected period:

* show the map if geometry exists,
* but clearly say there are no delivery orders for the current filters,
* avoid implying coverage is weak if there is no data.

Example:

```text
No delivery orders found for the selected filters. Adjust the date range or branch filter.
```

### 10. Responsive Layout

Improve desktop and mobile behavior:

Desktop:

* map on the left,
* selected block details on the right,
* legend/KPIs above or below.

Mobile:

* map full width,
* details panel below,
* legend collapses or wraps nicely,
* no horizontal overflow.

### 11. Accessibility

Add basic accessibility improvements:

* meaningful labels where practical,
* selected block state should be readable in text,
* do not rely only on color for status,
* avoid tiny unreadable text.

### 12. Internal-Use Messaging

The map is accepted for internal use.

Do not show scary legal text to normal users.

Use subtle wording only, such as:

```text
Internal-use geometry dataset.
```

If a longer license note exists, keep it in docs rather than making it prominent in the UI.

## Out Of Scope

* Do not add a real map tile provider.
* Do not add Google Maps.
* Do not add Mapbox.
* Do not add Leaflet unless it is already installed and already used.
* Do not add new dependencies unless absolutely necessary. Prefer existing React/SVG/Tailwind.
* Do not change the GeoJSON file.
* Do not change delivery aggregation logic.
* Do not change Supabase queries.
* Do not change RLS.
* Do not create migrations.
* Do not add new analytics features.
* Do not add marketing campaign logic.
* Do not add driver app features.
* Do not add AI.

## Documentation

Update `docs/DELIVERY_COVERAGE_ANALYTICS.md` only if the UI behavior or map presentation changed enough to document.

Do not over-document minor styling changes.

If you update docs, mention:

* map remains internal-use accepted,
* matrix fallback remains available,
* no paid map API is used,
* no fake geography is created.

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Also run if useful:

```bash
npm ls --depth=0
```

Do not run deployment commands.

Do not claim audit is clean unless you run audit and it passes. Audit is not required for this UI-only pass unless package files change.

## Final Response Format

Return:

```markdown
## Summary
<short summary>

## Files Changed
- <file>
- <file>

## UX Improvements
- Map container:
- Color scale:
- Legend:
- Hover/selection:
- Selected block details:
- Data-quality indicators:
- Loading/error/empty states:
- Responsive behavior:

## Verification
- typecheck:
- build:
- npm ls if run:

## Remaining Notes
- <note>
- <note>

## Final Status
B) dedicated-client staging-ready only
```

## Acceptance Criteria

* Map looks more polished and enterprise-ready.
* Existing GeoJSON map still works.
* Matrix fallback still works.
* No fake geography is introduced.
* No external map API is added.
* No migrations are changed.
* No RLS/Supabase logic is changed.
* Hover and selected block states are improved.
* Legend exists.
* Selected block detail panel exists or is significantly improved.
* Data-quality indicators are visible.
* Loading/error/empty states are clear.
* Desktop and mobile layouts are usable.
* `npm run typecheck` passes.
* `npm run build` passes.
