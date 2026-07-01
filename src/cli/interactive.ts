import readline from "node:readline";
import path from "node:path";
import process from "node:process";

import { runPublicAgent, type ScanMode } from "../agent/loop.js";
import { mapFindingsToCompliance, normalizeFramework } from "../compliance/map.js";
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

// Persisted session config. The API key is intentionally NOT part of this shape,
// so it is never written to disk — it lives only in memory for the session.
interface SessionConfig {
  targets: string[];
  goal: string;
  scanMode: ScanMode;
  framework: string;
  allowShell: boolean;
  authorized: boolean;
  scopeNote: string;
  model?: string;
  baseUrl?: string;
  workspaceDir: string;
}

const SCAN_MODES = new Set<ScanMode>(["quick", "standard", "deep"]);

const targetSlug = (target: string): string =>
  target
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[^a-z0-9.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "target";

const defaultConfig = (workspaceDir: string): SessionConfig => ({
  targets: [],
  goal: "Perform a scoped shallow pentest and produce evidence-backed findings.",
  scanMode: "standard",
  framework: "owasp-top10",
  allowShell: false,
  authorized: false,
  scopeNote: "",
  workspaceDir,
});

const sessionFile = (workspaceDir: string): string => path.join(workspaceDir, "session.json");

const loadSession = async (workspaceDir: string): Promise<SessionConfig | null> => {
  try {
    const raw = await readJson<Partial<SessionConfig>>(sessionFile(workspaceDir));
    return { ...defaultConfig(workspaceDir), ...raw, workspaceDir };
  } catch {
    return null;
  }
};

const HELP = [
  section("Session"),
  `  ${accent("/target")} <url|host|path>   add a target        ${accent("/targets")} [clear]   list / clear targets`,
  `  ${accent("/goal")} <text>              set assessment goal ${accent("/scope")} <text>       note scope / RoE`,
  `  ${accent("/mode")} quick|standard|deep set scan depth      ${accent("/framework")} <id>      set compliance framework`,
  `  ${accent("/shell")} on|off             allow scanners/shell ${accent("/authorize")}          confirm you are authorized`,
  `  ${accent("/env")} model|key|base <v>   set model / API key / base URL (key stays in memory)`,
  "",
  section("Run & review"),
  `  ${accent("/run")}                      start the assessment ${accent("/findings")}          list findings`,
  `  ${accent("/report")}                   show report path    ${accent("/compliance")}         readiness summary`,
  `  ${accent("/status")}                   show configuration  ${accent("/clear")}              redraw banner`,
  `  ${accent("/help")}                     this help           ${accent("/exit")}               leave (session is saved)`,
  "",
  colors.dim("Tip: type plain text (no slash) to set the goal, then /run."),
].join("\n");

export const runInteractive = async (workspaceDirArg?: string): Promise<void> => {
  const workspaceDir = workspaceDirArg ?? ".null/session";
  await ensureWorkspace(workspaceDir);
  const loaded = await loadSession(workspaceDir);
  const cfg: SessionConfig = loaded ?? defaultConfig(workspaceDir);
  cfg.workspaceDir = workspaceDir;
  const apiKeyRef: { value?: string } = {
    value: process.env.NULL_AI_API_KEY ?? process.env.OPENAI_API_KEY,
  };

  const save = async (): Promise<void> => {
    await writeJson(sessionFile(workspaceDir), cfg);
  };

  console.log(renderBanner());
  console.log(`\n${accent("interactive session")} ${colors.dim("— type")} ${accent("/help")} ${colors.dim("for commands,")} ${accent("/run")} ${colors.dim("to start,")} ${accent("/exit")} ${colors.dim("to leave")}`);
  if (loaded) {
    console.log(colors.dim(`resumed session · ${cfg.targets.length} target(s) · mode ${cfg.scanMode} · ${cfg.framework}`));
  } else {
    console.log(colors.dim("new session · add a target with /target <url>, then /authorize and /run"));
  }

  const printStatus = (): void => {
    const on = (value: boolean): string => (value ? accent("on") : colors.dim("off"));
    console.log(section("Session status"));
    console.log(`  ${colors.dim("targets")}     ${cfg.targets.length ? cfg.targets.map((t) => colors.fg(t)).join(colors.dim(", ")) : colors.dim("(none — /target <url>)")}`);
    console.log(`  ${colors.dim("goal")}        ${colors.muted(cfg.goal)}`);
    console.log(`  ${colors.dim("scan mode")}   ${colors.fg(cfg.scanMode)}    ${colors.dim("framework")} ${colors.fg(cfg.framework)}`);
    console.log(`  ${colors.dim("scanners")}    ${on(cfg.allowShell)}    ${colors.dim("authorized")} ${cfg.authorized ? accent("yes") : status("WARN")}`);
    console.log(`  ${colors.dim("scope/RoE")}   ${cfg.scopeNote ? colors.muted(cfg.scopeNote) : colors.dim("(none — /scope <text>)")}`);
    console.log(`  ${colors.dim("model")}       ${colors.fg(cfg.model ?? process.env.NULL_AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini")}    ${colors.dim("api key")} ${apiKeyRef.value ? accent("set") : colors.dim("none → dry-run")}`);
    console.log(`  ${colors.dim("workspace")}   ${accent(path.resolve(workspaceDir))}`);
  };

  const printFindings = async (): Promise<void> => {
    try {
      const findings = await readJson<Finding[]>(path.join(workspaceDir, "findings.json"));
      if (!findings.length) {
        console.log(colors.dim("No findings recorded yet. Run an assessment with /run."));
        return;
      }
      console.log(section(`Findings (${findings.length})`));
      for (const finding of findings) {
        console.log(`  ${severityTag(finding.severity)} ${colors.fg(finding.title)} ${colors.dim(finding.target)}`);
      }
    } catch {
      console.log(colors.dim("No findings file yet. Run /run first."));
    }
  };

  const printReport = async (): Promise<void> => {
    const reportPath = path.join(workspaceDir, "reports", "report.md");
    try {
      await readJson(path.join(workspaceDir, "run-state.json"));
      console.log(`${colors.dim("report")}  ${accent(path.resolve(reportPath))}`);
      console.log(`${colors.dim("sarif")}   ${accent(path.resolve(path.join(workspaceDir, "findings.sarif")))}`);
    } catch {
      console.log(colors.dim("No report yet. Run /run first."));
    }
  };

  const printCompliance = async (): Promise<void> => {
    try {
      const findings = await readJson<Finding[]>(path.join(workspaceDir, "findings.json"));
      const mappings = mapFindingsToCompliance(findings, normalizeFramework(cfg.framework));
      const counts = mappings.reduce<Record<string, number>>((acc, mapping) => {
        acc[mapping.status] = (acc[mapping.status] ?? 0) + 1;
        return acc;
      }, {});
      console.log(section(`${cfg.framework} readiness`));
      console.log(
        `  ${colors.red(`${counts.impacted ?? 0} impacted`)}  ${colors.yellow(`${counts.review ?? 0} review`)}  ${colors.dim(`${counts.no_evidence ?? 0} no-evidence`)}`,
      );
    } catch {
      console.log(colors.dim("No findings to map yet. Run /run first."));
    }
  };

  const doRun = async (): Promise<void> => {
    if (cfg.targets.length === 0) {
      console.log(status("WARN") + colors.muted(" add a target first: /target <url>"));
      return;
    }
    const apiKey = apiKeyRef.value;
    const dryRun = !apiKey;
    if ((!dryRun || cfg.allowShell) && !cfg.authorized) {
      console.log(status("WARN") + colors.muted(" this run contacts a target or runs scanners."));
      console.log(colors.muted(`  Confirm you are authorized to test ${cfg.targets.join(", ")} — type ${accent("/authorize")}.`));
      return;
    }
    const skill = await loadSkillBySlug("skills", `scan-mode-${cfg.scanMode}`).catch(() => undefined);
    const multi = cfg.targets.length > 1;
    for (const target of cfg.targets) {
      const runWorkspace = multi ? path.join(workspaceDir, targetSlug(target)) : workspaceDir;
      process.stderr.write(
        `${renderRunHeader({ target, goal: cfg.goal, framework: cfg.framework, workspaceDir: runWorkspace, mode: dryRun ? "dry-run" : "live", scanMode: cfg.scanMode })}\n`,
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
          scanMode: cfg.scanMode,
          scanModeGuidance: skill?.content,
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
      console.log(colors.dim(value ? "api key set (memory only, not saved)" : "api key cleared"));
      return;
    } else {
      console.log(colors.dim("usage: /env model <id> | /env key <value> | /env base <url>"));
      return;
    }
    await save();
    console.log(colors.dim(`${key} set`));
  };

  const handle = async (line: string): Promise<boolean> => {
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ").trim();
    switch (cmd) {
      case "/help":
        console.log(HELP);
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
          await save();
          console.log(`${status("PASS")} ${colors.dim("target added:")} ${colors.fg(arg)}`);
        }
        break;
      case "/targets":
        if (arg === "clear") {
          cfg.targets = [];
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
        await save();
        console.log(colors.dim("scope note saved"));
        break;
      case "/mode":
        if (SCAN_MODES.has(arg as ScanMode)) {
          cfg.scanMode = arg as ScanMode;
          await save();
          console.log(colors.dim(`scan mode: ${arg}`));
        } else {
          console.log(colors.dim("usage: /mode quick|standard|deep"));
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
        console.log(cfg.allowShell ? status("WARN") + colors.muted(" scanners/shell enabled — in-scope assets only") : colors.dim("scanners/shell disabled"));
        break;
      case "/authorize":
        cfg.authorized = true;
        await save();
        console.log(`${status("PASS")} ${colors.muted("authorization confirmed — you assert written permission to test the declared scope.")}`);
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
      case "/clear":
        console.clear();
        console.log(renderBanner());
        break;
      case "/exit":
      case "/quit":
        return true;
      default:
        if (cmd.startsWith("/")) {
          console.log(colors.dim(`unknown command: ${cmd} — type /help`));
        } else {
          cfg.goal = line;
          await save();
          console.log(colors.dim("goal set — type /run to start, or /help for commands"));
        }
    }
    return false;
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
  });
  rl.setPrompt(`\n${accent("null-ai")} ${colors.dim("›")} `);
  rl.prompt();
  for await (const raw of rl) {
    const line = raw.trim();
    if (line) {
      const done = await handle(line);
      if (done) break;
    }
    rl.prompt();
  }
  rl.close();
  console.log(`\n${colors.dim("session saved →")} ${accent(path.resolve(sessionFile(workspaceDir)))}`);
};
