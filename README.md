<div align="center">

![NullSquare autonomous offensive security testing](https://raw.githubusercontent.com/Null-Square/Null-CLi/main/docs/assets/nullsquare-cover.png)

# Null AI CLI

**Open-source AI pentest and compliance-readiness CLI by [NullSquare](https://nullsquare.net).**

[![CI](https://github.com/Null-Square/Null-CLi/actions/workflows/ci.yml/badge.svg)](https://github.com/Null-Square/Null-CLi/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](tsconfig.json)
[![Docker](https://img.shields.io/badge/runtime-Docker-2496ED.svg)](sandbox/Dockerfile)
[![SARIF](https://img.shields.io/badge/output-SARIF%202.1.0-6B7280.svg)](src/reports/sarif.ts)
[![NullSquare](https://img.shields.io/badge/NullSquare-nullsquare.net-F5D13A.svg)](https://nullsquare.net)

[Docs](#quick-start) | [Website](https://nullsquare.net) | [CLI](docs/cli.md) | [Compliance](docs/compliance.md)

A scoped terminal agent for authorized testing: safe reconnaissance, scanner orchestration, evidence-backed findings, Markdown/SARIF reports, and lightweight compliance-readiness mapping.

**Coverage:** OWASP Top 10 | PCI DSS lite | ISO 27001 lite | NIST CSF lite

![Null AI CLI running a scoped assessment](https://raw.githubusercontent.com/Null-Square/Null-CLi/main/docs/assets/null-ai-cli-run.svg)

</div>

## Why Null AI CLI

Modern teams need security feedback that is faster than a traditional pentest and more useful than raw scanner output. Null AI CLI is the open-source layer: a reproducible command-line framework for local assessments, scanner normalization, evidence capture, reports, and readiness mapping.

It is intentionally separate from the NullSquare managed platform. The public repo is useful on its own while keeping managed-platform internals out of scope. For hosted sandboxes, team workflows, dashboards, continuous testing, and enterprise reporting, see **[nullsquare.net](https://nullsquare.net)**.

## Install

```bash
# Run instantly with npx (no install)
npx @nullsquare/null-cli --help

# Or install globally
npm install -g @nullsquare/null-cli
null-ai --help

# Or one-line installer (checks Node >= 20, installs globally)
curl -fsSL https://raw.githubusercontent.com/Null-Square/Null-CLi/main/scripts/install.sh | bash
```

<details>
<summary>Build from source</summary>

```bash
git clone https://github.com/Null-Square/Null-CLi.git
cd Null-CLi
npm install
npm run build
node dist/cli/index.js --help
```

</details>

Binaries after install: `null-ai`, `null-cli`, `null`, `nullsquare` (all identical).

## Quick Start

```bash
# Open the guided home screen
null-ai

# Or run the demo flow against a lab you are authorized to test
null-ai demo --target http://localhost:3000 --authorize --out .null/demo
```

The demo flow is designed for your own OWASP Juice Shop, WebGoat, or equivalent training lab. It refuses live target contact unless you pass `--authorize`, writes a full local report, and keeps the public agent shallow and evidence-first.

```bash
null-ai run show .null/demo
null-ai run open .null/demo
```

Scale the same workflow with hosted infrastructure, dashboards, team evidence review, and enterprise reporting at **[nullsquare.net](https://nullsquare.net)**.

First launch creates a reusable model profile. Later launches open Home, where pentest, compliance readiness, lab demo, saved assessment, results, model settings, and advanced commands are separate choices. The API key is encrypted in a local user vault and is never written to the assessment session.

For automation or offline planning:

```bash
null-ai agent run --target https://example.com --dry-run --out .null/example
```

> **Only test systems you own or are explicitly authorized to test.** Scanner and shell execution are **off by default**; enable them with `--allow-shell` only for in-scope assets.

## Interactive Mode

Run `null-ai` with no arguments to open the primary **guided, persistent
assessment**.

On the first launch only, Null AI creates a model profile:

```text
null-ai

First-time model setup
? Provider                 OpenAI / DeepSeek / Anthropic / GLM / Moonshot / Qwen
? Profile name             default
? Use custom API endpoint? No
? API key                  ********
  42 models discovered
? Model family             OpenAI
? Model                    gpt-5-mini
```

The API key prompt remains visible while input is masked. The key is encrypted
in the local credential vault. Available models are discovered from the
provider; family and searchable model selectors replace manual model typing. Supported profile providers are OpenAI, DeepSeek, Anthropic, GLM, Moonshot, and Qwen. Change profiles later with `/profile`.

Later launches open a task-focused home screen instead of forcing a wizard:

```text
? Home
❯ New pentest
  Compliance readiness
  Resume saved assessment
  Authorized lab demo
  Results and reports
  Model settings
  Advanced commands
```

Pentest asks only for pentest inputs. A safe scope is generated automatically; detailed exclusions remain optional:

```text
New pentest
? Target(s)                https://app.example
? Assessment goal          Test the authorized staging application

Scope & authorization
  default scope             Authorized testing for app.example; destructive testing excluded
? Customize scope?         No

Run policy
? Assessment depth         Standard
? Enable local scanners?   No
? Confirm authorization    Yes
? Start assessment now?    Yes
```

Compliance readiness follows a different path: target, readiness objective, framework, evidence-review depth, optional scanner evidence, and authorization. Pentest does not ask for a compliance framework or generate compliance mapping. Advanced scope details can capture exclusions, authorization reference, test window, and rate limits when needed.

During a live run, the terminal shows planning, discovery, scanning, analysis, and reporting phases plus structured agent narration (`agent ...`),
tool calls, and artifact paths as they happen. The same trail is saved in the
report's **Agent Activity** section. After setup or a run, the searchable command
launcher supports `/` filtering, arrow-key navigation, descriptions, and Enter
selection. The CLI also checks npm periodically and displays a one-line upgrade
command when a newer version exists.

| Command | Purpose |
|---------|---------|
| `/wizard` | Run the guided setup-to-assessment flow |
| `/profile setup\|list\|use\|delete` | Manage saved model profiles |
| `/workflow pentest\|compliance` | Choose assessment workflow |
| `/depth quick\|standard\|deep` | Choose scan depth |
| `/target <t>` / `/targets [clear]` | Manage scope (repeatable) |
| `/scope <text>` / `/authorize` | Set a scope summary and confirm authorization |
| `/framework` / `/shell on\|off` / `/stream on\|off` | Configure the run |
| `/env model\|key\|base <v>` | Temporary per-process model overrides |
| `/run` / `/findings` / `/report` / `/compliance` / `/open report` | Run and review |
| `/status` / `/help` / `/exit` | Session control (config is saved between sessions) |

A live/scanner run is **gated behind authorization**. Profile metadata and
encrypted credentials are stored under `~/.null-ai` (or `%USERPROFILE%\.null-ai`
on Windows); `session.json` never stores the API key.

## Key Capabilities

- **Demo-to-report flow** - `null-ai demo` turns an authorized lab target into a traceable run and Markdown/SARIF report.
- **Guided interactive session** - one-time model onboarding, task-focused home screen, distinct pentest/compliance flows, searchable commands, and report opening.
- **Scoped single-agent loop** - one safe action per turn, hard scope boundaries, evidence-first reporting.
- **Scan modes** - `--scan-mode quick | standard | deep` trade speed for coverage.
- **Multi-target** - repeat `--target` to assess several assets in one command.
- **Live terminal UX** - branded NullSquare panels with real-time agent narration, tool, artifact, and finding output.
- **Scanner ingestion** - normalize `nuclei`, `semgrep`, and `trivy` JSON/JSONL into unified findings.
- **Engineer-ready outputs** - Markdown reports and SARIF for code scanning / CI.
- **Compliance readiness** - map findings to `owasp-top10`, `pci-dss-lite`, `iso27001-lite`, `nist-csf-lite`.
- **Docker sandbox** - reproducible scanner runtime with a toolchain smoke test.
- **Public skill packs** - markdown skills for scan modes, tooling, vuln classes, and compliance.

## Toolkit

| Tool | Purpose |
|------|---------|
| `http_request` | Safe HTTP capture and endpoint checks |
| `browser_action` | Browser-like page capture for surface mapping |
| `scanner_run` | Orchestrate scanners (gated behind `--allow-shell`) |
| `attach_evidence` | Attach raw artifacts to the assessment |
| `report_finding` | Draft evidence-backed findings with severity, CWE, OWASP, CVSS |
| `map_compliance` | Map findings to a readiness framework (compliance workflow only) |
| `file_read` | Read local target sources within scope |

## Vulnerability Coverage

| Category | Examples |
|----------|----------|
| Access Control | IDOR, missing authorization, auth bypass |
| Misconfiguration | Missing security headers, verbose banners, exposed services |
| Client-Side | Reflected / stored XSS |
| Transport & Session | Missing HSTS, insecure cookies |
| Disclosure | Sensitive data / error leakage |

> Deep validation, exploit-chaining, and advanced heuristics live only in the managed NullSquare platform. This OSS layer focuses on safe, evidence-backed discovery.

## Scan Modes

| Mode | Model guidance | Use when |
|------|----------------|----------|
| `quick` | Focused, conservative coverage | Fast scoped review of a single target |
| `standard` | Balanced repeatable coverage | Default open-source assessment |
| `deep` | Broader evidence and compliance coverage | A more thorough authorized review |

Each mode is backed by a public skill (`null-ai skills show scan-mode-deep`) that shapes the model's plan. Modes do not change loop limits: the model exits through an explicit final response, with one global 300-turn safety ceiling. Budget warnings appear near that ceiling, and a partial inconclusive report is always saved if it is reached. Use `--max-steps <n>` only when you intentionally want a lower ceiling.

## Outputs

Each assessment writes deterministic local artifacts:

```text
.null/example/
  run-state.json        # full assessment state
  findings.json         # normalized findings
  findings.sarif        # SARIF 2.1.0 for CI / code scanning
  reports/report.md     # human-readable report
  artifacts/            # captured evidence
```

Review an existing workspace at any time:

```bash
null-ai run show .null/example
null-ai run open .null/example
```

## Scanner Ingestion & Reports

```bash
# Normalize scanner output into Null AI findings
null-ai ingest artifacts/scans --out findings.json

# Normalize artifacts from a demo workspace
null-ai ingest .null/demo/artifacts/scans --out .null/demo/findings-from-scanners.json

# Generate a report + SARIF
null-ai report generate findings.json --out report.md --sarif findings.sarif --framework iso27001-lite

# Map findings to compliance-readiness controls
null-ai compliance map findings.json --framework pci-dss-lite --out pci-readiness.json
```

Compliance output is readiness support, **not** certification, attestation, or legal advice.

## Sandbox Runtime

```bash
docker build -f sandbox/Dockerfile -t null-cli-sandbox:dev .
docker run --rm -v "$PWD/sandbox:/opt/null-cli/sandbox:ro" null-cli-sandbox:dev \
  sh /opt/null-cli/sandbox/smoke.sh /opt/null-cli/sandbox/tools-manifest.json
```

Covers `httpx`, `nuclei`, `katana`, `nmap`, `semgrep`, `trivy`, `gitleaks`, `curl`, `jq`, and `node`.

## CI Usage

```yaml
- name: Null AI CLI dry assessment
  run: |
    npm ci && npm run build
    node dist/cli/index.js agent run --target https://example.com --dry-run --out .null/ci
```

Headless exit codes: `0` complete with no findings, `2` complete with findings, `3` inconclusive, `1` CLI/runtime failure.

For live assessments, provide `NULL_AI_API_KEY` and keep targets limited to systems you are authorized to test.

## Public Boundary

This repo ships the **open-source framework layer**: CLI + branded terminal, scoped public agent loop, scanner runtime checks, artifact ingestion, evidence-backed findings, reports/SARIF, lightweight compliance mapping, public skill packs, demo flow, and local trace viewer.

It does **not** include NullSquare managed-platform internals, customer artifacts, non-public heuristics, multi-agent orchestration, cross-run memory, hosted service logic, or enterprise automation. See [docs/public-boundary.md](docs/public-boundary.md).

## NullSquare Platform

Null AI CLI is the open-source entry point. **[NullSquare](https://nullsquare.net)** is the managed platform for teams that need hosted assessments, managed infrastructure, collaboration, dashboards, evidence review, compliance workflows, and enterprise reporting.

## Safety

Use Null AI CLI only on systems you own or have explicit permission to test. Keep written authorization, define scope before scanning, and never use it for destructive activity or credential attacks.

## Documentation

- [Demo](docs/demo.md) | [Architecture](docs/architecture.md) | [CLI reference](docs/cli.md) | [Scan modes](docs/scan-modes.md) | [Compliance](docs/compliance.md) | [Public boundary](docs/public-boundary.md)

## Contributing

Contributions that keep the public boundary intact are very welcome: new scanner parsers, public skills, report improvements, and tests. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE).
