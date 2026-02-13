/**
 * Unit tests for CLI session share tokens
 */

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const shareUrl = new URL('../dist/core/services/cli-session-share.js', import.meta.url).href;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod;

const originalNow = Date.now;

afterEach(() => {
  Date.now = originalNow;
});

describe('CliSessionShareManager', async () => {
  mod = await import(shareUrl);

  it('creates a token record with expected fields', () => {
    const mgr = new mod.CliSessionShareManager();
    const record = mgr.createToken({
      sessionKey: 's-1',
      projectRoot: 'D:\\\\Claude_dms3',
      mode: 'read',
      ttlMs: 10_000,
    });

    assert.equal(record.sessionKey, 's-1');
    assert.equal(record.projectRoot, 'D:\\\\Claude_dms3');
    assert.equal(record.mode, 'read');
    assert.match(record.token, /^[A-Za-z0-9_-]+$/);
    assert.ok(record.expiresAt.endsWith('Z'));
  });

  it('validates only when sessionKey matches', () => {
    const mgr = new mod.CliSessionShareManager();
    const record = mgr.createToken({
      sessionKey: 's-abc',
      projectRoot: '/tmp/project',
      mode: 'read',
      ttlMs: 60_000,
    });

    assert.ok(mgr.validateToken(record.token, 's-abc'));
    assert.equal(mgr.validateToken(record.token, 's-wrong'), null);
  });

  it('revokes tokens', () => {
    const mgr = new mod.CliSessionShareManager();
    const record = mgr.createToken({
      sessionKey: 's-1',
      projectRoot: '/tmp/project',
      mode: 'write',
      ttlMs: 60_000,
    });

    assert.equal(mgr.revokeToken(record.token), true);
    assert.equal(mgr.revokeToken(record.token), false);
    assert.equal(mgr.validateToken(record.token, record.sessionKey), null);
  });

  it('expires tokens and cleans up expired entries', () => {
    let now = 1_700_000_000_000;
    Date.now = () => now;

    const mgr = new mod.CliSessionShareManager();
    const recordA = mgr.createToken({
      sessionKey: 's-a',
      projectRoot: '/tmp/project',
      mode: 'read',
      ttlMs: 1_000,
    });
    const recordB = mgr.createToken({
      sessionKey: 's-b',
      projectRoot: '/tmp/project',
      mode: 'read',
      ttlMs: 10_000,
    });

    now += 1_001;

    assert.equal(mgr.validateToken(recordA.token, recordA.sessionKey), null);
    assert.ok(mgr.validateToken(recordB.token, recordB.sessionKey));
    assert.equal(mgr.cleanupExpired(), 0);

    now += 10_000;
    assert.equal(mgr.cleanupExpired(), 1);
    assert.equal(mgr.validateToken(recordB.token, recordB.sessionKey), null);
  });

  it('clamps ttlMs to a minimum of 1000ms', () => {
    const fixedNow = 1_700_000_000_000;
    Date.now = () => fixedNow;

    const mgr = new mod.CliSessionShareManager();
    const record = mgr.createToken({
      sessionKey: 's-1',
      projectRoot: '/tmp/project',
      mode: 'read',
      ttlMs: 1,
    });

    assert.equal(record.expiresAt, new Date(fixedNow + 1_000).toISOString());
  });

  it('lists tokens for a session (scoped to projectRoot) and sorts by expiresAt', () => {
    let now = 1_700_000_000_000;
    Date.now = () => now;

    const mgr = new mod.CliSessionShareManager();
    const t1 = mgr.createToken({
      sessionKey: 's-1',
      projectRoot: '/p1',
      mode: 'read',
      ttlMs: 5_000,
    });
    const t2 = mgr.createToken({
      sessionKey: 's-1',
      projectRoot: '/p1',
      mode: 'write',
      ttlMs: 10_000,
    });
    mgr.createToken({ sessionKey: 's-1', projectRoot: '/p2', mode: 'read', ttlMs: 10_000 });
    mgr.createToken({ sessionKey: 's-2', projectRoot: '/p1', mode: 'read', ttlMs: 10_000 });

    const list1 = mgr.listTokensForSession('s-1', '/p1');
    assert.equal(list1.length, 2);
    assert.equal(list1[0].token, t1.token);
    assert.equal(list1[1].token, t2.token);

    now += 5_001;
    const list2 = mgr.listTokensForSession('s-1', '/p1');
    assert.deepEqual(list2.map(r => r.token), [t2.token]);
  });
});
