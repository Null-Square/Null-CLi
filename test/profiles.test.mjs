import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  activateModelProfile,
  credentialStorePath,
  deleteModelProfile,
  listModelProfiles,
  loadModelProfile,
  masterKeyPath,
  profileStorePath,
  saveModelProfile,
} from "../dist/index.js";

test("model profiles persist metadata and encrypt API keys outside session state", async () => {
  const previousHome = process.env.NULL_AI_HOME;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "null-ai-profile-"));
  process.env.NULL_AI_HOME = home;
  const secret = "null-ai-test-secret";

  try {
    await saveModelProfile({
      name: "primary",
      model: "test-model",
      baseUrl: "https://models.example/v1",
      apiKey: secret,
    });
    await saveModelProfile({
      name: "secondary",
      model: "other-model",
      apiKey: "secondary-secret",
    });

    assert.equal((await listModelProfiles()).length, 2);
    const active = await loadModelProfile();
    assert.equal(active?.name, "secondary");
    assert.equal(active?.apiKey, "secondary-secret");

    const selected = await activateModelProfile("primary");
    assert.equal(selected.model, "test-model");
    assert.equal(selected.apiKey, secret);

    const profileJson = await fs.readFile(profileStorePath(), "utf8");
    const credentialJson = await fs.readFile(credentialStorePath(), "utf8");
    const masterKey = await fs.readFile(masterKeyPath(), "utf8");
    assert.doesNotMatch(profileJson, new RegExp(secret));
    assert.doesNotMatch(credentialJson, new RegExp(secret));
    assert.doesNotMatch(masterKey, new RegExp(secret));

    await deleteModelProfile("primary");
    assert.equal(await loadModelProfile("primary"), null);
  } finally {
    if (previousHome === undefined) delete process.env.NULL_AI_HOME;
    else process.env.NULL_AI_HOME = previousHome;
    await fs.rm(home, { recursive: true, force: true });
  }
});
