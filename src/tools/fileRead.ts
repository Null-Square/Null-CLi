import fs from "node:fs/promises";

import { resolveWorkspacePath } from "../runtime/workspace.js";
import type { ToolDefinition } from "./toolTypes.js";
import { optionalNumber, requireString, success } from "./toolTypes.js";

export const fileReadTool: ToolDefinition = {
  name: "file_read",
  description: "Read a workspace-relative file. Paths outside the workspace are rejected.",
  inputSchema: {
    type: "object",
    required: ["path"],
    properties: {
      path: { type: "string" },
      maxBytes: { type: "number", default: 12000 },
    },
  },
  async handler(args, context) {
    const requestedPath = requireString(args, "path");
    const maxBytes = Math.max(1, Math.min(optionalNumber(args, "maxBytes", 12000), 120000));
    const filePath = resolveWorkspacePath(context.state.workspaceDir, requestedPath);
    const raw = await fs.readFile(filePath);
    return success("file read", {
      path: requestedPath,
      truncated: raw.length > maxBytes,
      content: raw.subarray(0, maxBytes).toString("utf8"),
    });
  },
};
