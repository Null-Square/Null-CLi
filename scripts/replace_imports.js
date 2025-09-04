import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const roots = [
  join(process.cwd(), 'packages/cli/src'),
  join(process.cwd(), 'packages/core/src'),
  join(process.cwd(), 'packages/vscode-ide-companion/src'),
];

const exts = new Set(['.ts', '.tsx']);

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, files);
    } else if (exts.has(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

const targets = roots.flatMap((r) => walk(r));
let changed = 0;
for (const file of targets) {
  let text;
  try {
    text = readFileSync(file, 'utf-8');
  } catch {
    continue;
  }
  const next = text
    .replaceAll('@qwen-code/qwen-code-core', '@null/null-core')
    .replaceAll(
      '@qwen-code/qwen-code-test-utils',
      '@null/null-test-utils',
    );
  if (next !== text) {
    writeFileSync(file, next);
    changed++;
  }
}
console.log(`Updated imports in ${changed} files.`);

