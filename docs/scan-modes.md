# Scan Modes

`--scan-mode` selects how much surface the agent covers and how many steps it may
spend. Each mode is backed by a public skill that shapes the agent's plan; view it
with `null-ai skills show scan-mode-<mode>`.

| Mode | Step budget | Intent |
|------|-------------|--------|
| `quick` | ~4 | Fast, conservative review of a single authorized target. |
| `standard` | ~8 | Repeatable open-source assessment (default). |
| `deep` | ~16 | Broader coverage with fuller evidence and compliance mapping. |

You can always override the budget with `--max-steps <n>`.

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
