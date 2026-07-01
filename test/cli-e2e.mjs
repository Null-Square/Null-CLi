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
assert.match(help, /Version: 0\.1\.0/);

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
