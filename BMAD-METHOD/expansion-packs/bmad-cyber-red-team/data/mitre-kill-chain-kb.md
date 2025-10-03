MITRE ATT&CK and Lockheed Martin Kill Chain - Quick Reference

Purpose
- Provide agents with concise, practical context to align outputs to industry frameworks while preserving safety (simulation-only).

Lockheed Martin Kill Chain Phases
- Reconnaissance: Target research, asset discovery, exposure mapping.
- Weaponization: Pairing payload with delivery vector, decoy preparation.
- Delivery: Transmitting the weapon to the target environment.
- Exploitation: Triggering of payload to exploit a vulnerability.
- Installation: Establishing foothold/persistence.
- Command & Control (C2): External control channel to the compromised environment.
- Actions on Objectives: Executing mission goals (exfiltration, impact, etc.).

MITRE ATT&CK Alignment (Selected, Non-Exhaustive)
- Reconnaissance (TA0043): Active/Passive info gathering.
- Resource Development (TA0042): Staging accounts/infrastructure (simulated only here).
- Initial Access (TA0001): Phishing, supply chain, drive-by (planning only).
- Execution (TA0002): Execution via scripts, macros, etc. (documentation only).
- Persistence (TA0003): Account/registry/services/scheduled tasks (documented).
- Privilege Escalation (TA0004): Abuse of vulnerabilities or misconfigurations (documented references only).
- Defense Evasion (TA0005): Obfuscation, clearing tracks (do not generate harmful steps; discuss defensively).
- Credential Access (TA0006): Credential harvesting techniques (high-level, non-actionable documentation only).
- Discovery (TA0007): Host/network discovery (planning only).
- Lateral Movement (TA0008): RDP/SMB/WMI patterns (planning only).
- Collection (TA0009): Data staging (simulation-only).
- Command and Control (TA0011): Beaconing/profiles (planning only).
- Exfiltration (TA0010): Protocol choices, controls (simulation-only).
- Impact (TA0040): Service interruptions, data manipulation (discuss defensively).

Safety & Ethics
- All content in this expansion pack is for simulation and planning. No scanning, exploitation, or delivery should be executed from within this system.
- Where techniques are mentioned, include defensive considerations and references to public materials. Avoid enabling harm.

Report Quality Guidelines
- Cite public sources (CVE, vendor advisories) where relevant.
- Capture assumptions, prerequisites, and observables.
- Provide recommendations for defenders.
- Ensure outputs flow cleanly into next-phase templates.






