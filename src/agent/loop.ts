import path from "node:path";

import { createAssessmentState, makeId, type AssessmentState, type EvidenceKind } from "../findings/types.js";
import { createChatCompletion, type ChatMessage } from "../llm/openaiCompatible.js";
import { mapFindingsToCompliance, normalizeFramework } from "../compliance/map.js";
import { renderMarkdownReport } from "../reports/markdown.js";
import { renderSarif } from "../reports/sarif.js";
import { ensureWorkspace, writeJson } from "../runtime/workspace.js";
import { buildPublicAgentPrompt } from "./prompt.js";
import { createPublicToolRegistry, invokeTool } from "../tools/registry.js";
import type { ToolContext, ToolDefinition } from "../tools/toolTypes.js";

export type ScanMode = "quick" | "standard" | "deep";
export type WorkflowMode = "pentest" | "compliance";
export type AgentPhase = "planning" | "discovery" | "scanning" | "analysis" | "reporting";

export type AgentEvent =
  | { type: "step"; step: number; maxSteps: number }
  | { type: "phase"; phase: AgentPhase }
  | { type: "agent"; message: string }
  | { type: "model"; delta: string; preview: string }
  | { type: "tool"; tool: string; ok: boolean; reason?: string; message?: string; artifactPaths?: string[] }
  | { type: "finding"; severity: string; title: string }
  | { type: "note"; title: string }
  | { type: "done"; findings: number };

export const DEFAULT_AGENT_TURN_LIMIT = 300;

// Scan mode changes model guidance, never the runtime ceiling.
export const defaultStepsForMode = (_mode: ScanMode): number => DEFAULT_AGENT_TURN_LIMIT;

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
  say?: string;
  tool?: string;
  args?: Record<string, unknown>;
  reason?: string;
  final?: {
    summary?: string;
    recommendation?: string;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
};

const collectArtifactPaths = (value: unknown): string[] => {
  if (!isRecord(value)) return [];
  const paths = new Set<string>();
  const add = (candidate: unknown): void => {
    if (typeof candidate === "string" && candidate.trim()) paths.add(candidate.trim());
  };
  add(value.artifactPath);
  if (Array.isArray(value.artifactPaths)) value.artifactPaths.forEach(add);
  return [...paths];
};

const evidenceKindForTool = (tool: string): EvidenceKind => {
  if (tool === "http_request") return "http_exchange";
  if (tool === "scanner_run") return "scanner_artifact";
  if (tool === "browser_action" || tool === "file_read" || tool === "shell_run") return "file";
  return "note";
};

const phaseForTool = (tool: string): AgentPhase => {
  if (tool === "create_note") return "planning";
  if (tool === "browser_action" || tool === "http_request") return "discovery";
  if (tool === "scanner_run" || tool === "shell_run") return "scanning";
  if (tool === "map_compliance" || tool === "finish_assessment") return "reporting";
  return "analysis";
};

const attachToolEvidence = (
  state: AssessmentState,
  tool: string,
  resultData: unknown,
  step: number,
): string[] => {
  const artifactPaths = collectArtifactPaths(resultData);
  for (const artifactPath of artifactPaths) {
    state.evidence.push({
      id: makeId("evidence", state.evidence.length + 1),
      title: `${tool} artifact from step ${step}`,
      kind: evidenceKindForTool(tool),
      path: artifactPath,
      createdAt: new Date().toISOString(),
    });
  }
  return artifactPaths;
};

const addNoEvidenceNote = (state: AssessmentState): void => {
  if (state.notes.some((note) => note.title === "No evidence captured")) return;
  state.notes.push({
    id: makeId("note", state.notes.length + 1),
    title: "No evidence captured",
    content:
      "The live agent loop did not capture a successful evidence artifact. Review the Agent Activity section for failed tool calls, then rerun with a corrected/resolvable target, a deeper scan mode, or scanner permissions if appropriate.",
    category: "general",
    createdAt: new Date().toISOString(),
  });
};

const addModelResponseNote = (state: AssessmentState, message: string): void => {
  if (state.notes.some((note) => note.title === "Model response unavailable")) return;
  state.notes.push({
    id: makeId("note", state.notes.length + 1),
    title: "Model response unavailable",
    content: `${message} The run was closed as inconclusive and all captured tool diagnostics were written to the workspace.`,
    category: "general",
    createdAt: new Date().toISOString(),
  });
};

