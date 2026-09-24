# CODEX PROMPT: ESLint Setup for Existing TypeScript Codebase

## Objective
Add an ESLint configuration appropriate for a React 19 + TypeScript + Vite 6 codebase, add a `lint` script to package.json, and establish a documented baseline so existing code does not need to be fully rewritten immediately.

## Context
The build scripts currently include `dev`, `build`, `typecheck`, and `preview` but no `lint` script, and this is listed as a known gap. TypeScript strict mode is already in use; ESLint should complement it (catching unused vars, React hook dependency issues, accessibility issues) without duplicating type-checking.

## Files To Inspect First
- package.json
- tsconfig.json
- App.tsx
- app/ (sample of existing component patterns to ensure config matches actual code style)

## Scope
- Add ESLint with a configuration suitable for React 19 + TypeScript + Vite (typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh as appropriate for Vite's React plugin).
- Add a `lint` script to package.json (`"lint": "eslint ."` or equivalent).
- Run the linter against the current codebase and capture the full output.
- For any errors (not warnings) found, fix them if they are trivial and low-risk (e.g., unused imports, missing hook dependencies that are clearly safe to add). For non-trivial findings, do not fix in this prompt — instead list them in `docs/LINT_BASELINE.md` as a documented baseline.
- Configure the lint rule severity so that the documented baseline issues are warnings (not errors) initially, so `npm run lint` can pass or be used in CI without blocking on pre-existing issues, while new code is held to the full standard.

## Out Of Scope
- Do not refactor existing components beyond trivial, safe lint fixes.
- Do not set up CI pipelines (separate concern) — just make `npm run lint` work locally.
- Do not change `tsconfig.json` strictness settings.

## Data And Security Notes
- None directly — this is a tooling/maintainability task with no RLS or data impact.

## Verification
- `npm run lint` runs and completes (either passing cleanly or passing with documented baseline warnings).
- `npm run typecheck` and `npm run build` remain unaffected and pass.

## Acceptance Criteria
- `package.json` has a working `lint` script.
- ESLint config file exists and is appropriate for React 19 + TS + Vite.
- `docs/LINT_BASELINE.md` exists listing any pre-existing issues deferred as warnings, with rationale.
- `npm run lint`, `npm run typecheck`, and `npm run build` all complete successfully.
