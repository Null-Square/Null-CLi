// NullSquare brand system for the terminal.
// Brand tokens mirror @null-ai/design-tokens (colors_and_type.css):
//   background  #000000 (pure black)
//   accent      #F5D13A (electric yellow — the single brand accent)
//   foreground  #F5F5F7 / muted #9B9BA3 / dim #5E5E66
//   severity    critical #E5484D · high #F2711C · medium #E8B339 · low #4F7FE8 · info #6B7280
//   success     #2FB27A
// The terminal is dark-first, so the yellow accent is used sparingly:
// one "yellow moment" per surface (the brand mark and the primary status).

const colorEnabled = process.env.NO_COLOR !== "1" && process.env.NO_COLOR !== "true";

type Rgb = readonly [number, number, number];

const BRAND = {
  yellow: [245, 209, 58] as Rgb,
  fg: [245, 245, 247] as Rgb,
  muted: [155, 155, 163] as Rgb,
  dim: [94, 94, 102] as Rgb,
  border: [72, 72, 78] as Rgb,
  success: [47, 178, 122] as Rgb,
  critical: [229, 72, 77] as Rgb,
  high: [242, 113, 28] as Rgb,
  medium: [232, 179, 57] as Rgb,
  low: [79, 127, 232] as Rgb,
  info: [107, 114, 128] as Rgb,
} as const;

const truecolor = (rgb: Rgb, value: string): string =>
  colorEnabled ? `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${value}\x1b[0m` : value;

const wrap = (code: string, value: string): string =>
  colorEnabled ? `\x1b[${code}m${value}\x1b[0m` : value;

// Legacy 16-color helpers kept for backward compatibility with existing call
// sites. `cyan` now maps to the brand yellow so nothing renders off-brand.
export const colors = {
  cyan: (value: string): string => truecolor(BRAND.yellow, value),
  yellow: (value: string): string => truecolor(BRAND.yellow, value),
  green: (value: string): string => truecolor(BRAND.success, value),
  red: (value: string): string => truecolor(BRAND.critical, value),
  magenta: (value: string): string => truecolor(BRAND.high, value),
  gray: (value: string): string => truecolor(BRAND.dim, value),
  muted: (value: string): string => truecolor(BRAND.muted, value),
  fg: (value: string): string => truecolor(BRAND.fg, value),
  bold: (value: string): string => wrap("1", value),
  dim: (value: string): string => wrap("2", value),
};

export const accent = (value: string): string => truecolor(BRAND.yellow, value);
export const muted = (value: string): string => truecolor(BRAND.muted, value);

