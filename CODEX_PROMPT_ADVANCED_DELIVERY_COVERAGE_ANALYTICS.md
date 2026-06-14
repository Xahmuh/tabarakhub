# CODEX PROMPT: Advanced Delivery Coverage Analytics

You are working on the main/base product repo for a dedicated-client deployment model.

This project is intentionally NOT a shared multi-tenant SaaS.
Each client gets a separate deployment with its own Supabase project, database, storage, Auth users, environment variables, Edge Function secrets, and frontend URL.

Current status:

```text
B) dedicated-client staging-ready only
```

Do not claim production-ready.
Do not deploy.
Do not commit unless explicitly asked.
Do not apply remote migrations unless explicitly asked.
Do not implement multi-tenancy.
Do not add `organization_id`.
Do not expose secrets in frontend.
Do not use paid map APIs.
Do not invent fake Bahrain geography.
Do not add AI in this pass.

---

## Objective

Enhance the existing Delivery Coverage Analytics module into an advanced manager decision system.

The current MVP shows Bahrain block-level delivery coverage using real delivery orders and a matrix/list fallback when exact Bahrain block polygon GeoJSON is unavailable.

Now add advanced actionable analytics that help managers decide:

- Where demand is strong.
- Where demand is weak.
- Which branch serves which areas.
- Which blocks are campaign opportunities.
- Which branches are overloaded.
- Which blocks may be expansion candidates for review.
- Which insights should become operations tasks.

The goal is not just to show analytics, but to convert delivery coverage data into manager actions.

---

## Existing Feature Context

Current Delivery Coverage Analytics has:

- `services/deliveryCoverageService.ts`
- `app/delivery/DeliveryCoverage.tsx`
- `app/delivery/DeliveryHub.tsx`
- coverage types in `types.ts`
- `docs/DELIVERY_COVERAGE_ANALYTICS.md`

Current behavior:

- Aggregates `delivery_orders` by `block_number`.
- Uses real delivery order data only.
- Has KPIs:
  - total orders,
  - known block orders,
  - unknown block rate,
  - unique blocks served,
  - top block,
  - top branch,
  - unresolved blocks.
- Uses fallback block matrix/list grouped by governorate/area because no polygon geometry exists yet.
- Does not fake a real map.
- No new dependency was added.
- Command Center integration was intentionally deferred.
- Final status remains staging-ready only.

---

## High-Level Product Goal

The advanced Delivery Coverage module should become a strategic tool for:

1. Marketing campaign planning.
2. Branch delivery catchment analysis.
3. Delivery service area optimization.
4. Expansion candidate review.
5. Operations task creation from insights.

The output should be careful and evidence-based.

Do not say:

```text
Open a branch here.
```

Instead say:

```text
Candidate for further review.
```

---

## Important Rules

- Use real data only.
- Do not generate fake orders.
- Do not generate fake geography.
- If exact Bahrain block polygons are missing, keep the matrix/list fallback.
- Do not add paid map APIs.
- Do not expose Google Maps API keys.
- Do not add AI.
- Do not add a full campaign management system in this pass unless scoped as lightweight MVP.
- Do not build a full GIS system.
- Keep changes incremental and safe.
- Respect existing RLS and role model.
- Do not rely only on UI hiding for data access.
- If data is insufficient, show “insufficient data” and suppress overconfident recommendations.

---

## Files To Inspect First

Inspect before coding:

- `services/deliveryCoverageService.ts`
- `app/delivery/DeliveryCoverage.tsx`
- `app/delivery/DeliveryHub.tsx`
- `services/deliveryService.ts`
- `services/branchService.ts`
- `app/command-center/`
- `app/command-center/operationsTaskService.ts`
- `types.ts`
- `config/clientConfig.ts`
- `.env.example.production`
- `docs/DELIVERY_COVERAGE_ANALYTICS.md`
- `docs/PRODUCT_ROADMAP.md`
- `docs/PRODUCTION_GAPS.md`
- `docs/RELEASE_READINESS_STATUS.md`

