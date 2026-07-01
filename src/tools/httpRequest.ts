import { writeTextArtifact } from "../runtime/workspace.js";
import type { ToolDefinition } from "./toolTypes.js";
import { failure, optionalString, requireString, success } from "./toolTypes.js";

const REDACTED_HEADER_VALUE = "[REDACTED]";
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);

const redactHeaders = (headers: Headers): Record<string, string> => {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    out[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? REDACTED_HEADER_VALUE : value;
  });
  return out;
};

export const isUrlInScope = (target: string, requestedUrl: string): boolean => {
  try {
    const requested = new URL(requestedUrl);
    const scoped = new URL(target);
    return requested.hostname === scoped.hostname || requested.hostname.endsWith(`.${scoped.hostname}`);
  } catch {
    return requestedUrl.includes(target);
  }
};

export const httpRequestTool: ToolDefinition = {
  name: "http_request",
  description: "Send a scoped HTTP request and save a redacted request/response artifact.",
  inputSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string" },
      method: { type: "string", default: "GET" },
      body: { type: "string" },
    },
  },
  async handler(args, context) {
    const url = requireString(args, "url");
    if (!isUrlInScope(context.state.target, url)) {
      return failure(`URL is outside the declared target scope: ${url}`);
    }

    const method = optionalString(args, "method") ?? "GET";
    const body = optionalString(args, "body");
    const started = Date.now();
    const response = await fetch(url, {
      method,
      body: method.toUpperCase() === "GET" ? undefined : body,
      redirect: "manual",
    });
    const responseText = await response.text();
    const durationMs = Date.now() - started;
    const preview = responseText.slice(0, 16000);
    const artifactPath = await writeTextArtifact(
      context.state.workspaceDir,
      `http-${Date.now()}.json`,
      JSON.stringify(
        {
          request: { method, url },
          response: {
            status: response.status,
            headers: redactHeaders(response.headers),
            bodyPreview: preview,
            truncated: responseText.length > preview.length,
          },
          durationMs,
        },
        null,
        2,
      ),
    );

    return success("HTTP request completed", {
      status: response.status,
      durationMs,
      artifactPath,
      bodyPreview: preview.slice(0, 2000),
    });
  },
};
