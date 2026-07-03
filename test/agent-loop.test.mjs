import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { defaultStepsForMode, runPublicAgent } from "../dist/index.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const withMockFetch = async (handler, run) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("live agent loop invokes tools and auto-attaches evidence artifacts", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-agent-loop-"));
  let modelCalls = 0;
  const events = [];

  const state = await withMockFetch(
    async (url, init) => {
      const requested = String(url);
      if (requested === "https://llm.example/v1/chat/completions") {
        modelCalls += 1;
        const body = JSON.parse(String(init.body));
        assert.equal(body.model, "test-model");
        if (modelCalls === 1) {
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    say: "I will check the homepage first and capture an HTTP artifact.",
                    tool: "http_request",
                    args: { url: "/" },
                    reason: "Capture landing page headers and body preview",
                  }),
                },
              },
            ],
          });
        }
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  say: "The homepage was captured successfully, so I will finish with no confirmed finding.",
                  final: {
                    summary: "Landing page checked with no confirmed finding.",
                    recommendation: "Review the captured HTTP artifact.",
                  },
                }),
              },
            },
          ],
        });
      }

      if (requested === "https://example.com/") {
        return new Response("<html><title>Example</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }

      throw new Error(`unexpected fetch: ${requested}`);
    },
    () =>
      runPublicAgent({
        target: "example.com",
        goal: "authorized smoke test",
        workspaceDir,
        apiKey: "test-key",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        scanMode: "quick",
        maxSteps: 3,
        onEvent: (event) => events.push(event),
      }),
  );

  assert.equal(modelCalls, 2);
  assert.equal(state.outcome, "complete");
  assert.equal(state.evidence.length, 1);
  assert.equal(state.evidence[0].kind, "http_exchange");
  assert.equal(state.actions.length, 2);
  assert.equal(state.actions[0].tool, "http_request");
  assert.equal(state.actions[0].say, "I will check the homepage first and capture an HTTP artifact.");
  assert.equal(state.actions[0].artifactPaths.length, 1);
  assert.equal(state.actions[1].tool, "finish_assessment");
  assert.equal(state.actions[1].say, "The homepage was captured successfully, so I will finish with no confirmed finding.");
  assert.equal(fs.existsSync(path.join(workspaceDir, state.evidence[0].path)), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, "reports", "report.md")), true);
  assert.equal(events.some((event) => event.type === "agent" && event.message.includes("homepage first")), true);
  assert.equal(events.some((event) => event.type === "tool" && event.tool === "http_request"), true);
  assert.deepEqual(
    events.filter((event) => event.type === "phase").map((event) => event.phase),
    ["planning", "discovery", "reporting"],
  );

  const report = fs.readFileSync(path.join(workspaceDir, "reports", "report.md"), "utf8");
  assert.match(report, /Outcome: complete/);
  assert.match(report, /Evidence artifacts: 1/);
  assert.match(report, /Agent actions: 2/);
  assert.match(report, /Agent: I will check the homepage first/);
  assert.match(report, /http_request - ok/);
});

test("live agent loop marks failed target coverage inconclusive with diagnostics", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-agent-loop-failed-"));
  let modelCalls = 0;

  const state = await withMockFetch(
    async (url) => {
      const requested = String(url);
      if (requested === "https://llm.example/v1/chat/completions") {
        modelCalls += 1;
        if (modelCalls === 1) {
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    say: "I will try to capture the homepage to verify reachability.",
                    tool: "http_request",
                    args: { url: "/" },
                    reason: "Capture target homepage",
                  }),
                },
              },
            ],
          });
        }
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  say: "The target could not be reached, so this run is inconclusive.",
                  final: { summary: "Target could not be reached." },
                }),
              },
            },
          ],
        });
      }

      if (requested === "https://broken.example/") {
        const cause = new Error("getaddrinfo ENOTFOUND broken.example");
        cause.code = "ENOTFOUND";
        throw new Error("fetch failed", { cause });
      }

      throw new Error(`unexpected fetch: ${requested}`);
    },
    () =>
      runPublicAgent({
        target: "broken.example",
        goal: "authorized smoke test",
        workspaceDir,
        apiKey: "test-key",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        scanMode: "quick",
        maxSteps: 3,
      }),
  );

  assert.equal(state.outcome, "inconclusive");
  assert.equal(state.actions[0].ok, false);
  assert.equal(state.actions[0].say, "I will try to capture the homepage to verify reachability.");
  assert.match(state.actions[0].message, /HTTP request failed/);
  assert.equal(state.actions[0].artifactPaths.length, 1);
  assert.equal(state.evidence.length, 1);
  const diagnostic = fs.readFileSync(path.join(workspaceDir, state.evidence[0].path), "utf8");
  assert.match(diagnostic, /ENOTFOUND/);
  const report = fs.readFileSync(path.join(workspaceDir, "reports", "report.md"), "utf8");
  assert.match(report, /Outcome: inconclusive/);
  assert.match(report, /not as a clean security result/);
  assert.match(report, /http_request - failed/);
});

