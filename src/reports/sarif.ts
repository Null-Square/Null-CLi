import type { Finding } from "../findings/types.js";

const levelForSeverity = (severity: Finding["severity"]): "error" | "warning" | "note" => {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium" || severity === "low") return "warning";
  return "note";
};

export const renderSarif = (findings: Finding[]): Record<string, unknown> => ({
  version: "2.1.0",
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  runs: [
    {
      tool: {
        driver: {
          name: "Null CLI",
          informationUri: "https://github.com/Null-Square/Null-CLi",
          rules: findings.map((finding) => ({
            id: finding.id,
            name: finding.title,
            shortDescription: { text: finding.title },
            fullDescription: { text: finding.description },
            properties: {
              severity: finding.severity,
              cweIds: finding.cweIds,
              owaspCategory: finding.owaspCategory,
            },
          })),
        },
      },
      results: findings.map((finding) => ({
        ruleId: finding.id,
        level: levelForSeverity(finding.severity),
        message: { text: finding.description },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: finding.evidence[0]?.path ?? finding.target,
              },
            },
          },
        ],
      })),
    },
  ],
});
