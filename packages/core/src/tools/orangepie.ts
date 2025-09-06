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

export interface OrangepieToolParams {
  mode: 'phishlet' | 'lure' | 'session' | 'proxy' | 'developer';
  command?: string; // Additional command to run
  phishlet?: string; // Phishlet name for phishlet mode
  domain?: string; // Domain for lure creation
  redirect_url?: string; // Redirect URL for lure creation
  hide_form?: boolean; // Hide form for lure creation
  session_id?: string; // Session ID for session mode
  verbose?: boolean; // Enable verbose output
}

function sanitizePhishlet(phishlet: string): string | null {
  const p = phishlet.trim();
  // Allow alphanumeric, hyphens, and underscores only
  if (!p || /[^a-zA-Z0-9\-_]/.test(p)) return null;
  return p;
}

function sanitizeDomain(domain: string): string | null {
  const d = domain.trim();
  // Basic domain validation
  if (!d || /[^a-zA-Z0-9\-_.]/.test(d)) return null;
  return d;
}

class OrangepieToolInvocation extends BaseToolInvocation<OrangepieToolParams, ToolResult> {
  constructor(private readonly config: Config, params: OrangepieToolParams) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = ['evilginx2'];
    
    switch (this.params.mode) {
      case 'phishlet':
        parts.push('phishlet');
        if (this.params.command) parts.push(this.params.command);
        if (this.params.phishlet) parts.push(this.params.phishlet);
        break;
      case 'lure':
        parts.push('lure');
        if (this.params.command) parts.push(this.params.command);
        if (this.params.domain) parts.push('-domain', this.params.domain);
        if (this.params.redirect_url) parts.push('-redirect_url', this.params.redirect_url);
        if (this.params.hide_form) parts.push('-hide_form');
        break;
      case 'session':
        parts.push('session');
        if (this.params.command) parts.push(this.params.command);
        if (this.params.session_id) parts.push(this.params.session_id);
        break;
      case 'proxy':
        parts.push('proxy');
        if (this.params.command) parts.push(this.params.command);
        break;
      case 'developer':
        parts.push('developer');
        if (this.params.command) parts.push(this.params.command);
        break;
    }
    
    if (this.params.verbose) parts.push('-debug');
    
    return `Run: ${parts.join(' ')}`;
  }

  override async shouldConfirmExecute(): Promise<
    ToolCallConfirmationDetails | false
  > {
    // Always confirm Orangepie operations as they can be used for phishing
    const desc = this.getDescription();
    const details: ToolCallConfirmationDetails = {
      type: 'exec',
      title: 'Confirm Orangepie Operation',
      command: desc,
      rootCommand: 'evilginx2',
      onConfirm: async (_outcome: ToolConfirmationOutcome) => {},
    };
    return details;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const args: string[] = [];
    
    // Add mode-specific arguments
    switch (this.params.mode) {
      case 'phishlet':
        args.push('phishlet');
        if (this.params.command) args.push(this.params.command);
        if (this.params.phishlet) args.push(this.params.phishlet);
        break;
      case 'lure':
        args.push('lure');
        if (this.params.command) args.push(this.params.command);
        if (this.params.domain) args.push('-domain', this.params.domain);
        if (this.params.redirect_url) args.push('-redirect_url', this.params.redirect_url);
        if (this.params.hide_form) args.push('-hide_form');
        break;
      case 'session':
        args.push('session');
        if (this.params.command) args.push(this.params.command);
        if (this.params.session_id) args.push(this.params.session_id);
        break;
      case 'proxy':
        args.push('proxy');
        if (this.params.command) args.push(this.params.command);
        break;
      case 'developer':
        args.push('developer');
        if (this.params.command) args.push(this.params.command);
        break;
    }
    
    // Add verbose flag if requested
    if (this.params.verbose) args.push('-debug');

    return await new Promise<ToolResult>((resolve) => {
      const child = spawn('evilginx2', args, {
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
          returnDisplay: `Orangepie error: ${err.message}`,
          error: { message: err.message },
        });
      });
      child.on('close', (code) => {
        if (closed) return;
        closed = true;
        if (code === 0 || stdout) {
          resolve({
            llmContent: stdout || '(no output)',
            returnDisplay: 'Orangepie completed. See details above.',
          } as ToolResult);
        } else {
          const msg = `Orangepie exited with code ${code}. Stderr: ${stderr || '(empty)'}`;
          resolve({ llmContent: msg, returnDisplay: msg, error: { message: msg } });
        }
      });
    });
  }
}

export class OrangepieTool extends BaseDeclarativeTool<OrangepieToolParams, ToolResult> {
  static readonly Name = 'orangepie';

  constructor(private readonly config: Config) {
    super(
      OrangepieTool.Name,
      'Orangepie',
      'Orangepie is a man-in-the-middle attack framework used for phishing login credentials along with session cookies, allowing for the bypass of 2-factor authentication protection.\n\n' +
      'Available modes:\n' +
      '- phishlet: Manage phishlets\n' +
      '- lure: Manage lures\n' +
      '- session: Manage sessions\n' +
      '- proxy: Proxy mode\n' +
      '- developer: Developer mode\n\n' +
      'This tool requires explicit permission to run as it can be used for unauthorized access to accounts.\n' +
      'The tool always prompts for confirmation before executing.\n' +
      'Use responsibly and only on systems you have authorized access to test.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['phishlet', 'lure', 'session', 'proxy', 'developer'],
            description: 'Operational mode for Orangepie',
          },
          command: {
            type: 'string',
            description: 'Additional command to run in the specified mode',
          },
          phishlet: {
            type: 'string',
            description: 'Phishlet name (used in phishlet mode)',
          },
          domain: {
            type: 'string',
            description: 'Domain for lure creation (used in lure mode)',
          },
          redirect_url: {
            type: 'string',
            description: 'Redirect URL for lure creation (used in lure mode)',
          },
          hide_form: {
            type: 'boolean',
            description: 'Hide form for lure creation (used in lure mode)',
          },
          session_id: {
            type: 'string',
            description: 'Session ID (used in session mode)',
          },
          verbose: {
            type: 'boolean',
            description: 'Enable verbose output',
          },
        },
        required: ['mode'],
        additionalProperties: false,
      },
      false,
      false,
    );
  }

  protected override validateToolParamValues(
    params: OrangepieToolParams,
  ): string | null {
    // Validate phishlet name if provided
    if (params.phishlet) {
      const phishlet = sanitizePhishlet(params.phishlet);
      if (!phishlet) return 'Invalid phishlet name. Only alphanumeric characters, hyphens, and underscores are allowed.';
    }
    
    // Validate domain if provided
    if (params.domain) {
      const domain = sanitizeDomain(params.domain);
      if (!domain) return 'Invalid domain. Only alphanumeric characters, hyphens, underscores, and dots are allowed.';
    }
    
    return null;
  }

  protected override createInvocation(
    params: OrangepieToolParams,
  ): ToolInvocation<OrangepieToolParams, ToolResult> {
    // Normalize parameters after validation
    if (params.phishlet) {
      params.phishlet = sanitizePhishlet(params.phishlet)!;
    }
    if (params.domain) {
      params.domain = sanitizeDomain(params.domain)!;
    }
    return new OrangepieToolInvocation(this.config, params);
  }
}