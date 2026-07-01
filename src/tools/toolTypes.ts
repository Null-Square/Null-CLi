import type { AssessmentState } from "../findings/types.js";

export interface ToolContext {
  state: AssessmentState;
  allowShell: boolean;
  log: (message: string) => void;
}

export interface ToolResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export const success = (message: string, data?: unknown): ToolResult => ({
  ok: true,
  message,
  ...(data === undefined ? {} : { data }),
});

export const failure = (message: string, data?: unknown): ToolResult => ({
  ok: false,
  message,
  ...(data === undefined ? {} : { data }),
});

export const requireString = (
  args: Record<string, unknown>,
  key: string,
  fallback?: string,
): string => {
  const value = args[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required string argument: ${key}`);
};

export const optionalString = (args: Record<string, unknown>, key: string): string | undefined => {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

export const optionalNumber = (
  args: Record<string, unknown>,
  key: string,
  fallback: number,
): number => {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
};
