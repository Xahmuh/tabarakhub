# Product Roadmap

This product remains a dedicated-client deployment model. Do not add shared multi-tenancy, `organization_id`, or tenant routing.

## Recently shipped (staging)

```text
Delivery Coverage Analytics (Bahrain block coverage) — manager/owner/supervisor KPIs,
  block-level coverage matrix grouped by governorate, branch footprint, and explainable
  recommendations from real delivery records. Read-only analytics, no schema change.
  Real Bahrain block map enabled for internal use (public/data/bahrain-blocks.geojson).
  See docs/DELIVERY_COVERAGE_ANALYTICS.md.
Delivery Coverage Advanced Analytics — campaign-opportunity engine, demand trends,
  branch catchment, overlap/cannibalization, capacity pressure, cautious expansion-review
  scoring, and manager-only operations-task creation from insights. Real data only,
  cautious wording (never "open a branch here"). Flag VITE_DELIVERY_COVERAGE_ADVANCED_ANALYTICS
  (default on). SLA/product/customer analytics are future-only (fields absent).
  See docs/DELIVERY_COVERAGE_ADVANCED_ANALYTICS.md.
```

## Week 1: Production Readiness

```text
Keep TypeScript green.
Separate demo mode from production mode with VITE_DEMO_MODE.
Stop silent localStorage fallback for production operational records.
Remove or isolate mock dashboard insights.
Document smoke tests for login, dashboard, POS, feedback, spin flow, scoping, and unauthenticated blocking.
Track the ExcelJS/uuid audit risk until resolved or formally accepted.
```

## Weeks 2-3: Daily Command Center

```text
Expand the Daily Command Center with unified operational alerts.
Add a richer action queue with owner, status, due date, and source module.
Improve branch health scoring with weighted signals from shortages, lost sales, cash differences, HR, feedback, and rewards.
Add drill-downs from risks to the exact module state that needs action.
Keep the module launcher below the operational summary.
```

## Month 2: Intelligence And Automation

```text
Persistent task/incident workflow with owner, status, due date, comments, audit trail, and source record links.
Server-side fraud validation for reward tokens, customer daily limits, and voucher redemption policy.
Notifications for cash alerts, negative feedback trends, stuck HR requests, and reward fraud signals.
Executive weekly digest with risks, actions, and improvements.
Reorder engine that converts repeated shortages into purchasing suggestions.
AI Operations Copilot later, after the alert/task model is stable.
```

## Later

```text
Client onboarding wizard for dedicated deployment setup.
PWA/mobile branch mode for fast POS, shortage, cash, and QR workflows.
Spin & Win campaign ROI reporting.
Policy acknowledgements and training checks inside Corporate Codex.
Deeper automated regression tests and visual smoke checks.
Exact Bahrain block map (GeoJSON choropleth) for Delivery Coverage, with no paid map APIs.
Delivery coverage signals in the Daily Command Center (high unknown-block rate, demand concentration).
Marketing-campaign and expansion-review workflows built on delivery coverage recommendations.
```
