/**
 * Unit tests for RateLimiter
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const limiterUrl = new URL('../dist/core/services/rate-limiter.js', import.meta.url).href;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod;

describe('RateLimiter', async () => {
  mod = await import(limiterUrl);

  it('enforces limits within a window', () => {
    const limiter = new mod.RateLimiter({ limit: 3, windowMs: 60_000 });

    const r1 = limiter.consume('k');
    const r2 = limiter.consume('k');
    const r3 = limiter.consume('k');
    const r4 = limiter.consume('k');

    assert.equal(r1.ok, true);
    assert.equal(r1.remaining, 2);
    assert.equal(typeof r1.resetAt, 'number');

    assert.equal(r2.ok, true);
    assert.equal(r2.remaining, 1);
    assert.equal(r2.resetAt, r1.resetAt);

    assert.equal(r3.ok, true);
    assert.equal(r3.remaining, 0);
    assert.equal(r3.resetAt, r1.resetAt);

    assert.equal(r4.ok, false);
    assert.equal(r4.remaining, 0);
    assert.equal(r4.resetAt, r1.resetAt);
  });

  it('handles costs and does not penalize impossible costs', () => {
    const limiter = new mod.RateLimiter({ limit: 3, windowMs: 60_000 });

    // Cost is floored; negative cost becomes 0
    assert.equal(limiter.consume('k2', -5).ok, true);
    assert.equal(limiter.consume('k2').remaining, 2);

    // Cost larger than limit returns not ok but bucket remains full.
    const tooMuch = limiter.consume('k3', 10);
    assert.equal(tooMuch.ok, false);
    assert.equal(tooMuch.remaining, 0);
    assert.equal(limiter.consume('k3').remaining, 2);
  });

  it('resets after the window expires', async () => {
    const limiter = new mod.RateLimiter({ limit: 1, windowMs: 50 });

    assert.equal(limiter.consume('k').ok, true);
    assert.equal(limiter.consume('k').ok, false);

    await new Promise((resolve) => setTimeout(resolve, 70));

    assert.equal(limiter.consume('k').ok, true);
  });

  it('supports a limit of 0', () => {
    const limiter = new mod.RateLimiter({ limit: 0, windowMs: 1_000 });
    assert.equal(limiter.consume('k').ok, false);
    assert.equal(limiter.consume('k', 0).ok, true);
  });
});
