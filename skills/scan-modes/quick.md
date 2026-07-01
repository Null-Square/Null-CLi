---
slug: scan-mode-quick
name: Quick scoped web scan
description: Conservative reconnaissance and evidence capture for a single authorized target.
category: scan-mode
---

Use this mode when the operator wants a fast scoped review.

Recommended flow:

1. Create a plan note.
2. Capture the target landing page with `browser_action`.
3. Use `http_request` for one or two safe endpoint checks.
4. Run `scanner_run` only when shell/scanner execution is explicitly enabled.
5. Report only evidence-backed findings.
6. Run `map_compliance` before finishing.

Avoid brute force, credential attacks, destructive payloads, persistence, and out-of-scope host discovery.