const visibleLength = (value: string): number =>
  // eslint-disable-next-line no-control-regex
  value.replace(/\x1b\[[0-9;]*m/g, "").length;

const INNER_WIDTH = 62;

// Clip a plain (un-colored) value so a labelled row fits inside the panel.
const clip = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;

const normalizeText = (value: string | undefined): string =>
  value?.replace(/\s+/g, " ").trim() ?? "";

const wrapText = (value: string | undefined, width: number): string[] => {
  const words = normalizeText(value).split(" ").filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const boxLine = (content: string): string => {
  const pad = Math.max(0, INNER_WIDTH - visibleLength(content));
  return `${truecolor(BRAND.border, "│")} ${content}${" ".repeat(pad)} ${truecolor(BRAND.border, "│")}`;
};

// Minimal bordered panel in NullSquare colors — echoes the brand's boxed,
// low-chrome aesthetic rather than a loud ASCII figlet.
const box = (title: string, lines: string[]): string => {
  const label = ` ${title} `;
  const topFill = "─".repeat(Math.max(0, INNER_WIDTH - visibleLength(label)));
  const top = truecolor(BRAND.border, "╭─") + accent(colors.bold(label)) + truecolor(BRAND.border, `${topFill}─╮`);
  const bottom = truecolor(BRAND.border, `╰${"─".repeat(INNER_WIDTH + 2)}╯`);
  return [top, ...lines.map(boxLine), bottom].join("\n");
};

// "NULL AI" in an ANSI Shadow block font. Two-tone: the block faces (█) render
// in brand yellow while the shadow edges (║╗╝╚═╔) stay dim, giving the wordmark
// depth without turning the whole banner yellow.
const NULL_AI_SHADOW = [
  "███╗   ██╗██╗   ██╗██╗     ██╗         █████╗ ██╗",
  "████╗  ██║██║   ██║██║     ██║        ██╔══██╗██║",
  "██╔██╗ ██║██║   ██║██║     ██║        ███████║██║",
  "██║╚██╗██║██║   ██║██║     ██║        ██╔══██║██║",
  "██║ ╚████║╚██████╔╝███████╗███████╗   ██║  ██║██║",
  "╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚══════╝   ╚═╝  ╚═╝╚═╝",
];

// Shade a block-font line: block faces yellow, box-drawing edges dim, spaces kept.
const shadeBlock = (line: string): string => {
  let out = "";
  let index = 0;
  while (index < line.length) {
    const ch = line[index];
    const cls = ch === "█" ? "face" : ch === " " ? "space" : "edge";
    let run = "";
    while (
      index < line.length &&
      (line[index] === "█" ? "face" : line[index] === " " ? "space" : "edge") === cls
    ) {
      run += line[index];
      index += 1;
    }
    out += cls === "face" ? accent(run) : cls === "edge" ? colors.gray(run) : run;
  }
  return out;
};

export const renderBanner = (): string =>
  box("NULLSQUARE", [
    "",
    ...NULL_AI_SHADOW.map((line) => `  ${shadeBlock(line)}`),
    "",
    `  ${colors.bold(colors.fg("Null AI CLI"))}  ${colors.dim("· by NullSquare")}`,
    `  ${colors.muted("Open-source AI pentest & compliance readiness framework")}`,
    "",
    `  ${colors.dim("managed platform")}  ${accent("→")}  ${accent("nullsquare.net")}`,
    "",
  ]);

export const section = (title: string): string => colors.bold(accent(title));

export const command = (value: string): string => truecolor(BRAND.success, value);

export const status = (label: "PASS" | "FAIL" | "INFO" | "WARN"): string => {
  if (label === "PASS") return truecolor(BRAND.success, colors.bold(label));
  if (label === "FAIL") return truecolor(BRAND.critical, colors.bold(label));
  if (label === "WARN") return truecolor(BRAND.medium, colors.bold(label));
  return accent(colors.bold(label));
};

type Severity = "critical" | "high" | "medium" | "low" | "info";

const severityRgb: Record<Severity, Rgb> = {
  critical: BRAND.critical,
  high: BRAND.high,
  medium: BRAND.medium,
  low: BRAND.low,
  info: BRAND.info,
};

export const severityColor = (severity: string, value: string): string => {
  const rgb = severityRgb[(severity as Severity)] ?? BRAND.info;
  return truecolor(rgb, value);
};

export const severityTag = (severity: string): string =>
  severityColor(severity, colors.bold(severity.toUpperCase().padEnd(8)));

export interface RunHeaderInfo {
  target: string;
  goal: string;
  framework?: string;
  workspaceDir: string;
  mode: "live" | "dry-run";
  scanMode?: string;
}

export const renderRunHeader = (info: RunHeaderInfo): string => {
  const modeLabel =
    info.mode === "dry-run"
      ? `${accent("dry run")} ${colors.dim("(no model call)")}`
      : accent("live assessment");
  return box("NULLSQUARE · ASSESSMENT", [
    "",
    `${colors.dim("Mode")}       ${modeLabel}${info.scanMode ? `${colors.dim(" · ")}${colors.muted(info.scanMode)}` : ""}`,
    `${colors.dim("Target")}     ${colors.fg(clip(info.target, 50))}`,
    `${colors.dim("Goal")}       ${colors.muted(clip(info.goal, 50))}`,
    ...(info.framework ? [`${colors.dim("Framework")}  ${colors.fg(info.framework)}`] : []),
    `${colors.dim("Output")}     ${accent(clip(info.workspaceDir, 50))}`,
    "",
  ]);
};

export interface FindingLine {
  severity: string;
  title: string;
  target: string;
}

const severityTally = (findings: FindingLine[]): string => {
  const counts = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});
  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  return order
    .filter((severity) => counts[severity])
    .map((severity) => severityColor(severity, `${counts[severity]} ${severity}`))
    .join(colors.dim(" · "));
};

