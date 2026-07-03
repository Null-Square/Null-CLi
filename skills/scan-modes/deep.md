---
slug: scan-mode-deep
name: Deep scoped assessment
description: Broader authorized public workflow with fuller evidence and compliance coverage.
category: scan-mode
---

Use this mode for a thorough open-source assessment of an authorized target.

Recommended flow:

1. Record the declared scope, assumptions, and out-of-scope boundaries.
2. Map the surface with `browser_action` and multiple safe `http_request` checks.
3. Run scanner presets (`nuclei`, `semgrep`, `trivy`) where shell/scanner execution is enabled.
4. Ingest and normalize all scanner output, attaching raw artifacts as evidence.
5. Draft findings with severity, confidence, CWE, OWASP, CVSS, evidence, and remediation.
6. When the active workflow is compliance, cross-check findings against the selected framework and generate readiness mapping.
7. Finish with an executive summary, exploit-path notes, affected surface, and explicit limitations.

Deep mode asks the model for broader coverage but does not change the runtime turn ceiling.
It still avoids brute force, credential attacks, destructive payloads, persistence, and
out-of-scope host discovery. This public skill intentionally excludes advanced validation
and exploit-chaining strategy, which live only in the managed NullSquare platform.
