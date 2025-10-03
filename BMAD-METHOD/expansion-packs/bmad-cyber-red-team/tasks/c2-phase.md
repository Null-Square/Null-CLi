<!-- Powered by BMAD(R) Core -->

# Task: c2-phase

## Purpose
- Design simulated command and control (C2) profiles, communication cadences, and defensive countermeasures.
- Produce docs/red-team/c2-plan.md documenting infrastructure, beacon characteristics, logging strategy, and contingency paths.

## Prerequisites
- docs/red-team/persistence-plan.md
- Network architecture constraints, allowed hosting providers, approved protocols.
- Directories: build/c2, reports/c2.

## Success Criteria
- At least two C2 profiles defined (e.g., HTTPS beacon, DNS tunnel) with parameters, tooling, and detection guidance.
- Kill-switches, failover channels, and teardown steps clearly documented.
- ATT&CK techniques (TA0011 Command and Control, TA0005 Defense Evasion) mapped with D3FEND mitigations.
- Handoff equips Actions-on-Objectives Agent with communication expectations and safety limits.

## Safety & Compliance
- Maintain simulation posture unless live infrastructure is authorised; never expose real customer data.
- Use lab domains/certificates when generating profiles; avoid live call-outs to production systems.
- Record all configuration changes and logs under reports/c2 for auditability.

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| sliver | `sliver-server daemon --lhost {{c2_ip}} --lport 8888` | Launch Sliver C2 server for HTTPS/WireGuard simulations. | Listener banner with operator prompt and implant keys. |
| merlin | `./merlinServer -i 0.0.0.0 -p 443 -c certs/server.pem -k certs/server.key` | Provide HTTP/2 mutual TLS beacon server. | Listener initialised log with session tracking. |
| covenant | `dotnet Covenant.dll` | GUI-driven C2 design for HTTP(S)/SMB beacons. | Console log plus URL to covenant UI. |
| chisel | `chisel server -p 8080 --reverse` | Document SOCKS-over-HTTP tunnelling for lateral command relays. | Server ready message with connection logs. |
| reGeorg | `python3 reGeorgSocksProxy.py -p 1080 -u https://{{target}}/static/tunnel.ashx` | Simulate webshell to SOCKS pivot. | Proxy listening confirmation and client activity logs. |
| mitm6 | `sudo mitm6 -i {{interface}} -d {{domain}}` | Model IPv6 relay channel for stealthy C2. | Captured authentication log entries. |
| rita | `rita import --rolling 30 /var/log/zeek/logs && rita show-beacons` | Provide defender analytics baseline for beacon detection. | Beacon scoring table with hostnames, frequencies. |

## Procedure
1. Review persistence-plan.md for established footholds, platform mix, and monitoring requirements.
2. Define operational objectives: beacon jitter, dwell-time, fallback needs, acceptable bandwidth, and fail-closed behaviour.
3. Select C2 tooling (sliver, merlin, covenant, chisel) aligned with objectives and target detection landscape.
4. For each C2 profile:
   - Configure listener parameters (protocol, domain/front, headers, user-agent, jitter, sleep/wakeup intervals).
   - Document implant requirements and installation commands.
   - Identify infrastructure dependencies (redirectors, CDN fronting, certificates).
5. Generate configuration files or profile artefacts (e.g., malleable profile, YAML configs) under build/c2 with timestamps.
6. Define monitoring and detection for defenders (e.g., web proxy logs, JA3 fingerprints, DNS TTL anomalies, Zeek beacon analysis). Provide Sigma/Elastic queries or sample logs using rita/Zeek where possible.
7. Establish kill-switch and teardown procedures (e.g., disable listeners, revoke certificates, delete storage accounts). Note responsible roles and timeframe.
8. Plan contingency channels (e.g., HTTP primary, DNS secondary, out-of-band dead drop) with triggers for activation.
9. Populate docs/red-team/c2-plan.md via template sections (Channels & Profiles, OPSEC considerations, Detection & Blue-Team Visibility, Handoff).
10. Brief Actions-on-Objectives Agent on communication cadence, required authentication, monitoring expectations, and teardown triggers.

## Decision Gates
- **Policy Compliance**: confirm chosen hosting/providers comply with legal and contractual obligations.
- **Noise vs. Reliability**: adjust jitter and packet size to balance stealth and responsiveness.
- **Monitoring Alignment**: ensure defenders can detect simulated C2 for training value; if not, propose instrumentation improvements.

## Outputs
- `docs/red-team/c2-plan.md`
- C2 configuration artefacts in `build/c2/`
- Activity logs and profiles in `reports/c2/`
- Handoff summary for Actions-on-Objectives phase.
