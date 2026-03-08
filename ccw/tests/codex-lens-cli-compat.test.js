import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDirs = [];

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CodexLens CLI compatibility retries', () => {
  it('initializes a tiny index even when CLI emits compatibility conflicts first', async () => {
    const moduleUrl = new URL(`../dist/tools/codex-lens.js?compat=${Date.now()}`, import.meta.url).href;
    const { checkVenvStatus, executeCodexLens } = await import(moduleUrl);

    const ready = await checkVenvStatus(true);
    if (!ready.ready) {
      console.log('Skipping: CodexLens not ready');
      return;
    }

    const projectDir = mkdtempSync(join(tmpdir(), 'codexlens-init-'));
    tempDirs.push(projectDir);
    writeFileSync(join(projectDir, 'sample.ts'), 'export const sample = 1;\n');

    const result = await executeCodexLens(['index', 'init', projectDir, '--force'], { timeout: 600000 });

    assert.equal(result.success, true, result.error ?? 'Expected init to succeed');
    assert.ok((result.output ?? '').length > 0 || (result.warning ?? '').length > 0, 'Expected init output or compatibility warning');
  });
});
