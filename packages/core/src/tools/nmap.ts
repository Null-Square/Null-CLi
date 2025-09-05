/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import { Config } from '../config/config.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
  ToolInvocation,
  ToolResult,
} from './tools.js';

export interface NmapToolParams {
  target: string; // host or IP (no wildcards)
  ports?: string; // comma-separated list or range, e.g. "80,443" or "1-1024"
  service_detection?: boolean; // -sV
  ping_skip?: boolean; // -Pn
  top_ports?: number; // --top-ports N
  timing?: 'T2' | 'T3' | 'T4'; // -T*
}

function sanitizeTarget(target: string): string | null {
  const t = target.trim();
  // Very conservative: allow IPv4, IPv6, or hostname without spaces or wildcards
  if (!t || /\s|[*]/.test(t)) return null;
  return t;
}

class NmapToolInvocation extends BaseToolInvocation<NmapToolParams, ToolResult> {
  constructor(private readonly config: Config, params: NmapToolParams) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = ['nmap'];
    if (this.params.ping_skip) parts.push('-Pn');
    if (this.params.service_detection) parts.push('-sV');
    if (this.params.timing) parts.push(`-${this.params.timing}`);
    if (this.params.top_ports && this.params.top_ports > 0)
      parts.push(`--top-ports`, String(this.params.top_ports));
    if (this.params.ports) parts.push('-p', this.params.ports);
    parts.push(this.params.target);
    return `Run: ${parts.join(' ')}`;
  }

  override async shouldConfirmExecute(): Promise<
    ToolCallConfirmationDetails | false
  > {
    // Always confirm network scans
    const desc = this.getDescription();
    const details: ToolCallConfirmationDetails = {
      type: 'exec',
      title: 'Confirm Nmap Scan',
      command: desc,
      rootCommand: 'nmap',
      onConfirm: async (_outcome: ToolConfirmationOutcome) => {},
    };
    return details;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const args: string[] = [];
    if (this.params.ping_skip) args.push('-Pn');
    if (this.params.service_detection) args.push('-sV');
    if (this.params.timing) args.push(`-${this.params.timing}`);
    if (this.params.top_ports && this.params.top_ports > 0) {
      args.push('--top-ports', String(this.params.top_ports));
    }
    if (this.params.ports) args.push('-p', this.params.ports);
    args.push(this.params.target);

    return await new Promise<ToolResult>((resolve) => {
      const child = spawn('nmap', args, {
        cwd: this.config.getTargetDir(),
      });
      let stdout = '';
      let stderr = '';
      let closed = false;
      child.stdout.on('data', (d) => (stdout += d?.toString() ?? ''));
      child.stderr.on('data', (d) => (stderr += d?.toString() ?? ''));
      child.on('error', (err) => {
        if (closed) return;
        closed = true;
        resolve({
          llmContent: `Error: ${err.message}\nStderr: ${stderr || '(empty)'}`,
          returnDisplay: `Nmap error: ${err.message}`,
          error: { message: err.message },
        });
      });
      child.on('close', (code) => {
        if (closed) return;
        closed = true;
        if (code === 0 || stdout) {
          resolve({
            llmContent: stdout || '(no output)',
            returnDisplay: 'Nmap completed. See details above.',
          } as ToolResult);
        } else {
          const msg = `Nmap exited with code ${code}. Stderr: ${stderr || '(empty)'}`;
          resolve({ llmContent: msg, returnDisplay: msg, error: { message: msg } });
        }
      });
    });
  }
}

export class NmapTool extends BaseDeclarativeTool<NmapToolParams, ToolResult> {
  static readonly Name = 'nmap_scan';

  constructor(private readonly config: Config) {
    super(
      NmapTool.Name,
      'Nmap',
      'Performs a basic nmap scan against a single target with a restricted set of options.\n- Use for host/port discovery on explicitly provided targets you have permission to scan.\n- Allowed options: -Pn (skip ping), -sV (service/version), -p <ports>, --top-ports <N>, -T2/-T3/-T4.\n- The tool always prompts for confirmation before executing.\n- Avoid scanning broad ranges or unknown networks.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description:
              'Hostname or IP address to scan (no wildcards, single target only).',
          },
          ports: {
            type: 'string',
            description:
              'Optional ports list or range (e.g., "80,443" or "1-1024").',
          },
          service_detection: {
            type: 'boolean',
            description: 'Enable service/version detection (-sV).',
          },
          ping_skip: {
            type: 'boolean',
            description: 'Skip host discovery (treat all as online) (-Pn).',
          },
          top_ports: {
            type: 'number',
            description: 'Scan top N most common ports (--top-ports N).',
            minimum: 1,
            maximum: 10000,
          },
          timing: {
            type: 'string',
            enum: ['T2', 'T3', 'T4'],
            description: 'Timing template (-T2/-T3/-T4).',
          },
        },
        required: ['target'],
        additionalProperties: false,
      },
      false,
      false,
    );
  }

  protected override validateToolParamValues(
    params: NmapToolParams,
  ): string | null {
    const tgt = sanitizeTarget(params.target);
    if (!tgt) return 'Invalid target. Provide a single hostname or IP without wildcards.';
    if (params.ports && /[^0-9,\-]/.test(params.ports)) {
      return 'Invalid ports syntax. Use digits, commas, and dashes only.';
    }
    return null;
  }

  protected override createInvocation(
    params: NmapToolParams,
  ): ToolInvocation<NmapToolParams, ToolResult> {
    // Normalize target after validation
    params.target = sanitizeTarget(params.target)!;
    return new NmapToolInvocation(this.config, params);
  }
}


