#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runPublicAgent } from "../agent/loop.js";
import { mapFindingsToCompliance, normalizeFramework } from "../compliance/map.js";
import type { AssessmentState, Finding } from "../findings/types.js";
import { createAssessmentState } from "../findings/types.js";
import { renderMarkdownReport } from "../reports/markdown.js";
import { renderSarif } from "../reports/sarif.js";
import { ensureWorkspace, readJson, writeJson } from "../runtime/workspace.js";
import { parseScannerPath } from "../scanners/parsers.js";
import { loadPublicSkills, loadSkillBySlug } from "../skills/loader.js";
import { runShellCommand } from "../tools/shellRun.js";
import {
  accent,
  colors,
  command as colorCommand,
  renderBanner,
  renderMultiSummary,
  renderRunHeader,
  renderRunSummary,
  section,
  status,
} from "./brand.js";
import { createLiveReporter } from "./live.js";
import type { ScanMode } from "../agent/loop.js";

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
  // Every occurrence of a repeatable string flag (e.g. multiple --target).
  all: Record<string, string[]>;
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const all: Record<string, string[]> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      (all[key] ??= []).push(next);
      index += 1;
    }
  }
  return { positionals, flags, all };
};

const collectStrings = (parsed: ParsedArgs, ...keys: string[]): string[] => {
  const values: string[] = [];
  for (const key of keys) values.push(...(parsed.all[key] ?? []));
  return values;
};

const targetSlug = (target: string): string =>
  target
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[^a-z0-9.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "target";

const SCAN_MODES = new Set(["quick", "standard", "deep"]);

const flagString = (flags: Record<string, string | boolean>, key: string, fallback?: string): string | undefined => {
  const value = flags[key];
  return typeof value === "string" ? value : fallback;
};

const flagNumber = (flags: Record<string, string | boolean>, key: string, fallback: number): number => {
  const value = flagString(flags, key);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const packagePath = (relativePath: string): string => fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));

const defaultSkillsRoot = (): string => packagePath("skills");

const defaultSandboxManifest = (): string => packagePath("sandbox/tools-manifest.json");

const home = (): string => [
  renderBanner(),
  "",
  section("Start"),
  `  ${colorCommand("null-ai agent run")} --target https://example.com`,
  `  ${colorCommand("null-ai agent run")} --target https://example.com --dry-run`,
  "",
  colors.muted("Run null-ai --help for all commands and options."),
  colors.gray("Managed platform: nullsquare.net"),
].join("\n");

const usage = (version: string): string => [
  renderBanner(),
  "",
  section("Usage"),
  `  ${colorCommand("null-ai")} <command> [options]`,
  "",
  section("Commands"),
  `  ${colorCommand("agent run")} --target <url|host|path> [--target ...] [--scan-mode quick|standard|deep]`,
  `    ${colors.dim("[--goal <text>] [--framework <id>] [--out .null/run] [--allow-shell] [--dry-run]")}`,
  `  ${colorCommand("null-ai sandbox verify")} [--manifest <path>]`,
  `  ${colorCommand("null-ai ingest")} <file-or-dir> --out findings.json`,
  `  ${colorCommand("null-ai report generate")} <findings.json> --out report.md [--sarif findings.sarif]`,
  `  ${colorCommand("null-ai compliance map")} <findings.json> --framework <owasp-top10|pci-dss-lite|iso27001-lite|nist-csf-lite> --out compliance.json`,
  `  ${colorCommand("null-ai skills list")} [--root <path>]`,
  `  ${colorCommand("null-ai skills show")} <slug> [--root <path>]`,
  "",
  section("Model env"),
  "  NULL_AI_API_KEY or OPENAI_API_KEY",
  "  NULL_AI_BASE_URL or OPENAI_BASE_URL",
  "  NULL_AI_MODEL or OPENAI_MODEL",
  "",
  colors.gray(`Aliases: null, null-ai, nullsquare  |  Version: ${version}`),
].join("\n");

