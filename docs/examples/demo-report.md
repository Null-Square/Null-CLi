# Null CLI Assessment Report

> Sanitized example generated from an authorized local training lab. This is not
> a compliance certification.

## Scope

- Target: http://localhost:3000
- Goal: Run a shallow, evidence-first assessment of an authorized training lab.
- Started: 2026-07-02T00:00:00.000Z
- Finished: 2026-07-02T00:01:00.000Z

## Executive Summary

Outcome: complete. 1 finding(s) reported. Highest severity: low. Evidence
artifacts: 3. Agent actions: 5.

## Assessment Summary

The local lab was reachable. Null AI captured HTTP metadata, checked common
public files, attached raw artifacts, and reported one low-severity
evidence-backed issue suitable for demo purposes.

## Findings

### finding-0001: Missing HSTS header on lab endpoint

- Severity: low
- Confidence: medium
- Target: http://localhost:3000
- CWE: Not mapped
- CVE: Not mapped
- OWASP: Not mapped

**Description**

The HTTP response did not include a Strict-Transport-Security header.

**Impact**

Browsers may not enforce HTTPS-only access after first contact.

**Remediation**

Enable HSTS in production deployments after validating HTTPS coverage.

**Evidence**

- evidence-0001: HTTP response headers (artifacts/http-headers.json)

## Evidence

- evidence-0001: HTTP response headers (http_exchange, target evidence) - artifacts/http-headers.json
- evidence-0002: robots.txt capture (http_exchange, target evidence) - artifacts/robots.json
- evidence-0003: httpx scanner output (scanner_artifact, scanner observation) - artifacts/scans/httpx.json

## Agent Activity

- action-0001: step 1 create_note - ok (note created). Agent: I will outline a safe lab assessment plan.
- action-0002: step 2 http_request - ok (HTTP request completed). Artifacts: artifacts/http-headers.json.
- action-0003: step 3 http_request - ok (HTTP request completed). Artifacts: artifacts/robots.json.
- action-0004: step 4 report_finding - ok (finding reported).
- action-0005: step 5 finish_assessment - ok (assessment finished).

## Compliance Readiness Mapping

Readiness mapping is generated from confirmed findings only.

## Notes

This example is sanitized and intentionally shallow.