const addStepBudgetNote = (state: AssessmentState, maxSteps: number): void => {
  if (state.notes.some((note) => note.title === "Step budget exhausted")) return;
  state.notes.push({
    id: makeId("note", state.notes.length + 1),
    title: "Step budget exhausted",
    content: `The assessment reached its configured turn budget (${maxSteps}) before the agent called finish. Captured evidence and findings were preserved, but coverage is partial. Rerun with standard/deep mode or a higher --max-steps value for more coverage.`,
    category: "general",
    createdAt: new Date().toISOString(),
  });
};

const successfulEvidenceActionCount = (state: AssessmentState): number =>
  state.actions.filter((action) => action.ok && action.artifactPaths.length > 0).length;

const finalizeLiveOutcome = (state: AssessmentState, forcedInconclusive: boolean): void => {
  const hasCleanFinish = state.actions.some((action) => action.tool === "finish_assessment" && action.ok);
  const hasSuccessfulEvidenceAction = successfulEvidenceActionCount(state) > 0;
  if (!forcedInconclusive && hasCleanFinish && hasSuccessfulEvidenceAction) {
    state.outcome = "complete";
    return;
  }
  state.outcome = "inconclusive";
  if (!hasSuccessfulEvidenceAction) addNoEvidenceNote(state);
};

const ensureIncompleteAssessmentSummary = (state: AssessmentState): void => {
  if (state.notes.some((note) => note.title === "Assessment summary")) return;
  const successfulEvidence = successfulEvidenceActionCount(state);
  state.notes.push({
    id: makeId("note", state.notes.length + 1),
    title: "Assessment summary",
    content: [
      "The agent stopped before a clean completion signal, so this assessment is inconclusive.",
      `${state.actions.length} action(s) were recorded, ${successfulEvidence} successful evidence-producing action(s) completed, and ${state.findings.length} evidence-backed finding(s) were preserved.`,
      "Review the saved evidence and Agent Activity trace, correct the model or target failure shown there, and rerun the assessment.",
    ].join(" "),
    category: "general",
    createdAt: new Date().toISOString(),
  });
};

const compactConversation = (messages: ChatMessage[], state: AssessmentState): void => {
  if (messages.length <= 32) return;
  const system = messages[0];
  const initialRequest = messages[1];
  const recent = messages
    .slice(-14)
    .filter((message) => !message.content.startsWith("Run ledger (authoritative persisted state):"));
  const actions = state.actions.slice(-40).map((action) =>
    [
      `step ${action.step}`,
      action.tool,
      action.ok ? "ok" : "failed",
      action.message,
      action.artifactPaths.length ? `artifacts=${action.artifactPaths.join(",")}` : "",
    ].filter(Boolean).join(" | "),
  );
  const findings = state.findings.map((finding) =>
    `${finding.id} | ${finding.severity} | ${finding.title} | evidence=${finding.evidence.map((entry) => entry.id).join(",") || "none"}`,
  );
  const evidence = state.evidence.map((entry) =>
    `${entry.id} | ${entry.kind} | ${entry.title}${entry.path ? ` | ${entry.path}` : ""}`,
  );
  const ledger: ChatMessage = {
    role: "user",
    content: [
      "Run ledger (authoritative persisted state):",
      `Actions (${state.actions.length} total; latest shown):`,
      ...(actions.length ? actions : ["none"]),
      `Evidence (${state.evidence.length}):`,
      ...(evidence.length ? evidence : ["none"]),
      `Findings (${state.findings.length}):`,
      ...(findings.length ? findings : ["none"]),
      "Continue from this state. Do not repeat completed actions unless needed to validate a result.",
    ].join("\n"),
  };
  messages.splice(0, messages.length, system, initialRequest, ledger, ...recent);
};

