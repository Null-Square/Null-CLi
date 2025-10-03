<!-- Powered by BMAD(R) Core -->

# Task: delivery-phase

## Purpose
- Design delivery logistics, infrastructure, and monitoring plans for the selected payloads/lures.
- Produce docs/red-team/delivery-plan.md detailing channel selection, staging steps, detection coverage, and contingency paths.

## Prerequisites
- docs/red-team/payload-report.md
- Approved delivery channels and communication policies.
- Access to staging infrastructure (SMTP relay, web host, redirectors) or simulation workspace.
- Directories: build/infrastructure, reports/delivery.

## Success Criteria
- Delivery plan covers at least two viable channels with risk scoring, tooling, authentication requirements, and telemetry hooks.
- Checklists for staging (TLS, DNS, tracking) are prepared and validated.
- ATT&CK mappings (e.g., T1566, T1105, T1197) documented with detection/mitigation guidance.
- Handoff instructions equip Exploitation Agent with expected ingress points and monitoring expectations.

## Safety & Compliance
- No real phishing or payload deployment without explicit authorisation; default to simulation.
- Anonymise target data in artefacts; use lab domains where possible (e.g., example.com).
- Ensure use of third-party services complies with legal/ethical standards.

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
1. Review payload-report.md to understand payload formats, dependencies, and observables. Note required infrastructure (SMTP, web, USB, SMB, cloud).
2. Confirm delivery constraints with stakeholders: allowable channels, sending domains, infrastructure ownership, maximum touch points.
3. Build a delivery channel matrix:
   - Email (e.g., spearphish, newsletter clone)
   - Web (drive-by, credential harvest)
   - Network/physical (USB drop, LLMNR poisoning)
   Score each for impact, detection likelihood, operational effort, and compliance.
4. For each approved channel, configure or simulate tooling:
   - Email: gophish/sendemail for templates, SPF/DKIM alignment, tracking settings.
   - Web: certbot for TLS, evilginx or custom site for lure hosting, logging configuration.
   - Network: impacket-smbserver or responder for network shares, ensure segmentation awareness.
5. Document staging steps in build/infrastructure (e.g., domain registration, DNS records, certificate issuance, redirector deployment). Include verification commands and expected outputs.
6. Define telemetry coverage: SIEM alerts, mail gateway rules, WAF logs, EDR triggers. Provide sample log entries or Sigma references.
7. Prepare contingency and rollback plans (e.g., immediate shutdown commands, retraction emails, staging clean-up scripts).
8. Populate docs/red-team/delivery-plan.md via template: summary, inputs, channel matrix, staging instructions, detection/mitigation, handoff to exploitation.
9. Store logs, configuration snippets, and checklists in reports/delivery/ with timestamps.
10. Deliver a concise brief to the Exploitation Agent highlighting ready channels, prerequisites, and monitoring expectations.

## Decision Gates
- **Compliance Check**: escalate if proposed channel violates legal/contractual constraints.
- **Infrastructure Health**: verify redirectors/TLS certs before launch; if unavailable, mark simulation-only and adjust risk scoring.
- **Detection Overload**: if existing detections make a channel impractical, propose alternates or highlight expected alert fatigue.

## Outputs
- `docs/red-team/delivery-plan.md`
- Staging artefacts under `build/infrastructure`
- Channel matrix, checklists, and logs in `reports/delivery`
- Handoff summary for Exploitation phase.
