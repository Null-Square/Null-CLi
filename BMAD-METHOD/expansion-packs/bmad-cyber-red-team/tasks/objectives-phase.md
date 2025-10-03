<!-- Powered by BMAD(R) Core -->

# Task: objectives-phase

## Purpose
- Plan and document simulated actions on objectives, evidence collection, and defender uplift activities.
- Produce docs/red-team/objectives-report.md summarising mission outcomes, detected gaps, and remediation recommendations.

## Prerequisites
- docs/red-team/c2-plan.md
- Business objectives, data classification requirements, and incident response expectations.
- Directories: reports/objectives, evidence/, scripts/objectives.

## Success Criteria
- Objectives mapped to ATT&CK impact techniques (TA0040, TA0010, TA0009) with clear success metrics.
- Evidence collection plan defined (transcripts, logs, screenshots) alongside chain-of-custody notes.
- Defensive recommendations (detections, process changes, tabletop follow-ups) captured for each objective.
- Engagement closeout documents ROE adherence, data handling, and lessons learned.

## Safety & Compliance
- Simulation-only unless authorised; do not access or exfiltrate real sensitive data.
- Follow data-handling rules for staged content (use synthetic datasets when possible).
- Coordinate with blue-team to avoid confusion with real incidents.

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| rclone | `rclone sync /opt/collection/enriched s3:controlled-bucket --dry-run --log-file reports/objectives/rclone-{{timestamp}}.log` | Simulate data staging/exfil workflow and log actions. | Dry-run log showing files, sizes, would-copy summary. |
| powershell transcript | `Start-Transcript -Path C:\\Logs\\mission-{{timestamp}}.txt` | Capture command history for evidence. | Transcript start confirmation; stop transcript to save. |
| sharphound | `Invoke-BloodHound -CollectionMethods Session,ACL,Trusts -OutputDirectory C:\\Windows\\Temp` | Gather lateral movement evidence supporting objectives. | Zip/JSON files for BloodHound ingestion. |
| auditbeat | `./auditbeat -e -strict.perms=false -c auditbeat.yml` | Provide defender telemetry baseline during simulated operations. | Event stream logs to configured output. |
| chainsaw | `chainsaw hunt /var/log/evtx/ --rules ./signatures --output reports/objectives/chainsaw-{{timestamp}}` | Demonstrate detection validation through Sigma rules. | CSV/JSON results with matched events. |
| netsh trace | `netsh trace start capture=yes tracefile=C:\\Logs\\rt-trace.etl` | Capture network telemetry while running objective actions. | Trace started confirmation and ETL file upon stop. |
| gitleaks | `gitleaks detect --source /opt/repos/target --report-format json --report-path reports/objectives/gitleaks-{{timestamp}}.json` | Assess repository for secret exposure as part of impact objectives. | JSON report listing potential secrets with file/line references. |

## Procedure
1. Reconfirm mission objectives with stakeholders: business critical assets, acceptable impact level, and desired training outcomes.
2. Define success metrics for each objective (e.g., simulated data staging completed, lateral movement path documented, detection alert triggered).
3. Prepare evidence capture tooling (transcripts, screen capture, netsh trace, Auditbeat). Ensure storage paths align with data-handling rules.
4. Execute or simulate objective actions:
   - Data access/staging (rclone dry-run, scripted exports with synthetic data).
   - Credential/secret discovery (gitleaks, BloodHound results usage).
   - Impact simulations (service disablement scripts in lab, ransomware tabletop walk-through).
5. Collect artefacts: command transcripts, logs, screenshots, Sigma/Chainsaw findings, timeline notes. Store under evidence/ with timestamped subdirectories.
6. Analyse defender response: log correlation (SIEM alerts, EDR telemetry), detection gaps, process delays. Use Chainsaw/Auditbeat or equivalent to validate detection.
7. Document lessons learned and remediation recommendations (technical controls, process updates, tabletop drills). Align with MITRE D3FEND where applicable.
8. Populate docs/red-team/objectives-report.md via template sections (Objectives & Success Criteria, Planned Actions, Outcomes & Evidence, Defensive Recommendations, Engagement Closeout).
9. Confirm data clean-up (delete staging data, revoke temporary credentials, stop transcripts/traces). Record cleanup evidence in reports/objectives/cleanup-{{timestamp}}.txt.
10. Prepare executive-ready summary for stakeholders highlighting mission goals, results, residual risks, and next steps.

## Decision Gates
- **Data Sensitivity**: halt if simulated content risks exposure of real customer data; switch to synthetic datasets.
- **IR Coordination**: confirm incident response teams are aware of simulation to avoid real incident escalations.
- **Scope Drift**: if actions drift beyond approved objectives, seek stakeholder approval before proceeding.

## Outputs
- `docs/red-team/objectives-report.md`
- Evidence bundles under `evidence/` with accompanying logs in `reports/objectives/`
- Cleanup confirmation notes and stakeholder briefings.
