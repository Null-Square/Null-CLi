# CLI Reference

All binaries (`null-ai`, `null`, `nullsquare`) are identical. Run `null-ai --help` for the built-in summary, or `null-ai version` for the version.

## `interactive` (or bare `null-ai`)

Open a guided, persistent assessment. Running `null-ai` with no arguments on a
terminal launches it automatically (piped/non-TTY invocation prints the static
home screen instead).

On first launch, model onboarding selects a provider, securely captures its key, discovers available models, and provides model-family and searchable model selection. Supported profile providers are OpenAI, DeepSeek, Anthropic, GLM, Moonshot, and Qwen. This does not repeat after a valid profile exists; use `/profile` to change it.

Later launches open Home with separate actions for a new pentest, compliance readiness review, saved assessment, authorized lab demo, results, model settings, and advanced commands. Pentest asks for target, goal, depth, scanner policy, and authorization. Compliance instead asks for a readiness objective, framework, evidence depth, scanner evidence policy, and authorization. A safe scope summary is generated automatically; detailed scope fields are opt-in.

The post-run command launcher is searchable. Type `/` or part of a command,
navigate with arrow keys, and press Enter to select it.

Live runs show planning, discovery, scanning, analysis, and reporting phases alongside structured agent narration (`agent ...`), tool calls, and
artifact paths as they happen. The saved Markdown report includes the same trail
under **Agent Activity**.

```bash
null-ai                      # or: null-ai interactive
null-ai interactive --out .null/session
```

Session commands:

| Command | Purpose |
|---------|---------|
| `/wizard` | Configure scope and start a new assessment |
| `/profile setup\|list\|use <name>\|delete <name>` | Manage saved model profiles |
| `/workflow pentest\|compliance` | Choose workflow mode |
| `/mode pentest\|compliance` | Alias for workflow mode; `/mode quick\|standard\|deep` remains a depth alias |
| `/depth quick\|standard\|deep` | Set scan depth |
| `/target <t>` / `/targets [clear]` | Add / list / clear targets (scope is repeatable) |
| `/goal <text>` / `/scope <text>` | Set the assessment goal and scope summary |
| `/framework <id>` | Set compliance framework |
| `/shell on\|off` | Allow scanner/shell execution (in-scope assets only) |
| `/stream on\|off` | Stream model progress into the live status line |
| `/authorize` / `/deauthorize` | Confirm or clear authorization; required before any live or scanner run |
| `/env model\|key\|base <v>` | Set temporary process-only overrides |
| `/run` | Optional manual repeat/start command; the wizard can run directly |
| `/findings` / `/report` / `/compliance` | Review results (persisted in the workspace) |
| `/open report\|sarif\|folder` | Open generated output locally |
| `/status` / `/help` / `/clear` / `/exit` | Session control (config is saved to `<out>/session.json`) |

## `agent run`

Run a scoped assessment against one or more targets.

```bash
null-ai agent run --target <url|host|path> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--target <t>` | required | Target to assess. **Repeatable**: pass multiple `--target` for multi-target runs. |
| `--workflow <mode>` | `pentest` | `pentest` or `compliance`. Shapes the default goal and run context. |
| `--profile <id>` | none | Assessment profile. Currently supports `web-lab` for authorized training labs. |
| `--scan-mode <mode>` | `standard` | `quick`, `standard`, or `deep`. Changes model coverage guidance only. |
| `--goal <text>` | scoped shallow pentest | Natural-language objective for the agent. |
| `--scope <text>` | none | Scope / rules-of-engagement summary for headless runs. |
| `--framework <id>` | compliance: `owasp-top10` | Compliance workflow only: `owasp-top10`, `pci-dss-lite`, `iso27001-lite`, `nist-csf-lite`. |
| `--out <dir>` | `.null/run` | Output workspace. For multi-target, each target gets `<out>/<slug>`. |
| `--allow-shell` | off | Enable scanner/shell execution. Use only for in-scope assets. |
| `--dry-run` | off | Build assessment structure without calling a model. |
| `--stream` | off | Stream model progress into the live status line. |
| `--max-steps <n>` | `300` | Set a lower runtime safety ceiling. It does not select scan depth. |
| `--model <id>` | env/profile | Model id; flags override environment variables, which override the active profile. |
| `--api-key <key>` | env/profile | API key; flags override environment variables, which override the active profile. |
| `--base-url <url>` | env/profile | OpenAI-compatible base URL; flags override environment variables, which override the active profile. |

