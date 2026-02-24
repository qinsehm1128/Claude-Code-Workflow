/**
 * Regression test: CodexLens bootstrap falls back to pip when UV bootstrap fails.
 *
 * We simulate a "broken UV" by pointing CCW_UV_PATH to the current Node executable.
 * `node --version` exits 0 so isUvAvailable() returns true, but `node venv ...` fails,
 * forcing the bootstrap code to try the pip path.
 *
 * This test runs bootstrapVenv in a child process to avoid mutating process-wide
 * environment variables that could affect other tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// repo root: <repo>/ccw/tests -> <repo>
const REPO_ROOT = join(__dirname, '..', '..');

function runNodeEvalModule(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      cwd: REPO_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('CodexLens bootstrap fallback', () => {
  it('falls back to pip when UV bootstrap fails', { timeout: 10 * 60 * 1000 }, async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'codexlens-bootstrap-fallback-'));

    try {
      const script = `
import { bootstrapVenv } from './ccw/dist/tools/codex-lens.js';

(async () => {
  const result = await bootstrapVenv();
  console.log('@@RESULT@@' + JSON.stringify(result));
})().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
`;

      const env = {
        ...process.env,
        // Isolate test venv + dependencies from user/global CodexLens state.
        CODEXLENS_DATA_DIR: dataDir,
        // Make isUvAvailable() return true, but createVenv() fail.
        CCW_UV_PATH: process.execPath,
      };

      const { code, stdout, stderr } = await runNodeEvalModule(script, env);
      assert.equal(code, 0, `bootstrapVenv child process failed:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);

      const marker = '@@RESULT@@';
      const idx = stdout.lastIndexOf(marker);
      assert.ok(idx !== -1, `Missing result marker in stdout:\n${stdout}`);

      const jsonText = stdout.slice(idx + marker.length).trim();
      const parsed = JSON.parse(jsonText);

      assert.equal(parsed?.success, true, `Expected success=true, got:\n${jsonText}`);
      assert.ok(Array.isArray(parsed.warnings), 'Expected warnings array on pip fallback result');
      assert.ok(parsed.warnings.some((w) => String(w).includes('UV bootstrap failed')), `Expected UV failure warning, got: ${JSON.stringify(parsed.warnings)}`);
    } finally {
      try {
        rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup; leave artifacts only if Windows locks prevent removal.
      }
    }
  });
});

