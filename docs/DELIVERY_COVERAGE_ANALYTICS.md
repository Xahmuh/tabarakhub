# Delivery Coverage Analytics (Bahrain Block Coverage)

Manager-facing analytics that turn recorded delivery order block numbers into a
strategic, block-level coverage view for Bahrain.

## Purpose

Answer operational/strategic questions from real delivery data:

- Which Bahrain blocks receive the most delivery orders?
- Which blocks are served by each branch?
- Which served blocks have weak demand?
- Which branch covers which delivery zones?
- Where might marketing campaigns help?
- Where might coverage/expansion be worth **further review** (not a decision)?

## Data source

- Table: `public.delivery_orders` (created by
  `supabase/migrations/20260612190000_delivery_recording_traceability.sql`).
- Relevant fields used by coverage:
  - `branch_id` — branch that recorded the order.
  - `block_number` — Bahrain block (nullable; **not** an FK, so unknown blocks
    can still be recorded).
  - `area_name`, `governorate` — snapshots resolved from `delivery_blocks` at
    insert time by the `delivery_orders_resolve_geo` trigger.
  - `is_outside_governorate` — branch served outside its own governorate.
  - `payment_type` — `BP | CARD | CASH | TALABAT`.
  - `order_date` — used for date filtering and intra-period trend.
- There is **no delivery status column** in the current schema, so the spec's
  optional status filter is intentionally omitted.
- Aggregation runs in TypeScript over RLS-scoped, date-bounded rows fetched via
  `deliveryService.orders.list` (MVP; volumes are small and always date-capped,
  default last 30 days). `services/deliveryCoverageService.ts` is the entry point.

## `block_number` assumptions

- **Talabat** orders have no block by design — they are excluded from block
  coverage and reported separately (`talabatOrders`).
- **Mappable** orders = non-Talabat orders. Among these:
  - **Known block** = a non-empty `block_number` was recorded.
  - **Unknown block** = no block number recorded (`unknownBlockOrders`,
    `unknownBlockRate`). This is the data-quality KPI.
  - **Unresolved block** = a block number was recorded but it is not in the
    `delivery_blocks` directory, so area/governorate are unknown
    (`unresolvedBlockOrders`). Surfaced as a separate data-quality signal.
- No geography is invented. Unresolved blocks are grouped under the `Unknown`
  governorate bucket and flagged, never placed on a fake location.

## KPI definitions

| KPI | Meaning |
|---|---|
| Total orders | All delivery orders in scope (incl. Talabat). |
| Known block orders | Non-Talabat orders with a block number. |
| Unknown block orders | Non-Talabat orders with no block number. |
| Unknown block rate | Unknown ÷ mappable (non-Talabat) orders. |
| Unique blocks served | Distinct block numbers recorded. |
| Top block | Block with the most orders in scope. |
| Top serving branch | Branch with the most mappable orders. |
| Unresolved blocks | Orders whose block number is not in the directory. |

Per-block metric (`DeliveryBlockMetric`): order count, branch breakdown,
dominant branch, share of located deliveries, and an intra-period **trend**
(first half vs second half of the selected window; `insufficient_data` below 4
orders so a trend is never implied from one or two records).

## Recommendation rules (explainable, real-data only)

- **data_quality_issue** — unknown-block rate ≥ 10% (high ≥ 25%), or any
  unresolved blocks present. Also fires a "low data volume" note when there are
  fewer than 10 mappable orders, and suppresses all geographic advice in that case.
- **strong_service_area** — top blocks with ≥ 5 orders and ≥ 5% share. Suggests
  retention/quality monitoring.
- **marketing_opportunity** — served blocks with the weakest volume. Cautious:
  "if this block is within your service area, consider a targeted campaign."
- **expansion_candidate** — a branch with ≥ 20 located orders and ≥ 35% of them
  outside its own governorate. Worded strictly as "candidate for further review",
  never "open a branch here". At most one is surfaced per run.

No recommendation asserts a branch-opening decision; weak data produces no
expansion advice.

## Map / visualization mode

Two modes, chosen automatically by whether real block geometry is present.