Also inspect whether any delivery order fields exist for:

- order amount / revenue
- delivery time
- delivery status
- customer identifier
- customer phone
- order source
- product/category/order items

Do not assume these fields exist. If missing, document feature limitations.

---

## Phase 1 — Advanced Analytics Models

Add or extend TypeScript models for advanced delivery insights.

Suggested types:

```ts
DeliveryCampaignOpportunity
DeliveryDemandTrend
DeliveryBranchCatchment
DeliveryBranchOverlap
DeliveryWhiteSpaceInsight
DeliveryExpansionCandidate
DeliveryCapacityPressure
DeliveryCoverageAction
DeliveryCoverageInsightType
DeliveryCoverageInsightSeverity
```

Suggested insight severity:

```text
low
medium
high
critical
```

Suggested insight types:

```text
campaign_opportunity
strong_service_area
weak_service_area
branch_catchment
branch_overlap
white_space
expansion_candidate
capacity_pressure
data_quality_issue
sla_delay
repeat_customer_signal
product_demand_signal
```

Only populate insight types when the required data exists.

---

## Phase 2 — Campaign Opportunity Engine

Add explainable campaign opportunity logic.

The system should identify blocks that may benefit from marketing campaigns.

Possible rules:

- Low delivery volume blocks in the selected period.
- Blocks served before but currently weak.
- Blocks with enough data to suggest potential.
- Blocks near strong areas only if geography/area grouping supports it.
- Blocks with high unknown/unresolved data should not generate confident campaign recommendations.

Output example:

```text
Block 405 has low delivery activity in the selected period.
Recommended action: run a 7-day targeted campaign if this block is within your service area.
```

Rules:

- Be cautious.
- Do not say the campaign will definitely work.
- Do not use fake geography.
- If no geography exists, base the recommendation only on real historical delivery activity.

---

## Phase 3 — Delivery Demand Trend

Add trend analysis by block and branch.

Compare selected period internally:

- first half vs second half of period,
- or current period vs previous period if practical.

Classify:

```text
increasing
decreasing
stable
new_demand
insufficient_data
```

Use minimum sample thresholds.

Do not classify a trend if order count is too low.

Show:

- emerging blocks,
- declining blocks,
- consistently strong blocks,
- weak blocks.

---

## Phase 4 — Branch Catchment Area

Create branch catchment analysis from real delivery orders.

For each branch:

- total delivery orders,
- unique blocks served,
- primary service blocks,
- secondary service blocks,
- weak service blocks,
- outside-governorate orders if data exists,
- share of total delivery volume.

Classification example:

```text
Primary block: high order count / high share for branch.
Secondary block: moderate volume.
Weak block: low volume.
```

No geography is required for this; use real block order distribution.

---

## Phase 5 — Branch Overlap / Cannibalization

Detect blocks served by more than one branch.

For each overlapping block:

- total orders,
- branches serving it,
- branch share percentage,
- dominant branch,
- overlap severity.

Recommendation example:

```text
Block 312 is served by multiple branches. Review routing rules and service ownership.
```

Do not automatically suggest removing a branch. Just flag for manager review.

---

## Phase 6 — White Space / Low Activity Analysis

Identify blocks with very low or no recent delivery activity only from known available block universe.

Important:

- If you only know blocks that appear in orders, you cannot know all blocks with zero orders.
- In that case, show “low activity among historically served blocks”.
- If Bahrain block GeoJSON or directory gives a full block universe, then you may show true zero-activity blocks.

Clearly distinguish:

```text
No recent activity among known served blocks.
```

from:

```text
No delivery activity in this geographic block.
```

Only use the second if full block dataset exists.

---

## Phase 7 — Expansion Candidate Score

Add cautious expansion candidate review scoring.

Do not recommend opening a branch directly.

