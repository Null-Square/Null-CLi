import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  confirm as promptConfirm,
  input as promptInput,
  password as promptPassword,
  search as promptSearch,
  select as promptSelect,
} from "@inquirer/prompts";

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
import {
  MODEL_PROVIDERS,
  discoverModels,
  environmentApiKeyForProvider,
  modelFamilies,
  modelProvider,
  modelsForFamily,
  normalizeModelProviderId,
  type ModelProviderId,
} from "../config/modelCatalog.js";
import type { Finding } from "../findings/types.js";
import { summarizeAssessment } from "../reports/markdown.js";
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
  scope?: ScopeDetails;
  streamModel: boolean;
  profile?: string;
  model?: string;
  baseUrl?: string;
  workspaceDir: string;
}

interface ScopeDetails {
  inScope: string;
  outOfScope: string;
  authorizationReference: string;
  testingWindow: string;
  rateLimit: string;
}

const SCAN_MODES = new Set<ScanMode>(["quick", "standard", "deep"]);
const WORKFLOWS = new Set<WorkflowMode>(["pentest", "compliance"]);
const FRAMEWORKS: ComplianceFramework[] = ["owasp-top10", "pci-dss-lite", "iso27001-lite", "nist-csf-lite"];

export type HomeAction =
  | "pentest"
  | "compliance"
  | "resume"
  | "results"
  | "demo"
  | "profiles"
  | "advanced"
  | "exit";

export const workflowUsesCompliance = (workflow: WorkflowMode): boolean => workflow === "compliance";

export const homeMenuChoices = (hasCurrentAssessment: boolean): Array<{
  name: string;
  value: HomeAction;
  description: string;
}> => [
  { name: "New pentest", value: "pentest", description: "Start an authorized evidence-backed security assessment" },
  { name: "Compliance readiness", value: "compliance", description: "Collect evidence and map it to a selected framework" },
  ...(hasCurrentAssessment
    ? [{ name: "Resume saved assessment", value: "resume" as const, description: "Review and run the current saved configuration" }]
    : []),
  { name: "Authorized lab demo", value: "demo", description: "Run a focused assessment against your own training lab" },
  { name: "Results and reports", value: "results", description: "Review findings and open generated artifacts" },
  { name: "Model settings", value: "profiles", description: "Manage providers, models, and credentials" },
  { name: "Advanced commands", value: "advanced", description: "Open the searchable slash-command launcher" },
  { name: "Exit", value: "exit", description: "Save and leave Null AI" },
];

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
  `  ${accent("/scope")} <text>            scope summary     ${accent("/authorize")}          confirm authorization`,
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

const yes = (value: string): boolean => /^(y|yes|true|1)$/i.test(value.trim());

const isInteractiveTerminal = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

const required = (label: string) => (value: string): boolean | string =>
  value.trim().length > 0 || `${label} is required.`;

