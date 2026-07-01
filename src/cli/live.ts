import process from "node:process";

import type { AgentEvent } from "../agent/loop.js";
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
  let step = 0;
  let maxSteps = 0;
  let last = "starting";
  let timer: ReturnType<typeof setInterval> | undefined;

  const clearLine = (): void => {
    if (tty) stream.write("\r\x1b[2K");
  };

  const renderStatus = (): void => {
    if (!tty) return;
    const spin = accent(FRAMES[frame % FRAMES.length]);
    const stepText = maxSteps ? colors.dim(`step ${step}/${maxSteps}`) : colors.dim("working");
    clearLine();
    stream.write(`${spin} ${colors.muted(label)} ${colors.dim("|")} ${stepText} ${colors.dim("|")} ${colors.muted(clip(last, 42))}`);
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
        step = event.step;
        maxSteps = event.maxSteps;
        last = "thinking";
        if (tty) renderStatus();
        else println(`${colors.dim("-")} ${colors.muted(`step ${event.step}/${event.maxSteps}`)}`);
        break;
      case "model":
        last = `model: ${event.preview}`;
        if (tty) renderStatus();
        break;
      case "tool":
        last = event.reason ? `${event.tool} - ${event.reason}` : event.tool;
        if (tty) renderStatus();
        else println(`${colors.dim("-")} ${colors.muted(event.tool)}${event.ok ? "" : colors.dim(" (failed)")}`);
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
