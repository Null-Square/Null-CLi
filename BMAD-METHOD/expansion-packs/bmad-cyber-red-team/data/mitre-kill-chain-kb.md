# MITRE ATT&CK and Lockheed Martin Kill Chain - Quick Reference

## Purpose
- Provide agents with concise, practical context to align outputs to industry frameworks.
- Ensure all actions are **authorized, safe, and defender-aware** — whether in simulation or live execution.

## Lockheed Martin Kill Chain Phases
- **Reconnaissance**: Target research, asset discovery, exposure mapping.
- **Weaponization**: Pairing payload with delivery vector, decoy preparation.
- **Delivery**: Transmitting the weapon to the target environment.
- **Exploitation**: Triggering of payload to exploit a vulnerability.
- **Installation**: Establishing foothold/persistence.
- **Command & Control (C2)**: External control channel to the compromised environment.
- **Actions on Objectives**: Executing mission goals (exfiltration, impact, etc.).

## MITRE ATT&CK Alignment (Selected, Non-Exhaustive)
- **Reconnaissance (TA0043)**: Active/Passive info gathering.
- **Resource Development (TA0042)**: Staging accounts/infrastructure.
- **Initial Access (TA0001)**: Phishing, supply chain, drive-by.
- **Execution (TA0002)**: Execution via scripts, macros, etc.
- **Persistence (TA0003)**: Account/registry/services/scheduled tasks.
- **Privilege Escalation (TA0004)**: Abuse of vulnerabilities or misconfigurations.
- **Defense Evasion (TA0005)**: Obfuscation, clearing tracks.
- **Credential Access (TA0006)**: Credential harvesting techniques.
- **Discovery (TA0007)**: Host/network discovery.
- **Lateral Movement (TA0008)**: RDP/SMB/WMI patterns.
- **Collection (TA0009)**: Data staging.
- **Command and Control (TA0011)**: Beaconing/profiles.
- **Exfiltration (TA0010)**: Protocol choices, controls.
- **Impact (TA0040)**: Service interruptions, data manipulation.

## Safety & Ethics
- ✅ **Execution is permitted only when**:
  - Explicitly authorized in the Rules of Engagement (ROE)
  - Confirmed by the user per action ("y/N" prompt)
  - Conducted within approved scope (domains, IPs, techniques)
  - Using lab-safe defaults (e.g., `example-phish.local`, `127.0.0.1`)
- 🛡️ **All actions must include**:
  - Full logging and artefact hashing
  - Defender-aware telemetry notes
  - Immediate kill-switch and cleanup instructions
- 🚫 **Never execute**:
  - Destructive payloads (ransomware, wipers)
  - Unapproved zero-days
  - Actions against out-of-scope assets
  - Real phishing against non-consenting users

## Report Quality Guidelines
- Cite public sources (CVE, vendor advisories) where relevant.
- Capture assumptions, prerequisites, and observables.
- Provide recommendations for defenders.
- Ensure outputs flow cleanly into next-phase templates.
- **In execution mode**: Include real artefact paths, hashes, service status, and verification steps.