import assert from "node:assert/strict";
import test from "node:test";

import { calculateCvss, deriveOwaspCategory, normalizeCweIds } from "../dist/index.js";

test("calculates CVSS v3.1 base score", () => {
  const result = calculateCvss({
    attackVector: "N",
    attackComplexity: "L",
    privilegesRequired: "N",
    userInteraction: "N",
    scope: "U",
    confidentiality: "H",
    integrity: "H",
    availability: "H",
  });

  assert.equal(result.score, 9.8);
  assert.equal(result.severity, "critical");
});

test("normalizes CWE IDs and maps OWASP category", () => {
  const cwes = normalizeCweIds(["79", "CWE-89", "cwe-79"]);
  assert.deepEqual(cwes, ["CWE-79", "CWE-89"]);
  assert.equal(deriveOwaspCategory(cwes), "A03:2021-Injection");
});
