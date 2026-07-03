# Public Boundary

This repository exposes the open-source framework layer: useful, credible, and
competitive with public pentest-agent tools, while keeping NullSquare's closed
harness and managed-platform internals out of scope.

The rule is practical:

- Public, commodity, user-visible behavior is allowed.
- Closed harness logic, managed-platform behavior, and non-public decision paths
  are not allowed.

## Allowed Public Surface

These are safe to build because they are expected behavior in open-source
security CLIs and do not expose NullSquare's private approach:

- Branded CLI, guided setup, model profile onboarding, update notices, and
  clear terminal summaries.
- Explicit target, scope, rules-of-engagement, and authorization gates.
- Shallow single-agent model loop with one JSON action per turn.
- Conservative HTTP and browser-like page capture.
- Workspace-bound file reads.
- Operator-enabled shell and scanner execution.
- Public scanner orchestration wrappers for tools such as nuclei, httpx,
  semgrep, trivy, nmap, and similar commodity tools.
- Public skill markdown for scan modes, tooling, vulnerability classes, and
  compliance-readiness mapping.
- Scanner artifact ingestion and normalization.
- Evidence capture, finding records, Markdown reports, SARIF, and local
  run-state artifacts.
- Agent activity traces that show public tool calls, artifacts, and final
  conclusions.
- Lightweight OWASP, PCI DSS lite, ISO 27001 lite, and NIST CSF lite readiness
  mapping.
- Generic CVSS, CWE, OWASP, and report-format helpers.
- Documentation, screenshots, examples, sandbox smoke tests, and CI wiring.

## Disallowed Closed Surface

Do not add or copy any of the following from NullSquare's closed harness,
private research, customer systems, or managed platform:

- Managed-platform orchestration code.
- Multi-agent topology, delegation, scheduling, or recovery internals.
- Non-public prompt construction, planning chains, or decision paths.
- Closed-platform selection heuristics or prioritization logic.
- Advanced validation, replay, triage, exploit-chaining, or proof workflows.
- Cross-run memory, customer context, private benchmark data, or production
  review systems.
- Enterprise tenant, billing, policy, dashboard, hosted sandbox, or team
  workflow controls.
- External callback infrastructure or payload delivery infrastructure.
- Credential attacks, destructive automation, persistence, or denial-of-service
  behavior.
- Customer artifacts, private test corpora, real run traces, secrets, or
  internal telemetry.
- Model routing, provider fallback, cost controls, or platform reliability
  systems.

## Release Checklist

Before publishing a feature, ask:

- Is this already visible in public open-source security tools or normal CLI
  expectations?
- Can the feature be explained without referencing NullSquare closed harness
  internals?
- Does it operate only inside declared scope and write local artifacts?
- Does the report distinguish confirmed findings from notes, diagnostics, and
  inconclusive results?
- Would publishing this help adoption without revealing why the managed
  platform is better?

If the answer is unclear, keep the feature shallow or move it to the managed
platform.

Compliance output must use readiness language. It must not claim
certification, attestation, or legal sufficiency.
