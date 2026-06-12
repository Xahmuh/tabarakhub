# Demo Mode Audit Report

Date: 2026-06-12

Scope: audited `localStorage` usage and operational write failure handling for lost sales, shortages, cash differences, HR requests, and operations tasks/events.

## Summary

Production demo mode boundary is implemented through `config/clientConfig.ts`, where `isDemoMode` reads `VITE_DEMO_MODE` and defaults to `false`.

Operational localStorage fallbacks in the service layer are gated behind `isDemoMode`. In production mode (`VITE_DEMO_MODE=false`), the helpers return without reading/writing localStorage or `throwUnlessDemoMode` rethrows the Supabase failure before any local fallback write can run.

Fixes applied in this audit:

- Added visible error handling for HR admin status update failures in `app/dashboard/HRRequestsSection.tsx`.
- Added visible error handling for vacation request Supabase save failures in `app/hr/VacationRequestFlow.tsx`.
- Added visible error handling and refresh behavior for lost-sale deletes in `app/dashboard/page.tsx`.
- Added visible error handling and refresh behavior for shortage deletes in `app/dashboard/page.tsx`.

No Supabase schema, RLS policy, or demo-mode fallback behavior was changed.

## Operational localStorage Findings

| File | Lines | Entity | Classification | Supabase failure fallthrough? | Resolution |
| --- | ---: | --- | --- | --- | --- |
| `services/saleService.ts` | 9-20 | Shared demo helper for products, lost sales, shortages, manual product log | Demo fallback helper, gated by `isDemoMode` | No. Production failures throw through `throwUnlessDemoMode` before local writes. | No fix needed - already gated. |
| `services/saleService.ts` | 159 | Lost sales list fallback read | Demo fallback read | No. In production, list failures throw before local read. If Supabase returns successfully, helper returns empty in non-demo mode. | No fix needed - already gated. |
| `services/saleService.ts` | 209-212 | Lost sale insert fallback write | Operational record fallback | No. Production insert failures throw before reading/writing `tabarak_offline_sales`. | No fix needed - already gated. |
| `services/saleService.ts` | 223-224 | Lost sale delete fallback write | Operational record fallback | No. Production delete failures throw before local write. | No fix needed - already gated. UI delete failure handling added in `app/dashboard/page.tsx`. |
| `services/saleService.ts` | 263 | Shortage list fallback read | Demo fallback read | No. In production, list failures throw before local read. | No fix needed - already gated. |
| `services/saleService.ts` | 322-335 | Shortage create/update fallback write | Operational record fallback | No. Production create/update failures throw before local write. | No fix needed - already gated. |
| `services/saleService.ts` | 347-348 | Shortage delete fallback write | Operational record fallback | No. Production delete failures throw before local write. | No fix needed - already gated. UI delete failure handling added in `app/dashboard/page.tsx`. |
| `services/hrService.ts` | 6-17 | HR requests demo helper | Demo fallback helper, gated by `isDemoMode` | No. Production failures throw through `throwUnlessDemoMode` before local writes. | No fix needed - already gated. |
| `services/hrService.ts` | 63-66 | HR request create fallback write | Operational record fallback | No. Production create failures throw before local write. | No fix needed - already gated. Added visible UI failure handling in `app/hr/VacationRequestFlow.tsx`. |
| `services/hrService.ts` | 109 | HR request list fallback read | Demo fallback read | No. Production list failures throw before local read. | No fix needed - already gated. |
| `services/hrService.ts` | 119-123 | HR request status update fallback write | Operational record fallback | No. Production update failures throw before local write. | No fix needed - already gated. Added visible UI failure handling in `app/dashboard/HRRequestsSection.tsx`. |
| `services/financeService.ts` | 6-23 | Finance demo helper | Demo fallback helper, gated by `isDemoMode` | No. Production failures throw through `throwUnlessDemoMode` before local writes. | No fix needed - already gated. |
| `services/financeService.ts` | 43-215 | Cash flow suppliers, cheques, expenses, actual/expected revenues | Cash-flow demo fallback read/write | No. Production failures throw before local writes. | No fix needed - already gated. Cash-flow entities are adjacent to this prompt's cash-difference scope but were audited because they share the helper. |
| `services/financeService.ts` | 246 | Cash flow settings fallback write | Cash-flow settings demo fallback | No. `throwUnlessDemoMode` runs before this write in production. | No fix needed - already gated. |
| `services/financeService.ts` | 273 | Cash differences list fallback read | Operational record fallback read | No. Production list failures throw before local read. | No fix needed - already gated. |
| `services/financeService.ts` | 296-297 | Cash differences delete fallback write | Operational record fallback | No. Production delete failures throw before local write. | No fix needed - already gated. Cash-difference create/update has no localStorage fallback. |
| `app/command-center/operationsTaskService.ts` | 26-37 | Operations tasks/events demo helper | Demo fallback helper, gated by `isDemoMode` | No. Production failures throw through `throwUnlessDemoMode` before local writes. | No fix needed - already gated. |
| `app/command-center/operationsTaskService.ts` | 209-237 | Operations task create fallback write | Operational record fallback | No. Production failures throw before local task/event writes. | No fix needed - already gated. `DailyCommandCenter` displays caught errors in an in-page notice. |
| `app/command-center/operationsTaskService.ts` | 275-288 | Operations task status update fallback write | Operational record fallback | No. Production failures throw before local task/event writes. | No fix needed - already gated. `DailyCommandCenter` displays caught errors in an in-page notice. |
| `app/command-center/operationsTaskService.ts` | 308-309 | Operations task comment fallback write | Operational record fallback | No. Production failures throw before local event write. | No fix needed - already gated. |
| `app/command-center/operationsTaskService.ts` | 329 | Operations task event list fallback read | Demo fallback read | No. Production failures throw before local read. | No fix needed - already gated. |

