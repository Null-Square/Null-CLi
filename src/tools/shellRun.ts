import { spawn } from "node:child_process";

import { resolveWorkspacePath, writeTextArtifact } from "../runtime/workspace.js";
import type { ToolContext, ToolDefinition, ToolResult } from "./toolTypes.js";
import { failure, optionalNumber, optionalString, requireString, success } from "./toolTypes.js";

const MAX_CAPTURE_BYTES = 120_000;

const BLOCKED_COMMAND_PATTERNS = [
  /\brm\s+-rf\s+\/(?:\s|$)/i,
  /\bmkfs(?:\.| )/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /\bInvoke-Expression\b/i,
  /\biex\b/i,
  /:\(\)\s*\{\s*:\|:/,
  /\b(curl|wget)\b[\s\S]{0,80}\|\s*(sh|bash|pwsh|powershell)\b/i,
];

export const guardShellCommand = (command: string): string | null => {
  if (!command.trim()) return "command cannot be empty";
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(command)) return "command matches a blocked destructive pattern";
  }
  return null;
};

const captureAppend = (current: string, chunk: Buffer): string => {
  const next = current + chunk.toString("utf8");
  if (Buffer.byteLength(next, "utf8") <= MAX_CAPTURE_BYTES) return next;
  return next.slice(-MAX_CAPTURE_BYTES);
};

export const runShellCommand = async (
  command: string,
  options: { cwd: string; timeoutMs: number },
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const child = spawn(command, {
      cwd: options.cwd,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        CI: process.env.CI ?? "true",
      },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = captureAppend(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = captureAppend(stderr, chunk);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });

export const shellRunTool: ToolDefinition = {
  name: "shell_run",
  description:
    "Run a shell command inside the assessment workspace. Disabled unless the operator starts the agent with --allow-shell.",
  inputSchema: {
    type: "object",
    required: ["command"],
    properties: {
      command: { type: "string" },
      cwd: { type: "string", description: "Workspace-relative directory." },
      timeoutMs: { type: "number", default: 30000 },
    },
  },
  async handler(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    if (!context.allowShell) {
      return failure("shell_run is disabled. Re-run with --allow-shell to permit workspace shell commands.");
    }

    const command = requireString(args, "command");
    const guard = guardShellCommand(command);
    if (guard) return failure(guard);

    const cwd = resolveWorkspacePath(context.state.workspaceDir, optionalString(args, "cwd") ?? ".");
    const timeoutMs = Math.max(1000, Math.min(optionalNumber(args, "timeoutMs", 30000), 120000));
    const result = await runShellCommand(command, { cwd, timeoutMs });
    const artifactPath = await writeTextArtifact(
      context.state.workspaceDir,
      `shell-${Date.now()}.txt`,
      [
        `$ ${command}`,
        "",
        `exitCode=${result.exitCode ?? "null"} timedOut=${result.timedOut}`,
        "",
        "stdout:",
        result.stdout,
        "",
        "stderr:",
        result.stderr,
      ].join("\n"),
    );

    return success("shell command completed", {
      ...result,
      artifactPath,
    });
  },
};
