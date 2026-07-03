import assert from "node:assert/strict";
import test from "node:test";

import { createChatCompletion, preferMaxCompletionTokens } from "../dist/llm/openaiCompatible.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const withMockFetch = async (handler, run) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("OpenAI models prefer max_completion_tokens", () => {
  assert.equal(preferMaxCompletionTokens("gpt-5-mini", "https://api.openai.com/v1"), true);
  assert.equal(preferMaxCompletionTokens("deepseek-chat", "https://api.deepseek.example/v1"), false);
});

test("retries with max_completion_tokens when a model rejects max_tokens", async () => {
  const bodies = [];
  let calls = 0;
  const result = await withMockFetch(
    async (_url, init) => {
      bodies.push(JSON.parse(String(init.body)));
      calls += 1;
      if (calls === 1) {
        return jsonResponse(
          { error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } },
          400,
        );
      }
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    },
    () =>
      createChatCompletion({
        apiKey: "test-key",
        baseUrl: "https://gateway.example/v1",
        model: "deepseek-chat",
        maxTokens: 77,
        messages: [{ role: "user", content: "hello" }],
      }),
  );

  assert.equal(result, "ok");
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].max_tokens, 77);
  assert.equal(bodies[0].max_completion_tokens, undefined);
  assert.equal(bodies[1].max_tokens, undefined);
  assert.equal(bodies[1].max_completion_tokens, 77);
});

test("retries without temperature when a model rejects custom temperature", async () => {
  const bodies = [];
  let calls = 0;
  const result = await withMockFetch(
    async (_url, init) => {
      bodies.push(JSON.parse(String(init.body)));
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ error: { message: "Unsupported value: 'temperature' is not supported with this model." } }, 400);
      }
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    },
    () =>
      createChatCompletion({
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5-mini",
        messages: [{ role: "user", content: "hello" }],
      }),
  );

  assert.equal(result, "ok");
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].temperature, 0.2);
  assert.equal("temperature" in bodies[1], false);
  assert.equal(bodies[1].max_completion_tokens, 1200);
});
