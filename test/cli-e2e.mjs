import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const cli = path.resolve("dist/cli/index.js");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-e2e-"));
process.env.NULL_AI_HOME = path.join(outDir, "config");
process.env.NULL_AI_DISABLE_UPDATE_CHECK = "1";

const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const createMockLlmServer = (responses) => {
  let calls = 0;
  const server = http.createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = body ? JSON.parse(body) : {};
      const next = typeof responses === "function" ? responses(calls, parsed) : responses[calls];
      calls += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(next) } }] }));
    });
  });
  return { server, get calls() { return calls; } };
};

const runCli = (args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, options.timeoutMs ?? 20000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (status) => {
      clearTimeout(timeout);
      resolve({ status, stdout, stderr });
    });
  });

const help = execFileSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
assert.match(help, /Null AI CLI/);
assert.match(help, /Version: 0\.3\.0/);
assert.match(help, /null-ai demo/);

const demoHelp = execFileSync(process.execPath, [cli, "demo", "--help"], { encoding: "utf8" });
assert.match(demoHelp, /authorized training lab/i);
assert.match(demoHelp, /--authorize/);

const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-"));
try {
  const skills = execFileSync(process.execPath, [cli, "skills", "list"], { cwd: tempCwd, encoding: "utf8" });
  assert.match(skills, /scan-mode-standard/);
} finally {
  fs.rmSync(tempCwd, { recursive: true, force: true });
}

execFileSync(process.execPath, [
  cli,
  "agent",
  "run",
  "--target",
  "https://example.com",
  "--out",
  outDir,
  "--dry-run",
], { stdio: "inherit" });

assert.equal(fs.existsSync(path.join(outDir, "findings.json")), true);
assert.equal(fs.existsSync(path.join(outDir, "reports", "report.md")), true);
assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, "run-state.json"), "utf8")).complianceMappings.length, 0);

let refusedDemo = "";
try {
  execFileSync(process.execPath, [cli, "demo", "--target", "http://localhost:3000"], { encoding: "utf8", stdio: "pipe" });
  assert.fail("demo without --authorize should fail");
} catch (error) {
  refusedDemo = `${error.stdout ?? ""}${error.stderr ?? ""}`;
}
assert.match(refusedDemo, /Confirm you own or are authorized/);

const demoOut = path.join(outDir, "demo");
execFileSync(process.execPath, [
  cli,
  "demo",
  "--target",
  "http://localhost:3000",
  "--dry-run",
  "--out",
  demoOut,
], { stdio: "inherit" });
assert.equal(fs.existsSync(path.join(demoOut, "run-state.json")), true);
const demoState = JSON.parse(fs.readFileSync(path.join(demoOut, "run-state.json"), "utf8"));
assert.equal(demoState.outcome, "dry-run");
assert.match(demoState.goal, /authorized training lab/);
const runTrace = execFileSync(process.execPath, [cli, "run", "show", demoOut], { encoding: "utf8" });
assert.match(runTrace, /Run Trace/);
assert.match(runTrace, /Assessment Summary/);
assert.match(runTrace, /report/);

