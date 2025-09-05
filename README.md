# Null CLI

Null CLI is a developer-focused AI command-line assistant adapted from the Gemini CLI via Qwen Code. This fork rebrands the project to "Null" and will evolve into a penetration testing agent with real command execution, methodology guidance (e.g., MITRE ATT&CK), and reporting.

This repo currently targets local development with pnpm, keeping changes incremental and the core library stable.

## Quick Start

Prerequisites:

- Node.js >= 20
- pnpm >= 8

Install and build:

```bash
pnpm install 
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

Global install (deferred):

- Not configured yet for publish under the `@null/*` scope. Once branding and features are stable, npm publish workflows will be updated.


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


## Configure Null CLI With Agent


1) In Null CLI, run `/auth` and select “API”. Enter:
- You will see list of modles that are available.
- To add more to the list add them to ./null/settings.json
- you can select custom and connect to any API.



## Safety & Legal

Null is for security research and authorized testing only. Ensure you have explicit permission before running any offensive tools or scans.

## Contributing

See `AGENT.md` for development guidelines and conventions for working in this repo.

## Docker

Build the image locally:

```bash
docker build -t null-cli:local .
```

Run the CLI with your project mounted as the working directory:

- Windows (PowerShell):

```powershell
docker run --rm -it `
  -v "${PWD}:/workspace" `
  -w /workspace `
  null-cli:local null
```



## Brand Identity

- Primary: Black `#000000`
- Accent: Gold `#FFD900`
- Style: Minimalist, high-contrast, sharp corners; assertive, all-caps headlines where appropriate

## Theme Selection (Null Light/Dark)

You can switch between built-in Null themes inside the CLI:

1) Use the theme command

```bash
/theme
```

Then select “Null Dark” (default) or “Null Light”.

2) Or set in settings dialog

```bash
/settings
```

Choose Theme → “Null Dark” or “Null Light”.
