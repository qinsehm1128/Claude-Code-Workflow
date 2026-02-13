/**
 * Unit tests for path-validator utility module.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses a stubbed `fs/promises.realpath` to simulate symlinks and ENOENT cases.
 */

import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsp = require('node:fs/promises') as typeof import('node:fs/promises');

const ORIGINAL_ENV = { ...process.env };

type RealpathPlan = Map<string, { type: 'return'; value: string } | { type: 'throw'; error: any }>;

const realpathCalls: string[] = [];
const realpathPlan: RealpathPlan = new Map();

function enoent(message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = 'ENOENT';
  return err;
}

const originalRealpath = fsp.realpath;
fsp.realpath = (async (p: string) => {
  realpathCalls.push(p);
  const planned = realpathPlan.get(p);
  if (!planned) {
    throw enoent(`ENOENT: no such file or directory, realpath '${p}'`);
  }
  if (planned.type === 'throw') throw planned.error;
  return planned.value;
}) as any;

const pathValidatorUrl = new URL('../dist/utils/path-validator.js', import.meta.url).href;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

beforeEach(() => {
  realpathCalls.length = 0;
  realpathPlan.clear();

  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
});

describe('path-validator utility module', async () => {
  mod = await import(pathValidatorUrl);

  it('getProjectRoot uses CCW_PROJECT_ROOT or falls back to cwd', () => {
    delete process.env.CCW_PROJECT_ROOT;
    assert.equal(mod.getProjectRoot(), process.cwd());

    process.env.CCW_PROJECT_ROOT = 'C:\\root';
    assert.equal(mod.getProjectRoot(), 'C:\\root');
  });

  it('getAllowedDirectories parses CCW_ALLOWED_DIRS or falls back to project root', () => {
    process.env.CCW_PROJECT_ROOT = 'C:\\root';
    delete process.env.CCW_ALLOWED_DIRS;
    assert.deepEqual(mod.getAllowedDirectories(), ['C:\\root']);

    process.env.CCW_ALLOWED_DIRS = 'C:\\a, C:\\b ,,';
    assert.deepEqual(mod.getAllowedDirectories(), ['C:\\a', 'C:\\b']);
  });

  it('normalizePath and isPathWithinAllowedDirectories are cross-platform friendly', () => {
    assert.equal(mod.normalizePath('C:\\a\\b'), 'C:/a/b');

    assert.equal(mod.isPathWithinAllowedDirectories('C:/allowed', ['C:/allowed']), true);
    assert.equal(mod.isPathWithinAllowedDirectories('C:/allowed/sub', ['C:/allowed']), true);
    assert.equal(mod.isPathWithinAllowedDirectories('C:/allowedness/sub', ['C:/allowed']), false);
  });

  it('validatePath returns normalized real path for allowed targets', async () => {
    process.env.CCW_PROJECT_ROOT = 'C:\\root';
    const absolute = path.resolve('C:\\root', 'sub', 'file.txt');
    realpathPlan.set(absolute, { type: 'return', value: absolute });

    const result = await mod.validatePath(path.join('sub', 'file.txt'), {
      allowedDirectories: ['C:\\root'],
    });
    assert.equal(result, 'C:/root/sub/file.txt');
    assert.deepEqual(realpathCalls, [absolute]);
  });

  it('validatePath rejects paths outside allowed directories when sandbox is enabled', async () => {
    process.env.CCW_ENABLE_SANDBOX = '1';
    await assert.rejects(
      mod.validatePath('C:\\secret\\file.txt', { allowedDirectories: ['C:\\allowed'] }),
      (err: any) => err instanceof Error && err.message.includes('Access denied: path'),
    );
  });

  it('validatePath allows paths outside allowed directories when sandbox is disabled (default)', async () => {
    delete process.env.CCW_ENABLE_SANDBOX;
    const link = 'C:\\secret\\file.txt';
    realpathPlan.set(link, { type: 'return', value: link });

    const result = await mod.validatePath(link, { allowedDirectories: ['C:\\allowed'] });
    assert.equal(result, 'C:/secret/file.txt');
  });

  it('validatePath re-checks symlink target after realpath when sandbox is enabled', async () => {
    process.env.CCW_ENABLE_SANDBOX = '1';
    const link = 'C:\\allowed\\link.txt';
    realpathPlan.set(link, { type: 'return', value: 'C:\\secret\\target.txt' });

    await assert.rejects(
      mod.validatePath(link, { allowedDirectories: ['C:\\allowed'] }),
      (err: any) => err instanceof Error && err.message.includes('symlink target'),
    );
  });

  it('validatePath handles ENOENT with mustExist and validates parent directory', async () => {
    const missing = 'C:\\allowed\\missing.txt';
    realpathPlan.set(missing, { type: 'throw', error: enoent('missing') });

    await assert.rejects(
      mod.validatePath(missing, { allowedDirectories: ['C:\\allowed'], mustExist: true }),
      (err: any) => err instanceof Error && err.message.includes('File not found'),
    );

    const newFile = 'C:\\allowed\\new\\file.txt';
    const parent = path.resolve(newFile, '..');
    realpathPlan.set(newFile, { type: 'throw', error: enoent('missing') });
    realpathPlan.set(parent, { type: 'return', value: parent });

    const ok = await mod.validatePath(newFile, { allowedDirectories: ['C:\\allowed'] });
    assert.equal(ok, newFile);

    const newFileNoParent = 'C:\\allowed\\no-parent\\file.txt';
    const noParentDir = path.resolve(newFileNoParent, '..');
    realpathPlan.set(newFileNoParent, { type: 'throw', error: enoent('missing') });
    realpathPlan.set(noParentDir, { type: 'throw', error: enoent('parent missing') });

    const okNoParent = await mod.validatePath(newFileNoParent, { allowedDirectories: ['C:\\allowed'] });
    assert.equal(okNoParent, newFileNoParent);
  });

  it('resolveProjectPath resolves under project root', () => {
    process.env.CCW_PROJECT_ROOT = 'C:\\root';
    assert.equal(mod.resolveProjectPath('a', 'b'), path.resolve('C:\\root', 'a', 'b'));
  });
});

after(() => {
  fsp.realpath = originalRealpath;

  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
});

