import assert from "node:assert/strict";
import test from "node:test";

import { exitCodeForState, exitCodeForStates, renderRunTrace } from "../dist/cli/runView.js";

const baseState = (overrides = {}) => ({
  target: "http://localhost:3000",
  goal: "authorized lab assessment",
  workspaceDir: ".null/demo",
  findings: [],
  evidence: [],
  notes: [
    {
      id: "note-0001",
      title: "Assessment summary",
      content: "Demo assessment completed with no confirmed findings.",
      category: "general",
      createdAt: "2026-07-02T00:00:00.000Z",
    },
  ],
  actions: [],
  complianceMappings: [],
  outcome: "complete",
  completed: true,
  startedAt: "2026-07-02T00:00:00.000Z",
  finishedAt: "2026-07-02T00:00:01.000Z",
  ...overrides,
});

test("run trace renders outcome, summary, evidence, actions, and report path", () => {
  const trace = renderRunTrace(
    baseState({
      evidence: [
        {
          id: "evidence-0001",
          title: "HTTP artifact",
          kind: "http_exchange",
          path: "artifacts/http.json",
          createdAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      actions: [
        {
          id: "action-0001",
          step: 1,
          tool: "http_request",
          ok: true,
          say: "I will capture the landing page.",
          message: "HTTP request completed",
          artifactPaths: ["artifacts/http.json"],
          createdAt: "2026-07-02T00:00:00.000Z",
        },
      ],
    }),
    ".null/demo",
  );

  assert.match(trace, /Run Trace/);
  assert.match(trace, /Assessment Summary/);
  assert.match(trace, /Demo assessment completed/);
  assert.match(trace, /Evidence \(1\)/);
  assert.match(trace, /Agent Activity \(1\)/);
  assert.match(trace, /reports[\\/]report\.md/);
});

test("headless exit codes map outcomes and findings", () => {
  assert.equal(exitCodeForState(baseState()), 0);
  assert.equal(exitCodeForState(baseState({ findings: [{ title: "finding" }], outcome: "complete" })), 2);
  assert.equal(exitCodeForState(baseState({ outcome: "inconclusive" })), 3);
  assert.equal(exitCodeForStates([baseState(), baseState({ findings: [{ title: "finding" }], outcome: "complete" })]), 2);
  assert.equal(exitCodeForStates([baseState({ findings: [{ title: "finding" }], outcome: "complete" }), baseState({ outcome: "inconclusive" })]), 3);
});
