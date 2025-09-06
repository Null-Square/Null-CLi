/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrangepieTool } from './orangepie.js';
import { Config } from '../config/config.js';

// Mock child_process.spawn
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual('node:child_process');
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

describe('OrangepieTool', () => {
  let tool: OrangepieTool;
  let mockConfig: Config;

  beforeEach(() => {
    // Create a mock config
    mockConfig = {
      getTargetDir: () => '/mock/target/dir',
    } as unknown as Config;
    
    // Create the tool instance
    tool = new OrangepieTool(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name, displayName, and description', () => {
    expect(tool.name).toBe('orangepie');
    expect(tool.displayName).toBe('Orangepie');
    expect(tool.description).toContain('man-in-the-middle attack framework');
  });

  it('should validate phishlet parameter correctly', () => {
    // Valid phishlet names
    expect(tool.validateToolParams({ mode: 'phishlet', phishlet: 'github' })).toBeNull();
    expect(tool.validateToolParams({ mode: 'phishlet', phishlet: 'google-mail' })).toBeNull();
    expect(tool.validateToolParams({ mode: 'phishlet', phishlet: 'test_123' })).toBeNull();
    
    // Invalid phishlet names
    expect(tool.validateToolParams({ mode: 'phishlet', phishlet: 'test@invalid' })).toBe('Invalid phishlet name. Only alphanumeric characters, hyphens, and underscores are allowed.');
    expect(tool.validateToolParams({ mode: 'phishlet', phishlet: 'test invalid' })).toBe('Invalid phishlet name. Only alphanumeric characters, hyphens, and underscores are allowed.');
  });

  it('should validate domain parameter correctly', () => {
    // Valid domains
    expect(tool.validateToolParams({ mode: 'lure', domain: 'example.com' })).toBeNull();
    expect(tool.validateToolParams({ mode: 'lure', domain: 'sub.domain.com' })).toBeNull();
    expect(tool.validateToolParams({ mode: 'lure', domain: 'test-domain.com' })).toBeNull();
    
    // Invalid domains
    expect(tool.validateToolParams({ mode: 'lure', domain: 'test@domain.com' })).toBe('Invalid domain. Only alphanumeric characters, hyphens, underscores, and dots are allowed.');
    expect(tool.validateToolParams({ mode: 'lure', domain: 'test domain' })).toBe('Invalid domain. Only alphanumeric characters, hyphens, underscores, and dots are allowed.');
  });

  it('should create correct invocation for phishlet mode', () => {
    const invocation = tool.build({ mode: 'phishlet', command: 'get-hosts', phishlet: 'github' });
    const description = invocation.getDescription();
    expect(description).toBe('Run: evilginx2 phishlet get-hosts github');
  });

  it('should create correct invocation for lure mode with parameters', () => {
    const invocation = tool.build({ 
      mode: 'lure', 
      command: 'create', 
      domain: 'example.com', 
      redirect_url: 'https://example.com/login',
      hide_form: true
    });
    const description = invocation.getDescription();
    expect(description).toBe('Run: evilginx2 lure create -domain example.com -redirect_url https://example.com/login -hide_form');
  });

  it('should create correct invocation for session mode', () => {
    const invocation = tool.build({ mode: 'session', command: 'list' });
    const description = invocation.getDescription();
    expect(description).toBe('Run: evilginx2 session list');
  });

  it('should add verbose flag when requested', () => {
    const invocation = tool.build({ mode: 'proxy', command: 'start', verbose: true });
    const description = invocation.getDescription();
    expect(description).toBe('Run: evilginx2 proxy start -debug');
  });

  it('should require mode parameter', () => {
    expect(() => tool.build({} as any)).toThrow();
  });

  it('should always require confirmation before execution', async () => {
    const invocation = tool.build({ mode: 'phishlet', phishlet: 'github' });
    const confirmation = await invocation.shouldConfirmExecute(new AbortController().signal);
    expect(confirmation).not.toBe(false);
    if (confirmation !== false) {
      expect(confirmation.type).toBe('exec');
      expect(confirmation.title).toBe('Confirm Orangepie Operation');
      if (confirmation.type === 'exec') {
        expect(confirmation.rootCommand).toBe('evilginx2');
      }
    }
  });
});