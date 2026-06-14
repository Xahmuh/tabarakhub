# Delivery Coverage — Advanced Analytics

Advanced, manager-facing decision analytics layered on top of the base Delivery
Coverage module. Turns real `delivery_orders` block data into cautious, explainable
actions: where demand is strong/weak, who serves what, where to run campaigns,
which branches are overloaded, and which blocks are worth *reviewing* for
expansion. All outputs are evidence-based and never assert a branch-opening
decision.

## Feature purpose

- Marketing campaign planning (low/declining blocks).
- Branch delivery catchment analysis (primary/secondary/weak service blocks).
- Service-area optimization (overlap / cannibalization, capacity pressure).
- Cautious expansion *review* candidates (never a decision).
- Converting insights into operations tasks.

## Analytics included (enabled now)

| Analytic | Source | Notes |
|---|---|---|
| Campaign opportunities | block order volume + intra-period trend | Suppressed when data is thin (<10 mappable orders) or unknown-block rate ≥ 40%. |
| Demand trend | order dates, first half vs second half | Min 4-order sample, else `insufficient_data`; classes: increasing / decreasing / stable / new_demand. |
| Branch catchment | per-branch block distribution | Tiers by share-of-branch: primary ≥15%, secondary 5–15%, weak <5%. Includes revenue (value_bhd). |
| Branch overlap | blocks served by >1 branch | Severity by second-branch share (≥40% high, ≥25% medium). Flag for review only. |
| White space | block directory minus served blocks | `true_zero_activity` when the directory is available; otherwise `served_low_activity`. Scope-aware wording. |
| Expansion review | per-block score 0–100 | Conservative; shown only ≥60 with ≥2 reasons and ≥20 mappable orders. "Candidate for further review." |
| Capacity pressure | per-branch composite | normal / watch / high_pressure / overloaded / insufficient_data. |

## Future-only (required fields absent on `delivery_orders`)

`delivery_orders` has: branch, order_date, value_bhd, payment_type, pharmacist,
driver, block_number, area_name, governorate, is_outside_governorate, notes.
It does **not** have delivery/promised/completed timestamps, a delivery status,
a customer identifier, or product/category/order-item data. Therefore:

- **SLA / delay heatmap (Phase 9)** — future work; requires delivery timing/status.
- **Product demand by block (Phase 10)** — future work; requires order items/category.
- **Customer repeat rate (Phase 11)** — future work; requires a safe customer id.
  No customer PII is collected or displayed.

The Data Quality tab shows a "field availability" panel making this explicit.

## Exact rules

**Campaign opportunity engine.** Among served, resolved blocks, "low" = order
count ≤ max(2, 25th-percentile of block counts). Declining blocks (trend
`decreasing`) get medium severity; others low. Confidence: `medium` if ≥3 orders
else `low`. Entirely suppressed when mappable < 10 or unknown-block rate ≥ 40%.
Wording is cautious — outcomes are not guaranteed.

**Branch catchment.** For each branch, blocks are tiered by share of the branch's
known-block orders (primary ≥0.15, secondary ≥0.05, weak <0.05).

**Overlap / cannibalization.** Blocks with >1 serving branch, sorted by volume,
top 15. Recommendation flags for routing/ownership review — never an automatic
removal suggestion.

**Expansion candidate score (0–100).** Sustained volume (top-quartile block) up to
+40 scaled by share; increasing trend +25 (or new demand +15); dominant branch
outside-governorate ≥35% +20; dominant branch under capacity pressure +15. Shown
only if score ≥60, ≥2 reasons, ≥8 block orders, and ≥20 mappable orders overall.
Block-level only — real geographic clustering of adjacent blocks requires GeoJSON
geometry and is documented as future work.

**Capacity pressure.** Per branch (≥8 orders, else `insufficient_data`): +2/+1 for
outside-gov share ≥0.35/≥0.2; +2/+1 for unique blocks ≥15/≥8; +2/+1 for unknown
rate ≥0.25/≥0.1; +1 for ≥5 overlap blocks; +1 for top-block concentration ≥0.5.
Score ≥5 overloaded, 3–4 high_pressure, 1–2 watch, 0 normal.

## Operations task integration

Manager-only "Create task" buttons on campaign, overlap, capacity, and expansion
insights create an `operations_tasks` row via the existing service:

- `source_module = 'delivery_coverage'`
- `related_record_type ∈ { delivery_block, branch_coverage, delivery_insight }`
- `related_record_id =` block number or branch id (stable insight id for expansion)

Before creating, the UI checks `findOpenTaskForInsight` and **warns if an open /
in_progress task already exists** for the same insight, requiring explicit confirm.
Tasks are never auto-created. Creation uses existing task RLS/permissions.

## Role access

- Coverage tab + advanced sections: manager / owner / supervisor (RLS-scoped data;
  supervisors see only assigned branches; branch users do not get this tab and are
  RLS-limited to their own branch anyway).
- **Create task: manager only** (`canCreateTask`). Owner/supervisor are read-only.
- Access never relies on UI hiding alone — `deliveryService.orders.list` is
  RLS-scoped at the database.

## No fake geography rule

Advanced analytics use real order/block data only. The real Bahrain block map
(`public/data/bahrain-blocks.geojson`) renders when present; otherwise the
governorate/area matrix fallback stays. No coordinates or polygons are invented.
White-space "true zero activity" is only claimed when the block directory provides
a real universe, and is labelled as scoped to the visible (RLS-filtered) data.

## Feature flag

`VITE_DELIVERY_COVERAGE_ADVANCED_ANALYTICS` (config key `deliveryCoverageAdvanced`,
default true in demo and the production template). When off, the advanced sub-tabs
(Campaign, Overlap, Capacity, Expansion) and the demand-trend/catchment add-ons are
hidden; Overview, Block Map, Branch Catchment (footprint), and Data Quality remain.
Core Delivery Coverage is unaffected.

## Data requirements summary

- Required: `delivery_orders` with block_number, order_date, branch_id, payment_type.
- Used when present: value_bhd (revenue), area_name/governorate snapshots, the block
  directory (`delivery_blocks`), and the block GeoJSON.
- Insufficient data → "insufficient data" states and suppressed recommendations.