Score should be explainable and conservative.

Potential inputs:

- sustained high delivery volume,
- increasing trend,
- high unique block cluster demand if grouping exists,
- far/outside governorate service indicator if data exists,
- branch capacity pressure,
- repeated demand over time.

Output:

```text
Expansion review candidate: Block cluster 312-316
Score: 78/100
Reason:
- sustained delivery volume
- increasing trend
- current serving branch has high outside-area load
```

If data is insufficient, do not show expansion candidates.

If clustering by nearby blocks is not reliable, score individual blocks only and document that real geographic clustering requires GeoJSON/geometry.

---

## Phase 8 — Branch Capacity Pressure

For each branch, compute pressure indicators:

- total orders in selected period,
- unique blocks served,
- concentration in top blocks,
- outside governorate percentage if data exists,
- overlap with other branches,
- unknown block rate.

Classify:

```text
normal
watch
high_pressure
overloaded
insufficient_data
```

Recommendation example:

```text
H003 is serving many unique blocks with high outside-governorate share. Review delivery capacity and routing.
```

---

## Phase 9 — Delivery SLA / Delay Heatmap, only if fields exist

Inspect if delivery order records have:

- order time,
- delivery time,
- completed time,
- promised time,
- duration,
- status.

If available, add SLA analytics:

- average delivery time by block,
- late orders by block,
- high-delay blocks,
- branch delay pressure.

If not available:

- do not build fake SLA analytics,
- document as future work requiring delivery timestamps.

---

## Phase 10 — Product Demand by Block, only if fields exist

Inspect if delivery order records include product/category/order item data.

If available, add:

- top product/category by block,
- product demand signals by area,
- campaign recommendation by category.

If not available:

- document as future work requiring order item/category data.

---

## Phase 11 — Customer Repeat Rate by Block, only if safe fields exist

Inspect if delivery orders include safe customer identifier.

If available and privacy-safe:

- repeat customer rate by block,
- new vs returning customer split.

If not available or privacy risk is unclear:

- do not implement,
- document as future work.

Do not expose customer phone numbers or PII in the dashboard.

---

## Phase 12 — Auto-Create Operations Task From Coverage Insight

Integrate with existing `operations_tasks` workflow.

For manager/admin:

- Add a “Create task” action for selected insights.
- Suggested task title examples:
  - `Review campaign opportunity for Block 405`
  - `Review delivery overlap in Block 312`
  - `Review capacity pressure for H003`
  - `Review expansion candidate Block 316`

Map:

```text
source_module = delivery_coverage
related_record_type = delivery_block | branch_coverage | delivery_insight
related_record_id = stable insight id or block number
```

Do not auto-create tasks.

Do not create duplicates if an open/in_progress task already exists for the same insight.

If duplicate prevention cannot be guaranteed yet, warn before creating.

---

## Phase 13 — UI Enhancements

Update Delivery Coverage UI to include advanced tabs or sections.

Suggested layout:

```text
Overview
Block Matrix
Branch Catchment
Campaign Opportunities
Branch Overlap
Capacity Pressure
Expansion Review
Data Quality
```

Keep UI readable and not too heavy.

Each section should show:

- concise KPI,
- evidence,
- recommendation,
- confidence/data quality,
- optional create-task button for manager/admin.

Avoid overclaiming.

Show clear empty states:

- no delivery data,
- insufficient data,
- unknown block rate too high,
- GeoJSON missing,
- SLA data unavailable,
- product/category data unavailable.

---

## Phase 14 — Documentation

Update or create:

```text
docs/DELIVERY_COVERAGE_ADVANCED_ANALYTICS.md
```

Include:

- feature purpose,
- analytics included,
- exact rules,
- data requirements,
- what is enabled now,
- what is future-only due to missing fields,
- explanation of campaign opportunity engine,
- branch catchment logic,
- overlap logic,
- expansion candidate score,
- capacity pressure logic,
- operations task integration,
- role access,
- no fake geography rule,
- GeoJSON requirement for exact maps.

