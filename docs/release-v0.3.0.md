# Null AI CLI v0.3.0 Release Notes

## Highlights

- Added `null-ai demo` for authorized training-lab assessments.
- Added `null-ai run show` and `null-ai run open` for saved workspace review.
- Added headless exit codes for CI usage.
- Added the public `web-lab` assessment skill.
- Improved scanner diagnostics for missing, timed-out, and nonzero scanner runs.
- Improved reports to distinguish confirmed findings, diagnostics, scanner observations, and inconclusive runs.
- Decoupled scan modes from runtime limits: quick/standard/deep now change model guidance only, under one global 300-turn safety ceiling.
- Added near-limit warnings, compact run context, and guaranteed partial closeout at the safety ceiling.
- Authorization confirmations default to Yes while still requiring the operator to confirm the declared scope.

## GitHub Topics

Recommended repository topics:

`ai-security`, `pentest`, `appsec`, `security-tools`, `owasp`, `sarif`, `compliance`, `typescript`, `cli`, `nullsquare`

## Managed Platform CTA

Null AI CLI is the open-source entry point. For hosted sandboxes, dashboards,
team workflows, evidence review, continuous testing, and enterprise reporting,
use [NullSquare](https://nullsquare.net).
