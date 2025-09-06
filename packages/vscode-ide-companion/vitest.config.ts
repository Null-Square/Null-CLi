/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const r = (p: string) => path.resolve(here, p);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      '**/dist/**',
      '**/node_modules/**',
      // These rely on runtime core package resolution; skip in CI unit tests
      'src/extension.test.ts',
      'src/extension-multi-folder.test.ts',
    ],
    reporters: ['default', 'junit'],
    outputFile: { junit: 'junit.xml' },
  },
  resolve: {
    alias: {
      '@null/null-core': r('../core/src/index.ts'),
    },
  },
});
