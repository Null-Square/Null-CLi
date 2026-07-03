# Demo Flow

`null-ai demo` is the fastest way to see Null AI CLI produce a traceable local
assessment. It is designed for targets you own or are explicitly authorized to
test, such as a local OWASP Juice Shop or WebGoat lab.

Null AI does not ship a hardcoded public vulnerable target. Public lab URLs can
change, disappear, or prohibit automated scanning. You provide the target and
confirm authorization.

## Run A Local Lab

Example with OWASP Juice Shop:

```bash
docker run --rm -p 3000:3000 bkimminich/juice-shop
```

Then run the demo:

```bash
null-ai demo --target http://localhost:3000 --authorize --out .null/demo
```

For scanner-backed evidence, install the scanner tools locally or use your own
sandbox runtime, then opt in:

```bash
null-ai demo --target http://localhost:3000 --authorize --allow-shell --out .null/demo
```

## Review The Result

```bash
null-ai run show .null/demo
null-ai run open .null/demo
```

The workspace contains:

```text
.null/demo/
  run-state.json
  findings.json
  findings.sarif
  reports/report.md
  artifacts/
```

The terminal summary and Markdown report distinguish confirmed findings,
diagnostic evidence, scanner observations, and inconclusive runs.

## Scanner Artifacts

Normalize scanner artifacts from the demo workspace:

```bash
null-ai ingest .null/demo/artifacts/scans --out .null/demo/findings-from-scanners.json
```

Supported finding normalization currently includes `nuclei`, `semgrep`, and
`trivy`. `httpx` output is kept as scanner observation evidence by default.

## Example Outputs

- [Sanitized demo report](examples/demo-report.md)
- [Sanitized terminal trace](examples/demo-trace.txt)

## Managed Platform

Null AI CLI is the open-source entry point. For hosted sandboxes, dashboards,
team workflows, evidence review, continuous testing, and enterprise reporting,
use [NullSquare](https://nullsquare.net).
