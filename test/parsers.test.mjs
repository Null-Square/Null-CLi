import assert from "node:assert/strict";
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
