# Null CLI

Null CLI is a developer-focused AI command-line assistant adapted from the Gemini CLI via Qwen Code. This fork rebrands the project to "Null" and will evolve into a penetration testing agent with real command execution, methodology guidance (e.g., MITRE ATT&CK), and reporting.

This repo currently targets local development with pnpm, keeping changes incremental and the core library stable.

## Quick Start

Prerequisites:

- Node.js >= 20
- pnpm >= 8

Install and build:

```bash
pnpm install --ignore-scripts
pnpm -r build
```

Run the CLI locally:

```bash
pnpm --filter @null/null-cli start
```

Check version:

```bash
pnpm --filter @null/null-cli start -- --version
```

## Project Structure

- `packages/cli`: Null CLI app (bin: `null`)
- `packages/core`: Core agent logic and tools
- `packages/test-utils`: Shared testing utilities
- `packages/vscode-ide-companion`: VS Code companion extension
- `scripts/*`: Build, bundle, and utility scripts

## Current Status

- Build: passes via `pnpm -r build`
- Run: `pnpm --filter @null/null-cli start` launches the CLI
- Rename: CLI/core/test-utils packages migrated to `@null/*`
- Docs: This README and `NULL.md` are added; legacy content will be refactored progressively

## Installation Options

Local workspace (recommended during development):

```bash
pnpm install --ignore-scripts
pnpm -r build
pnpm --filter @null/null-cli start
```

Global install (deferred):

- Not configured yet for publish under the `@null/*` scope. Once branding and features are stable, npm publish workflows will be updated.

## Roadmap (High-level)

- Pentest tooling execution (Nmap, Gobuster, SQLMap, etc.)
- Methodology-driven flows (MITRE ATT&CK alignment)
- Real-time logs, safety gates, and final reporting
- Local model support and pluggable reasoning providers

## Safety & Legal

Null is for security research and authorized testing only. Ensure you have explicit permission before running any offensive tools or scans.

## Contributing

See `AGENT.md` for development guidelines and conventions for working in this repo.