test("live agent loop retries empty model content after tool diagnostics", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-agent-loop-empty-retry-"));
  let modelCalls = 0;

  const state = await withMockFetch(
    async (url) => {
      const requested = String(url);
      if (requested === "https://llm.example/v1/chat/completions") {
        modelCalls += 1;
        if (modelCalls === 1) {
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    say: "I will check target reachability before reporting anything.",
                    tool: "http_request",
                    args: { url: "/" },
                    reason: "Capture target homepage",
                  }),
                },
              },
            ],
          });
        }
        if (modelCalls === 2) {
          return jsonResponse({ choices: [{ message: {} }] });
        }
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  say: "The target could not be reached, so I will close this run as inconclusive.",
                  final: { summary: "Target DNS resolution failed." },
                }),
              },
            },
          ],
        });
      }

      if (requested === "https://broken.example/") {
        const cause = new Error("getaddrinfo ENOTFOUND broken.example");
        cause.code = "ENOTFOUND";
        throw new Error("fetch failed", { cause });
      }

      throw new Error(`unexpected fetch: ${requested}`);
    },
    () =>
      runPublicAgent({
        target: "broken.example",
        goal: "authorized smoke test",
        workspaceDir,
        apiKey: "test-key",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        scanMode: "quick",
        maxSteps: 3,
      }),
  );

  assert.equal(modelCalls, 3);
  assert.equal(state.outcome, "inconclusive");
  assert.equal(state.actions.length, 2);
  assert.equal(state.actions[0].tool, "http_request");
  assert.equal(state.actions[0].ok, false);
  assert.equal(state.actions[1].tool, "finish_assessment");
  assert.equal(state.actions[1].ok, true);

  const report = fs.readFileSync(path.join(workspaceDir, "reports", "report.md"), "utf8");
  assert.match(report, /Outcome: inconclusive/);
  assert.match(report, /not as a clean security result/);
});

test("live agent loop closes inconclusive when model content remains empty", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-agent-loop-empty-fail-"));
  let modelCalls = 0;
  const events = [];

  const state = await withMockFetch(
    async (url) => {
      const requested = String(url);
      if (requested === "https://llm.example/v1/chat/completions") {
        modelCalls += 1;
        return jsonResponse({ choices: [{ message: {} }] });
      }
      throw new Error(`unexpected fetch: ${requested}`);
    },
    () =>
      runPublicAgent({
        target: "example.com",
        goal: "authorized smoke test",
        workspaceDir,
        apiKey: "test-key",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        scanMode: "quick",
        maxSteps: 3,
        onEvent: (event) => events.push(event),
      }),
  );

  assert.equal(modelCalls, 2);
  assert.equal(state.outcome, "inconclusive");
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0].tool, "model_response");
  assert.equal(state.actions[0].ok, false);
  assert.match(state.actions[0].message, /empty response twice/);
  assert.equal(state.notes.some((note) => note.title === "Assessment summary"), true);
  assert.equal(events.some((event) => event.type === "tool" && event.tool === "model_response"), true);

  const report = fs.readFileSync(path.join(workspaceDir, "reports", "report.md"), "utf8");
  assert.match(report, /Model response unavailable/);
  assert.match(report, /Outcome: inconclusive/);
});

test("live agent loop can produce an evidence-backed finding", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-agent-loop-finding-"));
  let modelCalls = 0;

  const state = await withMockFetch(
    async (url) => {
      const requested = String(url);
      if (requested === "https://llm.example/v1/chat/completions") {
        modelCalls += 1;
        if (modelCalls === 1) {
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    say: "I will capture response headers before reporting any issue.",
                    tool: "http_request",
                    args: { url: "/" },
                    reason: "Capture target headers",
                  }),
                },
              },
            ],
          });
        }
        if (modelCalls === 2) {
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    say: "The response lacks HSTS, so I will report a low-severity lab finding with evidence.",
                    tool: "report_finding",
                    args: {
                      title: "Missing HSTS header on lab endpoint",
                      severity: "low",
                      description: "The captured response headers did not include Strict-Transport-Security.",
                      remediation: "Enable HSTS after validating HTTPS coverage.",
                      evidenceIds: ["evidence-0001"],
                      confidence: "medium",
                    },
                    reason: "Evidence-backed header finding",
                  }),
                },
              },
            ],
          });
        }
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  say: "The finding has evidence attached, so I will finish the assessment.",
                  final: { summary: "One low-severity evidence-backed finding was reported." },
                }),
              },
            },
          ],
        });
      }

      if (requested === "https://lab.example/") {
        return new Response("<html><title>Lab</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }

      throw new Error(`unexpected fetch: ${requested}`);
    },
    () =>
      runPublicAgent({
        target: "lab.example",
        goal: "authorized lab finding test",
        workspaceDir,
        apiKey: "test-key",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        scanMode: "quick",
        maxSteps: 4,
      }),
  );

  assert.equal(modelCalls, 3);
  assert.equal(state.outcome, "complete");
  assert.equal(state.findings.length, 1);
  assert.equal(state.findings[0].title, "Missing HSTS header on lab endpoint");
  assert.equal(state.findings[0].evidence.length, 1);
  const report = fs.readFileSync(path.join(workspaceDir, "reports", "report.md"), "utf8");
  assert.match(report, /Missing HSTS header/);
  assert.match(report, /Outcome: complete/);
});