If no API key is available, the run automatically falls back to **dry-run** mode.

### Examples

```bash
# Quick single-target dry run
null-ai agent run --target https://example.com --scan-mode quick --dry-run

# Deep live assessment mapped to PCI readiness
null-ai agent run --target https://example.com --workflow compliance --scan-mode deep --framework pci-dss-lite

# Multi-target (writes .null/run/example.com and .null/run/api.example.com)
null-ai agent run --target https://example.com --target https://api.example.com

# Authorized web lab profile
null-ai agent run --target http://localhost:3000 --profile web-lab --allow-shell
```

Headless exit codes:

| Code | Meaning |
|------|---------|
| `0` | Completed or dry-run with no findings |
| `2` | Completed with one or more findings |
| `3` | Inconclusive or failed assessment |
| `1` | CLI/runtime error |

## `demo`

Run a popularity-oriented, public-safe demo flow against a lab target you are
authorized to test. The target is user-provided; Null AI does not ship a
hardcoded public vulnerable host.

```bash
null-ai demo --target <authorized-lab-url> --authorize [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--target <url>` | required | Your authorized OWASP Juice Shop, WebGoat, or equivalent training lab URL. |
| `--authorize` | required for live runs | Confirms you are authorized to contact the target. |
| `--out <dir>` | `.null/demo` | Output workspace. |
| `--allow-shell` | off | Enable local scanner wrappers for the lab. |
| `--dry-run` | off | Write a plan without model calls or target contact. |
| `--scan-mode <mode>` | `standard` | `quick`, `standard`, or `deep`. |

```bash
null-ai demo --target http://localhost:3000 --authorize --out .null/demo
null-ai demo --target http://localhost:3000 --dry-run
```

## `run show` / `run open`

Render or open a saved run workspace.

```bash
null-ai run show .null/demo
null-ai run open .null/demo
null-ai run open .null/demo --folder
```

`run show` reads `<workspace>/run-state.json` and prints outcome, summary,
findings, evidence, agent actions, artifact paths, and the saved report path.

## `ingest`

Normalize scanner output (`nuclei`, `semgrep`, `trivy`) into Null AI findings.

```bash
null-ai ingest <file-or-dir> --out findings.json

# Example: normalize scanner artifacts created by the demo flow
null-ai ingest .null/demo/artifacts/scans --out .null/demo/findings-from-scanners.json
```

## `report generate`

Render a Markdown report (and optional SARIF) from a findings file.

```bash
null-ai report generate findings.json --out report.md --sarif findings.sarif --framework iso27001-lite
```

## `compliance map`

Map findings to readiness controls for a framework.

```bash
null-ai compliance map findings.json --framework pci-dss-lite --out pci-readiness.json
```

## `sandbox verify`

Run the Docker scanner-toolchain smoke test against a manifest.

```bash
null-ai sandbox verify --manifest sandbox/tools-manifest.json
```

## `skills list` / `skills show`

Browse the public skill packs.

```bash
null-ai skills list
null-ai skills show scan-mode-deep
```

## Environment

| Variable | Purpose |
|----------|---------|
| `NULL_AI_API_KEY` | Provider-neutral model API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GLM_API_KEY` / `ZHIPU_API_KEY` / `BIGMODEL_API_KEY` | GLM API key |
| `MOONSHOT_API_KEY` | Moonshot API key |
| `DASHSCOPE_API_KEY` / `QWEN_API_KEY` | Qwen API key |
| `NULL_AI_BASE_URL` / `OPENAI_BASE_URL` | OpenAI-compatible base URL |
| `NULL_AI_MODEL` / `OPENAI_MODEL` | Model id |
| `NULL_AI_HOME` | Override the model profile and credential directory |
| `NULL_AI_DISABLE_UPDATE_CHECK` | Set to `1` to disable the cached npm update check |
| `NO_COLOR=1` | Disable colored output |

## Model profiles

The interactive wizard stores the profile name, model, and base URL in the
user-level Null AI configuration directory. API-key input is hidden in an
interactive terminal, and keys are encrypted with
AES-256-GCM using a random local master key stored separately with user-only
file permissions where the operating system supports them. This protects
against accidental plaintext disclosure in reports, sessions, logs, and source
control; it is not a replacement for an operating-system or enterprise secrets
manager on a compromised account.

The active profile is also used by `null-ai agent run` when command flags and
environment variables do not provide model settings.
