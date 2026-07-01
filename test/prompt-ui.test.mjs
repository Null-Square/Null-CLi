import assert from "node:assert/strict";
import test from "node:test";

import { password, search } from "@inquirer/prompts";
import { render } from "@inquirer/testing";

test("API-key prompt stays visible while the secret is masked", async () => {
  const secret = "visible-prompt-hidden-secret";
  const { answer, events, getScreen } = await render(password, {
    message: "API key",
    mask: "*",
    validate: (value) => Boolean(value.trim()) || "API key is required.",
  });

  assert.match(getScreen(), /API key/);
  events.type(secret);
  assert.match(getScreen(), /\*{8,}/);
  assert.doesNotMatch(getScreen(), new RegExp(secret));
  events.keypress("enter");
  assert.equal(await answer, secret);
});

test("slash command search filters interactively and selects with Enter", async () => {
  const choices = [
    { name: "/wizard", value: "wizard", description: "New assessment" },
    { name: "/status", value: "status", description: "Review configuration" },
    { name: "/report", value: "report", description: "Show report" },
  ];
  const { answer, events, getScreen } = await render(search, {
    message: "Null AI command",
    source: (term) => {
      const query = (term ?? "").replace(/^\//, "").toLowerCase();
      return choices.filter((choice) => choice.name.slice(1).includes(query));
    },
  });

  events.type("/sta");
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(getScreen(), /\/status/);
  assert.doesNotMatch(getScreen(), /\/wizard/);
  events.keypress("enter");
  assert.equal(await answer, "status");
});