test("scan modes share one runtime safety ceiling", () => {
  assert.equal(defaultStepsForMode("quick"), 300);
  assert.equal(defaultStepsForMode("standard"), 300);
  assert.equal(defaultStepsForMode("deep"), 300);
});

test("scan mode does not override the model's explicit completion", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-agent-loop-coverage-"));
  let modelCalls = 0;

  const state = await withMockFetch(
    async (url) => {
      const requested = String(url);
      if (requested === "https://llm.example/v1/chat/completions") {
        modelCalls += 1;
        if (modelCalls === 2) {
          return jsonResponse({
            choices: [{ message: { content: JSON.stringify({
              say: "The requested quick assessment is complete.",
              final: {
                summary: "The scoped quick check completed with no evidence-backed finding.",
                recommendation: "Review the captured HTTP artifacts.",
              },
            }) } }],
          });
        }
        return jsonResponse({
          choices: [{ message: { content: JSON.stringify({
            say: "I will capture the scoped public surface.",
            tool: "http_request",
            args: { url: "/" },
            reason: "Complete the model-selected quick coverage",
          }) } }],
        });
      }

      if (requested.startsWith("https://example.com/")) {
        return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
      }
      throw new Error(`unexpected fetch: ${requested}`);
    },
    () => runPublicAgent({
      target: "example.com",
      goal: "authorized quick assessment",
      workspaceDir,
      apiKey: "test-key",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      scanMode: "quick",
    }),
  );

  assert.equal(modelCalls, 2);
  assert.equal(state.outcome, "complete");
  assert.equal(state.actions.filter((action) => action.tool === "http_request").length, 1);
  assert.equal(state.actions.at(-1).tool, "finish_assessment");
  assert.match(
    fs.readFileSync(path.join(workspaceDir, "reports", "report.md"), "utf8"),
    /scoped quick check completed/,
  );
});

test("turn-budget exhaustion preserves evidence and writes an explicit partial conclusion", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-agent-loop-budget-"));
  let modelCalls = 0;

  const state = await withMockFetch(
    async (url) => {
      const requested = String(url);
      if (requested === "https://llm.example/v1/chat/completions") {
        modelCalls += 1;
        return jsonResponse({
          choices: [{ message: { content: JSON.stringify(
            modelCalls === 1
              ? { tool: "http_request", args: { url: "/" }, reason: "Capture target evidence" }
              : { tool: "create_note", args: { title: "Pending coverage", content: "More checks remain." } },
          ) } }],
        });
      }
      if (requested === "https://example.com/") {
        return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
      }
      throw new Error(`unexpected fetch: ${requested}`);
    },
    () => runPublicAgent({
      target: "example.com",
      goal: "authorized bounded assessment",
      workspaceDir,
      apiKey: "test-key",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      scanMode: "quick",
      maxSteps: 2,
    }),
  );

  assert.equal(modelCalls, 2);
  assert.equal(state.outcome, "inconclusive");
  assert.equal(state.evidence.length, 1);
  assert.equal(state.actions.at(-1).tool, "finish_assessment");
  assert.equal(state.notes.some((note) => note.title === "Assessment summary"), true);
  assert.equal(state.notes.some((note) => note.title === "No evidence captured"), false);

  const report = fs.readFileSync(path.join(workspaceDir, "reports", "report.md"), "utf8");
  assert.match(report, /reached its 2-turn limit/);
  assert.match(report, /Successful target evidence was captured/);
  assert.doesNotMatch(report, /did not capture successful target evidence/);
});

test("compliance mapping is exclusive to the compliance workflow", async () => {
  const pentestWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-pentest-flow-"));
  const complianceWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-compliance-flow-"));

  const pentest = await runPublicAgent({
    target: "example.com",
    goal: "authorized pentest",
    workspaceDir: pentestWorkspace,
    workflow: "pentest",
    dryRun: true,
  });
  const compliance = await runPublicAgent({
    target: "example.com",
    goal: "authorized readiness review",
    workspaceDir: complianceWorkspace,
    workflow: "compliance",
    framework: "iso27001-lite",
    dryRun: true,
  });

  assert.equal(pentest.complianceMappings.length, 0);
  assert.equal(compliance.complianceMappings.length > 0, true);
  assert.doesNotMatch(
    fs.readFileSync(path.join(pentestWorkspace, "reports", "report.md"), "utf8"),
    /Compliance Readiness Mapping/,
  );
  assert.match(
    fs.readFileSync(path.join(complianceWorkspace, "reports", "report.md"), "utf8"),
    /Compliance Readiness Mapping/,
  );
});
