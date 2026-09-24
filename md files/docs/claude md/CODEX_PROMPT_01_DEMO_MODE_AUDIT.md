# CODEX PROMPT: Demo Mode and localStorage Fallback Audit

## Objective
Audit every operational write path (lost sales, shortages, cash differences, HR requests, operations tasks) to confirm that when `VITE_DEMO_MODE=false`, no path falls back to localStorage on Supabase failure, and that failures surface as visible UI warnings instead of silent local persistence.

## Context
The product is dedicated-client, staging-ready (not production-ready). `VITE_DEMO_MODE=false` is required for staging/production validation. Demo mode is permitted to use localStorage fallbacks for isolated demos only. Production-trust failures (silent local writes masking real data loss) are the highest-priority pre-deployment risk.

## Files To Inspect First
- config/clientConfig.ts
- services/ (all files handling lost sales, shortages, cash differences, HR requests, operations tasks)
- app/ (POS/lost-sale entry components, cash difference entry, HR request forms)

## Scope
- Grep all source files for `localStorage.setItem` and `localStorage.getItem` calls.
- For each occurrence, document: (a) which operational entity it relates to, (b) whether it is gated behind a `DEMO_MODE` check, (c) whether a Supabase write failure currently falls through to this localStorage call.
- For any occurrence writing real operational data (lost sales, shortages, cash differences, HR requests, operations tasks/events) without a `DEMO_MODE` gate, wrap it so it only executes when `clientConfig` demo mode is true.
- When `DEMO_MODE=false` and a Supabase write fails, ensure the UI shows a clear, visible error/warning (e.g., toast/banner) and does NOT proceed as if the save succeeded.
- Produce a written audit report (`docs/DEMO_MODE_AUDIT_REPORT.md`) listing every occurrence found, its classification, and the fix applied (or "no fix needed — already gated").

## Out Of Scope
- Do not change the demo mode fallback behavior for genuinely demo-only flows (isolated demo deployments with `DEMO_MODE=true`).
- Do not add new persistence backends or change the Supabase schema.
- Do not modify draft-persistence localStorage usage that is explicitly for in-progress form drafts (not final operational records) — document these separately as "draft persistence, not operational record" if found.

## Data And Security Notes
- This task does not touch RLS or Supabase policies directly, but its findings (silent data loss paths) directly affect data trust, which is a prerequisite for the security checklist.
- Do not log or persist any real customer/employee data as part of the audit.

## Verification
- Run `npm run typecheck` and `npm run build` after changes — both must remain green.
- Manually test with `VITE_DEMO_MODE=false`: simulate a Supabase write failure (e.g., temporarily revoke a permission or disconnect network) for one lost-sale submission and confirm a visible error appears and no localStorage entry is created for that record.
- Manually test with `VITE_DEMO_MODE=true`: confirm existing demo fallback behavior is unchanged.

## Acceptance Criteria
- `docs/DEMO_MODE_AUDIT_REPORT.md` exists and lists every `localStorage` call related to operational data with its classification and resolution.
- No operational write path silently persists to localStorage when `DEMO_MODE=false`.
- All Supabase write failures on operational paths produce a visible UI warning when `DEMO_MODE=false`.
- `npm run typecheck` and `npm run build` pass.
