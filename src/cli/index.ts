#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runPublicAgent } from "../agent/loop.js";
import { mapFindingsToCompliance, normalizeFramework } from "../compliance/map.js";
import { environmentApiKeyForProvider } from "../config/modelCatalog.js";
import { loadModelProfile } from "../config/profiles.js";
import type { AssessmentState, Finding } from "../findings/types.js";
import { createAssessmentState } from "../findings/types.js";
import { renderMarkdownReport, summarizeAssessment } from "../reports/markdown.js";
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
import { runInteractive } from "./interactive.js";
import {
  exitCodeForStates,
  openLocalPath,
  renderRunTrace,
  reportPathForWorkspace,
  successfulEvidenceCount,
} from "./runView.js";
import type { ScanMode, WorkflowMode } from "../agent/loop.js";

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
const WORKFLOWS = new Set(["pentest", "compliance"]);

const defaultGoalForWorkflow = (workflow: WorkflowMode): string =>
  workflow === "compliance"
    ? "Assess scoped evidence and map findings to compliance-readiness controls."
    : "Perform a scoped pentest and produce evidence-backed findings.";

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

const WEB_LAB_GOAL =
  "Run a shallow, evidence-first assessment of an authorized training lab. Confirm reachability, capture safe web metadata, check common public files, optionally run enabled scanners, and report only evidence-backed simple issues.";

const webLabScope = (target: string): string =>
  `Authorized training-lab assessment for ${target}; exclude destructive testing, credential attacks, denial of service, persistence, exploit chaining, and third-party systems.`;

const combineGuidance = (...items: Array<string | undefined>): string | undefined => {
  const content = items.map((item) => item?.trim()).filter(Boolean);
  return content.length ? content.join("\n\n") : undefined;
};

