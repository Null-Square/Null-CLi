# Compliance Readiness

Null CLI provides lightweight compliance readiness mapping. It does not provide certification, attestation, or legal advice.

Supported public frameworks:

- `owasp-top10`
- `pci-dss-lite`
- `iso27001-lite`
- `nist-csf-lite`

The mapper uses finding metadata such as severity, CWE, CVE, and OWASP category. Missing evidence stays `no_evidence`.

Example:

```bash
node dist/cli/index.js compliance map findings.json --framework iso27001-lite --out iso27001-readiness.json
```
