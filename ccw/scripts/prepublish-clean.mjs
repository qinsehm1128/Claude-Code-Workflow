#!/usr/bin/env node
/**
 * Pre-publish cleanup - removes dev artifacts from directories
 * that will be included in the npm package via the "files" field.
 */
import { globSync } from 'glob';
import { rmSync } from 'fs';

const patterns = [
  'ccw/scripts/__pycache__/**',
  'ccw/dist/.ace-tool/**',
  'ccw/src/.ace-tool/**',
  'codex-lens/src/**/__pycache__/**',
  'ccw-litellm/src/**/__pycache__/**',
  'codex-lens/src/**/.workflow/**',
  '**/.workflow/.cli-history/*.db*',
];

let cleaned = 0;
for (const pattern of patterns) {
  const files = globSync(pattern, { ignore: 'node_modules/**', dot: true });
  for (const f of files) {
    try {
      rmSync(f, { force: true });
      cleaned++;
    } catch { /* skip */ }
  }
}

if (cleaned > 0) {
  console.log(`[prepublish-clean] Removed ${cleaned} dev artifacts`);
}
