# BMAD (R) Cyber Security Expansion Pack - Red Team Kill Chain

## Overview
- Extends BMAD Core with a simulation-only workflow that mirrors the Lockheed Martin Kill Chain and the corresponding MITRE ATT&CK coverage.
- Orchestrates seven specialist agents with deep tooling guidance so teams can rehearse engagements end-to-end without executing harmful activity.

## Prerequisites & Dependencies
- BMAD Core repository available in the same workspace (agents rely on shared tasks such as `advanced-elicitation.md`).
- Node.js tooling from BMAD (used for bundling/lint flows).
- Access to a Kali Linux or equivalent environment that provides the referenced CLI tooling (e.g., `nmap`, `amass`, `subfinder`, `httpx`, `msfvenom`, `crackmapexec`, `sliver`).
- Optional: containerised tooling or remote execution hosts if you intend to execute commands rather than operate in simulation mode.

## Workflow Components
- **Workflow:** `workflows/red-team-kill-chain.yaml` (consumes IDs from `workflow-manifest.yaml`).
- **Manifest:** `workflow-manifest.yaml` maps logical task/template IDs to file paths for validation and linting.
- **Agents:** Recon, Weaponization, Delivery, Exploitation, Installation, C2, Actions on Objectives.
- **Tasks:** One per Kill Chain phase, each with success criteria, decision gates, tooling matrices, and handoff guidance.
- **Templates:** Interactive, validated markdown templates that enforce required sections and provide phase-specific elicitation prompts.
- **Knowledge Base:** `data/mitre-kill-chain-kb.md` capturing ATT&CK and Kill Chain alignment plus safety guidance.

## Artifact Layout
All generated artefacts live under a shared structure so downstream tooling can ingest them easily:
- `docs/red-team/` — canonical phase reports (`recon-report.md`, `payload-report.md`, `delivery-plan.md`, `exploit-report.md`, `persistence-plan.md`, `c2-plan.md`, `objectives-report.md`).
- `reports/` — raw command outputs grouped by phase (e.g., `reports/nmap/`, `reports/weaponization/`, `reports/delivery/`, `reports/exploitation/`).
- `build/` — simulated payload, lure, profile, and infrastructure artefacts (e.g., `build/payloads/`, `build/lures/`, `build/profiles/`, `build/c2/`).
- `scripts/` — helper scripts for persistence or objective simulations (`scripts/persistence/`, `scripts/objectives/`).
- `evidence/` — transcripts, screenshots, and proof bundles used during the Actions on Objectives phase.

## Runbook
1. Confirm environment and ROE inputs: target summary, scope, constraints, and intelligence feeds.
2. Launch the workflow (e.g., `node tools/cli.js run --workflow expansion-packs/bmad-cyber-red-team/workflows/red-team-kill-chain.yaml --manifest expansion-packs/bmad-cyber-red-team/workflow-manifest.yaml`).
3. The Recon agent will greet the user, auto-run `*help`, and begin eliciting required scope details before generating `docs/red-team/recon-report.md`.
4. Each subsequent agent consumes the previous phase artefacts, references the tooling catalog, and produces the next report plus supporting files under `build/` and `reports/`.
5. After Actions on Objectives completes, review the full report set and supporting evidence, then perform cleanup using the instructions captured in each phase.

## Tooling Snapshot
| Phase | Highlighted Tooling |
| --- | --- |
| Recon | `nmap`, `amass`, `subfinder`, `dnsx`, `httpx`, `theHarvester`, `eyewitness` |
| Weaponization | `msfvenom`, `donut`, `macro_pack`, `veil`, `setoolkit`, Cobalt Strike profile generators |
| Delivery | `gophish`, `sendemail`, `certbot`, `evilginx`, `impacket-smbserver`, `urlcrazy`, `responder` |
| Exploitation | `metasploit`, `crackmapexec`, `nmap` NSE, `sqlmap`, `bloodhound-python`, `evil-winrm`, `rubeus` |
| Installation | `schtasks`, `reg add`, `systemd`, `crontab`, `wmic`, `az` CLI |
| C2 | `sliver`, `merlin`, `covenant`, `chisel`, `reGeorg`, `mitm6`, `rita` |
| Actions on Objectives | `rclone`, PowerShell transcripts, `Invoke-BloodHound`, `auditbeat`, `chainsaw`, `netsh trace`, `gitleaks` |

## Safety Posture
- All agents default to simulation mode; they provide command syntax, evidentiary expectations, and defensive notes without executing unless explicitly directed and approved.
- Each template and task enforces documentation of kill-switches, rollback steps, and monitoring hooks so blue-team stakeholders benefit from every artefact.
- The knowledge base reiterates that no real exploitation, scanning, or delivery should occur from within this system without the owner''s informed consent.

## Validation & Linting
- Validate workflow schema once changes are made: `node tools/cli.js lint --workflows expansion-packs/bmad-cyber-red-team/workflows --manifest expansion-packs/bmad-cyber-red-team/workflow-manifest.yaml`.
- Consider adding CI steps to execute lint, spellcheck, and forbidden-commands scans for this expansion pack.

## Versioning
- Pack: 0.1.0 (in-progress hardening)
- Compatible with: BMAD-METHOD v4.x