const home = (): string => [
  renderBanner(),
  "",
  section("Start"),
  `  ${colorCommand("null-ai")}                              ${colors.dim("open the guided interactive session")}`,
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
  `  ${colorCommand("interactive")} ${colors.dim("(or just")} ${colorCommand("null-ai")}${colors.dim(")")}   guided session: set scope/RoE, run, review findings`,
  `  ${colorCommand("null-ai demo")} --target <authorized-lab-url> --authorize ${colors.dim("[--out .null/demo] [--allow-shell]")}`,
  `  ${colorCommand("null-ai run show")} <workspace>      ${colors.dim("render saved run-state trace")}`,
  `  ${colorCommand("null-ai run open")} <workspace>      ${colors.dim("open report or workspace folder")}`,
  `  ${colorCommand("agent run")} --target <url|host|path> [--workflow pentest|compliance] [--scan-mode quick|standard|deep]`,
  `    ${colors.dim("[--goal <text>] [--profile web-lab] [--framework <id>] [--out .null/run] [--allow-shell] [--dry-run] [--stream]")}`,
  `  ${colorCommand("null-ai sandbox verify")} [--manifest <path>]`,
  `  ${colorCommand("null-ai ingest")} <file-or-dir> --out findings.json`,
  `  ${colorCommand("null-ai report generate")} <findings.json> --out report.md [--sarif findings.sarif]`,
  `  ${colorCommand("null-ai compliance map")} <findings.json> --framework <owasp-top10|pci-dss-lite|iso27001-lite|nist-csf-lite> --out compliance.json`,
  `  ${colorCommand("null-ai skills list")} [--root <path>]`,
  `  ${colorCommand("null-ai skills show")} <slug> [--root <path>]`,
  "",
  section("Model env"),
  "  Active model profile (configured in the interactive wizard)",
  "  NULL_AI_API_KEY or provider-specific key env (OPENAI, DEEPSEEK, ANTHROPIC, GLM, MOONSHOT, DASHSCOPE/QWEN)",
  "  NULL_AI_BASE_URL or OPENAI_BASE_URL",
  "  NULL_AI_MODEL or OPENAI_MODEL",
  "",
  colors.gray(`Aliases: null-ai, null-cli, null, nullsquare  |  Version: ${version}`),
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

  const workflow = (flagString(flags, "workflow", "pentest") ?? "pentest").toLowerCase();
  if (!WORKFLOWS.has(workflow)) {
    throw new Error(`Unknown --workflow "${workflow}". Use pentest or compliance.`);
  }

  const assessmentProfile = flagString(flags, "profile");
  if (assessmentProfile && assessmentProfile !== "web-lab") {
    throw new Error(`Unknown assessment profile "${assessmentProfile}". Supported profile: web-lab.`);
  }
  const goal = flagString(
    flags,
    "goal",
    assessmentProfile === "web-lab" ? WEB_LAB_GOAL : defaultGoalForWorkflow(workflow as WorkflowMode),
  )!;
  const baseOut = flagString(flags, "out", ".null/run")!;
  const framework = flagString(flags, "framework") ?? (workflow === "compliance" ? "owasp-top10" : undefined);
  const profile = await loadModelProfile().catch(() => null);
  const apiKey =
    flagString(flags, "api-key") ??
    profile?.apiKey ??
    environmentApiKeyForProvider(profile?.provider ?? "openai");
  const model =
    flagString(flags, "model") ??
    process.env.NULL_AI_MODEL ??
    process.env.OPENAI_MODEL ??
    profile?.model;
  const baseUrl =
    flagString(flags, "base-url") ??
    process.env.NULL_AI_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    profile?.baseUrl;
  const dryRun = flags["dry-run"] === true || !apiKey;

  const scanMode = (flagString(flags, "scan-mode") ?? flagString(flags, "depth", "standard") ?? "standard").toLowerCase();
  if (!SCAN_MODES.has(scanMode)) {
    throw new Error(`Unknown scan depth "${scanMode}". Use quick, standard, or deep (--scan-mode / --depth).`);
  }

  // Load the matching public scan-mode skill so its guidance shapes the run.
  const skillsRoot = flagString(flags, "skills") ?? defaultSkillsRoot();
  const scanModeSkill = await loadSkillBySlug(skillsRoot, `scan-mode-${scanMode}`).catch(() => undefined);
  const webLabSkill = assessmentProfile === "web-lab"
    ? await loadSkillBySlug(skillsRoot, "web-lab").catch(() => undefined)
    : undefined;

  const multi = targets.length > 1;
  const states: AssessmentState[] = [];

  for (const target of targets) {
    const workspaceDir = multi ? path.join(baseOut, targetSlug(target)) : baseOut;
    console.error(
      renderRunHeader({ target, goal, ...(framework ? { framework } : {}), workspaceDir, mode: dryRun ? "dry-run" : "live", scanMode }),
    );

    const reporter = createLiveReporter(target);
    try {
      const state = await runPublicAgent({
        target,
        goal,
        workspaceDir,
        model,
        baseUrl,
        apiKey,
        maxSteps: parsed.all["max-steps"] ? flagNumber(flags, "max-steps", 8) : undefined,
        allowShell: flags["allow-shell"] === true,
        ...(framework ? { framework } : {}),
        scope: flagString(flags, "scope") ?? (assessmentProfile === "web-lab" ? webLabScope(target) : undefined),
        workflow: workflow as WorkflowMode,
        scanMode: scanMode as ScanMode,
        scanModeGuidance: combineGuidance(webLabSkill?.content, scanModeSkill?.content),
        dryRun: flags["dry-run"] === true,
        streamModel: flags.stream === true,
        onEvent: reporter.onEvent,
      });
      states.push(state);
      console.log(
        renderRunSummary(state.findings, path.resolve(state.workspaceDir), {
          evidence: state.evidence.length,
          successfulEvidence: successfulEvidenceCount(state),
          actions: state.actions.length,
          outcome: state.outcome,
          summary: summarizeAssessment(state),
          reportPath: path.resolve(state.workspaceDir, "reports", "report.md"),
        }),
      );
    } finally {
      reporter.stop();
    }
  }

  if (multi) {
    const allFindings = states.flatMap((state) => state.findings);
    console.log(renderMultiSummary(states.length, allFindings, path.resolve(baseOut)));
  }
  process.exitCode = exitCodeForStates(states);
};

const demoHelp = (): string => [
  section("Demo"),
  `  ${colorCommand("null-ai demo")} --target <authorized-lab-url> --authorize`,
  "",
  "Run a shallow, evidence-first assessment against an authorized training lab.",
  "Use your own OWASP Juice Shop, WebGoat, or equivalent training lab URL.",
  "",
  section("Options"),
  "  --target <url>       Required authorized lab URL",
  "  --authorize          Required for live target contact",
  "  --out <dir>          Workspace output directory (default: .null/demo)",
  "  --allow-shell        Permit local scanner wrappers",
  "  --dry-run            Write a plan without model calls or target contact",
  "  --scan-mode <mode>   quick, standard, or deep (default: standard)",
  "",
  colors.dim("Example: null-ai demo --target http://localhost:3000 --authorize --allow-shell"),
].join("\n");