const closeAtBudget = async (
  state: AssessmentState,
  tools: Map<string, ToolDefinition>,
  context: ToolContext,
  maxSteps: number,
  emit: (event: AgentEvent) => void,
): Promise<void> => {
  addStepBudgetNote(state, maxSteps);
  const successfulEvidence = successfulEvidenceActionCount(state);
  const summary = [
    `The assessment reached its ${maxSteps}-turn limit before the agent completed the planned coverage.`,
    `${state.actions.length} tool action(s) ran, ${successfulEvidence} successful evidence-producing action(s) completed, and ${state.findings.length} evidence-backed finding(s) were reported.`,
    successfulEvidence > 0
      ? "Captured target evidence remains available in the workspace, but the overall result is inconclusive because coverage is incomplete."
      : "No successful target evidence was captured, so the result is inconclusive.",
  ].join(" ");
  const recommendation =
    "Review the saved evidence and activity trace, then rerun with standard/deep mode or increase --max-steps when broader authorized coverage is required.";
  const say = "The configured turn budget was reached, so I am closing with a partial, inconclusive result and preserving all evidence.";
  emit({ type: "agent", message: say });
  const finishResult = await invokeTool(
    tools,
    "finish_assessment",
    { summary, recommendation },
    context,
  );
  state.actions.push({
    id: makeId("action", state.actions.length + 1),
    step: maxSteps + 1,
    tool: "finish_assessment",
    ok: finishResult.ok,
    say,
    reason: "Persist a complete operator-facing result after turn-budget exhaustion.",
    message: finishResult.message,
    artifactPaths: [],
    createdAt: new Date().toISOString(),
  });
  emit({ type: "tool", tool: "finish_assessment", ok: finishResult.ok, message: finishResult.message, artifactPaths: [] });
};

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

const isEmptyModelResponseError = (error: unknown): boolean =>
  error instanceof Error && /LLM response did not include message content/i.test(error.message);