Update:

```text
docs/DELIVERY_COVERAGE_ANALYTICS.md
docs/PRODUCT_ROADMAP.md
docs/PRODUCTION_GAPS.md
docs/RELEASE_READINESS_STATUS.md
```

---

## Phase 15 — Optional Feature Flag

If module flags exist, add or confirm a sub-flag:

```text
VITE_DELIVERY_COVERAGE_ADVANCED_ANALYTICS
```

Default can be true in demo config and false or true in production template depending on project convention.

If you add a flag, update:

- `config/clientConfig.ts`
- `config/clientConfig.demo.ts`
- `.env.example.production`
- docs.

Do not hide core Delivery Coverage unless existing module flag says so.

---

## Out Of Scope

- Do not add paid maps.
- Do not add a real polygon map unless a real GeoJSON dataset already exists and can be safely loaded.
- Do not invent coordinates.
- Do not implement AI.
- Do not build a full campaign management system with budgets and ROI in this pass.
- Do not build a branch-opening recommendation engine that gives definitive decisions.
- Do not add customer PII analytics unless explicitly safe.
- Do not rewrite the Delivery module.
- Do not change delivery order recording workflow except for safe service reuse.
- Do not apply remote migrations.
- Do not deploy.

---

## Data And Security Notes

- This is manager-facing strategic analytics.
- Branch users should not see all-branch coverage analytics unless intentionally scoped.
- Manager/owner/supervisor access must respect existing role/RLS rules.
- No frontend secret exposure.
- No fake data.
- If data is insufficient, suppress recommendations.
- Do not expose customer phone numbers or personal data.
- Operations task creation should use existing task service and permissions.

---

## Verification

Run:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm ls --depth=0
```

If lint/test scripts exist, run:

```bash
npm run lint
npm test
```

Manual/local verification:

- Delivery Coverage page loads.
- Advanced sections render.
- Date/branch filters affect results.
- Top served blocks are accurate.
- Campaign opportunities appear only when data supports them.
- Weak data suppresses overconfident recommendations.
- Branch catchment shows primary/secondary/weak blocks.
- Overlap detects blocks served by multiple branches.
- Expansion candidates are cautious and marked for review only.
- Capacity pressure is explainable.
- SLA/product/customer insights only appear if required fields exist.
- Manager/admin can create task from insight.
- Branch user cannot access all-branch strategic analytics.
- Matrix fallback remains if GeoJSON map is unavailable.
- No fake geography appears.

---

## Final Response Format

Return:

```markdown
## Summary
<short summary>

## Files Changed
- <file>
- <file>

## Analytics Added
- Campaign Opportunity:
- Demand Trend:
- Branch Catchment:
- Branch Overlap:
- White Space:
- Expansion Review:
- Capacity Pressure:
- SLA/Product/Customer: enabled or documented as unavailable

## Operations Task Integration
<summary>

## UI Summary
<sections/tabs added>

## Documentation
<docs updated/created>

## Verification
- typecheck:
- build:
- audit:
- npm ls:
- lint/test:

## Remaining Blockers
- <blocker>

## Final Status
B) dedicated-client staging-ready only
```

---

## Acceptance Criteria

- Advanced analytics are based only on real delivery data.
- Campaign opportunity engine exists with cautious recommendations.
- Demand trends exist with minimum sample thresholds.
- Branch catchment analysis exists.
- Branch overlap analysis exists.
- Capacity pressure exists.
- Expansion review candidates are cautious and explainable.
- White-space analysis does not overclaim without full block universe.
- SLA/product/customer analytics only appear if required fields exist.
- Manager/admin can create operations tasks from insights.
- UI is clear and not misleading.
- No fake geography is created.
- Documentation exists.
- Typecheck passes.
- Build passes.
- Final status remains:

```text
B) dedicated-client staging-ready only
```
