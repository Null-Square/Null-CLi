<!-- Powered by BMAD(R) Core -->

# Task: c2-phase

## Purpose
- **Deploy and validate** authorized command and control (C2) infrastructure and beacon profiles after persistence is confirmed.
- Produce `docs/red-team/c2-report.md` with **live endpoints**, configuration artefacts, and defender-aware telemetry.

## Prerequisites
- `docs/red-team/persistence-report.md` (with **confirmed foothold**)
- Network architecture constraints, approved protocols, and **authorized hosting scope**.
- Directories: `build/c2/`, `reports/c2/`, `certs/`.

## Success Criteria
- **Live C2 listeners deployed** (e.g., Sliver on 127.0.0.1:8888, Merlin on 443).
- **Beacon profiles generated** and tested (malleable configs, implants).
- ATT&CK technique coverage documented (TA0011 Command and Control, TA0005 Defense Evasion).
- **Artefact paths, logs, and kill-switches** stored in `reports/c2/`.
- Clear handoff to Actions-on-Objectives Agent with **confirmed communication channels**.

## Safety & Compliance
- **Never deploy C2 listeners without explicit user confirmation per profile.**
- Default to **lab-safe IPs/domains** (127.0.0.1, example-c2.local) unless real infrastructure is approved.
- **Log every command, output, and artefact** with UTC timestamps and hashes.
- **Immediately terminate** listeners if unintended exposure occurs; document teardown steps.

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| sliver | `sliver-server daemon --lhost {{c2_ip}} --lport 8888` | **Deploy** Sliver C2 server for HTTPS/WireGuard beacons. | Listener banner + `netstat -tuln \| grep 8888` verification. |
| merlin | `./merlinServer -i 0.0.0.0 -p 443 -c certs/server.pem -k certs/server.key` | **Deploy** HTTP/2 mTLS beacon server. | TLS context log + `ss -tuln \| grep 443` output. |
| covenant | `dotnet Covenant.dll` | **Launch** GUI C2 for HTTP(S)/SMB beacons. | Web UI URL + console log of active listeners. |
| chisel | `chisel server -p 8080 --reverse` | **Deploy** SOCKS-over-HTTP tunnel. | Server ready message + client connection logs. |
| reGeorg | `python3 reGeorgSocksProxy.py -p 1080 -u https://{{target}}/static/tunnel.ashx` | **Deploy** webshell-to-SOCKS pivot. | Proxy listening confirmation + traffic logs. |
| mitm6 | `sudo mitm6 -i {{interface}} -d {{domain}}` | **Deploy** IPv6 LLMNR poisoning for lateral C2. | Captured auth events + client IP logs. |
| rita | `rita import --rolling 30 /var/log/zeek/logs && rita show-beacons` | **Analyze** beacon detection baseline. | Beacon score table with risk metrics. |

> ⚠️ **All tools require explicit user confirmation before execution.**

## Procedure
1. Review `persistence-report.md` to identify **confirmed footholds** (e.g., `systemd service active on 127.0.0.1`).
2. Define C2 requirements: protocol, jitter, dwell-time, failover needs, kill-switch triggers.
3. For each C2 profile:
   - **Prompt user**: “Deploy [Sliver] on [127.0.0.1:8888]? (y/N)”
   - **If confirmed**, execute command, capture full output, store in `reports/c2/{{tool}}-{{timestamp}}.log`
4. **Validate C2 listener**:
   - `netstat -tuln | grep 8888` (Sliver)
   - `ss -tuln | grep 443` (Merlin)
   - `curl -k https://127.0.0.1:8888` (basic reachability)
5. Generate **beacon profiles**:
   - Sliver: `generate --os windows --arch amd64 --format exe`
   - Save to `build/c2/` with SHA256 hash
6. Document each C2 channel including:
   - **Listener endpoint** (e.g., `https://127.0.0.1:8888`)
   - **Certificate path** (e.g., `certs/server.pem`)
   - **Verification output** (e.g., `Active: listening`)
   - **Detection signals** (e.g., “JA3 hash: a1b2c3...”, “Zeek http.log: unusual User-Agent”)
   - **Kill-switch**: `pkill -f sliver-server`, `rm -rf certs/`
7. Assess risk: if detection likelihood is too high, recommend stealth tuning or abort.
8. Populate `docs/red-team/c2-report.md` via template with:
   - **Real listener endpoints**
   - **UTC timestamps**
   - **Artefact hashes** (for profiles, certs)
9. Store C2 configs in `build/c2/` with headers noting **execution status**.
10. Prepare handoff brief for Actions-on-Objectives Agent:
    > “C2 confirmed live at https://127.0.0.1:8888 (Sliver).  
    > Beacon profile: `build/c2/beacon-windows-12345.exe` (SHA256: a1b2c3...).  
    > Next: execute data staging.”

## Decision Gates
- **User Confirmation**: **Never auto-deploy** — require “y” per C2 profile.
- **Port Availability**: if port in use, log error and suggest alternate.
- **Certificate Safety**: if using real domains, confirm certbot approval; else use self-signed in `certs/`.
- **Detection Alert**: if local proxy/EDR triggers, log event and consider pausing.

## Outputs
- `docs/red-team/c2-report.md` (**with live C2 evidence**)
- **Real logs and artefacts** in `reports/c2/`
- **Beacon profiles and configs** in `build/c2/`
- Handoff summary for Actions-on-Objectives phase with **confirmed communication channels**
