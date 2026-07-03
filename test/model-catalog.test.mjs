import assert from "node:assert/strict";
import test from "node:test";

import {
  MODEL_PROVIDER_IDS,
  environmentApiKeyForProvider,
  isLikelyChatModel,
  isSupportedModelProviderId,
  modelFamilies,
  modelFamily,
  modelsForFamily,
  normalizeModelsUrl,
} from "../dist/index.js";

test("normalizes model endpoints and groups model families", () => {
  assert.equal(normalizeModelsUrl("https://api.example/v1/"), "https://api.example/v1/models");
  assert.equal(modelFamily("gpt-5-mini"), "OpenAI");
  assert.equal(modelFamily("anthropic/claude-sonnet"), "Anthropic");
  assert.equal(modelFamily("deepseek/deepseek-chat"), "DeepSeek");
  assert.equal(modelFamily("qwen/qwen3-coder"), "Qwen");
  assert.equal(modelFamily("moonshotai/kimi-k2"), "Moonshot");
  assert.equal(modelFamily("z-ai/glm-4.5"), "GLM");
  assert.equal(modelFamily("modelscope/qwen3-coder"), "Qwen");
  assert.deepEqual(
    modelFamilies([
      "gpt-5-mini",
      "anthropic/claude-sonnet",
      "deepseek/deepseek-chat",
      "qwen/qwen3-coder",
      "moonshotai/kimi-k2",
      "z-ai/glm-4.5",
      "modelscope/qwen3-coder",
    ]),
    ["OpenAI", "DeepSeek", "Qwen", "Anthropic", "Moonshot", "GLM"],
  );
  assert.deepEqual(modelsForFamily(["gpt-5-mini", "gpt-4.1-mini"], "OpenAI"), ["gpt-5-mini", "gpt-4.1-mini"]);
});

test("filters non-chat models from discovery results", () => {
  assert.equal(isLikelyChatModel("gpt-5-mini"), true);
  assert.equal(isLikelyChatModel("text-embedding-3-large"), false);
  assert.equal(isLikelyChatModel("gpt-image-1"), false);
});

test("model providers are restricted to approved first-party providers", () => {
  assert.deepEqual([...MODEL_PROVIDER_IDS], ["openai", "deepseek", "anthropic", "glm", "moonshot", "qwen"]);
  assert.equal(isSupportedModelProviderId("openai"), true);
  assert.equal(isSupportedModelProviderId("openrouter"), false);
  assert.equal(isSupportedModelProviderId("ollama"), false);
  assert.equal(environmentApiKeyForProvider("deepseek", { DEEPSEEK_API_KEY: "deepseek-key", OPENAI_API_KEY: "openai-key" }), "deepseek-key");
  assert.equal(environmentApiKeyForProvider("qwen", { DASHSCOPE_API_KEY: "dashscope-key" }), "dashscope-key");
});
