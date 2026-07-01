import { isUrlInScope } from "./httpRequest.js";
import { writeTextArtifact } from "../runtime/workspace.js";
import type { ToolDefinition } from "./toolTypes.js";
import { failure, optionalString, requireString, success } from "./toolTypes.js";

const extractTitle = (html: string): string | undefined => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim();
};

const countMatches = (html: string, pattern: RegExp): number => {
  const matches = html.match(pattern);
  return matches ? matches.length : 0;
};

export const browserActionTool: ToolDefinition = {
  name: "browser_action",
  description:
    "Perform a shallow browser-like page fetch for scoped web targets. This public adapter captures HTML metadata, not a private interactive browser runner.",
  inputSchema: {
    type: "object",
    required: ["action", "url"],
    properties: {
      action: { enum: ["goto", "view_source"] },
      url: { type: "string" },
    },
  },
  async handler(args, context) {
    const action = requireString(args, "action");
    if (action !== "goto" && action !== "view_source") {
      return failure("Public browser_action only supports goto and view_source.");
    }
    const url = requireString(args, "url");
    if (!isUrlInScope(context.state.target, url)) {
      return failure(`URL is outside the declared target scope: ${url}`);
    }

    const response = await fetch(url, { redirect: "manual" });
    const html = await response.text();
    const artifactPath = await writeTextArtifact(context.state.workspaceDir, `browser-${Date.now()}.html`, html);
    return success("browser page captured", {
      url,
      status: response.status,
      title: extractTitle(html),
      links: countMatches(html, /<a\b/gi),
      forms: countMatches(html, /<form\b/gi),
      scripts: countMatches(html, /<script\b/gi),
      artifactPath,
    });
  },
};