const recordModelResponseFailure = (
  state: AssessmentState,
  step: number,
  message: string,
  emit: (event: AgentEvent) => void,
): void => {
  state.actions.push({
    id: makeId("action", state.actions.length + 1),
    step,
    tool: "model_response",
    ok: false,
    message,
    artifactPaths: [],
    createdAt: new Date().toISOString(),
  });
  addModelResponseNote(state, message);
  state.completed = true;
  state.finishedAt = new Date().toISOString();
  emit({ type: "tool", tool: "model_response", ok: false, message, artifactPaths: [] });
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
  state.outcome = "dry-run";
  state.notes.push({
    id: "note-0001",
    title: "Dry run plan",
    content: [
      `No model call was made (scan mode: ${options.scanMode ?? "standard"}).`,
      `Workflow: ${options.workflow ?? "pentest"}.`,
      "Suggested public flow: browser_action/goto, http_request, scanner_run where authorized,",
      options.workflow === "compliance"
        ? "attach_evidence, report_finding for confirmed observations, map_compliance, finish_assessment."
        : "attach_evidence, report_finding for confirmed observations, finish_assessment.",
    ].join(" "),
    category: "plan",
    createdAt: new Date().toISOString(),
  });
  state.complianceMappings =
    options.workflow === "compliance"
      ? mapFindingsToCompliance(state.findings, normalizeFramework(options.framework ?? "owasp-top10"))
      : [];
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
  if ((options.workflow ?? "pentest") !== "compliance") tools.delete("map_compliance");
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
        /^https?:\/\//i.test(options.target)
          ? ""
          : `Target URL hint: use https://${options.target} for HTTP and browser tools unless evidence indicates HTTP is required.`,
        options.scanModeGuidance ? `\nScan mode guidance:\n${options.scanModeGuidance}` : "",
        "\nStart with a concise plan note, then gather evidence. Use browser_action or http_request before finishing. Report only evidence-backed findings. Cover the scoped public surface methodically and avoid repeating completed checks. If no finding is confirmed, finish with a complete summary of what was checked, the evidence captured, coverage gaps, and why no finding was reported. The run is complete only after an explicit final response.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  const maxSteps = Math.max(
    1,
    Math.min(options.maxSteps ?? DEFAULT_AGENT_TURN_LIMIT, DEFAULT_AGENT_TURN_LIMIT),
  );
  let forcedInconclusive = false;
  let activePhase: AgentPhase | undefined;
  const emitPhase = (phase: AgentPhase): void => {
    if (phase === activePhase) return;
    activePhase = phase;
    emit({ type: "phase", phase });
  };
  emitPhase("planning");
  for (let step = 0; step < maxSteps && !state.completed; step += 1) {
    compactConversation(messages, state);
    const currentTurn = step + 1;
    const remainingTurns = maxSteps - currentTurn;
    if (currentTurn === Math.ceil(maxSteps * 0.85)) {
      const warning = `Budget notice: ${currentTurn}/${maxSteps} turns used. Prioritize unresolved coverage, evidence-backed findings, and a complete final assessment summary.`;
      messages.push({ role: "user", content: warning });
      log(warning);
    }
    if (remainingTurns === 3) {
      const warning = "Finalization required: only three turns remain. Stop broadening scope, complete any evidence-backed finding, and return the final assessment summary before the budget expires.";
      messages.push({ role: "user", content: warning });
      log(warning);
    }
    log(`agent step ${step + 1}/${maxSteps}`);
    emit({ type: "step", step: step + 1, maxSteps });
    let preview = "";
    let content = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        content = await createChatCompletion({
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
        break;
      } catch (error) {
        if (!isEmptyModelResponseError(error)) throw error;
        if (attempt === 0) {
          log("model returned empty response; retrying with JSON repair instruction");
          messages.push({
            role: "user",
            content:
              "Your previous response was empty. Return exactly one JSON object now. If tool results show the target is unreachable, finish with an inconclusive summary instead of calling more tools.",
          });
          continue;
        }
        recordModelResponseFailure(
          state,
          step + 1,
          "Model returned an empty response twice.",
          emit,
        );
      }
    }
    if (state.completed) break;
    messages.push({ role: "assistant", content });
    let request: AgentToolRequest;
    try {
      request = extractJson(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent returned an invalid response.";
      log(message);
      messages.push({
        role: "user",
        content:
          "That response was not valid JSON. Return exactly one JSON object using either a tool call or final summary. Do not use markdown.",
      });
      continue;
    }
    const say = optionalText(request.say);

    if (request.final) {
      if (state.evidence.length === 0 && step + 1 < maxSteps) {
        messages.push({
          role: "user",
          content:
            "Do not finish yet. No evidence artifact has been captured. Use browser_action or http_request on the scoped target, then finish only after the tool result is recorded.",
        });
        continue;
      }
      emitPhase("reporting");
      if (say) emit({ type: "agent", message: say });
      const finishResult = await invokeTool(
        tools,
        "finish_assessment",
        {
          summary: request.final.summary ?? "Assessment completed.",
          recommendation: request.final.recommendation ?? "Review evidence and remediate confirmed findings.",
        },
        context,
      );
      state.actions.push({
        id: makeId("action", state.actions.length + 1),
        step: step + 1,
        tool: "finish_assessment",
        ok: finishResult.ok,
        ...(say ? { say } : {}),
        message: finishResult.message,
        artifactPaths: [],
        createdAt: new Date().toISOString(),
      });
      if (!say) {
        const finalMessage = optionalText(request.final.summary);
        if (finalMessage) emit({ type: "agent", message: finalMessage });
      }
      emit({ type: "tool", tool: "finish_assessment", ok: finishResult.ok, message: finishResult.message, artifactPaths: [] });
      messages.push({ role: "user", content: `Tool result: ${JSON.stringify(finishResult)}` });
      break;
    }

    if (!request.tool) {
      messages.push({ role: "user", content: "Return a valid tool call or final JSON object." });
      continue;
    }

    const findingsBefore = state.findings.length;
    const notesBefore = state.notes.length;
    emitPhase(phaseForTool(request.tool));
    if (say) emit({ type: "agent", message: say });
    const result = await invokeTool(tools, request.tool, request.args ?? {}, context);
    const artifactPaths = attachToolEvidence(state, request.tool, result.data, step + 1);
    state.actions.push({
      id: makeId("action", state.actions.length + 1),
      step: step + 1,
      tool: request.tool,
      ok: result.ok,
      ...(say ? { say } : {}),
      ...(request.reason ? { reason: request.reason } : {}),
      message: result.message,
      artifactPaths,
      createdAt: new Date().toISOString(),
    });
    emit({ type: "tool", tool: request.tool, ok: result.ok, reason: request.reason, message: result.message, artifactPaths });
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
    forcedInconclusive = true;
    emitPhase("reporting");
    await closeAtBudget(state, tools, context, maxSteps, emit);
  }
  const hasCleanFinish = state.actions.some((action) => action.tool === "finish_assessment" && action.ok);
  if (!hasCleanFinish) {
    forcedInconclusive = true;
    ensureIncompleteAssessmentSummary(state);
  }
  finalizeLiveOutcome(state, forcedInconclusive);
  state.complianceMappings =
    options.workflow === "compliance"
      ? mapFindingsToCompliance(state.findings, normalizeFramework(options.framework ?? "owasp-top10"))
      : [];
  await writeRunArtifacts(state);
  return state;
};
