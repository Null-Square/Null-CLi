# BMAD (R) Cyber Security Expansion Pack - Red Team Kill Chain

Overview
- Purpose: Extend BMAD core to a safe, simulated red-team workflow aligned to Lockheed Martin Kill Chain and MITRE ATT&CK.
- Result: Sequential agent hand-offs produce structured markdown artifacts per phase, suitable for learning, training, and planning.

Components
- Agents: Recon, Weaponization, Delivery, Exploitation, Installation, C2, Actions on Objectives.
- Tasks: One guided task per phase with step-by-step instructions.
- Templates: One report template per phase producing consistent markdown files.
- Workflow: `red-team-kill-chain.yaml` orchestrates linear hand-offs.
- KB: `data/mitre-kill-chain-kb.md` with ATT&CK/Kill Chain mapping and safe-simulation rules.

Quick Start
- Load the team: see `agent-teams/agent-team.yaml` for included agents and workflows.
- Run the workflow conceptually using your AI agent host tooling, or bundle for web.

Bundling (Web Agent)
- Use the BMAD web builder to generate a single-file bundle:
  - Option A (agents): `node tools/cli.js build --agents-only`
  - Option B (teams): `node tools/cli.js build --teams-only`
  - Or via direct script: `node tools/builders/web-builder.js` (advanced usage)
- The output in `dist/` includes web-compatible bundles.

Safety & Scope
- This pack is for simulation and documentation only. No real-world exploitation, scanning, or delivery actions are executed.
- All tools listed are references to inform writing and planning.

Version
- Pack: 0.1.0 (initial scaffold)
- Compatible with: BMAD-METHOD v4.x



