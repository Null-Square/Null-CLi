import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cli = path.resolve("dist/cli/index.js");
const outDir = path.resolve(".null/e2e");
fs.rmSync(outDir, { recursive: true, force: true });
process.env.NULL_AI_HOME = path.join(outDir, "config");
process.env.NULL_AI_DISABLE_UPDATE_CHECK = "1";

const help = execFileSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
assert.match(help, /Null AI CLI/);
assert.match(help, /Version: 0\.2\.0/);

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
  ["Profile name", "default"],
  ["Model id", "test-model"],
  ["OpenAI-compatible base URL", "https://models.example/v1"],
  ["API key", wizardSecret],
  ["Workflow", "compliance"],
  ["Goal", "Review the authorized staging application"],
  ["Target URL/host/path", "https://staging.example"],
  ["Scope / rules of engagement", "Staging application only; production excluded"],
  ["Depth", "quick"],
  ["Framework", "iso27001-lite"],
  ["Enable scanners/shell", "n"],
  ["Confirm you have written authorization", "y"],
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
