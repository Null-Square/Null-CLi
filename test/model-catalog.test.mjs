import assert from "node:assert/strict";
import test from "node:test";

import {
  isLikelyChatModel,
  modelFamilies,
  modelFamily,
  modelsForFamily,
  normalizeModelsUrl,
} from "../dist/index.js";

test("normalizes model endpoints and groups model families", () => {
  assert.equal(normalizeModelsUrl("https://api.example/v1/"), "https://api.example/v1/models");
  assert.equal(modelFamily("gpt-5-mini"), "GPT-5");
  assert.equal(modelFamily("anthropic/claude-sonnet"), "anthropic");
  assert.deepEqual(modelFamilies(["gpt-5-mini", "gpt-4.1-mini", "gpt-5.2"]), ["GPT-4.1", "GPT-5"]);
  assert.deepEqual(modelsForFamily(["gpt-5-mini", "gpt-4.1-mini"], "GPT-5"), ["gpt-5-mini"]);
});

test("filters non-chat models from discovery results", () => {
  assert.equal(isLikelyChatModel("gpt-5-mini"), true);
  assert.equal(isLikelyChatModel("text-embedding-3-large"), false);
  assert.equal(isLikelyChatModel("gpt-image-1"), false);
});
