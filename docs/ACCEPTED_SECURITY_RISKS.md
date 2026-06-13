# Accepted Security Risks

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

Status: unresolved. Do not claim npm audit is clean. Do not claim production-ready until this is resolved, upgraded safely, or formally accepted by the client/release owner.

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
