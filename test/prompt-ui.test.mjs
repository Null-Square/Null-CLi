import assert from "node:assert/strict";
import test from "node:test";

import { password, search, select } from "@inquirer/prompts";
import { render } from "@inquirer/testing";
import { homeMenuChoices, workflowUsesCompliance } from "../dist/cli/interactive.js";

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

test("home menu exposes separate pentest and compliance journeys", () => {
  const fresh = homeMenuChoices(false);
  const resumed = homeMenuChoices(true);

  assert.equal(fresh.some((choice) => choice.value === "pentest"), true);
  assert.equal(fresh.some((choice) => choice.value === "compliance"), true);
  assert.equal(fresh.some((choice) => choice.value === "resume"), false);
  assert.equal(resumed.some((choice) => choice.value === "resume"), true);
  assert.equal(workflowUsesCompliance("pentest"), false);
  assert.equal(workflowUsesCompliance("compliance"), true);
});

test("home menu renders primary actions before advanced commands", async () => {
  const { answer, events, getScreen } = await render(select, {
    message: "Home",
    choices: homeMenuChoices(false),
    loop: false,
  });

  assert.match(getScreen(), /New pentest/);
  assert.match(getScreen(), /Compliance readiness/);
  assert.match(getScreen(), /Results and reports/);
  assert.match(getScreen(), /Advanced commands/);
  events.keypress("enter");
  assert.equal(await answer, "pentest");
});