const isPromptExit = (error: unknown): boolean =>
  error instanceof Error && (error.name === "ExitPromptError" || error.name === "AbortPromptError");

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
  const runtimeApiKey = (profile: ResolvedModelProfile | null): string | undefined =>
    profile?.apiKey ?? environmentApiKeyForProvider(profile?.provider ?? "openai");
  const apiKeyRef: { value?: string } = {
    value: runtimeApiKey(profileRef),
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
  const successfulEvidenceCount = (state: Awaited<ReturnType<typeof runPublicAgent>>): number =>
    (state.actions ?? [])
      .filter((action) => action.ok && action.artifactPaths.length > 0)
      .reduce((count, action) => count + action.artifactPaths.length, 0);

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
    if (workflowUsesCompliance(cfg.workflow)) {
      console.log(`  ${colors.dim("framework")}  ${colors.fg(cfg.framework)}    ${colors.dim("stream")} ${on(cfg.streamModel)}`);
    } else {
      console.log(`  ${colors.dim("stream")}     ${on(cfg.streamModel)}`);
    }
    console.log(`  ${colors.dim("scanners")}   ${on(cfg.allowShell)}    ${colors.dim("authorized")} ${cfg.authorized ? accent("yes") : status("WARN")}`);
    console.log(`  ${colors.dim("scope/RoE")}  ${cfg.scope ? colors.muted(cfg.scope.inScope) : cfg.scopeNote ? colors.muted(cfg.scopeNote) : colors.dim("(none - /scope <text>)")}`);
    if (cfg.scope) {
      console.log(`  ${colors.dim("excluded")}   ${colors.muted(cfg.scope.outOfScope)}`);
      console.log(`  ${colors.dim("auth ref")}   ${colors.muted(cfg.scope.authorizationReference)}`);
      console.log(`  ${colors.dim("window")}     ${colors.muted(cfg.scope.testingWindow)}    ${colors.dim("rate")} ${colors.muted(cfg.scope.rateLimit)}`);
    }
    console.log(`  ${colors.dim("profile")}    ${cfg.profile ? colors.fg(cfg.profile) : colors.dim("(not configured)")} ${profileRef?.provider ? colors.dim(`(${profileRef.provider})`) : ""}`);
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
        `${renderRunHeader({ target, goal: cfg.goal, ...(workflowUsesCompliance(cfg.workflow) ? { framework: cfg.framework } : {}), workspaceDir: runWorkspace, mode: "live", scanMode: cfg.scanMode })}\n`,
      );
      const reporter = createLiveReporter(target);
      try {
        const state = await runPublicAgent({
          target,
          goal: cfg.goal,
          scope: cfg.scopeNote,
          workspaceDir: runWorkspace,
          apiKey,
          model: cfg.model,
          baseUrl: cfg.baseUrl,
          allowShell: cfg.allowShell,
          ...(workflowUsesCompliance(cfg.workflow) ? { framework: cfg.framework } : {}),
          workflow: cfg.workflow,
          scanMode: cfg.scanMode,
          scanModeGuidance: skill?.content,
          streamModel: cfg.streamModel,
          onEvent: reporter.onEvent,
        });
        console.log(
          renderRunSummary(state.findings, path.resolve(runWorkspace), {
            evidence: state.evidence.length,
            successfulEvidence: successfulEvidenceCount(state),
            actions: state.actions.length,
            outcome: state.outcome,
            summary: summarizeAssessment(state),
            reportPath: path.resolve(runWorkspace, "reports", "report.md"),
          }),
        );
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
    const currentProvider = normalizeModelProviderId(profileRef?.provider) ?? "openai";
    const providerHint = MODEL_PROVIDERS.map((provider) => provider.id).join("/");
    const providerInput = (await ask(rl, `Provider [${providerHint}] (${currentProvider}): `)).trim() || currentProvider;
    const providerId = normalizeModelProviderId(providerInput);
    if (!providerId) {
      console.log(`${status("WARN")} ${colors.muted(`unsupported provider "${providerInput}". Supported: ${providerHint}.`)}`);
      return false;
    }
    const provider = modelProvider(providerId);
    const currentName = profileRef?.name ?? cfg.profile ?? "default";
    const name = (await ask(rl, `Profile name (${currentName}): `)).trim() || currentName;
    const sameProvider = profileRef?.provider === provider.id || (!profileRef?.provider && provider.id === "openai");
    const currentModel =
      (sameProvider ? profileRef?.model ?? cfg.model : undefined) ??
      provider.fallbackModels[0] ??
      process.env.NULL_AI_MODEL ??
      process.env.OPENAI_MODEL ??
      "gpt-4.1-mini";
    const model = (await ask(rl, `Model id (${currentModel}): `)).trim() || currentModel;
    const currentBase =
      (sameProvider ? profileRef?.baseUrl ?? cfg.baseUrl : undefined) ??
      process.env.NULL_AI_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      provider.baseUrl;
    const baseUrl = (await ask(rl, `OpenAI-compatible base URL (${currentBase}): `)).trim() || currentBase;

    const existing = await loadModelProfile(name).catch(() => null);
    const sameNamedProvider = existing?.provider === provider.id || (!existing?.provider && provider.id === "openai");
    const preserveExistingKey = sameNamedProvider && Boolean(existing?.apiKey);
    const keyPrompt = preserveExistingKey
      ? "API key (Enter keeps the saved key): "
      : "API key (required; saved in the encrypted local vault): ";
    const enteredKey = (await ask(rl, keyPrompt)).trim();
    const environmentKey = environmentApiKeyForProvider(provider.id);
    const apiKey = enteredKey || (sameNamedProvider ? existing?.apiKey : undefined) || environmentKey;
    if (!apiKey) {
      console.log(`${status("WARN")} ${colors.muted("an API key is required to complete a model profile.")}`);
      return false;
    }

    profileRef = await saveModelProfile({
      name,
      provider: provider.id,
      model,
      baseUrl,
      apiKey: enteredKey || (preserveExistingKey ? undefined : apiKey),
    });
    cfg.profile = profileRef.name;
    cfg.model = profileRef.model;
    cfg.baseUrl = profileRef.baseUrl;
    apiKeyRef.value = runtimeApiKey(profileRef);
    await save();
    console.log(`${status("PASS")} ${colors.muted(`profile "${profileRef.name}" saved; API key encrypted locally.`)}`);
    return true;
  };

  const configureProfileTty = async (): Promise<boolean> => {
    console.log(section(profileRef ? "Model profile" : "First-time model setup"));
    const providerId = await promptSelect<ModelProviderId>({
      message: "Provider",
      choices: MODEL_PROVIDERS.map((provider) => ({
        name: provider.label,
        value: provider.id,
        description: provider.description,
      })),
      default: normalizeModelProviderId(profileRef?.provider) ?? "openai",
      loop: false,
    });
    const provider = modelProvider(providerId);
    const currentName = profileRef?.name ?? cfg.profile ?? "default";
    const name = await promptInput({
      message: "Profile name",
      default: currentName,
      validate: required("Profile name"),
    });
    const existing = await loadModelProfile(name).catch(() => null);
    const sameProvider = Boolean(
      existing && (existing.provider === provider.id || (!existing.provider && provider.id === "openai")),
    );
    const existingKey = sameProvider ? existing?.apiKey : undefined;
    const suggestedBaseUrl = (sameProvider ? existing?.baseUrl : undefined) ?? provider.baseUrl;
    const useCustomEndpoint = await promptConfirm({
      message: "Use a custom API endpoint?",
      default: suggestedBaseUrl !== provider.baseUrl,
    });
    const baseUrl = useCustomEndpoint
      ? await promptInput({
          message: "API base URL",
          default: suggestedBaseUrl,
          validate: (value) => {
            try {
              const parsed = new URL(value);
              return parsed.protocol === "http:" || parsed.protocol === "https:" || "Use an HTTP(S) URL.";
            } catch {
              return "Enter a valid API base URL.";
            }
          },
        })
      : provider.baseUrl;

    const environmentKey = environmentApiKeyForProvider(provider.id);
    let enteredKey = "";
    if (provider.requiresApiKey) {
      enteredKey = await promptPassword({
        message: existingKey || environmentKey ? "API key (Enter keeps the available key)" : "API key",
        mask: "*",
        validate: (value) =>
          Boolean(value.trim() || existingKey || environmentKey) || "An API key is required for this provider.",
      });
    }
    const apiKey = enteredKey.trim() || existingKey || environmentKey;

    console.log(colors.dim("Checking available models..."));
    const discovered = await discoverModels(baseUrl, apiKey);
    const availableModels = [...new Set([...discovered, ...provider.fallbackModels])];
    if (discovered.length) {
      console.log(`${status("PASS")} ${colors.dim(`${discovered.length} models discovered`)}`);
    } else {
      console.log(`${status("WARN")} ${colors.dim("model discovery could not verify the endpoint; check the key, network, or custom URL if the run later fails")}`);
    }

    let model: string;
    if (availableModels.length) {
      const families = modelFamilies(availableModels);
      const family = await promptSelect<string>({
        message: "Model family",
        choices: [
          { name: "All available models", value: "All models" },
          ...families.map((item) => ({ name: item, value: item })),
          { name: "Custom model ID", value: "Custom" },
        ],
        loop: false,
      });
      if (family === "Custom") {
        model = await promptInput({ message: "Model ID", validate: required("Model ID") });
      } else {
        const familyModels = modelsForFamily(availableModels, family);
        model = await promptSearch<string>({
          message: "Model",
          pageSize: 10,
          source: (term) => {
            const query = (term ?? "").toLowerCase();
            const choices = familyModels
              .filter((item) => !query || item.toLowerCase().includes(query))
              .slice(0, 50)
              .map((item) => ({ name: item, value: item }));
            if (!query || "custom model id".includes(query)) {
              choices.push({ name: "Enter a custom model ID", value: "__custom__" });
            }
            return choices;
          },
        });
        if (model === "__custom__") {
          model = await promptInput({ message: "Model ID", validate: required("Model ID") });
        }
      }
    } else {
      model = await promptInput({
        message: "Model ID",
        default: sameProvider ? existing?.model : undefined,
        validate: required("Model ID"),
      });
    }

    profileRef = await saveModelProfile({
      name,
      provider: provider.id,
      model,
      baseUrl,
      apiKey: provider.requiresApiKey
        ? enteredKey.trim() || (existingKey ? undefined : apiKey)
        : null,
    });
    cfg.profile = profileRef.name;
    cfg.model = profileRef.model;
    cfg.baseUrl = profileRef.baseUrl;
    apiKeyRef.value = runtimeApiKey(profileRef);
    await save();
    console.log(`${status("PASS")} ${colors.fg(`profile "${profileRef.name}" is ready`)}`);
    return true;
  };

  const ensureProfileTty = async (): Promise<boolean> => {
    if (profileRef?.model && runtimeApiKey(profileRef)) return true;
    return configureProfileTty();
  };

  const ensureProfile = async (rl: readline.Interface): Promise<boolean> => {
    if (profileRef?.model && runtimeApiKey(profileRef)) return true;
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
        console.log(`  ${marker} ${colors.fg(profile.name)} ${colors.dim(profile.provider ?? "openai")} ${colors.dim(profile.model)} ${colors.dim(profile.baseUrl ?? "")}`);
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
      apiKeyRef.value = runtimeApiKey(profileRef);
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
        apiKeyRef.value = runtimeApiKey(profileRef);
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

  const defaultScopeSummary = (): string => {
    const targets = cfg.targets.length ? cfg.targets.join(", ") : "the declared target(s)";
    if (cfg.workflow === "compliance") {
      return `Review authorized security evidence for ${targets}; exclude destructive testing, credential attacks, denial of service, and third-party systems.`;
    }
    return `Authorized testing for ${targets}; exclude destructive testing, credential attacks, denial of service, and third-party systems.`;
  };

  const scopeDetailsToNote = (scope: ScopeDetails): string =>
    `In scope: ${scope.inScope}. Excluded: ${scope.outOfScope}. Authorization: ${scope.authorizationReference}. Window: ${scope.testingWindow}. Rate: ${scope.rateLimit}.`;

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

    const target = (await ask(rl, "Target URL/host/path (required): ")).trim();
    if (!target) {
      console.log(`${status("WARN")} ${colors.muted("a target is required. Wizard paused.")}`);
      await save();
      return;
    }
    cfg.targets = [target];
    cfg.authorized = false;

    const goal = (await ask(rl, `Goal (${cfg.goal}): `)).trim();
    if (goal) cfg.goal = goal;

    console.log(section("Scope & authorization"));
    const scopeSummary = (await ask(rl, `Scope summary (${defaultScopeSummary()}): `)).trim() || defaultScopeSummary();
    const previousScope = cfg.scope;
    cfg.scopeNote = scopeSummary;
    cfg.scope = undefined;

    const advancedScope = yes(await ask(rl, "Add advanced scope details? [y/N]: "));
    if (advancedScope) {
      cfg.scope = {
        inScope: (await ask(rl, `In-scope surfaces and paths (${scopeSummary}): `)).trim() || scopeSummary,
        outOfScope: (await ask(rl, `Out-of-scope exclusions (${previousScope?.outOfScope ?? "DoS, destructive actions, credential attacks, and third-party systems"}): `)).trim() || previousScope?.outOfScope || "DoS, destructive actions, credential attacks, and third-party systems",
        authorizationReference: (await ask(rl, `Authorization reference (${previousScope?.authorizationReference ?? "Written authorization confirmed"}): `)).trim() || previousScope?.authorizationReference || "Written authorization confirmed",
        testingWindow: (await ask(rl, `Authorized testing window (${previousScope?.testingWindow ?? "Current engagement window"}): `)).trim() || previousScope?.testingWindow || "Current engagement window",
        rateLimit: (await ask(rl, `Request-rate limit (${previousScope?.rateLimit ?? "Conservative manual pace"}): `)).trim() || previousScope?.rateLimit || "Conservative manual pace",
      };
      cfg.scopeNote = scopeDetailsToNote(cfg.scope);
    }

    const depth = (await ask(rl, `Depth [quick/standard/deep] (${cfg.scanMode}): `)).trim().toLowerCase();
    if (SCAN_MODES.has(depth as ScanMode)) cfg.scanMode = depth as ScanMode;

    if (cfg.workflow === "compliance") {
      const framework = (await ask(rl, `Framework [owasp-top10/pci-dss-lite/iso27001-lite/nist-csf-lite] (${cfg.framework}): `)).trim();
      if (framework) cfg.framework = normalizeFramework(framework);
    }

    const shell = await ask(rl, `Enable scanners/shell? [${cfg.allowShell ? "Y/n" : "y/N"}]: `);
    if (shell.trim()) cfg.allowShell = yes(shell);

    const authorized = await ask(
      rl,
      `Confirm you have written authorization to test ${target} within this scope? [Y/n]: `,
    );
    cfg.authorized = !/^(n|no)$/i.test(authorized.trim());

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

  const configureScopeTty = async (preferExisting = true, showHeading = true): Promise<void> => {
    if (showHeading) console.log(section("Scope & authorization"));
    const scopeSummary = await promptInput({
      message: "Scope summary",
      default: preferExisting && cfg.scopeNote ? cfg.scopeNote : defaultScopeSummary(),
      validate: required("Scope summary"),
    });
    const previousScope = cfg.scope;
    cfg.scopeNote = scopeSummary;
    cfg.scope = undefined;

    const advancedScope = await promptConfirm({
      message: "Add advanced scope details?",
      default: false,
    });
    if (!advancedScope) return;

    cfg.scope = {
      inScope: await promptInput({
        message: "In-scope surfaces and paths",
        default: previousScope?.inScope ?? scopeSummary,
        validate: required("In-scope definition"),
      }),
      outOfScope: await promptInput({
        message: "Out-of-scope exclusions",
        default: previousScope?.outOfScope ?? "DoS, destructive actions, credential attacks, and third-party systems",
        validate: required("Out-of-scope exclusions"),
      }),
      authorizationReference: await promptInput({
        message: "Authorization reference",
        default: previousScope?.authorizationReference ?? "Written authorization confirmed",
        validate: required("Authorization reference"),
      }),
      testingWindow: await promptInput({
        message: "Authorized testing window",
        default: previousScope?.testingWindow ?? "Current engagement window",
        validate: required("Testing window"),
      }),
      rateLimit: await promptInput({
        message: "Request-rate limit",
        default: previousScope?.rateLimit ?? "Conservative manual pace",
        validate: required("Request-rate limit"),
      }),
    };
    cfg.scopeNote = scopeDetailsToNote(cfg.scope);
  };

  const configureDefaultScopeTty = async (): Promise<void> => {
    cfg.scope = undefined;
    cfg.scopeNote = defaultScopeSummary();
    console.log(section("Scope & authorization"));
    console.log(`  ${colors.dim("default scope")} ${colors.muted(cfg.scopeNote)}`);
    const customize = await promptConfirm({
      message: "Customize scope or exclusions?",
      default: false,
    });
    if (customize) await configureScopeTty(false, false);
  };

  type AssessmentFlow = WorkflowMode | "demo";

  const runWizardTty = async (requestedFlow?: AssessmentFlow): Promise<void> => {
    cfg.authorized = false;
    let flow = requestedFlow;
    if (!flow) {
      flow = await promptSelect<WorkflowMode>({
        message: "Assessment type",
        choices: [
          { name: "Pentest", value: "pentest", description: "Evidence-backed authorized security testing" },
          { name: "Compliance readiness", value: "compliance", description: "Security evidence mapped to readiness controls" },
        ],
        default: cfg.workflow,
        loop: false,
      });
    }

    const workflow: WorkflowMode = flow === "compliance" ? "compliance" : "pentest";
    const hadDefaultGoal = Object.values(DEFAULT_GOALS).includes(cfg.goal);
    cfg.workflow = workflow;
    if (flow === "demo") {
      cfg.goal = "Find simple, evidence-backed issues in an authorized training lab.";
      cfg.scanMode = "quick";
    } else if (hadDefaultGoal) {
      cfg.goal = DEFAULT_GOALS[workflow];
    }

    const title = flow === "demo" ? "Authorized lab demo" : workflow === "compliance" ? "Compliance readiness" : "New pentest";
    console.log(section(title));
    console.log(`  ${colors.dim("model")} ${colors.fg(`${cfg.profile} / ${cfg.model}`)} ${colors.dim("(change with /profile)")}`);
    if (cfg.targets.length) {
      console.log(`  ${colors.dim("previous target")} ${colors.muted(cfg.targets.join(", "))}`);
    }

    const targets = await promptInput({
      message: flow === "demo" ? "Authorized lab URL" : "Target(s), comma separated",
      validate: required("At least one target"),
    });
    cfg.targets = [...new Set(targets.split(",").map((target) => target.trim()).filter(Boolean))];
    if (flow !== "demo") {
      cfg.goal = await promptInput({
        message: workflow === "compliance" ? "Readiness objective" : "Assessment goal",
        default: cfg.goal,
        validate: required("Assessment goal"),
      });
    }

    await configureDefaultScopeTty();

    console.log(section(workflow === "compliance" ? "Evidence policy" : "Run policy"));
    if (workflowUsesCompliance(workflow)) {
      cfg.framework = await promptSelect<ComplianceFramework>({
        message: "Readiness framework",
        choices: FRAMEWORKS.map((framework) => ({ name: framework, value: framework })),
        default: cfg.framework,
        loop: false,
      });
    }
    cfg.scanMode = await promptSelect<ScanMode>({
      message: workflow === "compliance" ? "Evidence review depth" : "Assessment depth",
      choices: [
        { name: "Quick", value: "quick", description: "Fast, conservative coverage" },
        { name: "Standard", value: "standard", description: "Balanced coverage and runtime" },
        { name: "Deep", value: "deep", description: "Broader model-guided coverage" },
      ],
      default: cfg.scanMode,
      loop: false,
    });
    cfg.allowShell = await promptConfirm({
      message: workflow === "compliance" ? "Collect local scanner evidence?" : "Enable local scanners and shell tools?",
      default: cfg.allowShell,
    });
    cfg.authorized = await promptConfirm({
      message: "I confirm written authorization for the target(s) and scope above",
      default: true,
    });

    await save();
    printStatus();
    if (!cfg.authorized) {
      console.log(`${status("WARN")} ${colors.muted("assessment saved but not started; authorization was not confirmed")}`);
      return;
    }
    if (await promptConfirm({ message: "Start this assessment now?", default: true })) {
      await doRun();
    } else {
      console.log(colors.dim("assessment saved and ready"));
    }
  };
  const manageProfilesTty = async (): Promise<void> => {
    const action = await promptSelect<"setup" | "use" | "delete" | "back">({
      message: "Model profiles",
      choices: [
        { name: "Set up or update a profile", value: "setup" },
        { name: "Switch active profile", value: "use" },
        { name: "Delete a profile", value: "delete" },
        { name: "Back", value: "back" },
      ],
      loop: false,
    });
    if (action === "back") return;
    if (action === "setup") {
      await configureProfileTty();
      return;
    }

    const profiles = await listModelProfiles();
    if (!profiles.length) {
      console.log(colors.dim("No model profiles configured."));
      await configureProfileTty();
      return;
    }
    const selected = await promptSelect<string>({
      message: action === "use" ? "Use profile" : "Delete profile",
      choices: profiles.map((profile) => ({
        name: `${profile.name}  ${profile.model}`,
        value: profile.name,
        description: profile.baseUrl,
      })),
      default: cfg.profile,
      loop: false,
    });
    if (action === "use") {
      profileRef = await activateModelProfile(selected);
      cfg.profile = profileRef.name;
      cfg.model = profileRef.model;
      cfg.baseUrl = profileRef.baseUrl;
      apiKeyRef.value = runtimeApiKey(profileRef);
      await save();
      console.log(`${status("PASS")} ${colors.dim(`using profile "${selected}"`)}`);
      return;
    }

    if (await promptConfirm({ message: `Delete model profile "${selected}"?`, default: false })) {
      await deleteModelProfile(selected);
      if (cfg.profile === selected) {
        profileRef = await loadModelProfile().catch(() => null);
        cfg.profile = profileRef?.name;
        cfg.model = profileRef?.model;
        cfg.baseUrl = profileRef?.baseUrl;
        apiKeyRef.value = runtimeApiKey(profileRef);
        await save();
      }
      console.log(colors.dim(`profile "${selected}" deleted`));
    }
  };

  const commandChoices = [
    { name: "/back", value: "back", description: "Return to the home screen" },
    { name: "/wizard", value: "wizard", description: "Configure and start a new assessment" },
    { name: "/run", value: "run", description: "Run the current authorized assessment" },
    { name: "/status", value: "status", description: "Review current configuration" },
    { name: "/findings", value: "findings", description: "List recorded findings" },
    { name: "/report", value: "report", description: "Show generated report paths" },
    { name: "/compliance", value: "compliance", description: "Show readiness mapping summary" },
    { name: "/open", value: "open", description: "Open report, SARIF, or workspace" },
    { name: "/profile", value: "profile", description: "Manage model providers and credentials" },
    { name: "/target", value: "target", description: "Replace assessment targets" },
    { name: "/goal", value: "goal", description: "Edit the assessment goal" },
    { name: "/scope", value: "scope", description: "Edit scope summary or advanced details" },
    { name: "/depth", value: "depth", description: "Change quick, standard, or deep coverage" },
    { name: "/framework", value: "framework", description: "Change readiness mapping" },
    { name: "/shell", value: "shell", description: "Enable or disable scanner tools" },
    { name: "/authorize", value: "authorize", description: "Confirm the current declared scope" },
    { name: "/deauthorize", value: "deauthorize", description: "Clear authorization" },
    { name: "/help", value: "help", description: "Show the complete command reference" },
    { name: "/exit", value: "exit", description: "Save and leave Null AI" },
  ] as const;

  const runCommandMenuTty = async (): Promise<void> => {
    for (;;) {
      let action: (typeof commandChoices)[number]["value"];
      try {
        action = await promptSearch({
          message: "Null AI command",
          pageSize: 10,
          source: (term) => {
            const query = (term ?? "").replace(/^\//, "").toLowerCase();
            return commandChoices.filter(
              (choice) =>
                !query ||
                choice.name.slice(1).includes(query) ||
                choice.description.toLowerCase().includes(query),
            );
          },
        });
      } catch (error) {
        if (isPromptExit(error)) return;
        throw error;
      }

      try {
        if (action === "exit" || action === "back") return;
        if (action === "wizard") await runWizardTty();
        else if (action === "scope") {
          await configureScopeTty();
          invalidateAuthorization("scope changed");
          await save();
        } else if (action === "run") await doRun();
        else if (action === "status") printStatus();
        else if (action === "findings") await printFindings();
        else if (action === "report") await printReport();
        else if (action === "compliance") await printCompliance();
        else if (action === "profile") await manageProfilesTty();
        else if (action === "target") {
          const value = await promptInput({
            message: "Target(s), comma separated",
            default: cfg.targets.join(", "),
            validate: required("At least one target"),
          });
          cfg.targets = [...new Set(value.split(",").map((target) => target.trim()).filter(Boolean))];
          invalidateAuthorization("targets changed");
          await save();
        } else if (action === "goal") {
          cfg.goal = await promptInput({ message: "Assessment goal", default: cfg.goal, validate: required("Goal") });
          await save();
        } else if (action === "depth") {
          cfg.scanMode = await promptSelect<ScanMode>({
            message: "Assessment depth",
            choices: [...SCAN_MODES].map((mode) => ({ name: mode, value: mode })),
            default: cfg.scanMode,
          });
          await save();
        } else if (action === "framework") {
          cfg.framework = await promptSelect<ComplianceFramework>({
            message: "Readiness mapping",
            choices: FRAMEWORKS.map((framework) => ({ name: framework, value: framework })),
            default: cfg.framework,
          });
          await save();
        } else if (action === "shell") {
          cfg.allowShell = await promptConfirm({ message: "Enable scanners and shell tools?", default: cfg.allowShell });
          await save();
        } else if (action === "authorize") {
          if (!cfg.targets.length || !cfg.scopeNote) {
            console.log(`${status("WARN")} ${colors.dim("set target and scope before authorization")}`);
          } else {
            cfg.authorized = await promptConfirm({
              message: "Confirm written authorization for the currently declared scope",
              default: true,
            });
            await save();
          }
        } else if (action === "deauthorize") {
          cfg.authorized = false;
          await save();
          console.log(colors.dim("authorization cleared"));
        } else if (action === "open") {
          const kind = await promptSelect<string>({
            message: "Open",
            choices: [
              { name: "Markdown report", value: "report" },
              { name: "SARIF findings", value: "sarif" },
              { name: "Workspace folder", value: "folder" },
            ],
          });
          await openTarget(kind);
        } else if (action === "help") {
          console.log(HELP);
        }
      } catch (error) {
        if (isPromptExit(error)) continue;
        console.log(`${status("FAIL")} ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  const reviewResultsTty = async (): Promise<void> => {
    console.log(section("Results"));
    await printFindings();
    await printReport();
    const existingReports = [];
    for (const reportPath of reportPaths()) {
      if (await fileExists(reportPath)) existingReports.push(reportPath);
    }
    const action = await promptSelect<"report" | "folder" | "back">({
      message: "Results action",
      choices: [
        ...(existingReports.length === 1
          ? [{ name: "Open Markdown report", value: "report" as const, description: "Open the most recent assessment report" }]
          : []),
        { name: "Open workspace folder", value: "folder", description: "Browse reports, SARIF, state, and evidence" },
        { name: "Back", value: "back", description: "Return to the home screen" },
      ],
      default: existingReports.length === 1 ? "report" : "folder",
      loop: false,
    });
    if (action !== "back") await openTarget(action);
  };

  const resumeAssessmentTty = async (): Promise<void> => {
    if (!cfg.targets.length) {
      console.log(`${status("WARN")} ${colors.muted("no saved assessment is available")}`);
      return;
    }
    if (!cfg.scopeNote) cfg.scopeNote = defaultScopeSummary();
    cfg.authorized = false;
    printStatus();
    cfg.authorized = await promptConfirm({
      message: "I confirm written authorization for this saved target and scope",
      default: true,
    });
    await save();
    if (!cfg.authorized) {
      console.log(`${status("WARN")} ${colors.muted("assessment not started because authorization was not confirmed")}`);
      return;
    }
    if (await promptConfirm({ message: "Start this assessment now?", default: true })) await doRun();
  };

  const runHomeTty = async (): Promise<void> => {
    for (;;) {
      let action: HomeAction;
      try {
        action = await promptSelect<HomeAction>({
          message: "Home",
          choices: homeMenuChoices(cfg.targets.length > 0),
          pageSize: 8,
          loop: false,
        });
      } catch (error) {
        if (isPromptExit(error)) return;
        throw error;
      }

      try {
        if (action === "exit") return;
        if (action === "pentest") await runWizardTty("pentest");
        else if (action === "compliance") await runWizardTty("compliance");
        else if (action === "demo") await runWizardTty("demo");
        else if (action === "resume") await resumeAssessmentTty();
        else if (action === "results") await reviewResultsTty();
        else if (action === "profiles") await manageProfilesTty();
        else if (action === "advanced") await runCommandMenuTty();
      } catch (error) {
        if (isPromptExit(error)) continue;
        console.log(`${status("FAIL")} ${error instanceof Error ? error.message : String(error)}`);
      }
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
        if (!arg) {
          console.log(cfg.scopeNote ? colors.muted(cfg.scopeNote) : colors.dim("no scope set"));
          break;
        }
        cfg.scopeNote = arg;
        cfg.scope = undefined;
        invalidateAuthorization("scope changed");
        await save();
        console.log(colors.dim("scope summary saved"));
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
  console.log(`\n${accent("guided session")} ${colors.dim("- choose an assessment, review results, or open advanced commands")}`);
  if (loaded) {
    console.log(colors.dim(`resumed session - ${cfg.targets.length} target(s) - ${cfg.workflow}/${cfg.scanMode} - ${cfg.framework}`));
  } else {
    console.log(colors.dim("new session - the guided assessment will start now"));
  }

  if (isInteractiveTerminal()) {
    try {
      if (await ensureProfileTty()) await runHomeTty();
    } catch (error) {
      if (!isPromptExit(error)) throw error;
    }
    await save();
    console.log(`\n${colors.dim("session saved ->")} ${accent(path.resolve(sessionFile(workspaceDir)))}`);
    return;
  }

  // Preserve the line protocol for pipes, scripts, and deterministic tests.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false, completer });

  rl.setPrompt(`\n${accent("null-ai")} ${colors.dim(">")} `);
  rl.prompt();
  for await (const raw of rl) {
    const line = raw.trim();
    if (line) {
      try {
        const done = await handle(line, rl);
        if (done) break;
      } catch (error) {
        console.log(`${status("FAIL")} ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    rl.prompt();
  }
  rl.close();
  await save();
  console.log(`\n${colors.dim("session saved ->")} ${accent(path.resolve(sessionFile(workspaceDir)))}`);
};
