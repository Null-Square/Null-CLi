import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runPublicAgent, type ScanMode, type WorkflowMode } from "../agent/loop.js";
import { mapFindingsToCompliance, normalizeFramework, type ComplianceFramework } from "../compliance/map.js";
import {
  activateModelProfile,
  deleteModelProfile,
  listModelProfiles,
  loadModelProfile,
  saveModelProfile,
  type ResolvedModelProfile,
} from "../config/profiles.js";
import type { Finding } from "../findings/types.js";
import { ensureWorkspace, readJson, writeJson } from "../runtime/workspace.js";
import { loadSkillBySlug } from "../skills/loader.js";
import {
  accent,
  colors,
  renderBanner,
  renderRunHeader,
  renderRunSummary,
  section,
  severityTag,
  status,
} from "./brand.js";
import { createLiveReporter } from "./live.js";
import { checkForCliUpdate } from "./update.js";

// Assessment state and credentials are persisted separately. session.json never
// contains the API key; the selected profile resolves it from the local vault.
interface SessionConfig {
  targets: string[];
  goal: string;
  workflow: WorkflowMode;
  scanMode: ScanMode;
  framework: ComplianceFramework;
  allowShell: boolean;
  authorized: boolean;
  scopeNote: string;
  streamModel: boolean;
  profile?: string;
  model?: string;
  baseUrl?: string;
  workspaceDir: string;
}

const SCAN_MODES = new Set<ScanMode>(["quick", "standard", "deep"]);
const WORKFLOWS = new Set<WorkflowMode>(["pentest", "compliance"]);
const FRAMEWORKS: ComplianceFramework[] = ["owasp-top10", "pci-dss-lite", "iso27001-lite", "nist-csf-lite"];

const DEFAULT_GOALS: Record<WorkflowMode, string> = {
  pentest: "Perform a scoped pentest and produce evidence-backed findings.",
  compliance: "Assess scoped evidence and map findings to compliance-readiness controls.",
};

const COMMANDS = [
  "/help",
  "/wizard",
  "/status",
  "/target",
  "/targets",
  "/goal",
  "/scope",
  "/workflow",
  "/mode",
  "/depth",
  "/framework",
  "/shell",
  "/stream",
  "/profile",
  "/authorize",
  "/deauthorize",
  "/env",
  "/run",
  "/findings",
  "/report",
  "/compliance",
  "/open",
  "/clear",
  "/exit",
  "/quit",
];

const packagePath = (relativePath: string): string => fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));
const defaultSkillsRoot = (): string => packagePath("skills");

const targetSlug = (target: string): string =>
  target
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[^a-z0-9.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "target";

const defaultConfig = (workspaceDir: string): SessionConfig => ({
  targets: [],
  goal: DEFAULT_GOALS.pentest,
  workflow: "pentest",
  scanMode: "standard",
  framework: "owasp-top10",
  allowShell: false,
  authorized: false,
  scopeNote: "",
  streamModel: true,
  workspaceDir,
});

const sessionFile = (workspaceDir: string): string => path.join(workspaceDir, "session.json");

const loadSession = async (workspaceDir: string): Promise<SessionConfig | null> => {
  try {
    const raw = await readJson<Partial<SessionConfig>>(sessionFile(workspaceDir));
    return {
      ...defaultConfig(workspaceDir),
      ...raw,
      workflow: WORKFLOWS.has(raw.workflow as WorkflowMode) ? (raw.workflow as WorkflowMode) : "pentest",
      scanMode: SCAN_MODES.has(raw.scanMode as ScanMode) ? (raw.scanMode as ScanMode) : "standard",
      framework: normalizeFramework(raw.framework ?? "owasp-top10"),
      workspaceDir,
    };
  } catch {
    return null;
  }
};

const HELP = [
  section("Session"),
  `  ${accent("/wizard")}                  configure & run    ${accent("/status")}             show configuration`,
  `  ${accent("/target")} <url|host|path>  add target         ${accent("/targets")} [clear]    list / clear targets`,
  `  ${accent("/scope")} <text>            scope / RoE note   ${accent("/authorize")}          confirm authorization`,
  `  ${accent("/workflow")} pentest|compliance                ${accent("/depth")} quick|standard|deep`,
  `  ${accent("/mode")} pentest|compliance  alias for workflow; /mode quick|standard|deep still sets depth`,
  `  ${accent("/framework")} <id>          set mapping        ${accent("/shell")} on|off       allow scanners/shell`,
  `  ${accent("/profile")} setup|list|use  model credentials  ${accent("/env")} model|key|base <v>`,
  `  ${accent("/stream")} on|off           stream model status`,
  "",
  section("Run & review"),
  `  ${accent("/run")}                     start assessment   ${accent("/findings")}           list findings`,
  `  ${accent("/report")}                  show report path   ${accent("/compliance")}         readiness summary`,
  `  ${accent("/open")} report|sarif|folder                  ${accent("/clear")}               redraw banner`,
  `  ${accent("/help")}                    this help          ${accent("/exit")}                leave`,
  "",
  colors.dim("Tip: type plain text without a slash to replace the assessment goal."),
].join("\n");

const ask = (rl: readline.Interface, prompt: string): Promise<string> =>
  new Promise((resolve) => rl.question(prompt, resolve));

const askSecret = async (rl: readline.Interface, prompt: string): Promise<string> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return ask(rl, prompt);

  const terminal = rl as readline.Interface & { _writeToOutput?: (value: string) => void };
  const original = terminal._writeToOutput;
  process.stdout.write(prompt);
  terminal._writeToOutput = () => undefined;
  try {
    return await ask(rl, "");
  } finally {
    terminal._writeToOutput = original;
    process.stdout.write("\n");
  }
};

