import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { configHome } from "../config/profiles.js";

interface UpdateCache {
  checkedAt: number;
  latest: string;
}

export interface CliUpdate {
  current: string;
  latest: string;
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REGISTRY_URL = "https://registry.npmjs.org/@nullsquare%2Fnull-cli/latest";

const cachePath = (): string => path.join(configHome(), "update-check.json");

const parseVersion = (value: string): number[] | null => {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1).map(Number) : null;
};

export const isNewerVersion = (current: string, candidate: string): boolean => {
  const left = parseVersion(current);
  const right = parseVersion(candidate);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    if (right[index] !== left[index]) return right[index] > left[index];
  }
  return false;
};

const currentVersion = async (): Promise<string> => {
  const packageFile = fileURLToPath(new URL("../../package.json", import.meta.url));
  const pkg = JSON.parse(await fs.readFile(packageFile, "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
};

const readCache = async (): Promise<UpdateCache | null> => {
  try {
    return JSON.parse(await fs.readFile(cachePath(), "utf8")) as UpdateCache;
  } catch {
    return null;
  }
};

const writeCache = async (cache: UpdateCache): Promise<void> => {
  await fs.mkdir(configHome(), { recursive: true, mode: 0o700 });
  await fs.writeFile(cachePath(), `${JSON.stringify(cache, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await fs.chmod(cachePath(), 0o600).catch(() => undefined);
};

const fetchLatest = async (): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(REGISTRY_URL, {
      headers: { accept: "application/json", "user-agent": "null-ai-cli-update-check" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    return typeof data.version === "string" && parseVersion(data.version) ? data.version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const checkForCliUpdate = async (): Promise<CliUpdate | null> => {
  if (/^(1|true|yes)$/i.test(process.env.NULL_AI_DISABLE_UPDATE_CHECK ?? "")) return null;

  const current = await currentVersion();
  const cached = await readCache();
  if (cached && Date.now() - cached.checkedAt < CHECK_INTERVAL_MS) {
    return isNewerVersion(current, cached.latest) ? { current, latest: cached.latest } : null;
  }

  const latest = await fetchLatest();
  if (latest) await writeCache({ checkedAt: Date.now(), latest }).catch(() => undefined);
  const candidate = latest ?? cached?.latest;
  return candidate && isNewerVersion(current, candidate) ? { current, latest: candidate } : null;
};
