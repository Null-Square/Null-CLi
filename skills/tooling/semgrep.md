---
slug: tooling-semgrep
name: semgrep public usage
description: Static analysis pattern for local code targets.
category: tooling
---

Use `semgrep` for authorized local code reviews.

Public preset:

```bash
semgrep --config auto --json --output artifacts/scans/semgrep.json ./target
```

Prefer remediation-oriented findings with file paths, rule IDs, and concise impact.
