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

const exists = async (filePath: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
};

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
    const relativeOutputPath = path.relative(context.state.workspaceDir, outputPath).replace(/\\/g, "/");

    if (args.dryRun === true) {
      return success("scanner command prepared", { scanner, command, outputPath: relativeOutputPath });
    }

    const result = await runShellCommand(command, { cwd: context.state.workspaceDir, timeoutMs: 120000 });
    const diagnosticPath = path.join(outputDir, `${scanner}-diagnostic-${Date.now()}.json`);
    const relativeDiagnosticPath = path.relative(context.state.workspaceDir, diagnosticPath).replace(/\\/g, "/");
    const rawExists = await exists(outputPath);
    await fs.writeFile(
      diagnosticPath,
      `${JSON.stringify(
        {
          scanner,
          target,
          command,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          rawArtifactPath: rawExists ? relativeOutputPath : null,
          stdout: result.stdout.slice(0, 4000),
          stderr: result.stderr.slice(0, 4000),
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const data = {
      scanner,
      command,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout.slice(0, 4000),
      stderr: result.stderr.slice(0, 4000),
      artifactPath: rawExists ? relativeOutputPath : relativeDiagnosticPath,
      artifactPaths: rawExists ? [relativeOutputPath, relativeDiagnosticPath] : [relativeDiagnosticPath],
    };

    if (result.timedOut || result.exitCode !== 0) {
      return failure(
        `scanner ${scanner} failed${result.timedOut ? " (timeout)" : ""} with exit code ${result.exitCode ?? "null"}`,
        data,
      );
    }

    return success("scanner completed", data);
  },
};
