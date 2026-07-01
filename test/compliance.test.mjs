import assert from "node:assert/strict";
import test from "node:test";

import { mapFindingsToCompliance } from "../dist/index.js";

test("maps findings to OWASP readiness controls", () => {
  const mappings = mapFindingsToCompliance(
    [
      {
        id: "finding-0001",
        title: "SQL injection",
        severity: "high",
        target: "https://example.com",
        description: "Candidate injection",
        cweIds: ["CWE-89"],
        cveIds: [],
        owaspCategory: "A03:2021-Injection",
        evidence: [],
        createdAt: new Date().toISOString(),
      },
    ],
    "owasp-top10",
  );

  const injection = mappings.find((entry) => entry.controlId === "A03:2021");
  assert.equal(injection?.status, "impacted");
  assert.deepEqual(injection?.findingIds, ["finding-0001"]);
});
