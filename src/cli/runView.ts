import { spawn } from "node:child_process";
import path from "node:path";

import type { AssessmentState } from "../findings/types.js";
import { summarizeAssessment } from "../reports/markdown.js";
import { accent, colors, section, severityTag, status } from "./brand.js";

const clip = (value: string, max = 120): string =>
  value.length > max ? `${value.slice(0, Math.max(1, max - 1))}...` : value;

export const successfulEvidenceCount = (state: AssessmentState): number =>
  (state.actions ?? [])
    .filter((action) => action.ok && action.artifactPaths.length > 0)
    .reduce((count, action) => count + action.artifactPaths.length, 0);

export const exitCodeForState = (state: AssessmentState): number => {
  if (state.outcome === "failed" || state.outcome === "inconclusive") return 3;
  if (state.outcome === "complete" && state.findings.length > 0) return 2;
  return 0;
};

export const exitCodeForStates = (states: AssessmentState[]): number => {
  if (states.some((state) => state.outcome === "failed" || state.outcome === "inconclusive")) return 3;
  if (states.some((state) => state.outcome === "complete" && state.findings.length > 0)) return 2;
  return 0;
};

export const reportPathForWorkspace = (workspaceDir: string): string =>
  path.resolve(workspaceDir, "reports", "report.md");

export const renderRunTrace = (state: AssessmentState, workspaceDir = state.workspaceDir): string => {
  const lines: string[] = [
    section("Run Trace"),
    `  ${colors.dim("outcome")}   ${state.outcome === "complete" ? status("PASS") : state.outcome === "dry-run" ? status("INFO") : status("WARN")} ${colors.fg(state.outcome)}`,
    `  ${colors.dim("target")}    ${colors.fg(state.target)}`,
    `  ${colors.dim("goal")}      ${colors.muted(clip(state.goal))}`,
    `  ${colors.dim("workspace")} ${accent(path.resolve(workspaceDir))}`,
    `  ${colors.dim("report")}    ${accent(reportPathForWorkspace(workspaceDir))}`,
    "",
    section("Assessment Summary"),
    ...summarizeAssessment(state)
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => `  ${colors.fg(line)}`),
    "",
    section(`Findings (${state.findings.length})`),
  ];

  if (!state.findings.length) lines.push(`  ${colors.dim("No findings reported.")}`);
  for (const finding of state.findings) {
    lines.push(`  ${severityTag(finding.severity)} ${colors.fg(clip(finding.title, 90))} ${colors.dim(finding.target)}`);
  }

  lines.push("", section(`Evidence (${state.evidence.length})`));
  if (!state.evidence.length) lines.push(`  ${colors.dim("No evidence artifacts attached.")}`);
  for (const evidence of state.evidence) {
    const location = evidence.path ? ` ${colors.dim(evidence.path)}` : "";
    lines.push(`  ${accent(evidence.id)} ${colors.fg(evidence.title)} ${colors.dim(`(${evidence.kind})`)}${location}`);
  }

  lines.push("", section(`Agent Activity (${state.actions?.length ?? 0})`));
  if (!state.actions?.length) lines.push(`  ${colors.dim("No agent actions recorded.")}`);
  for (const action of state.actions ?? []) {
    const marker = action.ok ? status("PASS") : status("FAIL");
    const artifacts = action.artifactPaths.length ? ` ${colors.dim(`artifacts: ${action.artifactPaths.join(", ")}`)}` : "";
    lines.push(`  ${marker} ${colors.dim(`step ${action.step}`)} ${colors.fg(action.tool)} ${colors.muted(clip(action.message, 90))}${artifacts}`);
    if (action.say) lines.push(`      ${colors.dim("agent")} ${colors.muted(clip(action.say, 110))}`);
  }

  lines.push("", `${colors.dim("Scale this on the managed platform")} ${accent("->")} ${accent("nullsquare.net")}`);
  return lines.join("\n");
};

export const openLocalPath = (filePath: string): boolean => {
  const resolved = path.resolve(filePath);
  const command = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  try {
    const child = spawn(command, [resolved], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
};
