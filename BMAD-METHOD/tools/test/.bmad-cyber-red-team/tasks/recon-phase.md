<!-- Powered by BMAD(R) Core -->

# Task: recon-phase

## Purpose
- Plan and execute reconnaissance aligned to ROE, scope, and MITRE ATT&CK.
- Produce docs/red-team/recon-report.md containing asset inventory, exposure analysis, and defender insights.

## Prerequisites
- Target summary, environments, and scope/ROE confirmation.
- Credentials or API keys for approved external data sources (if any).
- Workspace directories: reports/nmap, reports/amass, reports/httpx, reports/dns, reports/harvester.

## Success Criteria
- Scope boundaries, prohibited actions, and timebox captured in the report.
- Recon objectives mapped to ATT&CK techniques with supporting evidence.
- Live tool executions produce artefacts stored under reports/ with timestamps and hashes where applicable.
- Handoff notes prepared for Weaponization with key exposures and telemetry leads.

## Safety & Compliance
- Execute only actions authorised in the ROE; escalate if additional access is required.
- Respect target data handling rules; redact sensitive identifiers prior to sharing artefacts.
- Log every executed command with timestamp, data location, and justification.

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| nmap | `nmap -Pn -sV -p- --min-rate 2000 {{target_host}} -oA reports/nmap/{{target_host}}-{{timestamp}}` | Enumerate open TCP services and versions. | `reports/nmap/*.gnmap` containing ports, services, banners. |
| amass | `amass enum -passive -d {{target_domain}} -o reports/amass/{{target_domain}}-{{timestamp}}.txt` | Passive subdomain discovery. | Text file listing discovered subdomains with sources. |
| subfinder | `subfinder -d {{target_domain}} -all -silent | tee reports/subdomains/{{target_domain}}-{{timestamp}}.txt` | API-driven subdomain enumeration. | Flat file ready for resolution/httpx. |
| dnsx | `dnsx -l reports/subdomains/{{target_domain}}-{{timestamp}}.txt -a -resp -o reports/dns/{{target_domain}}-{{timestamp}}.txt` | Resolve discovered subdomains and capture A/AAAA records. | Resolved host/IP pairs and response metadata. |
| httpx | `httpx -l reports/subdomains/{{target_domain}}-{{timestamp}}.txt -ports 80,443,8080,8443 -status-code -tech-detect -title -o reports/httpx/{{target_domain}}-{{timestamp}}.txt` | Identify live web services and tech stack. | CSV-style entries with URL, status, tech, title. |
| theHarvester | `theHarvester -d {{target_domain}} -b linkedin,google -f reports/harvester/{{target_domain}}-{{timestamp}}` | Gather employee/contact intel to inform social vectors. | HTML/CSV summary of emails, hosts, sources. |
| eyewitness (optional) | `eyewitness --web -f reports/httpx/{{target_domain}}-{{timestamp}}.txt -d reports/eyewitness/{{timestamp}}` | Capture screenshots / metadata for surfaced web hosts. | Image gallery plus HTML index. |

## Procedure
1. Confirm scope and ROE with the user. Record allowed domains/IP ranges, disallowed actions, time constraints, and data-handling policy.
2. Define recon objectives aligned to mission (e.g., external attack surface, supply chain exposure, credential sources). Map each objective to ATT&CK techniques (TA0043/TA0042).
3. Prepare workspace directories and timestamp variable; validate that commands align with ROE approvals.
4. Execute passive discovery (amass, subfinder, theHarvester) capturing artefacts under reports/ with timestamps. Document findings immediately in draft report notes.
5. Perform host resolution and surface analysis (dnsx, httpx, eyewitness). Highlight technologies, certificates, potential misconfigurations, and note defensive telemetry leads.
6. Execute targeted service enumeration (nmap, additional NSE scripts) for high-value hosts. Capture banners, SSL metadata, errors, and hash outputs as needed.
7. Correlate findings: group assets by category, identify trust relationships, extract potential weak points. Include defensive telemetry references (e.g., DNS logs, WAF alerts).
8. Update docs/red-team/recon-report.md via template: scope, objectives, methodology, findings, attack surface summary, ATT&CK mapping, and weaponization handoff notes.
9. Store raw command logs in reports/logs/{{timestamp}}.txt (or equivalent) for auditing and hash any significant artefacts.
10. Brief Weaponization Agent using handoff prompt; ensure open questions and assumptions are documented.

## Decision Gates
- **Live Execution Approval**: halt if ROE does not authorise the planned actions; escalate for approval before proceeding.
- **Noise Threshold**: if enumeration risk is high (e.g., limited stealth requirement), coordinate with stakeholders before continuing.
- **Data Sensitivity**: consult stakeholders before storing user-identifiable information; anonymise when required.

## Outputs
- `docs/red-team/recon-report.md`
- Supporting artefacts in `reports/` (nmap, amass, httpx, dns, harvester, eyewitness, logs)
- Handoff summary (inline or separate note) for Weaponization phase.