const targetServer = http.createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html" });
  response.end("<html><title>Authorized Lab</title><body>demo lab</body></html>");
});
const targetPort = await listen(targetServer);
const liveLlm = createMockLlmServer([
  {
    say: "I will capture the lab homepage headers before reporting anything.",
    tool: "http_request",
    args: { url: "/" },
    reason: "Capture target status, headers, and page metadata",
  },
  {
    say: "The captured lab response lacks HSTS, so I will report a low-severity evidence-backed finding.",
    tool: "report_finding",
    args: {
      title: "Missing HSTS header on lab endpoint",
      severity: "low",
      description: "The captured response headers did not include Strict-Transport-Security.",
      remediation: "Enable HSTS after HTTPS coverage is validated.",
      evidenceIds: ["evidence-0001"],
      confidence: "medium",
    },
    reason: "Evidence-backed header observation",
  },
  {
    say: "The finding has evidence attached, so I will finish the demo assessment.",
    final: { summary: "One low-severity evidence-backed finding was reported." },
  },
]);
const liveLlmPort = await listen(liveLlm.server);
const liveDemoOut = path.join(outDir, "demo-live");
try {
  const liveDemo = await runCli([
    "demo",
    "--target",
    `http://127.0.0.1:${targetPort}`,
    "--authorize",
    "--out",
    liveDemoOut,
    "--api-key",
    "test-key",
    "--base-url",
    `http://127.0.0.1:${liveLlmPort}/v1`,
    "--model",
    "test-model",
    "--scan-mode",
    "quick",
  ]);
  assert.equal(liveDemo.status, 2, `${liveDemo.stdout}\n${liveDemo.stderr}`);
  assert.match(`${liveDemo.stdout}\n${liveDemo.stderr}`, /Missing HSTS|evidence-backed finding/i);
  assert.match(`${liveDemo.stdout}\n${liveDemo.stderr}`, /phase.*discovery/is);
  assert.match(`${liveDemo.stdout}\n${liveDemo.stderr}`, /phase.*reporting/is);
  assert.doesNotMatch(`${liveDemo.stdout}\n${liveDemo.stderr}`, /step \d+\/300/i);
  assert.equal(liveLlm.calls, 3);
  const liveState = JSON.parse(fs.readFileSync(path.join(liveDemoOut, "run-state.json"), "utf8"));
  assert.equal(liveState.outcome, "complete");
  assert.equal(liveState.findings.length, 1);
  assert.equal(liveState.findings[0].evidence.length, 1);
  const liveReport = fs.readFileSync(path.join(liveDemoOut, "reports", "report.md"), "utf8");
  assert.match(liveReport, /Missing HSTS header/);
  assert.match(liveReport, /Outcome: complete/);
} finally {
  await closeServer(targetServer);
  await closeServer(liveLlm.server);
}

const closedPortServer = http.createServer();
const closedPort = await listen(closedPortServer);
await closeServer(closedPortServer);
const inconclusiveLlm = createMockLlmServer([
  {
    say: "I will check reachability before reporting any issue.",
    tool: "http_request",
    args: { url: "/" },
    reason: "Confirm target reachability",
  },
  {
    say: "The target could not be reached, so this demo run is inconclusive.",
    final: {
      summary: "Target connection failed; no successful target evidence was captured.",
      recommendation: "Verify the authorized lab is running, then rerun the demo.",
    },
  },
]);
const inconclusiveLlmPort = await listen(inconclusiveLlm.server);
const inconclusiveOut = path.join(outDir, "demo-inconclusive");
try {
  const inconclusiveDemo = await runCli([
    "demo",
    "--target",
    `http://127.0.0.1:${closedPort}`,
    "--authorize",
    "--out",
    inconclusiveOut,
    "--api-key",
    "test-key",
    "--base-url",
    `http://127.0.0.1:${inconclusiveLlmPort}/v1`,
    "--model",
    "test-model",
    "--scan-mode",
    "quick",
  ]);
  assert.equal(inconclusiveDemo.status, 3, `${inconclusiveDemo.stdout}\n${inconclusiveDemo.stderr}`);
  assert.match(`${inconclusiveDemo.stdout}\n${inconclusiveDemo.stderr}`, /assessment inconclusive/i);
  assert.match(`${inconclusiveDemo.stdout}\n${inconclusiveDemo.stderr}`, /Target connection failed/i);
  const inconclusiveState = JSON.parse(fs.readFileSync(path.join(inconclusiveOut, "run-state.json"), "utf8"));
  assert.equal(inconclusiveState.outcome, "inconclusive");
  assert.equal(inconclusiveState.actions[0].ok, false);
  const inconclusiveReport = fs.readFileSync(path.join(inconclusiveOut, "reports", "report.md"), "utf8");
  assert.match(inconclusiveReport, /Outcome: inconclusive/);
  assert.match(inconclusiveReport, /Target connection failed/);
} finally {
  await closeServer(inconclusiveLlm.server);
}

