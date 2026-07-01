import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkForCliUpdate, isNewerVersion } from "../dist/index.js";

test("compares stable semantic versions", () => {
  assert.equal(isNewerVersion("0.1.2", "0.2.0"), true);
  assert.equal(isNewerVersion("1.4.0", "1.3.9"), false);
  assert.equal(isNewerVersion("1.0.0", "1.0.0"), false);
  assert.equal(isNewerVersion("invalid", "2.0.0"), false);
});

test("reports a newer npm version from the local update cache", async () => {
  const previousHome = process.env.NULL_AI_HOME;
  const previousDisabled = process.env.NULL_AI_DISABLE_UPDATE_CHECK;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "null-ai-update-"));
  process.env.NULL_AI_HOME = home;
  delete process.env.NULL_AI_DISABLE_UPDATE_CHECK;

  try {
    await fs.writeFile(
      path.join(home, "update-check.json"),
      `${JSON.stringify({ checkedAt: Date.now(), latest: "9.9.9" })}\n`,
      "utf8",
    );
    const update = await checkForCliUpdate();
    assert.equal(update?.latest, "9.9.9");
    assert.match(update?.current ?? "", /^\d+\.\d+\.\d+$/);
  } finally {
    if (previousHome === undefined) delete process.env.NULL_AI_HOME;
    else process.env.NULL_AI_HOME = previousHome;
    if (previousDisabled === undefined) delete process.env.NULL_AI_DISABLE_UPDATE_CHECK;
    else process.env.NULL_AI_DISABLE_UPDATE_CHECK = previousDisabled;
    await fs.rm(home, { recursive: true, force: true });
  }
});
