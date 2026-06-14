# Accepted Security Risks

Current release status:

```text
B) dedicated-client staging-ready only
```

## 2026-06-14 Final Gate Audit Status

Command:

```bash
npm audit --audit-level=moderate
```

Current result:

```text
5 vulnerabilities remain: 2 moderate from exceljs -> uuid and 3 high from @vitejs/plugin-react -> vite -> esbuild.
No safe non-breaking remediation is applied.
Production acceptance is not recorded.
```

These risks are accepted for local/demo/staging validation only where documented.
They are not accepted for production. Do not claim audit is clean until
`npm audit --audit-level=moderate` exits 0, or the client/release owner records
formal production acceptance with owner, date, scope, mitigation, and review
date.

## Exact npm audit output

Command:

```bash
npm audit --audit-level=moderate
```

Current output (verbatim, 2026-06-13 remediation pass):

```text
# npm audit report

esbuild  0.17.0 - 0.28.0
Severity: high
esbuild: Missing binary integrity verification in Deno module enables remote code execution via NPM_CONFIG_REGISTRY - https://github.com/advisories/GHSA-gv7w-rqvm-qjhr
fix available via `npm audit fix --force`
Will install vite@8.0.16, which is a breaking change
node_modules/esbuild
  vite  4.2.0-beta.0 - 8.0.3
  Depends on vulnerable versions of esbuild
  node_modules/vite
    @vitejs/plugin-react  4.0.0-beta.0 - 5.1.4
    Depends on vulnerable versions of vite
    node_modules/@vitejs/plugin-react

uuid  <11.1.1
Severity: moderate
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided - https://github.com/advisories/GHSA-w5hq-g745-h8pq
fix available via `npm audit fix --force`
Will install exceljs@3.4.0, which is a breaking change
node_modules/uuid
  exceljs  >=3.5.0
  Depends on vulnerable versions of uuid
  node_modules/exceljs

5 vulnerabilities (2 moderate, 3 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
```

> Note: the only npm-offered automatic fixes are `--force` major downgrades/upgrades
> (`vite@8.0.16`, `exceljs@3.4.0`). Both are breaking and are NOT applied. `npm audit fix`
> without `--force` changes nothing. Result after this pass is unchanged: 5 vulnerabilities
> (2 moderate, 3 high). See "2026-06-13 remediation pass" below for what was attempted.

## 2026-06-13 remediation pass (esbuild override attempted and rejected)

Status after this pass: **unchanged — `npm audit --audit-level=moderate` still exits 1 with
5 vulnerabilities (2 moderate, 3 high). Build and typecheck pass.**

Installed versions: `vite@6.4.3`, `@vitejs/plugin-react@5.1.2`, `esbuild@0.25.12`,
`exceljs@4.4.0`, `uuid@8.3.2`.

### Build-tool/dev chain (`@vitejs/plugin-react -> vite -> esbuild`) — attempted, reverted

- The esbuild advisory is fixed only in **esbuild 0.28.1**. Both `vite@6` and `vite@7` pin
  esbuild to `^0.25.0` (`>=0.25.0 <0.26.0`), so 0.28.1 cannot enter the tree through a normal
  vite minor/patch upgrade. The only vite line that drops esbuild entirely is `vite@8`
  (rolldown-based), which `npm audit fix --force` would install — a major breaking change that
  also requires `@vitejs/plugin-react@6` + `babel-plugin-react-compiler`. Out of scope for a
  staging-ready dependency pass and rejected.
- Attempted the conservative path instead: an npm `overrides` entry forcing `esbuild@0.28.1`
  into the existing `vite@6.4.3` tree. `npm install` succeeded and cleared the 3 high findings
  (audit dropped to 2 moderate), and `npm run typecheck` passed — but **`npm run build` failed**:
  esbuild 0.28 removed support for transforming destructuring to the configured legacy target
  (`es2020`/`chrome87`/`edge88`/`firefox78`/`safari14`), erroring with
  `Transforming destructuring to the configured target environment ... is not supported yet`.