execFileSync(process.execPath, [
  cli,
  "ingest",
  "examples/nuclei.jsonl",
  "--out",
  path.join(outDir, "ingested-findings.json"),
], { stdio: "inherit" });

assert.equal(fs.existsSync(path.join(outDir, "ingested-findings.json")), true);

const interactiveOut = path.join(outDir, "interactive");
const blocked = execFileSync(process.execPath, [cli, "interactive", "--out", interactiveOut], {
  input: [
    "/target https://app.example",
    "/scope Authorized staging app test",
    "/mode compliance",
    "/depth quick",
    "/shell on",
    "/run",
    "/exit",
    "",
  ].join("\n"),
  encoding: "utf8",
});

assert.match(blocked, /Confirm you are authorized/);
const interactiveSession = JSON.parse(fs.readFileSync(path.join(interactiveOut, "session.json"), "utf8"));
assert.equal(interactiveSession.workflow, "compliance");
assert.equal(interactiveSession.scanMode, "quick");
assert.equal(interactiveSession.authorized, false);
assert.equal(fs.existsSync(path.join(interactiveOut, "findings.json")), false);

const keyOut = path.join(outDir, "interactive-key");
const secret = "test-secret-key-should-not-persist";
execFileSync(process.execPath, [cli, "interactive", "--out", keyOut], {
  input: [
    `/env key ${secret}`,
    "/target https://app.example",
    "/authorize",
    "/exit",
    "",
  ].join("\n"),
  encoding: "utf8",
});
const persisted = fs.readFileSync(path.join(keyOut, "session.json"), "utf8");
assert.doesNotMatch(persisted, new RegExp(secret));
assert.equal(JSON.parse(persisted).authorized, false);

const wizardOut = path.join(outDir, "wizard");
const wizardSecret = "wizard-secret-should-be-encrypted";
const runPromptedSession = async (steps) => {
  const child = spawn(process.execPath, [cli, "interactive", "--out", wizardOut], {
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  let cursor = 0;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  const waitFor = async (text) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const index = output.indexOf(text, cursor);
      if (index >= 0) {
        cursor = index + text.length;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for "${text}". Output:\n${output}`);
  };

  for (const [prompt, answer] of steps) {
    await waitFor(prompt);
    child.stdin.write(`${answer}\n`);
  }
  child.stdin.end();
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(exitCode, 0, output);
  return output;
};

const wizard = await runPromptedSession([
  ["null-ai >", "/wizard"],
  ["Provider", "openai"],
  ["Profile name", "default"],
  ["Model id", "test-model"],
  ["OpenAI-compatible base URL", "https://models.example/v1"],
  ["API key", wizardSecret],
  ["Workflow", "compliance"],
  ["Target URL/host/path", "https://staging.example"],
  ["Goal", "Review the authorized staging application"],
  ["Scope summary", "Staging application only; production excluded"],
  ["Add advanced scope details", "n"],
  ["Depth", "quick"],
  ["Framework", "iso27001-lite"],
  ["Enable scanners/shell", "n"],
  ["Confirm you have written authorization", ""],
  ["Start assessment now", "n"],
  ["null-ai >", "/exit"],
]);
assert.match(wizard, /profile "default" saved/);
assert.match(wizard, /assessment saved and ready/);
const wizardSession = JSON.parse(fs.readFileSync(path.join(wizardOut, "session.json"), "utf8"));
assert.equal(wizardSession.profile, "default");
assert.equal(wizardSession.workflow, "compliance");
assert.equal(wizardSession.targets[0], "https://staging.example");
assert.equal(wizardSession.authorized, true);
assert.doesNotMatch(JSON.stringify(wizardSession), new RegExp(wizardSecret));
const credentialVault = fs.readFileSync(path.join(outDir, "config", "credentials.json"), "utf8");
assert.doesNotMatch(credentialVault, new RegExp(wizardSecret));
