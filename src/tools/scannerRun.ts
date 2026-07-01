import fs from "node:fs/promises";
import path from "node:path";

import { resolveWorkspacePath } from "../runtime/workspace.js";
import { runShellCommand } from "./shellRun.js";
import type { ToolDefinition } from "./toolTypes.js";
import { failure, optionalString, requireString, success } from "./toolTypes.js";

type ScannerName = "httpx" | "nuclei" | "katana" | "nmap" | "semgrep" | "trivy" | "gitleaks";

const SCANNER_COMMANDS: Record<ScannerName, (target: string, outputPath: string) => string> = {
  httpx: (target, outputPath) => `httpx -u ${JSON.stringify(target)} -json -silent -o ${JSON.stringify(outputPath)}`,
  nuclei: (target, outputPath) =>
    `nuclei -u ${JSON.stringify(target)} -jsonl -severity low,medium,high,critical -no-color -o ${JSON.stringify(outputPath)}`,
  katana: (target, outputPath) => `katana -u ${JSON.stringify(target)} -jsonl -silent -d 2 -o ${JSON.stringify(outputPath)}`,
  nmap: (target, outputPath) => `nmap -oX ${JSON.stringify(outputPath)} ${JSON.stringify(target)}`,
  semgrep: (target, outputPath) =>
    `semgrep --config auto --json --output ${JSON.stringify(outputPath)} ${JSON.stringify(target)}`,
  trivy: (target, outputPath) => `trivy fs --format json --output ${JSON.stringify(outputPath)} ${JSON.stringify(target)}`,
  gitleaks: (target, outputPath) => `gitleaks detect --source ${JSON.stringify(target)} --report-format json --report-path ${JSON.stringify(outputPath)}`,
};

const isScannerName = (value: string): value is ScannerName => value in SCANNER_COMMANDS;

export const scannerRunTool: ToolDefinition = {
  name: "scanner_run",
  description: "Run a known scanner with a conservative preset and save the raw artifact.",
  inputSchema: {
    type: "object",
    required: ["scanner"],
    properties: {
      scanner: { enum: Object.keys(SCANNER_COMMANDS) },
      target: { type: "string", description: "Defaults to the assessment target." },
      dryRun: { type: "boolean", default: false },
    },
  },
  async handler(args, context) {
    if (!context.allowShell) {
      return failure("scanner_run requires --allow-shell because it invokes local scanner binaries.");
    }
    const scanner = requireString(args, "scanner");
    if (!isScannerName(scanner)) {
      return failure(`Unsupported scanner: ${scanner}`);
    }

    const target = optionalString(args, "target") ?? context.state.target;
    const outputDir = resolveWorkspacePath(context.state.workspaceDir, "artifacts/scans");
    await fs.mkdir(outputDir, { recursive: true });
    const extension = scanner === "nmap" ? "xml" : "json";
    const outputPath = path.join(outputDir, `${scanner}-${Date.now()}.${extension}`);
    const command = SCANNER_COMMANDS[scanner](target, outputPath);

    if (args.dryRun === true) {
      return success("scanner command prepared", { scanner, command, outputPath });
    }

    const result = await runShellCommand(command, { cwd: context.state.workspaceDir, timeoutMs: 120000 });
    return success("scanner completed", {
      scanner,
      command,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout.slice(0, 4000),
      stderr: result.stderr.slice(0, 4000),
      artifactPath: path.relative(context.state.workspaceDir, outputPath).replace(/\\/g, "/"),
    });
  },
};
