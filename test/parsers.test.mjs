import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseScannerPath } from "../dist/index.js";

test("parses nuclei jsonl artifacts", async () => {
  const findings = await parseScannerPath(path.resolve("examples/nuclei.jsonl"));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "low");
  assert.equal(findings[0].cweIds[0], "CWE-16");
  assert.equal(findings[0].owaspCategory, "A05:2021-Security Misconfiguration");
});

test("keeps httpx scanner output as observation evidence, not findings", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "null-cli-httpx-"));
  try {
    const artifact = path.join(dir, "httpx.json");
    await fs.writeFile(
      artifact,
      `${JSON.stringify({ url: "https://example.com", status_code: 200, title: "Example", tech: ["nginx"] })}\n`,
      "utf8",
    );
    const findings = await parseScannerPath(artifact);
    assert.equal(findings.length, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