- Per the "do not keep an upgrade that breaks build" rule, the override was **reverted**
  (`package.json` overrides removed, `package-lock.json` restored to its committed state,
  `node_modules` reinstalled back to `esbuild@0.25.12`). Build and typecheck are green again.
- Conclusion: there is **no safe non-breaking remediation** for the esbuild chain in this repo
  right now. The only patched esbuild (0.28.1) is incompatible with the current build target,
  and the only esbuild-free vite (vite@8) is a major rewrite of the build toolchain.

### Reachability note (build-tool/dev exposure only)

`GHSA-gv7w-rqvm-qjhr` describes a **Deno-module** path: esbuild's Deno installer fetches the
esbuild binary without integrity verification, allowing a malicious `NPM_CONFIG_REGISTRY` to
substitute a binary. This project builds with **Node + npm + Vite**, where esbuild's binary is
installed by npm under lockfile integrity hashes and the Deno download path is never exercised.
The finding is a build/CI-environment supply-chain concern, not a runtime/product exposure, and
is not reachable through the deployed application. It still must be cleared or formally accepted
before production.

## Risk Categories

### Build-tool/dev dependency remediation track

```text
Package path: @vitejs/plugin-react -> vite -> esbuild
Current severity: 3 high vulnerabilities
Current npm audit status: no safe non-breaking fix (only npm-offered fix is vite@8 via --force).
Remediation attempted (2026-06-13): override esbuild -> 0.28.1; cleared the high findings and
  passed typecheck but FAILED the production build (esbuild 0.28 dropped destructuring transform
  for the configured legacy target). Reverted. See "2026-06-13 remediation pass" above.
Product/runtime exposure: build/development tooling path only; advisory is a Deno-installer
  supply-chain path not exercised by this Node/npm/Vite build, not a business workflow dependency.
Required action: track the first Vite line that ships a patched esbuild without a build-breaking
  target change (or migrate deliberately to vite@8/rolldown), or formally accept with owner
  approval before production.
Production status: not accepted.
```

### Runtime/product dependency unresolved track

```text
Package path: exceljs -> uuid (exceljs@4.4.0 -> uuid@8.3.2)
Current severity: 2 moderate vulnerabilities
Current npm audit status: no safe non-breaking fix. uuid advisory is fixed only in uuid >=11.1.1;
  there is no patched uuid 8.x backport, so the only fix is an 8 -> 11 major jump forced into
  exceljs, which cannot be verified safe by typecheck/build alone and is not applied this pass.
Decision (2026-06-13): Option A — keep ExcelJS, accept temporarily for staging only.
  Vulnerable uuid code path is v3/v5/v6 with a caller-supplied `buf`; exceljs generates v4
  (random) ids, so the bounded-buffer path is not reached in practice.
Product/runtime exposure: Excel import/export workflows (manager/admin gated, 5MB import guard,
  dynamic import).
Required action: replace ExcelJS, move Excel processing server-side, or formally accept with
  owner approval before production.
Production status: not accepted.
```

### Formally accepted risks

```text
Accepted for local/demo/staging validation only:
- exceljs -> uuid
- @vitejs/plugin-react -> vite -> esbuild

Accepted for production:
- None.
```

These audit findings must remain production blockers until they are fixed, replaced, or formally accepted by the client/release owner with date, owner, scope, mitigation, and review/expiry date.

## Production Blocker Hardening Note

No unsafe `npm audit fix --force` path is approved for this release. The current vulnerable paths are separated as:

