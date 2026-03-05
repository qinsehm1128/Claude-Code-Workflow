/**
 * Regression test: CodexLens bootstrap should recover when UV bootstrap fails
 * and the existing venv is missing pip (common with UV-created venvs).
 *
 * We simulate "UV available but broken" by pointing CCW_UV_PATH to the current Node
 * executable. `node --version` exits 0 so isUvAvailable() returns true, but any
 * `node pip install ...` calls fail, forcing bootstrapVenv() to fall back to pip.
 *
 * Before running bootstrapVenv(), we pre-create the venv and delete its pip entrypoint
 * to mimic a venv that has Python but no pip executable. bootstrapVenv() should
 * re-bootstrap pip (ensurepip) or recreate the venv, then succeed.
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

describe('CodexLens bootstrap pip repair', () => {
  it('repairs missing pip in existing venv during pip fallback', { timeout: 10 * 60 * 1000 }, async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'codexlens-bootstrap-pip-missing-'));

    try {
      const script = `
import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { getSystemPython } from './ccw/dist/utils/python-utils.js';
import { bootstrapVenv } from './ccw/dist/tools/codex-lens.js';

const dataDir = process.env.CODEXLENS_DATA_DIR;
if (!dataDir) throw new Error('Missing CODEXLENS_DATA_DIR');

mkdirSync(dataDir, { recursive: true });
const venvDir = join(dataDir, 'venv');

// Create a venv up-front so UV bootstrap will skip venv creation and fail on install.
const pythonCmd = getSystemPython();
execSync(pythonCmd + ' -m venv "' + venvDir + '"', { stdio: 'inherit' });

// Simulate a "pip-less" venv by deleting the pip entrypoint.
const pipPath = process.platform === 'win32'
  ? join(venvDir, 'Scripts', 'pip.exe')
  : join(venvDir, 'bin', 'pip');
if (existsSync(pipPath)) {
  rmSync(pipPath, { force: true });
}

const result = await bootstrapVenv();
const pipRestored = existsSync(pipPath);

console.log('@@RESULT@@' + JSON.stringify({ result, pipRestored }));
`.trim();

      const env = {
        ...process.env,
        // Isolate test venv + dependencies from user/global CodexLens state.
        CODEXLENS_DATA_DIR: dataDir,
        // Make isUvAvailable() return true, but installFromProject() fail.
        CCW_UV_PATH: process.execPath,
      };

      const { code, stdout, stderr } = await runNodeEvalModule(script, env);
      assert.equal(code, 0, `bootstrapVenv child process failed:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);

      const marker = '@@RESULT@@';
      const idx = stdout.lastIndexOf(marker);
      assert.ok(idx !== -1, `Missing result marker in stdout:\n${stdout}`);

      const jsonText = stdout.slice(idx + marker.length).trim();
      const parsed = JSON.parse(jsonText);

      assert.equal(parsed?.result?.success, true, `Expected success=true, got:\n${jsonText}`);
      assert.equal(parsed?.pipRestored, true, `Expected pipRestored=true, got:\n${jsonText}`);

      // Best-effort: confirm we exercised the missing-pip repair path.
      assert.ok(
        String(stderr).includes('pip not found at:') || String(stdout).includes('pip not found at:'),
        `Expected missing-pip warning in output. STDERR:\n${stderr}\nSTDOUT:\n${stdout}`
      );
    } finally {
      try {
        rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup; leave artifacts only if Windows locks prevent removal.
      }
    }
  });
});

