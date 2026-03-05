/**
 * Unit tests for CsrfTokenManager (ccw/dist/core/auth/csrf-manager.js).
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const csrfManagerUrl = new URL('../dist/core/auth/csrf-manager.js', import.meta.url).href;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

describe('CsrfTokenManager', async () => {
  mod = await import(csrfManagerUrl);

  it('generateToken produces a 64-character hex token', () => {
    const manager = new mod.CsrfTokenManager({ cleanupIntervalMs: 0 });
    const token = manager.generateToken('session-1');

    assert.match(token, /^[a-f0-9]{64}$/);
    manager.dispose();
  });

  it('validateToken accepts correct session token once', () => {
    const manager = new mod.CsrfTokenManager({ cleanupIntervalMs: 0 });
    const token = manager.generateToken('session-1');

    assert.equal(manager.validateToken(token, 'session-1'), true);
    assert.equal(manager.validateToken(token, 'session-1'), false);
    manager.dispose();
  });

  it('validateToken rejects expired tokens', () => {
    const manager = new mod.CsrfTokenManager({ tokenTtlMs: -1000, cleanupIntervalMs: 0 });
    const token = manager.generateToken('session-1');

    assert.equal(manager.validateToken(token, 'session-1'), false);
    assert.equal(manager.getActiveTokenCount(), 0);
    manager.dispose();
  });

  it('cleanupExpiredTokens removes expired entries', () => {
    const manager = new mod.CsrfTokenManager({ tokenTtlMs: 10, cleanupIntervalMs: 0 });
    manager.generateToken('session-1');

    const removed = manager.cleanupExpiredTokens(Date.now() + 100);
    assert.equal(removed, 1);
    assert.equal(manager.getActiveTokenCount(), 0);
    manager.dispose();
  });

  it('session association prevents cross-session token reuse', () => {
    const manager = new mod.CsrfTokenManager({ cleanupIntervalMs: 0 });
    const token = manager.generateToken('session-1');

    assert.equal(manager.validateToken(token, 'session-2'), false);
    assert.equal(manager.validateToken(token, 'session-1'), true);
    manager.dispose();
  });

  // ========== Pool Pattern Tests ==========

  it('generateTokens produces N unique tokens', () => {
    const manager = new mod.CsrfTokenManager({ cleanupIntervalMs: 0, maxTokensPerSession: 5 });
    const tokens = manager.generateTokens('session-1', 3);

    assert.equal(tokens.length, 3);
    // All tokens should be unique
    assert.equal(new Set(tokens).size, 3);
    // All tokens should be valid hex
    for (const token of tokens) {
      assert.match(token, /^[a-f0-9]{64}$/);
    }
    manager.dispose();
  });

  it('generateTokens respects maxTokensPerSession limit', () => {
    const manager = new mod.CsrfTokenManager({ cleanupIntervalMs: 0, maxTokensPerSession: 5 });
    // First batch of 5
    const tokens1 = manager.generateTokens('session-1', 5);
    assert.equal(tokens1.length, 5);

    // Second batch should be empty (pool full)
    const tokens2 = manager.generateTokens('session-1', 3);
    assert.equal(tokens2.length, 0);

    manager.dispose();
  });

  it('getTokenCount returns correct count for session', () => {
    const manager = new mod.CsrfTokenManager({ cleanupIntervalMs: 0 });
    manager.generateTokens('session-1', 3);
    manager.generateTokens('session-2', 2);

    assert.equal(manager.getTokenCount('session-1'), 3);
    assert.equal(manager.getTokenCount('session-2'), 2);
    assert.equal(manager.getTokenCount('session-3'), 0);
    manager.dispose();
  });

  it('validateToken works with pool pattern (multiple tokens per session)', () => {
    const manager = new mod.CsrfTokenManager({ cleanupIntervalMs: 0 });
    const tokens = manager.generateTokens('session-1', 3);

    // All tokens should be valid once
    assert.equal(manager.validateToken(tokens[0], 'session-1'), true);
    assert.equal(manager.validateToken(tokens[1], 'session-1'), true);
    assert.equal(manager.validateToken(tokens[2], 'session-1'), true);

    // All tokens should now be invalid (used)
    assert.equal(manager.validateToken(tokens[0], 'session-1'), false);
    assert.equal(manager.validateToken(tokens[1], 'session-1'), false);
    assert.equal(manager.validateToken(tokens[2], 'session-1'), false);

    manager.dispose();
  });

  it('cleanupExpiredTokens handles multiple sessions', () => {
    const manager = new mod.CsrfTokenManager({ tokenTtlMs: 10, cleanupIntervalMs: 0 });
    manager.generateTokens('session-1', 3);
    manager.generateTokens('session-2', 2);

    const removed = manager.cleanupExpiredTokens(Date.now() + 100);
    assert.equal(removed, 5);
    assert.equal(manager.getActiveTokenCount(), 0);
    assert.equal(manager.getTokenCount('session-1'), 0);
    assert.equal(manager.getTokenCount('session-2'), 0);
    manager.dispose();
  });

  it('concurrent requests can use different tokens from pool', () => {
    const manager = new mod.CsrfTokenManager({ cleanupIntervalMs: 0 });
    const tokens = manager.generateTokens('session-1', 5);

    // Simulate 5 concurrent requests using different tokens
    const results = tokens.map(token => manager.validateToken(token, 'session-1'));

    // All should succeed
    assert.deepEqual(results, [true, true, true, true, true]);

    // Token count should still be 5 (but all marked as used)
    assert.equal(manager.getTokenCount('session-1'), 5);

    manager.dispose();
  });
});

