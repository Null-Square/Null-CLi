#!/usr/bin/env sh
set -eu

MANIFEST="${1:-/opt/null-cli/sandbox/tools-manifest.json}"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required for manifest smoke"
  exit 1
fi

node - "$MANIFEST" <<'NODE'
const fs = require("fs");
const { execSync } = require("child_process");
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let failed = 0;
for (const entry of manifest) {
  try {
    const output = execSync(entry.command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20000 });
    const ok = new RegExp(entry.expect, "i").test(output);
    console.log(`${ok ? "PASS" : "FAIL"} ${entry.name}`);
    if (!ok) failed += 1;
  } catch (error) {
    console.log(`FAIL ${entry.name}`);
    failed += 1;
  }
}
process.exit(failed === 0 ? 0 : 1);
NODE