```text
Build-tool/dev dependency path:
- @vitejs/plugin-react -> vite -> esbuild
- Current status: unresolved. esbuild@0.28.1 override attempted 2026-06-13; reverted because it
  broke the production build. Only patched esbuild is incompatible with the current build target;
  only esbuild-free vite is vite@8 (major). No safe non-breaking fix exists today.

Runtime/product dependency path:
- exceljs -> uuid
- Current status: unresolved, accepted temporarily for staging (Option A). uuid fix exists only at
  uuid>=11.1.1 (major jump into exceljs); not applied. No safe non-breaking fix exists today.
```

For demo/staging validation, these findings may be documented as known risks. For production, they must be resolved or formally accepted by the client/release owner before the release can move beyond `B) dedicated-client staging-ready only`.

## ExcelJS transitive uuid audit finding

Status: temporarily accepted for staging only. For any dedicated client production release, this risk must either be resolved or explicitly approved by the client/release owner.

`npm audit --audit-level=moderate` still fails. The ExcelJS finding remains open, and the current audit also reports high-severity esbuild/Vite findings.

Current audit result:

```text
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided
exceljs depends on vulnerable versions of uuid
uuid via exceljs: 2 moderate vulnerabilities, no fix available
esbuild via vite/@vitejs/plugin-react: 3 high vulnerabilities, no fix available in the current audit result
```

No safe non-breaking npm audit fix is currently available in this project. Do not claim npm audit is clean until the audit command passes.

ExcelJS is used for:

```text
Product list exports
Product .xlsx imports
Dashboard/export workbooks
Spin-win exports
Quality feedback exports
```

Current mitigations:

```text
Product import has a 5MB file-size guard.
Product import should remain restricted to trusted admin/manager users.
ExcelJS is dynamically imported so it is loaded only when export/import flows run.
```

Before full production release for a client, the team must choose one of these paths:

```text
1. Replace ExcelJS with a safer maintained alternative.
2. Move Excel import/export to a server-side trusted environment.
3. Formally accept the risk in release notes with owner approval.
```

This risk is not resolved by documentation alone.

## Vite/esbuild audit finding

Status: unresolved (esbuild@0.28.1 override attempted 2026-06-13 and reverted — it broke the
production build; see "2026-06-13 remediation pass" above). Do not claim npm audit is clean. Do
not claim production-ready until this is resolved, upgraded safely, or formally accepted by the
client/release owner.

Current audit result:

```text
esbuild: Missing binary integrity verification in Deno module enables remote code execution via NPM_CONFIG_REGISTRY
vite depends on vulnerable versions of esbuild
@vitejs/plugin-react depends on vulnerable versions of vite
3 high severity vulnerabilities
No fix available in the current audit result
```

Production options:

```text
A) Track and apply the first safe Vite/esbuild/plugin-react upgrade that clears the advisory.
B) Formally accept the risk with client/release-owner approval, expiry/review date, and release-note disclosure.
C) Evaluate a build/deployment control that removes the affected threat path from the release environment, then document that decision.
```

Decision required before production:

```text
Chosen option:
Decision owner:
Decision date:
Review/expiry date:
Business justification:
Mitigation notes:
```

## ExcelJS Demo Deployment Decision

Current status:

```text
Unresolved npm audit issues.
Do not claim npm audit is clean.
```

Cause:

```text
exceljs -> uuid
vite/@vitejs/plugin-react -> esbuild
```

Severity:

```text
2 moderate vulnerabilities from uuid.
3 high vulnerabilities from esbuild/Vite.
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided.
No fix available through npm audit at this time.
```

Demo status:

```text
Acceptable for demo/staging validation only if documented in the deployment execution log and handover checklist.
Not acceptable as an unrecorded production risk.
```

Production options:

```text
A) Formally accept the risk with client/release-owner approval, expiry/review date, and release-note disclosure.
B) Replace ExcelJS with a maintained alternative that clears npm audit.
C) Move Excel import/export processing to a trusted server-side path and reduce or remove browser-side ExcelJS exposure.
```

Decision required before production:

```text
Chosen option:
Decision owner:
Decision date:
Review/expiry date:
Business justification:
Mitigation notes:
```
