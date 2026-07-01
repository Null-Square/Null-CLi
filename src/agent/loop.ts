import path from "node:path";

import { createAssessmentState, type AssessmentState } from "../findings/types.js";
import { createChatCompletion, type ChatMessage } from "../llm/openaiCompatible.js";
import { mapFindingsToCompliance, normalizeFramework } from "../compliance/map.js";
import { renderMarkdownReport } from "../reports/markdown.js";
import { renderSarif } from "../reports/sarif.js";
import { ensureWorkspace, writeJson } from "../runtime/workspace.js";
import { buildPublicAgentPrompt } from "./prompt.js";
import { createPublicToolRegistry, invokeTool } from "../tools/registry.js";
import type { ToolContext } from "../tools/toolTypes.js";

export type ScanMode = "quick" | "standard" | "deep";
export type WorkflowMode = "pentest" | "compliance";

export type AgentEvent =
  | { type: "step"; step: number; maxSteps: number }
  | { type: "model"; delta: string; preview: string }
  | { type: "tool"; tool: string; ok: boolean; reason?: string }
  | { type: "finding"; severity: string; title: string }
  | { type: "note"; title: string }
  | { type: "done"; findings: number };

export const defaultStepsForMode = (mode: ScanMode): number =>
  mode === "quick" ? 4 : mode === "deep" ? 16 : 8;

export interface AgentRunOptions {
  target: string;
  goal: string;
  scope?: string;
  workspaceDir: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  maxSteps?: number;
  allowShell?: boolean;
  framework?: string;
  workflow?: WorkflowMode;
  scanMode?: ScanMode;
  scanModeGuidance?: string;
  dryRun?: boolean;
  streamModel?: boolean;
  log?: (message: string) => void;
  onEvent?: (event: AgentEvent) => void;
}

interface AgentToolRequest {
  tool?: string;
  args?: Record<string, unknown>;
  reason?: string;
  final?: {
    summary?: string;
    recommendation?: string;
  };
}

const extractJson = (content: string): AgentToolRequest => {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as AgentToolRequest;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Agent did not return JSON: ${trimmed.slice(0, 200)}`);
    return JSON.parse(match[0]) as AgentToolRequest;
  }
};

const writeRunArtifacts = async (state: AssessmentState): Promise<void> => {
  const reportsDir = path.join(state.workspaceDir, "reports");
  await writeJson(path.join(state.workspaceDir, "run-state.json"), state);
  await writeJson(path.join(state.workspaceDir, "findings.json"), state.findings);
  await writeJson(path.join(state.workspaceDir, "findings.sarif"), renderSarif(state.findings));
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(path.join(reportsDir, "report.md"), renderMarkdownReport(state), "utf8"),
  );
};

const createDryRunState = async (options: AgentRunOptions, workspaceDir: string): Promise<AssessmentState> => {
  const state = createAssessmentState(options.target, options.goal, workspaceDir);
  state.notes.push({
    id: "note-0001",
    title: "Dry run plan",
    content: [
      `No model call was made (scan mode: ${options.scanMode ?? "standard"}).`,
      `Workflow: ${options.workflow ?? "pentest"}.`,
      "Suggested public flow: browser_action/goto, http_request, scanner_run where authorized,",
      "attach_evidence, report_finding for confirmed observations, map_compliance, finish_assessment.",
    ].join(" "),
    category: "plan",
    createdAt: new Date().toISOString(),
  });
  state.complianceMappings = mapFindingsToCompliance(state.findings, normalizeFramework(options.framework ?? "owasp-top10"));
  state.completed = true;
  state.finishedAt = new Date().toISOString();
  return state;
};

export const runPublicAgent = async (options: AgentRunOptions): Promise<AssessmentState> => {
  const log = options.log ?? (() => undefined);
  const workspaceDir = await ensureWorkspace(options.workspaceDir);

  if (options.dryRun || !options.apiKey) {
    const dryState = await createDryRunState(options, workspaceDir);
    await writeRunArtifacts(dryState);
    return dryState;
  }

  const state = createAssessmentState(options.target, options.goal, workspaceDir);
  const tools = createPublicToolRegistry();
  const context: ToolContext = {
    state,
    allowShell: options.allowShell === true,
    log,
  };
  const scanMode = options.scanMode ?? "standard";
  const emit = options.onEvent ?? (() => undefined);
  const messages: ChatMessage[] = [
    { role: "system", content: buildPublicAgentPrompt(tools) },
    {
      role: "user",
      content: [
        `Target: ${options.target}`,
        `Workflow: ${options.workflow ?? "pentest"}`,
        `Goal: ${options.goal}`,
        options.scope ? `Authorized scope / rules of engagement: ${options.scope}` : "",
        `Workspace: ${workspaceDir}`,
        `Scan mode: ${scanMode}`,
        `Shell/scanner tools enabled: ${options.allowShell === true ? "yes" : "no"}`,
        options.scanModeGuidance ? `\nScan mode guidance:\n${options.scanModeGuidance}` : "",
        "\nStart with a concise plan note, then gather evidence. Finish when enough scoped evidence exists.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  const maxSteps = Math.max(1, Math.min(options.maxSteps ?? defaultStepsForMode(scanMode), 20));
  for (let step = 0; step < maxSteps && !state.completed; step += 1) {
    log(`agent step ${step + 1}/${maxSteps}`);
    emit({ type: "step", step: step + 1, maxSteps });
    let preview = "";
    const content = await createChatCompletion({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.model ?? process.env.NULL_AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      messages,
      stream: options.streamModel === true,
      onToken: (delta) => {
        preview = `${preview}${delta}`.replace(/\s+/g, " ").slice(-160);
        emit({ type: "model", delta, preview });
      },
    });
    messages.push({ role: "assistant", content });
    const request = extractJson(content);

    if (request.final) {
      const finishResult = await invokeTool(
        tools,
        "finish_assessment",
        {
          summary: request.final.summary ?? "Assessment completed.",
          recommendation: request.final.recommendation ?? "Review evidence and remediate confirmed findings.",
        },
        context,
      );
      messages.push({ role: "user", content: `Tool result: ${JSON.stringify(finishResult)}` });
      break;
    }

    if (!request.tool) {
      messages.push({ role: "user", content: "Return a valid tool call or final JSON object." });
      continue;
    }

    const findingsBefore = state.findings.length;
    const notesBefore = state.notes.length;
    const result = await invokeTool(tools, request.tool, request.args ?? {}, context);
    emit({ type: "tool", tool: request.tool, ok: result.ok, reason: request.reason });
    for (const finding of state.findings.slice(findingsBefore)) {
      emit({ type: "finding", severity: finding.severity, title: finding.title });
    }
    for (const note of state.notes.slice(notesBefore)) {
      emit({ type: "note", title: note.title });
    }
    messages.push({
      role: "user",
      content: `Tool ${request.tool} result: ${JSON.stringify(result).slice(0, 12000)}`,
    });
  }
  emit({ type: "done", findings: state.findings.length });

  if (!state.completed) {
    state.completed = true;
    state.finishedAt = new Date().toISOString();
  }
  state.complianceMappings = mapFindingsToCompliance(state.findings, normalizeFramework(options.framework ?? "owasp-top10"));
  await writeRunArtifacts(state);
  return state;
};