export const renderRunSummary = (
  findings: FindingLine[],
  workspaceDir: string,
  meta?: {
    evidence?: number;
    successfulEvidence?: number;
    actions?: number;
    outcome?: "complete" | "dry-run" | "inconclusive" | "failed";
    summary?: string;
    reportPath?: string;
  },
): string => {
  const tally = severityTally(findings);
  const outcome = meta?.outcome ?? "complete";
  const outcomeLabel = outcome === "inconclusive" ? "WARN" : outcome === "failed" ? "FAIL" : "PASS";
  const outcomeText =
    outcome === "dry-run"
      ? "dry-run plan complete"
      : outcome === "inconclusive"
        ? "assessment inconclusive"
        : outcome === "failed"
          ? "assessment failed"
          : "assessment complete";
  const lines: string[] = [
    "",
    `${status(outcomeLabel)} ${colors.fg(outcomeText)}`,
    `${colors.dim("Findings")}  ${colors.bold(colors.fg(String(findings.length)))}${tally ? `  ${colors.dim("(")}${tally}${colors.dim(")")}` : ""}`,
    `${colors.dim("Evidence")}  ${colors.bold(colors.fg(String(meta?.evidence ?? 0)))}    ${colors.dim("Tool actions")}  ${colors.bold(colors.fg(String(meta?.actions ?? 0)))}`,
  ];
  const summaryLines = wrapText(meta?.summary, 50);
  if (summaryLines.length) {
    const visibleSummary = summaryLines.slice(0, 4);
    lines.push("");
    lines.push(`${colors.dim("Result")}    ${colors.fg(visibleSummary[0])}`);
    for (const line of visibleSummary.slice(1)) lines.push(`          ${colors.fg(line)}`);
    if (summaryLines.length > visibleSummary.length) {
      lines.push(`          ${colors.dim("... full report saved below")}`);
    }
  }
  if (outcome === "inconclusive") {
    const successfulEvidence = meta?.successfulEvidence ?? 0;
    lines.push("");
    const evidenceMessage =
      successfulEvidence > 0
        ? `Successful target evidence: ${successfulEvidence}. Review Agent Activity in the report.`
        : "Diagnostic evidence saved; no successful target evidence captured.";
    for (const line of wrapText(evidenceMessage, 52)) {
      lines.push(colors.dim(`  ${line}`));
    }
  }
  for (const finding of findings.slice(0, 6)) {
    lines.push(`  ${severityTag(finding.severity)} ${colors.fg(clip(finding.title, 48))}`);
  }
  if (findings.length > 6) lines.push(colors.dim(`  … +${findings.length - 6} more`));
  lines.push("");
  lines.push(`${colors.dim("Artifacts")}  ${accent(clip(workspaceDir, 49))}`);
  if (meta?.reportPath) lines.push(`${colors.dim("Report")}     ${accent(clip(meta.reportPath, 49))}`);
  lines.push(`${colors.dim("Scale this on the managed platform")}  ${accent("→")}  ${accent("nullsquare.net")}`);
  lines.push("");
  return box("NULLSQUARE · SUMMARY", lines);
};

export const renderMultiSummary = (
  targetCount: number,
  findings: FindingLine[],
  baseOut: string,
): string => {
  const tally = severityTally(findings);
  const lines: string[] = [
    "",
    `${status("PASS")} ${colors.fg(`${targetCount} targets assessed`)}`,
    `${colors.dim("Total findings")}  ${colors.bold(colors.fg(String(findings.length)))}${tally ? `  ${colors.dim("(")}${tally}${colors.dim(")")}` : ""}`,
    "",
    `${colors.dim("Artifacts")}  ${accent(clip(baseOut, 48))}`,
    `${colors.dim("Run these continuously on the managed platform")}  ${accent("→")}  ${accent("nullsquare.net")}`,
    "",
  ];
  return box("NULLSQUARE · MULTI-TARGET", lines);
};
