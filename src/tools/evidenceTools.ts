import { deriveOwaspCategory, normalizeCveIds, normalizeCweIds } from "../security/cweOwasp.js";
import type { AssessmentNote, EvidenceKind, Finding, Severity } from "../findings/types.js";
import { makeId, normalizeSeverity } from "../findings/types.js";
import type { ToolDefinition } from "./toolTypes.js";
import { optionalString, requireString, success } from "./toolTypes.js";

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
};

const normalizeEvidenceKind = (value: unknown): EvidenceKind => {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "http_exchange" ||
    normalized === "screenshot" ||
    normalized === "scanner_artifact" ||
    normalized === "file" ||
    normalized === "note"
  ) {
    return normalized;
  }
  return "note";
};

export const createNoteTool: ToolDefinition = {
  name: "create_note",
  description: "Create a short assessment note for plan, finding, compliance, scope, or general context.",
  inputSchema: {
    type: "object",
    required: ["title", "content"],
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      category: { enum: ["general", "plan", "finding", "compliance", "scope"] },
    },
  },
  async handler(args, context) {
    const requestedCategory = optionalString(args, "category");
    const category: AssessmentNote["category"] =
      requestedCategory === "plan" ||
      requestedCategory === "finding" ||
      requestedCategory === "compliance" ||
      requestedCategory === "scope"
        ? requestedCategory
        : "general";
    const note: AssessmentNote = {
      id: makeId("note", context.state.notes.length + 1),
      title: requireString(args, "title"),
      content: requireString(args, "content"),
      category,
      createdAt: new Date().toISOString(),
    };
    context.state.notes.push(note);
    return success("note created", note);
  },
};

export const attachEvidenceTool: ToolDefinition = {
  name: "attach_evidence",
  description: "Attach an existing artifact, excerpt, or note as evidence.",
  inputSchema: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string" },
      kind: { enum: ["http_exchange", "screenshot", "scanner_artifact", "file", "note"] },
      path: { type: "string" },
      excerpt: { type: "string" },
    },
  },
  async handler(args, context) {
    const evidence = {
      id: makeId("evidence", context.state.evidence.length + 1),
      title: requireString(args, "title"),
      kind: normalizeEvidenceKind(args.kind),
      ...(optionalString(args, "path") ? { path: optionalString(args, "path") } : {}),
      ...(optionalString(args, "excerpt") ? { excerpt: optionalString(args, "excerpt") } : {}),
      createdAt: new Date().toISOString(),
    };
    context.state.evidence.push(evidence);
    return success("evidence attached", evidence);
  },
};

export const reportFindingTool: ToolDefinition = {
  name: "report_finding",
  description: "Draft a finding with explicit evidence. This public tool does not perform advanced validation workflows.",
  inputSchema: {
    type: "object",
    required: ["title", "severity", "description"],
    properties: {
      title: { type: "string" },
      severity: { enum: ["critical", "high", "medium", "low", "info"] },
      description: { type: "string" },
      impact: { type: "string" },
      remediation: { type: "string" },
      cweIds: { type: "array", items: { type: "string" } },
      cveIds: { type: "array", items: { type: "string" } },
      evidenceIds: { type: "array", items: { type: "string" } },
      confidence: { enum: ["low", "medium", "high"] },
    },
  },
  async handler(args, context) {
    const cweIds = normalizeCweIds(toStringArray(args.cweIds));
    const cveIds = normalizeCveIds(toStringArray(args.cveIds));
    const evidenceIds = new Set(toStringArray(args.evidenceIds));
    const evidence = context.state.evidence.filter((entry) => evidenceIds.has(entry.id));
    const severity = normalizeSeverity(args.severity) as Severity;
    const requestedConfidence = optionalString(args, "confidence");
    const confidence: Finding["confidence"] =
      requestedConfidence === "high" || requestedConfidence === "low" ? requestedConfidence : "medium";
    const finding: Finding = {
      id: makeId("finding", context.state.findings.length + 1),
      title: requireString(args, "title"),
      severity,
      target: context.state.target,
      description: requireString(args, "description"),
      ...(optionalString(args, "impact") ? { impact: optionalString(args, "impact") } : {}),
      ...(optionalString(args, "remediation") ? { remediation: optionalString(args, "remediation") } : {}),
      confidence,
      cweIds,
      cveIds,
      ...(deriveOwaspCategory(cweIds) ? { owaspCategory: deriveOwaspCategory(cweIds) } : {}),
      evidence,
      source: "agent",
      createdAt: new Date().toISOString(),
    };
    context.state.findings.push(finding);
    return success("finding reported", finding);
  },
};

export const finishAssessmentTool: ToolDefinition = {
  name: "finish_assessment",
  description: "Finish the shallow public assessment and provide a concise summary.",
  inputSchema: {
    type: "object",
    required: ["summary"],
    properties: {
      summary: { type: "string" },
      recommendation: { type: "string" },
    },
  },
  async handler(args, context) {
    context.state.completed = true;
    context.state.finishedAt = new Date().toISOString();
    context.state.notes.push({
      id: makeId("note", context.state.notes.length + 1),
      title: "Assessment summary",
      content: [requireString(args, "summary"), optionalString(args, "recommendation")].filter(Boolean).join("\n\n"),
      category: "general",
      createdAt: new Date().toISOString(),
    });
    return success("assessment finished", {
      findings: context.state.findings.length,
      notes: context.state.notes.length,
    });
  },
};
