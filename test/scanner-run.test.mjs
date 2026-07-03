import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createAssessmentState } from "../dist/index.js";
import { scannerRunTool } from "../dist/tools/scannerRun.js";

test("scanner_run writes diagnostic artifact when scanner command fails", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "null-cli-scanner-fail-"));
  const previousPath = process.env.PATH;
  process.env.PATH = "";
  try {
    const state = createAssessmentState("https://example.com", "scanner diagnostic test", workspaceDir);
    const result = await scannerRunTool.handler(
      { scanner: "httpx" },
      {
        state,
        allowShell: true,
        log: () => undefined,
      },
    );

    assert.equal(result.ok, false);
    assert.match(result.message, /scanner httpx failed/);
    assert.equal(Array.isArray(result.data.artifactPaths), true);
    assert.equal(result.data.artifactPaths.length, 1);
    const diagnosticPath = path.join(workspaceDir, result.data.artifactPaths[0]);
    assert.equal(fs.existsSync(diagnosticPath), true);
    const diagnostic = fs.readFileSync(diagnosticPath, "utf8");
    assert.match(diagnostic, /"scanner": "httpx"/);
    assert.match(diagnostic, /"rawArtifactPath": null/);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
});
