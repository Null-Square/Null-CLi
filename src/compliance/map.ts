import type { ComplianceMapping, Finding } from "../findings/types.js";

export type ComplianceFramework = "owasp-top10" | "pci-dss-lite" | "iso27001-lite" | "nist-csf-lite";

export const normalizeFramework = (value: string): ComplianceFramework => {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "owasp-top10" ||
    normalized === "pci-dss-lite" ||
    normalized === "iso27001-lite" ||
    normalized === "nist-csf-lite"
  ) {
    return normalized;
  }
  return "owasp-top10";
};

const severityFindingIds = (findings: Finding[], severities: string[]): string[] =>
  findings.filter((finding) => severities.includes(finding.severity)).map((finding) => finding.id);

const cweFindingIds = (findings: Finding[], cwes: string[]): string[] =>
  findings.filter((finding) => finding.cweIds.some((cwe) => cwes.includes(cwe))).map((finding) => finding.id);

const owaspFindingIds = (findings: Finding[], prefix: string): string[] =>
  findings
    .filter((finding) => finding.owaspCategory?.startsWith(prefix))
    .map((finding) => finding.id);

const mapping = (
  framework: ComplianceFramework,
  controlId: string,
  title: string,
  findingIds: string[],
  rationale: string,
): ComplianceMapping => ({
  framework,
  controlId,
  title,
  status: findingIds.length > 0 ? "impacted" : "no_evidence",
  rationale,
  findingIds,
});

export const mapFindingsToCompliance = (
  findings: Finding[],
  framework: ComplianceFramework,
): ComplianceMapping[] => {
  switch (framework) {
    case "owasp-top10":
      return [
        mapping(framework, "A01:2021", "Broken Access Control", owaspFindingIds(findings, "A01"), "Findings mapped from CWE and OWASP category metadata."),
        mapping(framework, "A02:2021", "Cryptographic Failures", owaspFindingIds(findings, "A02"), "Findings mapped from CWE and OWASP category metadata."),
        mapping(framework, "A03:2021", "Injection", owaspFindingIds(findings, "A03"), "Findings mapped from CWE and OWASP category metadata."),
        mapping(framework, "A05:2021", "Security Misconfiguration", owaspFindingIds(findings, "A05"), "Findings mapped from CWE and OWASP category metadata."),
        mapping(framework, "A06:2021", "Vulnerable and Outdated Components", owaspFindingIds(findings, "A06"), "Findings mapped from CWE and OWASP category metadata."),
      ];
    case "pci-dss-lite":
      return [
        mapping(framework, "PCI-6.2", "Address vulnerabilities in custom software", severityFindingIds(findings, ["critical", "high", "medium"]), "Security findings indicate remediation tracking may be required."),
        mapping(framework, "PCI-6.4", "Public-facing web application protection", [...owaspFindingIds(findings, "A03"), ...owaspFindingIds(findings, "A01")], "Web app findings map to common public-facing app risk themes."),
        mapping(framework, "PCI-11.3", "External and internal vulnerability testing", findings.map((finding) => finding.id), "Assessment findings can support testing evidence, but this is not a PCI attestation."),
      ];
    case "iso27001-lite":
      return [
        mapping(framework, "A.8.8", "Management of technical vulnerabilities", findings.map((finding) => finding.id), "Findings should be tracked through vulnerability management."),
        mapping(framework, "A.8.9", "Configuration management", owaspFindingIds(findings, "A05"), "Misconfiguration findings can indicate configuration control gaps."),
        mapping(framework, "A.5.15", "Access control", owaspFindingIds(findings, "A01"), "Access control findings can support access-control readiness review."),
      ];
    case "nist-csf-lite":
      return [
        mapping(framework, "ID.RA", "Risk assessment", findings.map((finding) => finding.id), "Findings inform technical risk assessment."),
        mapping(framework, "PR.IP", "Protective technology and secure configuration", [...owaspFindingIds(findings, "A05"), ...cweFindingIds(findings, ["CWE-16"])], "Misconfiguration findings map to protection process review."),
        mapping(framework, "DE.CM", "Security continuous monitoring", severityFindingIds(findings, ["critical", "high"]), "High severity findings may require monitoring and detection review."),
      ];
  }
};
