import assert from "node:assert/strict";
import test from "node:test";

import { renderMarkdownReport } from "../dist/index.js";
import { normalizeScopedHttpUrl } from "../dist/tools/httpRequest.js";

test("normalizes host-only and relative scoped URLs", () => {
  assert.equal(normalizeScopedHttpUrl("example.com", "example.com"), "https://example.com");
  assert.equal(normalizeScopedHttpUrl("example.com", "/robots.txt"), "https://example.com/robots.txt");
  assert.equal(normalizeScopedHttpUrl("https://app.example/base", "/login"), "https://app.example/login");
  assert.equal(normalizeScopedHttpUrl("example.com", "https://example.com/a"), "https://example.com/a");
});

test("markdown report includes evidence and agent activity", () => {
  const report = renderMarkdownReport({
    target: "https://example.com",
    goal: "authorized test",
    workspaceDir: ".null/test",
    findings: [],
    evidence: [
      {
        id: "evidence-0001",
        title: "http_request artifact from step 1",
        kind: "http_exchange",
        path: "artifacts/http-1.json",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    notes: [],
    actions: [
      {
        id: "action-0001",
        step: 1,
        tool: "http_request",
        ok: true,
        say: "I will capture the homepage before making any finding claims.",
        message: "HTTP request completed",
        reason: "Check landing page",
        artifactPaths: ["artifacts/http-1.json"],
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    complianceMappings: [],
    outcome: "complete",
    completed: true,
    startedAt: "2026-07-01T00:00:00.000Z",
    finishedAt: "2026-07-01T00:00:01.000Z",
  });

  assert.match(report, /## Evidence/);
  assert.match(report, /## Assessment Summary/);
  assert.match(report, /did not report any evidence-backed findings/);
  assert.match(report, /evidence-0001/);
  assert.match(report, /## Agent Activity/);
  assert.match(report, /action-0001: step 1 http_request - ok/);
  assert.match(report, /Agent: I will capture the homepage/);
});
