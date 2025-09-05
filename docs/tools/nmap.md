# Nmap Tool (`nmap_scan`)

Runs a constrained Nmap scan against a single explicit target. Use this to validate your environment and test tool-calling with a standard recon utility.

- Always asks for confirmation before executing.
- Allowed options: `-Pn`, `-sV`, `-p <ports>`, `--top-ports <N>`, `-T2`/`-T3`/`-T4`.
- Single target only (hostname or IP). No wildcards.
- Output is returned as plain text.

## Examples

Basic service discovery (skip ping):

```
/ask Run a quick scan on localhost using the Nmap tool.
```

The model might call:

```
Tool: nmap_scan
{
  "target": "127.0.0.1",
  "service_detection": true,
  "ping_skip": true,
  "top_ports": 100,
  "timing": "T3"
}
```

Specific ports:

```
Tool: nmap_scan
{
  "target": "example.com",
  "ports": "22,80,443",
  "service_detection": true
}
```

## Notes

- Ensure `nmap` is installed and available on your PATH.
- Scan only hosts and networks you have permission to test.
- For broader or custom scans, prefer `/shell` with explicit user confirmation.

