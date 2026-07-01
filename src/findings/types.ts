export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type EvidenceKind =
  | "http_exchange"
  | "screenshot"
  | "scanner_artifact"
  | "file"
  | "note";

export interface EvidenceRef {
  id: string;
  kind: EvidenceKind;
  title: string;
  path?: string;
  excerpt?: string;
  createdAt: string;
}

export interface CvssSummary {
  score: number;
  severity: "none" | Severity;
  vector: string;
}

export interface ComplianceMapping {
  framework: string;
  controlId: string;
  title: string;
  status: "impacted" | "review" | "no_evidence";
  rationale: string;
  findingIds: string[];
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  target: string;
  description: string;
  impact?: string;
  remediation?: string;
  confidence?: "low" | "medium" | "high";
  cweIds: string[];
  cveIds: string[];
  owaspCategory?: string;
  cvss?: CvssSummary;
  evidence: EvidenceRef[];
  source?: string;
  createdAt: string;
}

export interface AssessmentNote {
  id: string;
  title: string;
  content: string;
  category: "general" | "plan" | "finding" | "compliance" | "scope";
  createdAt: string;
}

export interface AssessmentState {
  target: string;
  goal: string;
  workspaceDir: string;
  findings: Finding[];
  evidence: EvidenceRef[];
  notes: AssessmentNote[];
  complianceMappings: ComplianceMapping[];
  completed: boolean;
  startedAt: string;
  finishedAt?: string;
}

export const createAssessmentState = (
  target: string,
  goal: string,
  workspaceDir: string,
): AssessmentState => ({
  target,
  goal,
  workspaceDir,
  findings: [],
  evidence: [],
  notes: [],
  complianceMappings: [],
  completed: false,
  startedAt: new Date().toISOString(),
});

export const severityOrder: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export const normalizeSeverity = (value: unknown): Severity => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "critical" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low" ||
    normalized === "info"
  ) {
    return normalized;
  }
  return "info";
};

export const makeId = (prefix: string, next: number): string =>
  `${prefix}-${String(next).padStart(4, "0")}`;
