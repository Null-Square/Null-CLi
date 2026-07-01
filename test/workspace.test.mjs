import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveWorkspacePath } from "../dist/index.js";

test("workspace resolver rejects traversal", () => {
  const workspace = path.resolve(".null/test-workspace");
  assert.throws(() => resolveWorkspacePath(workspace, "../outside"), /escapes workspace/);
});
