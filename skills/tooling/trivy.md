---
slug: tooling-trivy
name: trivy public usage
description: Dependency and filesystem vulnerability scan pattern.
category: tooling
---

Use `trivy` for dependency and filesystem vulnerability checks.

Public preset:

```bash
trivy fs --format json --output artifacts/scans/trivy.json ./target
```

Map package vulnerabilities to CVEs where present and recommend version upgrades.
