import { complianceMapTool } from "./complianceTool.js";
import { browserActionTool } from "./browserAction.js";
import { attachEvidenceTool, createNoteTool, finishAssessmentTool, reportFindingTool } from "./evidenceTools.js";
import { fileReadTool } from "./fileRead.js";
import { httpRequestTool } from "./httpRequest.js";
import { scannerRunTool } from "./scannerRun.js";
import { shellRunTool } from "./shellRun.js";
import type { ToolContext, ToolDefinition, ToolResult } from "./toolTypes.js";
import { failure } from "./toolTypes.js";

export const createPublicToolRegistry = (): Map<string, ToolDefinition> => {
  const tools = [
    fileReadTool,
    httpRequestTool,
    browserActionTool,
    scannerRunTool,
    attachEvidenceTool,
    createNoteTool,
    reportFindingTool,
    complianceMapTool,
    finishAssessmentTool,
    shellRunTool,
  ];
  return new Map(tools.map((tool) => [tool.name, tool]));
};

export const renderToolInstructions = (tools: Map<string, ToolDefinition>): string =>
  Array.from(tools.values())
    .map((tool) => `- ${tool.name}: ${tool.description} Input schema: ${JSON.stringify(tool.inputSchema)}`)
    .join("\n");

export const invokeTool = async (
  tools: Map<string, ToolDefinition>,
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> => {
  const tool = tools.get(name);
  if (!tool) return failure(`Unknown tool: ${name}`);
  try {
    return await tool.handler(args, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(`Tool failed: ${message}`);
  }
};
