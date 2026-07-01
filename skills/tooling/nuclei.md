---
slug: tooling-nuclei
name: nuclei public usage
description: Conservative nuclei scanning against an authorized target.
category: tooling
---

Use `nuclei` for template-based checks when scanner execution is enabled.

Public preset:

```bash
nuclei -u https://example.com -jsonl -severity low,medium,high,critical -no-color -o artifacts/scans/nuclei.jsonl
```

Treat scanner output as candidate evidence. Do not overstate a finding unless the observable is clear.
