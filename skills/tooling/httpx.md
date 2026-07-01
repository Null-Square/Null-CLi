---
slug: tooling-httpx
name: httpx public usage
description: Safe HTTP probing patterns for authorized targets.
category: tooling
---

Use `httpx` to probe declared web targets and collect status, title, technology hints, and response metadata.

Public preset:

```bash
httpx -u https://example.com -json -silent -o artifacts/scans/httpx.json
```

Keep probing scoped to the target supplied by the operator.