const readVersion = async (): Promise<string> => {
  try {
    const pkg = JSON.parse(await fs.readFile(packagePath("package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
};

const requireValue = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`Missing required value: ${name}`);
  return value;
};

const commandAgentRun = async (parsed: ParsedArgs): Promise<void> => {
  const { flags } = parsed;
  const targets = collectStrings(parsed, "target");
  if (targets.length === 0) throw new Error("Missing required value: --target");

  const goal = flagString(flags, "goal", "Perform a scoped shallow pentest and produce evidence-backed findings.")!;
  const baseOut = flagString(flags, "out", ".null/run")!;
  const framework = flagString(flags, "framework", "owasp-top10")!;
  const apiKey = flagString(flags, "api-key") ?? process.env.NULL_AI_API_KEY ?? process.env.OPENAI_API_KEY;
  const dryRun = flags["dry-run"] === true || !apiKey;

  const scanMode = (flagString(flags, "scan-mode", "standard") ?? "standard").toLowerCase();
  if (!SCAN_MODES.has(scanMode)) {
    throw new Error(`Unknown --scan-mode "${scanMode}". Use quick, standard, or deep.`);
  }

  // Load the matching public scan-mode skill so its guidance shapes the run.
  const skillsRoot = flagString(flags, "skills") ?? defaultSkillsRoot();
  const scanModeSkill = await loadSkillBySlug(skillsRoot, `scan-mode-${scanMode}`).catch(() => undefined);

  const multi = targets.length > 1;
  const states: AssessmentState[] = [];

  for (const target of targets) {
    const workspaceDir = multi ? path.join(baseOut, targetSlug(target)) : baseOut;
    console.error(
      renderRunHeader({ target, goal, framework, workspaceDir, mode: dryRun ? "dry-run" : "live", scanMode }),
    );

    const reporter = createLiveReporter(target);
    try {
      const state = await runPublicAgent({
        target,
        goal,
        workspaceDir,
        model: flagString(flags, "model"),
        baseUrl: flagString(flags, "base-url"),
        apiKey,
        maxSteps: parsed.all["max-steps"] ? flagNumber(flags, "max-steps", 8) : undefined,
        allowShell: flags["allow-shell"] === true,
        framework,
        scanMode: scanMode as ScanMode,
        scanModeGuidance: scanModeSkill?.content,
        dryRun: flags["dry-run"] === true,
        onEvent: reporter.onEvent,
      });
      states.push(state);
      console.log(renderRunSummary(state.findings, path.resolve(state.workspaceDir)));
    } finally {
      reporter.stop();
    }
  }

  if (multi) {
    const allFindings = states.flatMap((state) => state.findings);
    console.log(renderMultiSummary(states.length, allFindings, path.resolve(baseOut)));
  }
};

const commandSandboxVerify = async (flags: Record<string, string | boolean>): Promise<void> => {
  const manifestPath = path.resolve(flagString(flags, "manifest") ?? defaultSandboxManifest());
  const manifest = (await readJson<Array<{ name: string; command: string; expect: string }>>(manifestPath)).filter(
    (entry) => entry.name && entry.command && entry.expect,
  );
  let failed = 0;
  for (const entry of manifest) {
    const result = await runShellCommand(entry.command, { cwd: process.cwd(), timeoutMs: 20000 });
    const output = `${result.stdout}\n${result.stderr}`;
    const passed = new RegExp(entry.expect, "i").test(output) && result.exitCode === 0;
    console.log(`${status(passed ? "PASS" : "FAIL")} ${entry.name}`);
    if (!passed) failed += 1;
  }
  if (failed > 0) {
    throw new Error(`${failed} sandbox tool check(s) failed`);
  }
};

const commandIngest = async (positionals: string[], flags: Record<string, string | boolean>): Promise<void> => {
  const inputPath = path.resolve(requireValue(positionals[1], "input path"));
  const out = path.resolve(requireValue(flagString(flags, "out"), "--out"));
  const findings = await parseScannerPath(inputPath);
  await writeJson(out, findings);
  console.log(`${status("PASS")} wrote ${findings.length} finding(s) to ${out}`);
};

const stateFromFindings = async (
  findingsPath: string,
  flags: Record<string, string | boolean>,
): Promise<AssessmentState> => {
  const findings = await readJson<Finding[]>(path.resolve(findingsPath));
  const workspaceDir = await ensureWorkspace(flagString(flags, "workspace", ".null/report")!);
  const state = createAssessmentState(
    flagString(flags, "target", "imported findings")!,
    flagString(flags, "goal", "Generate report from imported findings.")!,
    workspaceDir,
  );
  state.findings = findings;
  state.completed = true;
  state.finishedAt = new Date().toISOString();
  return state;
};

const commandReportGenerate = async (positionals: string[], flags: Record<string, string | boolean>): Promise<void> => {
  const findingsPath = requireValue(positionals[2], "findings path");
  const out = path.resolve(requireValue(flagString(flags, "out"), "--out"));
  const state = await stateFromFindings(findingsPath, flags);
  state.complianceMappings = mapFindingsToCompliance(
    state.findings,
    normalizeFramework(flagString(flags, "framework", "owasp-top10")!),
  );
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, renderMarkdownReport(state), "utf8");
  const sarifOut = flagString(flags, "sarif");
  if (sarifOut) {
    await writeJson(path.resolve(sarifOut), renderSarif(state.findings));
  }
  console.log(`${status("PASS")} wrote report to ${out}`);
};

const commandComplianceMap = async (positionals: string[], flags: Record<string, string | boolean>): Promise<void> => {
  const findingsPath = requireValue(positionals[2], "findings path");
  const out = path.resolve(requireValue(flagString(flags, "out"), "--out"));
  const findings = await readJson<Finding[]>(path.resolve(findingsPath));
  const framework = normalizeFramework(flagString(flags, "framework", "owasp-top10")!);
  await writeJson(out, mapFindingsToCompliance(findings, framework));
  console.log(`${status("PASS")} wrote ${framework} readiness mapping to ${out}`);
};

const commandSkills = async (positionals: string[], flags: Record<string, string | boolean>): Promise<void> => {
  const root = flagString(flags, "root") ?? defaultSkillsRoot();
  if (positionals[1] === "list") {
    const skills = await loadPublicSkills(root);
    for (const skill of skills) console.log(`${skill.slug}\t${skill.category}\t${skill.description}`);
    return;
  }
  if (positionals[1] === "show") {
    const slug = requireValue(positionals[2], "skill slug");
    const skill = await loadSkillBySlug(root, slug);
    if (!skill) throw new Error(`Skill not found: ${slug}`);
    console.log(`# ${skill.name}\n\n${skill.content}`);
    return;
  }
  throw new Error("Unknown skills command");
};

const main = async (): Promise<void> => {
  const parsed = parseArgs(process.argv.slice(2));
  const [command, subcommand] = parsed.positionals;
  if (command === "version" || parsed.flags.version === true) {
    console.log(`${accent("Null AI CLI")} ${colors.dim("by NullSquare")} v${await readVersion()}`);
    return;
  }
  if (command === "help" || parsed.flags.help === true) {
    console.log(usage(await readVersion()));
    return;
  }
  if (!command) {
    console.log(home());
    return;
  }
  if (command === "agent" && subcommand === "run") return commandAgentRun(parsed);
  if (command === "sandbox" && subcommand === "verify") return commandSandboxVerify(parsed.flags);
  if (command === "ingest") return commandIngest(parsed.positionals, parsed.flags);
  if (command === "report" && subcommand === "generate") return commandReportGenerate(parsed.positionals, parsed.flags);
  if (command === "compliance" && subcommand === "map") return commandComplianceMap(parsed.positionals, parsed.flags);
  if (command === "skills") return commandSkills(parsed.positionals, parsed.flags);
  throw new Error(`Unknown command: ${parsed.positionals.join(" ")}`);
};

main().catch((error: unknown) => {
  console.error(`${status("FAIL")} ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