## Draft Persistence And Non-operational localStorage

These are not final operational record persistence and were not changed.

| File | Lines | Use | Classification | Resolution |
| --- | ---: | --- | --- | --- |
| `app/pos/page.tsx` | 70, 84, 86, 236 | In-progress POS cart draft keyed by branch/pharmacist | Draft persistence, not final operational record | No fix needed - explicitly out of scope. |
| `app/hr/page.tsx` | 226, 233, 336 | In-progress HR document request draft | Draft persistence, not final operational record | No fix needed - explicitly out of scope. |
| `app/modules/quality-feedback/hooks/useAnonymityGuard.ts` | 18, 28 | Anonymous feedback cooldown/submission guard | Local client guard, not operational record persistence | No fix needed - outside prompt entity scope. |
| `services/spinWin.ts` | 14, 21 | Spin & Win demo helper for customers/spins/prizes/sessions | Demo fallback helper, gated by `isDemoMode` | No fix needed in prompt 01. Spin & Win fraud validation is covered by prompt 04. |
| `anonymous-quality-feedback-spec.md` | 331, 338, 342 | Historical/reference specification snippets | Documentation only, not app runtime source | No fix needed. |

## UI Failure Handling Review

| Write path | UI behavior after audit |
| --- | --- |
| POS lost-sale/shortage submit (`app/pos/page.tsx`) | Catches failed service writes, keeps cart/draft, and shows a blocking browser alert. Success banner only appears after all awaited writes complete. |
| Dashboard lost-sale delete (`app/dashboard/page.tsx`) | Now awaits delete, refreshes on success, and shows a toast error on failure. |
| Dashboard shortage delete (`app/dashboard/page.tsx`) | Now awaits delete, refreshes on success, and shows a toast error on failure. |
| HR document request submit (`app/hr/page.tsx`) | Catches failure and shows a SweetAlert toast. Draft remains until success. |
| Vacation request submit (`app/hr/VacationRequestFlow.tsx`) | Now catches Supabase failure and shows a SweetAlert error instead of an unhandled rejection. Success appears only after the write completes. |
| HR admin status update (`app/dashboard/HRRequestsSection.tsx`) | Now catches update failures and shows a visible alert instead of an unhandled rejection. |
| Cash difference create/update/delete (`app/cash-flow/BranchCashDifferenceTracker.tsx`) | Catches failures and shows SweetAlert errors. |
| Operations task create/status/comment (`app/command-center/DailyCommandCenter.tsx`) | Catches service failures and shows an in-page error notice. |

## Verification Notes

Required commands:

```text
npm run typecheck - passed
npm run build - passed
```

Manual checks required by prompt:

```text
VITE_DEMO_MODE=false: simulate a Supabase write failure for one lost-sale submission and confirm a visible error appears and no operational localStorage record is created.
VITE_DEMO_MODE=true: confirm existing demo fallback behavior is unchanged.
```

Fallback simulation performed with a direct service-level Node/TypeScript harness against `services/saleService.ts`:

```json
{
  "prodThrew": true,
  "prodKeys": [],
  "demoFallbackReturnedId": "99999999-9999-4999-9999-999999999999",
  "demoStoredCount": 1
}
```

This confirms that a simulated lost-sale Supabase write failure with `isDemoMode=false` throws before creating any localStorage key, while `isDemoMode=true` preserves the existing demo fallback. Interactive browser validation of the POS toast/alert flow is deferred until a real demo/staging deployment is available with test branch and pharmacist credentials. It was not run in this environment because no browser automation tool was available and no authenticated branch/pharmacist session was provided. The UI code path was inspected: `app/pos/page.tsx` catches the thrown service error, shows `alert("System Error: ...")`, does not clear the cart, and only removes the draft after all awaited writes succeed.

At the code level, the audited service write paths now either:

- Throw before any localStorage fallback can run when `isDemoMode` is false.
- Write/read localStorage only after `throwUnlessDemoMode` allows demo fallback.
- Use localStorage only for explicitly out-of-scope draft persistence.