const commandDemo = async (parsed: ParsedArgs): Promise<void> => {
  const { flags } = parsed;
  if (flags.help === true) {
    console.log(demoHelp());
    return;
  }
  const target = requireValue(flagString(flags, "target"), "--target");
  const liveRequested = flags["dry-run"] !== true;
  if (liveRequested && flags.authorize !== true) {
    throw new Error(
      [
        "Demo runs contact the target. Confirm you own or are authorized to test it with --authorize.",
        `Example: null-ai demo --target ${target} --authorize`,
      ].join("\n"),
    );
  }

  const scanMode = (flagString(flags, "scan-mode") ?? flagString(flags, "depth", "standard") ?? "standard").toLowerCase();
  if (!SCAN_MODES.has(scanMode)) {
    throw new Error(`Unknown scan depth "${scanMode}". Use quick, standard, or deep (--scan-mode / --depth).`);
  }

  const workspaceDir = flagString(flags, "out", ".null/demo")!;
  const profile = await loadModelProfile().catch(() => null);
  const apiKey =
    flagString(flags, "api-key") ??
    profile?.apiKey ??
    environmentApiKeyForProvider(profile?.provider ?? "openai");
  const model =
    flagString(flags, "model") ??
    process.env.NULL_AI_MODEL ??
    process.env.OPENAI_MODEL ??
    profile?.model;
  const baseUrl =
    flagString(flags, "base-url") ??
    process.env.NULL_AI_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    profile?.baseUrl;
  const dryRun = flags["dry-run"] === true || !apiKey;
  const skillsRoot = flagString(flags, "skills") ?? defaultSkillsRoot();
  const scanModeSkill = await loadSkillBySlug(skillsRoot, `scan-mode-${scanMode}`).catch(() => undefined);
  const webLabSkill = await loadSkillBySlug(skillsRoot, "web-lab").catch(() => undefined);

  console.error(renderRunHeader({ target, goal: WEB_LAB_GOAL, workspaceDir, mode: dryRun ? "dry-run" : "live", scanMode }));
  const reporter = createLiveReporter(target);
  try {
    const state = await runPublicAgent({
      target,
      goal: WEB_LAB_GOAL,
      scope: webLabScope(target),
      workspaceDir,
      model,
      baseUrl,
      apiKey,
      allowShell: flags["allow-shell"] === true,
      workflow: "pentest",
      scanMode: scanMode as ScanMode,
      scanModeGuidance: combineGuidance(webLabSkill?.content, scanModeSkill?.content),
      dryRun,
      streamModel: flags.stream === true,
      onEvent: reporter.onEvent,
    });
    console.log(
      renderRunSummary(state.findings, path.resolve(state.workspaceDir), {
        evidence: state.evidence.length,
        successfulEvidence: successfulEvidenceCount(state),
        actions: state.actions.length,
        outcome: state.outcome,
        summary: summarizeAssessment(state),
        reportPath: reportPathForWorkspace(state.workspaceDir),
      }),
    );
    process.exitCode = exitCodeForStates([state]);
  } finally {
    reporter.stop();
  }
};

const commandRun = async (positionals: string[], flags: Record<string, string | boolean>): Promise<void> => {
  const subcommand = positionals[1];
  const workspace = path.resolve(requireValue(positionals[2], "workspace"));
  if (subcommand === "show") {
    const state = await readJson<AssessmentState>(path.join(workspace, "run-state.json"));
    console.log(renderRunTrace(state, workspace));
    return;
  }
  if (subcommand === "open") {
    const reportPath = reportPathForWorkspace(workspace);
    const openFolder = flags.folder === true;
    const target = openFolder ? workspace : reportPath;
    const ok = openLocalPath(target);
    console.log(ok ? `${status("PASS")} opened ${openFolder ? "workspace" : "report"}` : `${colors.dim(openFolder ? "workspace" : "report")} ${accent(target)}`);
    return;
  }
  throw new Error("Unknown run command. Use: null-ai run show <workspace> | null-ai run open <workspace>");
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
  if (command === "help" || (!command && parsed.flags.help === true)) {
    console.log(usage(await readVersion()));
    return;
  }
  if (command === "interactive" || command === "chat") {
    return runInteractive(flagString(parsed.flags, "out"));
  }
  if (!command) {
    // Bare invocation on a terminal opens the guided interactive session;
    // when piped / non-TTY it prints the static home screen for scripts.
    if (process.stdin.isTTY && process.stdout.isTTY) return runInteractive(flagString(parsed.flags, "out"));
    console.log(home());
    return;
  }
  if (command === "demo") return commandDemo(parsed);
  if (command === "run") return commandRun(parsed.positionals, parsed.flags);
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
