---
slug: web-lab
name: Web lab assessment
description: Evidence-first shallow assessment flow for authorized training labs.
category: assessment
---

Use this public skill for authorized web security training labs such as a user-hosted OWASP Juice Shop or WebGoat instance.

Boundaries:
- Stay inside the declared target and scope.
- Do not brute force credentials, attempt denial of service, persist access, or chain exploits.
- Treat scanner output as evidence that still needs clear reporting context.
- Report only simple, evidence-backed issues. Use notes for observations and inconclusive checks.

Recommended flow:
1. Create a short plan note naming the target and safety boundaries.
2. Confirm reachability with `browser_action` or `http_request`.
3. Capture landing page metadata and response headers.
4. Check common public files: `/robots.txt`, `/sitemap.xml`, and `/.well-known/security.txt`.
5. If scanner tools are enabled, run conservative `httpx` first, then `nuclei` only when the target is a lab and authorization is explicit.
6. Attach artifacts before reporting any finding.
7. Finish with a clear conclusion: confirmed findings, no evidence-backed findings, or inconclusive with the blocking reason.

Good public findings:
- Missing or weak security headers when shown by HTTP evidence.
- Exposed diagnostic or public metadata files.
- Scanner-confirmed low/medium lab issues with raw artifact evidence.

Avoid:
- Credential stuffing, forced browsing at high volume, destructive payloads, exploit chaining, or advanced validation.
- Claims that a target is secure because shallow checks found no issue.
