# Public Boundary

This repository exposes a useful but shallow pentest-agent surface.

Allowed public functionality:

- Single-agent model loop.
- Explicit scope intake.
- Workspace-bound file reads.
- Operator-enabled shell and scanner execution.
- Conservative HTTP and browser-like capture.
- Public skill markdown.
- Scanner artifact ingestion.
- Finding, evidence, Markdown, SARIF, and compliance readiness output.
- Generic CVSS, CWE, and OWASP helpers.

Do not add:

- Managed-platform orchestration code.
- Non-public planning, scheduling, or recovery workflows.
- Enterprise task delegation or isolation internals.
- Non-public prompt construction.
- Closed-platform selection heuristics.
- Advanced validation, replay, or triage workflows.
- External callback infrastructure.
- Customer artifacts, private test corpora, or production review tools.
- Model routing, provider fallback, billing, tenant, or platform controls.

Compliance output must use readiness language. It must not claim certification, attestation, or legal sufficiency.
