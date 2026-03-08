import { afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const uvManagerPath = new URL('../dist/utils/uv-manager.js', import.meta.url).href;

describe('CodexLens UV python preference', async () => {
  let mod;
  const originalPython = process.env.CCW_PYTHON;

  before(async () => {
    mod = await import(uvManagerPath);
  });

  afterEach(() => {
    if (originalPython === undefined) {
      delete process.env.CCW_PYTHON;
      return;
    }
    process.env.CCW_PYTHON = originalPython;
  });

  it('honors CCW_PYTHON override', () => {
    process.env.CCW_PYTHON = 'C:/Custom/Python/python.exe';
    assert.equal(mod.getPreferredCodexLensPythonSpec(), 'C:/Custom/Python/python.exe');
  });

  it('prefers Python 3.11 or 3.10 on Windows when available', () => {
    if (process.platform !== 'win32') return;
    delete process.env.CCW_PYTHON;

    let installed = '';
    try {
      installed = execSync('py -0p', { encoding: 'utf-8' });
    } catch {
      return;
    }

    const has311 = installed.includes('-V:3.11');
    const has310 = installed.includes('-V:3.10');
    if (!has311 && !has310) {
      return;
    }

    const preferred = mod.getPreferredCodexLensPythonSpec();
    assert.ok(
      preferred === '3.11' || preferred === '3.10',
      `expected Windows preference to avoid 3.12 when 3.11/3.10 exists, got ${preferred}`,
    );
  });
});
