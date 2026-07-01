# CLI Reference

All binaries (`null-ai`, `null`, `nullsquare`) are identical. Run `null-ai --help` for the built-in summary, or `null-ai version` for the version.

## `interactive` (or bare `null-ai`)

Open a guided, persistent session. Running `null-ai` with no arguments on a terminal
launches this automatically (piped/non-TTY invocation prints the static home screen instead).

```bash
null-ai                      # or: null-ai interactive
null-ai interactive --out .null/session
```

Session commands:

| Command | Purpose |
|---------|---------|
| `/target <t>` · `/targets [clear]` | Add / list / clear targets (scope is repeatable) |
| `/goal <text>` · `/scope <text>` | Set the assessment goal and a rules-of-engagement note |
| `/mode quick\|standard\|deep` | Set scan depth |
| `/framework <id>` | Set compliance framework |
| `/shell on\|off` | Allow scanner/shell execution (in-scope assets only) |
| `/authorize` | Confirm you are authorized — required before any live or scanner run |
| `/env model\|key\|base <v>` | Set model / API key / base URL (the key stays in memory, never saved) |
| `/run` | Start the assessment with live output |
| `/findings` · `/report` · `/compliance` | Review results (persisted in the workspace) |
| `/status` · `/help` · `/clear` · `/exit` | Session control (config is saved to `<out>/session.json`) |

## `agent run`

Run a scoped assessment against one or more targets.

```bash
null-ai agent run --target <url|host|path> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--target <t>` | — | Target to assess. **Repeatable** — pass multiple `--target` for multi-target runs. |
| `--scan-mode <mode>` | `standard` | `quick`, `standard`, or `deep`. Controls depth / step budget. |
| `--goal <text>` | scoped shallow pentest | Natural-language objective for the agent. |
| `--framework <id>` | `owasp-top10` | `owasp-top10`, `pci-dss-lite`, `iso27001-lite`, `nist-csf-lite`. |
| `--out <dir>` | `.null/run` | Output workspace. For multi-target, each target gets `<out>/<slug>`. |
| `--allow-shell` | off | Enable scanner/shell execution. Use only for in-scope assets. |
| `--dry-run` | off | Build assessment structure without calling a model. |
| `--max-steps <n>` | per scan-mode | Override the agent step budget. |
| `--model <id>` | env | Model id (else `NULL_AI_MODEL` / `OPENAI_MODEL`). |
| `--api-key <key>` | env | API key (else `NULL_AI_API_KEY` / `OPENAI_API_KEY`). |
| `--base-url <url>` | env | OpenAI-compatible base URL. |

If no API key is available, the run automatically falls back to **dry-run** mode.

### Examples

```bash
# Quick single-target dry run
null-ai agent run --target https://example.com --scan-mode quick --dry-run

# Deep live assessment mapped to PCI readiness
null-ai agent run --target https://example.com --scan-mode deep --framework pci-dss-lite

# Multi-target (writes .null/run/example.com and .null/run/api.example.com)
null-ai agent run --target https://example.com --target https://api.example.com
```

## `ingest`

Normalize scanner output (`nuclei`, `semgrep`, `trivy`) into Null AI findings.

```bash
null-ai ingest <file-or-dir> --out findings.json
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
| `NULL_AI_API_KEY` / `OPENAI_API_KEY` | Model API key |
| `NULL_AI_BASE_URL` / `OPENAI_BASE_URL` | OpenAI-compatible base URL |
| `NULL_AI_MODEL` / `OPENAI_MODEL` | Model id |
| `NO_COLOR=1` | Disable colored output |
