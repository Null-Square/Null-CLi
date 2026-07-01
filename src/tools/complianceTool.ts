import { mapFindingsToCompliance, normalizeFramework } from "../compliance/map.js";
import type { ToolDefinition } from "./toolTypes.js";
import { optionalString, success } from "./toolTypes.js";

export const complianceMapTool: ToolDefinition = {
  name: "map_compliance",
  description:
    "Map current findings to lightweight compliance readiness controls. This is readiness support, not certification.",
  inputSchema: {
    type: "object",
    properties: {
      framework: { enum: ["owasp-top10", "pci-dss-lite", "iso27001-lite", "nist-csf-lite"] },
    },
  },
  async handler(args, context) {
    const framework = normalizeFramework(optionalString(args, "framework") ?? "owasp-top10");
    const mappings = mapFindingsToCompliance(context.state.findings, framework);
    context.state.complianceMappings = [
      ...context.state.complianceMappings.filter((entry) => entry.framework !== framework),
      ...mappings,
    ];
    return success("compliance readiness mapping created", { framework, mappings });
  },
};
