import process from "node:process";

import type { AgentEvent, AgentPhase } from "../agent/loop.js";
import { accent, colors, severityTag } from "./brand.js";

const FRAMES = ["|", "/", "-", "\\"];

const clip = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, Math.max(1, max - 1))}...` : value;

export interface LiveReporter {
  onEvent: (event: AgentEvent) => void;
  stop: () => void;
}

// Small live status line. On a TTY it animates one status row; in CI it degrades
// to sparse one-line events so logs stay readable.
export const createLiveReporter = (label: string): LiveReporter => {
  const stream = process.stderr;
  const tty = Boolean(stream.isTTY) && process.env.NO_COLOR !== "1";
  let frame = 0;
  let phase: AgentPhase = "planning";
  let last = "starting";
  let timer: ReturnType<typeof setInterval> | undefined;

  const clearLine = (): void => {
    if (tty) stream.write("\r\x1b[2K");
  };

  const renderStatus = (): void => {
    if (!tty) return;
    const spin = accent(FRAMES[frame % FRAMES.length]);
    clearLine();
    stream.write(`${spin} ${colors.muted(label)} ${colors.dim("|")} ${colors.dim(phase)} ${colors.dim("|")} ${colors.muted(clip(last, 48))}`);
  };

  const println = (line: string): void => {
    clearLine();
    stream.write(`${line}\n`);
    renderStatus();
  };

  if (tty) {
    timer = setInterval(() => {
      frame += 1;
      renderStatus();
    }, 90);
    if (typeof timer.unref === "function") timer.unref();
  }

  const onEvent = (event: AgentEvent): void => {
    switch (event.type) {
      case "step":
        last = "thinking";
        if (tty) renderStatus();
        break;
      case "phase":
        if (phase === event.phase) break;
        phase = event.phase;
        last = `${event.phase} in progress`;
        println(`${accent("phase")} ${colors.fg(event.phase)}`);
        break;
      case "agent":
        last = clip(event.message, 80);
        println(`${accent("agent")} ${colors.fg(clip(event.message, 110))}`);
        break;
      case "model":
        last = `model: ${event.preview}`;
        if (tty) renderStatus();
        break;
      case "tool":
        last = event.reason ? `${event.tool} - ${event.reason}` : event.tool;
        println(
          `${event.ok ? colors.green("tool") : colors.red("tool")} ${colors.fg(event.tool)} ${colors.dim(event.message ?? "")}`,
        );
        for (const artifactPath of event.artifactPaths ?? []) {
          println(`  ${colors.dim("artifact")} ${accent(artifactPath)}`);
        }
        break;
      case "finding":
        println(`  ${severityTag(event.severity)} ${colors.fg(clip(event.title, 52))}`);
        break;
      case "note":
        last = `note: ${event.title}`;
        if (tty) renderStatus();
        break;
      case "done":
        break;
    }
  };

  const stop = (): void => {
    if (timer) clearInterval(timer);
    clearLine();
  };

  return { onEvent, stop };
};
