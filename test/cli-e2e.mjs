import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cli = path.resolve("dist/cli/index.js");
const outDir = path.resolve(".null/e2e");
fs.rmSync(outDir, { recursive: true, force: true });

const help = execFileSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
assert.match(help, /Null AI CLI/);
assert.match(help, /Version: 0\.1\.2/);

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
