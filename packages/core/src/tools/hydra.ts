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

export type HydraService =
  | 'ssh'
  | 'ftp'
  | 'telnet'
  | 'smtp'
  | 'imap'
  | 'pop3'
  | 'rdp'
  | 'smb';

export interface HydraToolParams {
  target: string; // single host or IP
  service: HydraService; // hydra module to use
  port?: number; // optional explicit port
  username?: string; // -l
  user_list?: string; // -L (file path)
  password?: string; // -p
  password_list?: string; // -P (file path)
  tasks?: number; // -t (parallel tasks)
  wait_time?: number; // -w (seconds wait between retries)
  exit_on_success?: boolean; // -f
  verbose?: boolean; // -V
}

function sanitizeTarget(target: string): string | null {
  const t = target.trim();
  // Very conservative: disallow whitespace and wildcards
  if (!t || /\s|[*]/.test(t)) return null;
  return t;
}

// Shared JSON schema for both Unicorn and Hydra tools
const HYDRA_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    target: {
      type: 'string',
      description: 'Hostname or IP (single target, no wildcards).',
    },
    service: {
      type: 'string',
      enum: ['ssh', 'ftp', 'telnet', 'smtp', 'imap', 'pop3', 'rdp', 'smb'],
      description: 'Hydra module/service to use.',
    },
    port: {
      type: 'number',
      description: 'Optional explicit port (-s).',
      minimum: 1,
      maximum: 65535,
    },
    username: {
      type: 'string',
      description: 'Single username (-l).',
    },
    user_list: {
      type: 'string',
      description: 'Path to username list file (-L).',
    },
    password: {
      type: 'string',
      description: 'Single password (-p).',
    },
    password_list: {
      type: 'string',
      description: 'Path to password list file (-P).',
    },
    tasks: {
      type: 'number',
      description: 'Parallel tasks (-t). Keep low to respect rate limits.',
      minimum: 1,
      maximum: 16,
    },
    wait_time: {
      type: 'number',
      description: 'Seconds to wait between retries (-w).',
      minimum: 1,
      maximum: 60,
    },
    exit_on_success: {
      type: 'boolean',
      description: 'Stop after first valid credential (-f).',
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output (-V).',
    },
  },
  required: ['target', 'service'],
  additionalProperties: false,
} as const;

function validateAndNormalizeHydraParams(
  params: HydraToolParams,
): string | null {
  const tgt = sanitizeTarget(params.target);
  if (!tgt)
    return 'Invalid target. Provide a single hostname or IP without wildcards.';

  // Require at least one username source and one password source
  const hasUser = Boolean(params.username || params.user_list);
  const hasPass = Boolean(params.password || params.password_list);
  if (!hasUser || !hasPass) {
    return 'Provide at least one username (or user_list) and one password (or password_list).';
  }

  // Apply conservative defaults if unset
  if (!params.tasks) params.tasks = 4;
  if (!params.wait_time) params.wait_time = 2;
  if (params.exit_on_success === undefined) params.exit_on_success = true;
  if (params.verbose === undefined) params.verbose = true;

  // Normalize target after validation
  params.target = tgt;
  return null;
}

class HydraToolInvocation extends BaseToolInvocation<HydraToolParams, ToolResult> {
  constructor(private readonly config: Config, params: HydraToolParams) {
    super(params);
  }

  private buildArgs(): string[] {
    const args: string[] = [];
    const p = this.params;

    if (p.username) args.push('-l', p.username);
    if (p.user_list) args.push('-L', p.user_list);
    if (p.password) args.push('-p', p.password);
    if (p.password_list) args.push('-P', p.password_list);
    if (p.tasks && p.tasks > 0) args.push('-t', String(p.tasks));
    if (p.wait_time && p.wait_time > 0) args.push('-w', String(p.wait_time));
    if (p.exit_on_success) args.push('-f');
    if (p.verbose) args.push('-V');
    if (p.port && p.port > 0) args.push('-s', String(p.port));

    // Single target only; build service URL form: service://target
    const serviceUrl = `${p.service}://${p.target}`;
    args.push(serviceUrl);
    return args;
  }