const yes = (value: string): boolean => /^(y|yes|true|1)$/i.test(value.trim());

const typewrite = async (text: string): Promise<void> => {
  if (!process.stdout.isTTY) {
    console.log(text);
    return;
  }
  for (const char of text) {
    process.stdout.write(char);
    await new Promise((resolve) => setTimeout(resolve, 4));
  }
  process.stdout.write("\n");
};

const completer = (line: string): [string[], string] => {
  const [cmd, rest = ""] = line.split(/\s+/, 2);
  if (!line.startsWith("/")) return [[], line];
  if (!line.includes(" ")) {
    const hits = COMMANDS.filter((command) => command.startsWith(line));
    return [hits.length ? hits : COMMANDS, line];
  }

  const word = rest.trim();
  const values =
    cmd === "/workflow" || cmd === "/mode"
      ? [...WORKFLOWS, ...SCAN_MODES]
      : cmd === "/depth"
        ? [...SCAN_MODES]
        : cmd === "/framework"
          ? FRAMEWORKS
          : cmd === "/shell" || cmd === "/stream"
            ? ["on", "off"]
            : cmd === "/env"
              ? ["model", "key", "base"]
              : cmd === "/profile"
                ? ["setup", "list", "use", "delete"]
              : cmd === "/open"
                ? ["report", "sarif", "folder"]
                : [];
  const hits = values.filter((value) => value.startsWith(word));
  return [hits.map((hit) => `${cmd} ${hit}`), line];
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const openLocalPath = (filePath: string): boolean => {
  const resolved = path.resolve(filePath);
  const command = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = [resolved];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
};

export const runInteractive = async (workspaceDirArg?: string): Promise<void> => {
  const updateCheck = checkForCliUpdate().catch(() => null);
  const workspaceDir = workspaceDirArg ?? ".null/session";
  await ensureWorkspace(workspaceDir);
  const loaded = await loadSession(workspaceDir);
  const cfg: SessionConfig = loaded ?? defaultConfig(workspaceDir);
  cfg.workspaceDir = workspaceDir;
  let profileRef: ResolvedModelProfile | null = await loadModelProfile(cfg.profile).catch(() => null);
  if (!profileRef && cfg.profile) profileRef = await loadModelProfile().catch(() => null);
  if (profileRef) {
    cfg.profile = profileRef.name;
    cfg.model = profileRef.model;
    cfg.baseUrl = profileRef.baseUrl;
  }
  const apiKeyRef: { value?: string } = {
    value: process.env.NULL_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? profileRef?.apiKey,
  };

  const save = async (): Promise<void> => {
    await writeJson(sessionFile(workspaceDir), cfg);
  };

  const invalidateAuthorization = (reason: string): void => {
    if (!cfg.authorized) return;
    cfg.authorized = false;
    console.log(`${status("WARN")} ${colors.muted(`authorization reset: ${reason}. Run /authorize again.`)}`);
  };

  const setWorkflow = async (workflow: WorkflowMode): Promise<void> => {
    const hadDefaultGoal = Object.values(DEFAULT_GOALS).includes(cfg.goal);
    cfg.workflow = workflow;
    if (hadDefaultGoal) cfg.goal = DEFAULT_GOALS[workflow];
    await save();
    console.log(colors.dim(`workflow: ${workflow}`));
  };

  const runWorkspaces = (): string[] =>
    cfg.targets.length > 1 ? cfg.targets.map((target) => path.join(workspaceDir, targetSlug(target))) : [workspaceDir];

  const reportPaths = (): string[] => runWorkspaces().map((dir) => path.join(dir, "reports", "report.md"));
  const sarifPaths = (): string[] => runWorkspaces().map((dir) => path.join(dir, "findings.sarif"));

  const loadFindings = async (): Promise<Finding[]> => {
    const findings: Finding[] = [];
    const seen = new Set<string>();
    for (const dir of runWorkspaces()) {
      try {
        const batch = await readJson<Finding[]>(path.join(dir, "findings.json"));
        for (const finding of batch) {
          const key = `${finding.id}:${finding.target}:${finding.title}`;
          if (!seen.has(key)) {
            seen.add(key);
            findings.push(finding);
          }
        }
      } catch {
        // Missing findings are normal before the first run.
      }
    }
    return findings;
  };

  const printStatus = (): void => {
    const on = (value: boolean): string => (value ? accent("on") : colors.dim("off"));
    console.log(section("Session status"));
    console.log(`  ${colors.dim("workflow")}   ${colors.fg(cfg.workflow)}    ${colors.dim("depth")} ${colors.fg(cfg.scanMode)}`);
    console.log(`  ${colors.dim("targets")}    ${cfg.targets.length ? cfg.targets.map((target) => colors.fg(target)).join(colors.dim(", ")) : colors.dim("(none - /target <url>)")}`);
    console.log(`  ${colors.dim("goal")}       ${colors.muted(cfg.goal)}`);
    console.log(`  ${colors.dim("framework")}  ${colors.fg(cfg.framework)}    ${colors.dim("stream")} ${on(cfg.streamModel)}`);
    console.log(`  ${colors.dim("scanners")}   ${on(cfg.allowShell)}    ${colors.dim("authorized")} ${cfg.authorized ? accent("yes") : status("WARN")}`);
    console.log(`  ${colors.dim("scope/RoE")}  ${cfg.scopeNote ? colors.muted(cfg.scopeNote) : colors.dim("(none - /scope <text>)")}`);
    console.log(`  ${colors.dim("profile")}    ${cfg.profile ? colors.fg(cfg.profile) : colors.dim("(not configured)")}`);
    console.log(`  ${colors.dim("model")}      ${colors.fg(cfg.model ?? process.env.NULL_AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini")}    ${colors.dim("api key")} ${apiKeyRef.value ? accent("ready") : status("WARN")}`);
    console.log(`  ${colors.dim("workspace")}  ${accent(path.resolve(workspaceDir))}`);
  };

  const printFindings = async (): Promise<void> => {
    const findings = await loadFindings();
    if (!findings.length) {
      console.log(colors.dim("No findings recorded yet. Run an assessment with /run."));
      return;
    }
    console.log(section(`Findings (${findings.length})`));
    for (const finding of findings) {
      console.log(`  ${severityTag(finding.severity)} ${colors.fg(finding.title)} ${colors.dim(finding.target)}`);
    }
  };

  const printReport = async (): Promise<void> => {
    const paths = reportPaths();
    const existing = [];
    for (const reportPath of paths) {
      if (await fileExists(reportPath)) existing.push(reportPath);
    }
    if (!existing.length) {
      console.log(colors.dim("No report yet. Run /run first."));
      return;
    }
    for (const reportPath of existing) {
      console.log(`${colors.dim("report")}  ${accent(path.resolve(reportPath))}`);
    }
  };

  const printCompliance = async (): Promise<void> => {
    const findings = await loadFindings();
    if (!findings.length) {
      console.log(colors.dim("No findings to map yet. Run /run first."));
      return;
    }
    const mappings = mapFindingsToCompliance(findings, cfg.framework);
    const counts = mappings.reduce<Record<string, number>>((acc, mapping) => {
      acc[mapping.status] = (acc[mapping.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(section(`${cfg.framework} readiness`));
    console.log(
      `  ${colors.red(`${counts.impacted ?? 0} impacted`)}  ${colors.yellow(`${counts.review ?? 0} review`)}  ${colors.dim(`${counts.no_evidence ?? 0} no-evidence`)}`,
    );
  };

  const doRun = async (): Promise<void> => {
    if (cfg.targets.length === 0) {
      console.log(status("WARN") + colors.muted(" add a target first: /target <url>"));
      return;
    }
    if (!cfg.scopeNote) {
      console.log(status("WARN") + colors.muted(" declare the scope / rules of engagement first: /scope <text>"));
      return;
    }
    if (!cfg.authorized) {
      console.log(status("WARN") + colors.muted(" this run contacts a target or runs scanners."));
      console.log(colors.muted(`  Confirm you are authorized to test ${cfg.targets.join(", ")} - type ${accent("/authorize")}.`));
      return;
    }
    const apiKey = apiKeyRef.value;
    if (!apiKey) {
      console.log(`${status("WARN")} ${colors.muted("no API key is available. Run /profile setup before starting.")}`);
      return;
    }
    const skill = await loadSkillBySlug(defaultSkillsRoot(), `scan-mode-${cfg.scanMode}`).catch(() => undefined);
    const multi = cfg.targets.length > 1;
    for (const target of cfg.targets) {
      const runWorkspace = multi ? path.join(workspaceDir, targetSlug(target)) : workspaceDir;
      process.stderr.write(
        `${renderRunHeader({ target, goal: cfg.goal, framework: cfg.framework, workspaceDir: runWorkspace, mode: "live", scanMode: cfg.scanMode })}\n`,
      );
      const reporter = createLiveReporter(target);
      try {
        const state = await runPublicAgent({
          target,
          goal: cfg.goal,
          workspaceDir: runWorkspace,
          apiKey,
          model: cfg.model,
          baseUrl: cfg.baseUrl,
          allowShell: cfg.allowShell,
          framework: cfg.framework,
          workflow: cfg.workflow,
          scanMode: cfg.scanMode,
          scanModeGuidance: skill?.content,
          streamModel: cfg.streamModel,
          onEvent: reporter.onEvent,
        });
        console.log(renderRunSummary(state.findings, path.resolve(runWorkspace)));
      } finally {
        reporter.stop();
      }
    }
  };

  const handleEnv = async (rest: string[]): Promise<void> => {
    const [key, ...valueParts] = rest;
    const value = valueParts.join(" ");
    if (key === "model") cfg.model = value || undefined;
    else if (key === "base") cfg.baseUrl = value || undefined;
    else if (key === "key") {
      apiKeyRef.value = value || undefined;
      console.log(colors.dim(value ? "api key set for this process; use /profile setup to save it" : "api key cleared"));
      return;
    } else {
      console.log(colors.dim("usage: /env model <id> | /env key <value> | /env base <url>"));
      return;
    }
    console.log(colors.dim(`${key} set for this process; use /profile setup to save it`));
  };

  const configureProfile = async (rl: readline.Interface): Promise<boolean> => {
    console.log(section("Model profile"));
    const currentName = profileRef?.name ?? cfg.profile ?? "default";
    const name = (await ask(rl, `Profile name (${currentName}): `)).trim() || currentName;
    const currentModel =
      profileRef?.model ?? cfg.model ?? process.env.NULL_AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const model = (await ask(rl, `Model id (${currentModel}): `)).trim() || currentModel;
    const currentBase = profileRef?.baseUrl ?? cfg.baseUrl ?? process.env.NULL_AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const baseUrl = (await ask(rl, `OpenAI-compatible base URL (${currentBase}): `)).trim() || currentBase;

    const existing = await loadModelProfile(name).catch(() => null);
    const keyPrompt = existing?.apiKey
      ? "API key (Enter keeps the saved key): "
      : "API key (required; saved in the encrypted local vault): ";
    const enteredKey = (await askSecret(rl, keyPrompt)).trim();
    const environmentKey = process.env.NULL_AI_API_KEY ?? process.env.OPENAI_API_KEY;
    const apiKey = enteredKey || existing?.apiKey || environmentKey;
    if (!apiKey) {
      console.log(`${status("WARN")} ${colors.muted("an API key is required to complete a model profile.")}`);
      return false;
    }

    profileRef = await saveModelProfile({ name, model, baseUrl, apiKey: enteredKey || (existing?.apiKey ? undefined : apiKey) });
    cfg.profile = profileRef.name;
    cfg.model = profileRef.model;
    cfg.baseUrl = profileRef.baseUrl;
    apiKeyRef.value = process.env.NULL_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? profileRef.apiKey;
    await save();
    console.log(`${status("PASS")} ${colors.muted(`profile "${profileRef.name}" saved; API key encrypted locally.`)}`);
    return true;
  };

  const ensureProfile = async (rl: readline.Interface): Promise<boolean> => {
    if (profileRef?.apiKey && apiKeyRef.value) {
      const keep = await ask(rl, `Use model profile "${profileRef.name}" (${profileRef.model})? [Y/n]: `);
      if (!/^(n|no)$/i.test(keep.trim())) return true;
    }
    return configureProfile(rl);
  };

  const handleProfile = async (rest: string[], rl: readline.Interface): Promise<void> => {
    const [action, name] = rest;
    if (!action || action === "list") {
      const profiles = await listModelProfiles();
      if (!profiles.length) {
        console.log(colors.dim("No model profiles. Run /profile setup."));
        return;
      }
      for (const profile of profiles) {
        const marker = profile.name === cfg.profile ? accent("*") : " ";
        console.log(`  ${marker} ${colors.fg(profile.name)} ${colors.dim(profile.model)} ${colors.dim(profile.baseUrl ?? "")}`);
      }
      return;
    }
    if (action === "setup") {
      await configureProfile(rl);
      return;
    }
    if (action === "use" && name) {
      profileRef = await activateModelProfile(name);
      cfg.profile = profileRef.name;
      cfg.model = profileRef.model;
      cfg.baseUrl = profileRef.baseUrl;
      apiKeyRef.value = process.env.NULL_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? profileRef.apiKey;
      await save();
      console.log(`${status("PASS")} ${colors.dim(`using profile "${name}"`)}`);
      return;
    }
    if (action === "delete" && name) {
      await deleteModelProfile(name);
      if (cfg.profile === name) {
        profileRef = await loadModelProfile().catch(() => null);
        cfg.profile = profileRef?.name;
        cfg.model = profileRef?.model;
        cfg.baseUrl = profileRef?.baseUrl;
        apiKeyRef.value = process.env.NULL_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? profileRef?.apiKey;
        await save();
      }
      console.log(colors.dim(`profile "${name}" deleted`));
      return;
    }
    console.log(colors.dim("usage: /profile setup|list|use <name>|delete <name>"));
  };

  const openTarget = async (kind: string): Promise<void> => {
    const target = kind || "report";
    if (target === "folder") {
      const ok = openLocalPath(workspaceDir);
      console.log(ok ? colors.dim("opened workspace folder") : colors.dim(`workspace: ${path.resolve(workspaceDir)}`));
      return;
    }

    const candidates = target === "sarif" ? sarifPaths() : reportPaths();
    const existing = [];
    for (const candidate of candidates) {
      if (await fileExists(candidate)) existing.push(candidate);
    }
    if (!existing.length) {
      console.log(colors.dim(`No ${target} file yet. Run /run first.`));
      return;
    }
    if (existing.length > 1) {
      console.log(colors.dim(`Multiple ${target} files exist; opening workspace folder instead.`));
      openLocalPath(workspaceDir);
      return;
    }
    const ok = openLocalPath(existing[0]);
    console.log(ok ? colors.dim(`opened ${target}`) : `${colors.dim(target)} ${accent(path.resolve(existing[0]))}`);
  };

  const runWizard = async (rl: readline.Interface): Promise<void> => {
    await typewrite("Null AI guided assessment");
    if (!(await ensureProfile(rl))) {
      console.log(colors.dim("Wizard paused. Run /wizard when the model profile is ready."));
      return;
    }

    console.log(section("Assessment"));
    const workflow = (await ask(rl, `Workflow [pentest/compliance] (${cfg.workflow}): `)).trim().toLowerCase();
    if (WORKFLOWS.has(workflow as WorkflowMode)) {
      const hadDefaultGoal = Object.values(DEFAULT_GOALS).includes(cfg.goal);
      cfg.workflow = workflow as WorkflowMode;
      if (hadDefaultGoal) cfg.goal = DEFAULT_GOALS[cfg.workflow];
    }

    const goal = (await ask(rl, `Goal (${cfg.goal}): `)).trim();
    if (goal) cfg.goal = goal;

    const targetDefault = cfg.targets[0] ?? "";
    const target = (await ask(rl, `Target URL/host/path${targetDefault ? ` (${targetDefault})` : " (required)"}: `)).trim() || targetDefault;
    if (!target) {
      console.log(`${status("WARN")} ${colors.muted("a target is required. Wizard paused.")}`);
      await save();
      return;
    }
    cfg.targets = [target];
    cfg.authorized = false;

    const scope = (await ask(rl, `Scope / rules of engagement${cfg.scopeNote ? ` (${cfg.scopeNote})` : " (required)"}: `)).trim();
    if (scope) cfg.scopeNote = scope;
    if (!cfg.scopeNote) {
      console.log(`${status("WARN")} ${colors.muted("a scope / rules-of-engagement note is required. Wizard paused.")}`);
      await save();
      return;
    }

    const depth = (await ask(rl, `Depth [quick/standard/deep] (${cfg.scanMode}): `)).trim().toLowerCase();
    if (SCAN_MODES.has(depth as ScanMode)) cfg.scanMode = depth as ScanMode;

    const framework = (await ask(rl, `Framework [owasp-top10/pci-dss-lite/iso27001-lite/nist-csf-lite] (${cfg.framework}): `)).trim();
    if (framework) cfg.framework = normalizeFramework(framework);

    const shell = await ask(rl, `Enable scanners/shell? [${cfg.allowShell ? "Y/n" : "y/N"}]: `);
    if (shell.trim()) cfg.allowShell = yes(shell);

    const authorized = await ask(
      rl,
      `Confirm you have written authorization to test ${target} within this scope? [y/N]: `,
    );
    cfg.authorized = yes(authorized);

    await save();
    printStatus();
    if (!cfg.authorized) {
      console.log(`${status("WARN")} ${colors.muted("assessment not started because authorization was not confirmed.")}`);
      return;
    }

    const start = await ask(rl, "Start assessment now? [Y/n]: ");
    if (!/^(n|no)$/i.test(start.trim())) {
      await doRun();
    } else {
      console.log(colors.dim("assessment saved and ready; use /run when needed."));
    }
  };

  const handle = async (line: string, rl: readline.Interface): Promise<boolean> => {
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ").trim();
    switch (cmd) {
      case "/help":
        console.log(HELP);
        break;
      case "/wizard":
        await runWizard(rl);
        break;
      case "/profile":
        await handleProfile(rest, rl);
        break;
      case "/status":
        printStatus();
        break;
      case "/target":
        if (!arg) {
          console.log(cfg.targets.length ? cfg.targets.join("\n") : colors.dim("no targets set"));
        } else if (cfg.targets.includes(arg)) {
          console.log(colors.dim("already in scope"));
        } else {
          cfg.targets.push(arg);
          invalidateAuthorization("target changed");
          await save();
          console.log(`${status("PASS")} ${colors.dim("target added:")} ${colors.fg(arg)}`);
        }
        break;
      case "/targets":
        if (arg === "clear") {
          cfg.targets = [];
          invalidateAuthorization("targets cleared");
          await save();
          console.log(colors.dim("targets cleared"));
        } else {
          console.log(cfg.targets.length ? cfg.targets.join("\n") : colors.dim("no targets set"));
        }
        break;
      case "/goal":
        if (arg) {
          cfg.goal = arg;
          await save();
          console.log(colors.dim("goal set"));
        }
        break;
      case "/scope":
        cfg.scopeNote = arg;
        invalidateAuthorization("scope changed");
        await save();
        console.log(colors.dim("scope note saved"));
        break;
      case "/workflow":
        if (WORKFLOWS.has(arg as WorkflowMode)) await setWorkflow(arg as WorkflowMode);
        else console.log(colors.dim("usage: /workflow pentest|compliance"));
        break;
      case "/mode":
        if (WORKFLOWS.has(arg as WorkflowMode)) await setWorkflow(arg as WorkflowMode);
        else if (SCAN_MODES.has(arg as ScanMode)) {
          cfg.scanMode = arg as ScanMode;
          await save();
          console.log(colors.dim(`depth: ${arg}`));
        } else {
          console.log(colors.dim("usage: /mode pentest|compliance or /depth quick|standard|deep"));
        }
        break;
      case "/depth":
        if (SCAN_MODES.has(arg as ScanMode)) {
          cfg.scanMode = arg as ScanMode;
          await save();
          console.log(colors.dim(`depth: ${arg}`));
        } else {
          console.log(colors.dim("usage: /depth quick|standard|deep"));
        }
        break;
      case "/framework":
        if (arg) {
          cfg.framework = normalizeFramework(arg);
          await save();
          console.log(colors.dim(`framework: ${cfg.framework}`));
        }
        break;
      case "/shell":
        cfg.allowShell = arg === "on";
        await save();
        console.log(
          cfg.allowShell
            ? status("WARN") + colors.muted(" scanners/shell enabled - in-scope assets only")
            : colors.dim("scanners/shell disabled"),
        );
        break;
      case "/stream":
        cfg.streamModel = arg !== "off";
        await save();
        console.log(colors.dim(`stream model status: ${cfg.streamModel ? "on" : "off"}`));
        break;
      case "/authorize":
        if (!cfg.targets.length || !cfg.scopeNote) {
          console.log(`${status("WARN")} ${colors.muted("set at least one target and a scope / RoE note before authorization.")}`);
        } else {
          cfg.authorized = true;
          await save();
          console.log(`${status("PASS")} ${colors.muted("authorization confirmed - you assert written permission to test the declared scope.")}`);
        }
        break;
      case "/deauthorize":
        cfg.authorized = false;
        await save();
        console.log(colors.dim("authorization cleared"));
        break;
      case "/env":
        await handleEnv(rest);
        break;
      case "/run":
        await doRun();
        break;
      case "/findings":
        await printFindings();
        break;
      case "/report":
        await printReport();
        break;
      case "/compliance":
        await printCompliance();
        break;
      case "/open":
        await openTarget(arg);
        break;
      case "/clear":
        console.clear();
        console.log(renderBanner());
        break;
      case "/exit":
      case "/quit":
        return true;
      default:
        if (cmd.startsWith("/")) {
          console.log(colors.dim(`unknown command: ${cmd} - type /help`));
        } else {
          cfg.goal = line;
          await save();
          console.log(colors.dim("goal set - type /run to start, or /help for commands"));
        }
    }
    return false;
  };

  console.log(renderBanner());
  const update = await updateCheck;
  if (update) {
    console.log(
      `\n${status("INFO")} ${colors.fg(`Null AI CLI ${update.latest} is available`)} ${colors.dim(`(installed ${update.current})`)}`,
    );
    console.log(`  ${colors.dim("Update with")} ${accent("npm install -g @nullsquare/null-cli@latest")}`);
  }
  console.log(`\n${accent("guided session")} ${colors.dim("- the wizard configures the model, scope, and assessment, then starts it")}`);
  if (loaded) {
    console.log(colors.dim(`resumed session - ${cfg.targets.length} target(s) - ${cfg.workflow}/${cfg.scanMode} - ${cfg.framework}`));
  } else {
    console.log(colors.dim("new session - the guided assessment will start now"));
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
    completer,
  });
  if (process.stdin.isTTY) readline.emitKeypressEvents(process.stdin, rl);

  let commandInputActive = false;
  let slashPaletteShown = false;
  const onKeypress = (): void => {
    if (!commandInputActive || slashPaletteShown) return;
    setImmediate(() => {
      if (!commandInputActive || slashPaletteShown || rl.line !== "/") return;
      slashPaletteShown = true;
      console.log(
        `\n  ${accent("/wizard")}  ${accent("/profile")}  ${accent("/status")}  ${accent("/run")}  ${accent("/findings")}  ${accent("/report")}  ${accent("/help")}`,
      );
      console.log(colors.dim("  Keep typing or press Tab to complete a command."));
      rl.prompt(true);
    });
  };
  if (process.stdin.isTTY && process.stdout.isTTY) process.stdin.on("keypress", onKeypress);

  if (process.stdin.isTTY && process.stdout.isTTY) {
    await runWizard(rl);
  }

  rl.setPrompt(`\n${accent("null-ai")} ${colors.dim(">")} `);
  commandInputActive = true;
  rl.prompt();
  for await (const raw of rl) {
    commandInputActive = false;
    const line = raw.trim();
    if (line) {
      try {
        const done = await handle(line, rl);
        if (done) break;
      } catch (error) {
        console.log(`${status("FAIL")} ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    commandInputActive = true;
    slashPaletteShown = false;
    rl.prompt();
  }
  process.stdin.off("keypress", onKeypress);
  rl.close();
  await save();
  console.log(`\n${colors.dim("session saved ->")} ${accent(path.resolve(sessionFile(workspaceDir)))}`);
};
