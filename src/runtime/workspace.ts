import fs from "node:fs/promises";
import path from "node:path";

export const ensureWorkspace = async (workspaceDir: string): Promise<string> => {
  const resolved = path.resolve(workspaceDir);
  await fs.mkdir(resolved, { recursive: true });
  await fs.mkdir(path.join(resolved, "artifacts"), { recursive: true });
  await fs.mkdir(path.join(resolved, "reports"), { recursive: true });
  return resolved;
};

export const isInside = (root: string, candidate: string): boolean => {
  const rootPath = path.resolve(root);
  const candidatePath = path.resolve(candidate);
  return candidatePath === rootPath || candidatePath.startsWith(rootPath + path.sep);
};

export const resolveWorkspacePath = (workspaceDir: string, requestedPath: string): string => {
  const normalized = requestedPath && requestedPath.trim() ? requestedPath : ".";
  const resolved = path.resolve(workspaceDir, normalized);
  if (!isInside(workspaceDir, resolved)) {
    throw new Error(`Path escapes workspace: ${requestedPath}`);
  }
  return resolved;
};

export const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
};

export const safeArtifactName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "artifact";

export const writeTextArtifact = async (
  workspaceDir: string,
  name: string,
  content: string,
): Promise<string> => {
  const relative = path.join("artifacts", safeArtifactName(name));
  const absolute = resolveWorkspacePath(workspaceDir, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, "utf8");
  return relative.replace(/\\/g, "/");
};
