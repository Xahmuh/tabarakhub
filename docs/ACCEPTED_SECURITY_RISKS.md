# Accepted Security Risks

## ExcelJS transitive uuid audit finding

Status: temporarily accepted for staging only. For any dedicated client production release, this risk must either be resolved or explicitly approved by the client/release owner.

`npm audit --audit-level=moderate` still fails because `exceljs@4.4.0` depends on a vulnerable `uuid` version.

Current audit result:

```text
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided
exceljs depends on vulnerable versions of uuid
2 moderate severity vulnerabilities
No fix available
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

## ExcelJS Demo Deployment Decision

Current status:

```text
Unresolved npm audit issue.
Do not claim npm audit is clean.
```

Cause:

```text
exceljs -> uuid
```

Severity:

```text
2 moderate vulnerabilities.
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
