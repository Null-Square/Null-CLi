# Scan Modes

Scan modes are prompt profiles. They tell the model how broad and detailed the authorized assessment should be, but they do not change runtime limits or mechanically require a number of tool calls.

All modes share one 300-turn safety ceiling. Normal completion happens when the model returns an explicit final assessment response. The agent receives warnings near the ceiling and always writes a partial inconclusive report if it is reached. Use `--max-steps <n>` only to choose a lower operator-defined ceiling.

`--scan-mode` selects how much surface the model should cover. Each mode is backed
by a public skill that shapes the agent's plan; view it
with `null-ai skills show scan-mode-<mode>`.

| Mode | Prompt intent |
|------|---------------|
| `quick` | Fast, conservative review of a single authorized target. |
| `standard` | Repeatable open-source assessment (default). |
| `deep` | Broader coverage with fuller evidence and compliance mapping. |

## Quick

Landing-page capture, one or two safe endpoint checks, and evidence-backed findings
only. Best for a first look or a tight time box.

```bash
null-ai agent run --target https://example.com --scan-mode quick
```

## Standard

Records scope and assumptions, gathers HTTP metadata and page structure, runs safe
scanner presets where authorized, drafts findings with severity/CWE/OWASP/evidence,
and generates a compliance-readiness mapping.

```bash
null-ai agent run --target https://example.com --scan-mode standard --framework owasp-top10
```

## Deep

Maps the surface across multiple safe requests, runs scanner presets (when
`--allow-shell` is set), normalizes and attaches artifacts, drafts richer findings
with CVSS, and finishes with an executive summary and explicit limitations.

```bash
null-ai agent run --target https://example.com --scan-mode deep --framework pci-dss-lite --allow-shell
```

## Boundaries (all modes)

Every mode avoids brute force, credential attacks, destructive payloads, persistence,
and out-of-scope host discovery. Advanced validation and exploit-chaining strategy are
intentionally excluded from the OSS layer and live only in the managed
[NullSquare](https://nullsquare.net) platform.