  getDescription(): string {
    const parts: string[] = ['hydra'];
    parts.push(...this.buildArgs());
    return `Run: ${parts.join(' ')}`;
  }

  override async shouldConfirmExecute(): Promise<
    ToolCallConfirmationDetails | false
  > {
    // Always confirm brute-force attempts for safety and ROE compliance
    const desc = this.getDescription();
    const details: ToolCallConfirmationDetails = {
      type: 'exec',
      title: 'Confirm Hydra Brute Force',
      command: desc,
      rootCommand: 'hydra',
      onConfirm: async (_outcome: ToolConfirmationOutcome) => {},
      // A short reminder about safe defaults
      note:
        'Hydra will run with constrained concurrency. Ensure target is in scope and rate limits are respected.',
    } as ToolCallConfirmationDetails;
    return details;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const args = this.buildArgs();
    return await new Promise<ToolResult>((resolve) => {
      const child = spawn('hydra', args, {
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
          returnDisplay: `Hydra error: ${err.message}`,
          error: { message: err.message },
        });
      });
      child.on('close', (code) => {
        if (closed) return;
        closed = true;
        if (code === 0 || stdout) {
          resolve({
            llmContent: stdout || '(no output)',
            returnDisplay: 'Hydra completed. See details above.',
          } as ToolResult);
        } else {
          const msg = `Hydra exited with code ${code}. Stderr: ${stderr || '(empty)'}`;
          resolve({ llmContent: msg, returnDisplay: msg, error: { message: msg } });
        }
      });
    });
  }
}

export class HydraTool extends BaseDeclarativeTool<HydraToolParams, ToolResult> {
  // Expose as "unicorn" while executing hydra under the hood
  static readonly Name = 'unicorn';

  constructor(private readonly config: Config) {
    super(
      HydraTool.Name,
      'Unicorn',
      'Run a constrained credential brute-force (Hydra wrapper) against a single in-scope target.\n' +
        '- Allowed services: ssh, ftp, telnet, smtp, imap, pop3, rdp, smb.\n' +
        '- Requires explicit confirmation before execution.\n' +
        '- Defaults favor safety (low concurrency, optional early-exit).',
      Kind.Other,
      HYDRA_PARAM_SCHEMA,
      false,
      false,
    );
  }

  protected override validateToolParamValues(
    params: HydraToolParams,
  ): string | null {
    return validateAndNormalizeHydraParams(params);
  }

  protected override createInvocation(
    params: HydraToolParams,
  ): ToolInvocation<HydraToolParams, ToolResult> {
    return new HydraToolInvocation(this.config, params);
  }
}

export class HydraNativeTool extends BaseDeclarativeTool<
  HydraToolParams,
  ToolResult
> {
  // Expose a second tool name that maps to the same implementation
  static readonly Name = 'hydra_bruteforce';

  constructor(private readonly config: Config) {
    super(
      HydraNativeTool.Name,
      'Hydra',
      'Run a constrained Hydra brute-force attempt against a single in-scope target.\n' +
        '- Allowed services: ssh, ftp, telnet, smtp, imap, pop3, rdp, smb.\n' +
        '- Requires explicit confirmation before execution.\n' +
        '- Defaults favor safety (low concurrency, optional early-exit).',
      Kind.Other,
      HYDRA_PARAM_SCHEMA,
      false,
      false,
    );
  }

  protected override validateToolParamValues(
    params: HydraToolParams,
  ): string | null {
    return validateAndNormalizeHydraParams(params);
  }

  protected override createInvocation(
    params: HydraToolParams,
  ): ToolInvocation<HydraToolParams, ToolResult> {
    return new HydraToolInvocation(this.config, params);
  }
}