**Real block map (when geometry loads).** A Bahrain block polygon dataset is now
integrated at `public/data/bahrain-blocks.geojson` (491 polygons, `BLOCK_NO`).
When it loads, the dashboard shows a **Map / Matrix** toggle; Map renders the real
polygons via a plain inline SVG (no map library, no tiles, no API keys). The map
shows all available geometry in a neutral state, colors served blocks by order
volume, highlights hover/selected blocks, includes a compact activity legend, and
keeps a selected-block detail panel with branch breakdown, trend, mapped status,
and any available recommendation. Data-quality chips near the map show geometry
blocks loaded, served blocks mapped/unmapped, unknown block orders, and unresolved
blocks. Loading, empty, and unavailable states keep the matrix fallback clear and
available. The dataset is **staging/evaluation only** pending license review —
see `docs/BAHRAIN_BLOCK_GEOJSON_VALIDATION.md` and
`docs/BAHRAIN_BLOCK_GEOJSON_INTEGRATION.md`.

**Fallback matrix (always available).** A **block-level coverage matrix** grouped
by governorate (Capital / Muharraq / Northern / Southern / Unknown), each block a
heat-colored cell with branch breakdown, share, and trend on click. This is the
guaranteed view when geometry is missing, invalid, or still loading, and it also
covers blocks that have no polygon. No invented geometry in either mode.

### Replacing or updating the geometry

See `docs/BAHRAIN_BLOCK_GEOJSON_INTEGRATION.md`. In short: drop a new GeoJSON
`FeatureCollection` at `public/data/bahrain-blocks.geojson`; if its block id uses a
different property, add it to `BLOCK_PROPERTY_CANDIDATES` in
`app/delivery/bahrainBlockGeometry.ts`; update the metadata JSON. The typed
`BahrainBlockGeometry` hook in `types.ts` remains the contract. Do **not**
introduce paid map APIs or expose any map key in the frontend.

## Role access

Enforced by RLS first (`current_app_can_access_branch`), UI second:

| Role | Coverage access |
|---|---|
| Manager | All branches. |
| Owner | All branches (read). |
| Warehouse | Reads all delivery data (no coverage tab wired by default; data is RLS-visible). |
| Supervisor | Assigned branches only (RLS-scoped; tab visible). |
| Branch | Coverage tab not shown; their own data is on the Branch Dashboard. RLS would restrict to own branch anyway. |

The `DeliveryCoverage` component also accepts a `lockedBranchId` prop for any
future single-branch embedding; data scope never relies on UI hiding alone.

## Data quality notes

- High unknown-block rate undermines every geographic conclusion — fix entry
  accuracy first (the recording form already warns on missing/unknown blocks).
- Unresolved blocks should be added in **Delivery Settings → Blocks & Areas** so
  they resolve to an area and governorate.
- Branches with no governorate classification inflate the `Unknown` bucket; set
  them in **Delivery Settings → Branch Classification**.

## Advanced analytics

An advanced analytics layer extends this module with a campaign-opportunity
engine, demand trends, branch catchment, overlap/cannibalization, capacity
pressure, cautious expansion-review scoring, and manager-only operations-task
creation from insights. It is gated by `VITE_DELIVERY_COVERAGE_ADVANCED_ANALYTICS`
(default on). See **docs/DELIVERY_COVERAGE_ADVANCED_ANALYTICS.md** for the exact
rules, role access, and which analytics are future-only due to missing
`delivery_orders` fields (SLA timing, status, customer id, product/category).

## Future workflows

- **Command Center integration** — coverage insights can already be turned into
  operations tasks manually from the advanced UI (`source_module = delivery_coverage`).
  Auto-surfacing them in the Daily Command Center summary pipeline remains future
  work (kept out to avoid touching that pipeline).
- **Marketing campaign workflow** — turn campaign-opportunity insights into tracked
  campaigns per block (budget/ROI out of scope for now).
- **Expansion planning workflow** — combine sustained demand + branch capacity +
  drive-time once geometry-based clustering exists; always human-reviewed.
- **SLA / product / customer analytics** — require new `delivery_orders` fields
  (timing/status, order items, safe customer id); documented as future work.
