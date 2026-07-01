import fs from "node:fs/promises";
import path from "node:path";

import type { EvidenceRef, Finding } from "../findings/types.js";
import { makeId, normalizeSeverity } from "../findings/types.js";
import { deriveOwaspCategory, normalizeCveIds, normalizeCweIds } from "../security/cweOwasp.js";

type JsonObject = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => asStringArray(entry));
  }
  const text = asString(value);
  if (!text) return [];
  return text
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const evidenceFor = (artifactPath: string, title: string): EvidenceRef => ({
  id: makeId("evidence", 1),
  kind: "scanner_artifact",
  title,
  path: artifactPath,
  createdAt: new Date().toISOString(),
});

const makeFinding = (index: number, partial: Omit<Finding, "id" | "createdAt">): Finding => ({
  id: makeId("finding", index),
  createdAt: new Date().toISOString(),
  ...partial,
});

const parseJsonLines = (raw: string): unknown[] => {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    return [JSON.parse(trimmed)];
  } catch {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  }
};

const parseNuclei = (objects: JsonObject[], artifactPath: string): Finding[] =>
  objects
    .filter((entry) => typeof entry["template-id"] === "string" || typeof entry["templateID"] === "string")
    .map((entry, index) => {
      const info = isRecord(entry.info) ? entry.info : {};
      const classification = isRecord(info.classification) ? info.classification : {};
      const cweIds = normalizeCweIds(asStringArray(classification["cwe-id"] ?? classification.cwe));
      const cveIds = normalizeCveIds(asStringArray(classification["cve-id"] ?? classification.cve));
      return makeFinding(index + 1, {
        title: asString(info.name) ?? asString(entry["template-id"]) ?? "Nuclei finding",
        severity: normalizeSeverity(info.severity),
        target: asString(entry["matched-at"]) ?? asString(entry.host) ?? "unknown",
        description: asString(info.description) ?? "Nuclei reported a potential issue.",
        remediation: asString(info.remediation),
        confidence: "medium",
        cweIds,
        cveIds,
        ...(deriveOwaspCategory(cweIds) ? { owaspCategory: deriveOwaspCategory(cweIds) } : {}),
        evidence: [evidenceFor(artifactPath, "Nuclei raw artifact")],
        source: "nuclei",
      });
    });

const parseSemgrep = (root: JsonObject, artifactPath: string): Finding[] => {
  const results = Array.isArray(root.results) ? root.results.filter(isRecord) : [];
  return results.map((entry, index) => {
    const extra = isRecord(entry.extra) ? entry.extra : {};
    const metadata = isRecord(extra.metadata) ? extra.metadata : {};
    const cweIds = normalizeCweIds(asStringArray(metadata.cwe ?? metadata.cwe_id));
    const cveIds = normalizeCveIds(asStringArray(metadata.cve ?? metadata.cve_id));
    return makeFinding(index + 1, {
      title: asString(entry.check_id) ?? "Semgrep finding",
      severity: normalizeSeverity(extra.severity),
      target: asString(entry.path) ?? "repository",
      description: asString(extra.message) ?? "Semgrep reported a code issue.",
      remediation: asString(metadata.fix),
      confidence: "medium",
      cweIds,
      cveIds,
      ...(deriveOwaspCategory(cweIds) ? { owaspCategory: deriveOwaspCategory(cweIds) } : {}),
      evidence: [evidenceFor(artifactPath, "Semgrep raw artifact")],
      source: "semgrep",
    });
  });
};

const parseTrivy = (root: JsonObject, artifactPath: string): Finding[] => {
  const results = Array.isArray(root.Results) ? root.Results.filter(isRecord) : [];
  const findings: Finding[] = [];
  for (const result of results) {
    const vulns = Array.isArray(result.Vulnerabilities) ? result.Vulnerabilities.filter(isRecord) : [];
    for (const vuln of vulns) {
      const index = findings.length + 1;
      const cveIds = normalizeCveIds([asString(vuln.VulnerabilityID) ?? ""]);
      findings.push(
        makeFinding(index, {
          title: `${asString(vuln.PkgName) ?? "package"} ${asString(vuln.VulnerabilityID) ?? "vulnerability"}`,
          severity: normalizeSeverity(vuln.Severity),
          target: asString(result.Target) ?? "filesystem",
          description: asString(vuln.Description) ?? asString(vuln.Title) ?? "Trivy reported a vulnerable component.",
          remediation: asString(vuln.FixedVersion) ? `Upgrade to ${asString(vuln.FixedVersion)} or later.` : undefined,
          confidence: "medium",
          cweIds: [],
          cveIds,
          evidence: [evidenceFor(artifactPath, "Trivy raw artifact")],
          source: "trivy",
        }),
      );
    }
  }
  return findings;
};

export const parseScannerArtifact = async (filePath: string): Promise<Finding[]> => {
  const raw = await fs.readFile(filePath, "utf8");
  const artifactPath = filePath.replace(/\\/g, "/");
  const parsed = parseJsonLines(raw);
  const objects = parsed.filter(isRecord);
  if (!objects.length) return [];

  const first = objects[0];
  if (objects.some((entry) => typeof entry["template-id"] === "string" || typeof entry["templateID"] === "string")) {
    return parseNuclei(objects, artifactPath);
  }
  if (Array.isArray(first.results)) {
    return parseSemgrep(first, artifactPath);
  }
  if (Array.isArray(first.Results)) {
    return parseTrivy(first, artifactPath);
  }
  return [];
};

export const parseScannerPath = async (inputPath: string): Promise<Finding[]> => {
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) return parseScannerArtifact(inputPath);
  const entries = await fs.readdir(inputPath, { withFileTypes: true });
  const findings: Finding[] = [];
  for (const entry of entries) {
    const fullPath = path.join(inputPath, entry.name);
    if (entry.isDirectory()) {
      findings.push(...(await parseScannerPath(fullPath)));
    } else if (/\.(json|jsonl)$/i.test(entry.name)) {
      findings.push(...(await parseScannerArtifact(fullPath)));
    }
  }
  return findings.map((finding, index) => ({ ...finding, id: makeId("finding", index + 1) }));
};
