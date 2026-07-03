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

export const errorDetails = (error: unknown): { message: string; cause?: string; code?: string } => {
  if (!(error instanceof Error)) return { message: String(error) };
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: string }).code;
    return {
      message: error.message,
      cause: cause.message,
      ...(code ? { code } : {}),
    };
  }
  return { message: error.message };
};

export const readableError = (error: unknown): string => {
  const details = errorDetails(error);
  return [details.message, details.code, details.cause].filter(Boolean).join(" - ");
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

export const normalizeScopedHttpUrl = (target: string, requestedUrl: string): string => {
  const trimmed = requestedUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = /^https?:\/\//i.test(target) ? target : `https://${target}`;
  if (trimmed.startsWith("/")) return new URL(trimmed, base).toString();
  if (/^[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return new URL(trimmed, base).toString();
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
    const url = normalizeScopedHttpUrl(context.state.target, requireString(args, "url"));
    if (!isUrlInScope(context.state.target, url)) {
      return failure(`URL is outside the declared target scope: ${url}`);
    }

    const method = optionalString(args, "method") ?? "GET";
    const body = optionalString(args, "body");
    const started = Date.now();
    let response: Response;
    let responseText: string;
    try {
      response = await fetch(url, {
        method,
        body: method.toUpperCase() === "GET" ? undefined : body,
        redirect: "manual",
      });
      responseText = await response.text();
    } catch (error) {
      const durationMs = Date.now() - started;
      const details = errorDetails(error);
      const artifactPath = await writeTextArtifact(
        context.state.workspaceDir,
        `http-failed-${Date.now()}.json`,
        JSON.stringify(
          {
            request: { method, url },
            error: details,
            durationMs,
          },
          null,
          2,
        ),
      );
      return failure(`HTTP request failed for ${url}: ${readableError(error)}`, {
        url,
        durationMs,
        artifactPath,
        error: details,
      });
    }
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
