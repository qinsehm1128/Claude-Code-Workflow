/**
 * Tests for ContextLimitDetector
 */

import { describe, it, expect } from 'vitest';
import {
  isContextLimitStop,
  getMatchingContextPattern,
  getAllMatchingContextPatterns,
  CONTEXT_LIMIT_PATTERNS
} from '../src/core/hooks/context-limit-detector.js';
import type { StopContext } from '../src/core/hooks/context-limit-detector.js';

describe('isContextLimitStop', () => {
  it('should return false for undefined context', () => {
    expect(isContextLimitStop(undefined)).toBe(false);
  });

  it('should detect context_limit pattern', () => {
    const context: StopContext = { stop_reason: 'context_limit' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should detect context_window pattern', () => {
    const context: StopContext = { stop_reason: 'context_window_exceeded' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should detect token_limit pattern', () => {
    const context: StopContext = { stop_reason: 'token_limit_reached' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should detect max_tokens pattern', () => {
    const context: StopContext = { stop_reason: 'max_tokens' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should detect conversation_too_long pattern', () => {
    const context: StopContext = { stop_reason: 'conversation_too_long' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should detect pattern in end_turn_reason', () => {
    const context: StopContext = { end_turn_reason: 'context_exceeded' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should detect pattern in camelCase endTurnReason', () => {
    const context: StopContext = { endTurnReason: 'context_full' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should detect pattern in camelCase stopReason', () => {
    const context: StopContext = { stopReason: 'input_too_long' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should be case-insensitive', () => {
    const context: StopContext = { stop_reason: 'CONTEXT_LIMIT' };
    expect(isContextLimitStop(context)).toBe(true);
  });

  it('should return false for non-context-limit reasons', () => {
    const context: StopContext = { stop_reason: 'end_turn' };
    expect(isContextLimitStop(context)).toBe(false);
  });

  it('should return false for empty reasons', () => {
    const context: StopContext = { stop_reason: '' };
    expect(isContextLimitStop(context)).toBe(false);
  });

  it('should return false for unrelated patterns', () => {
    const contexts: StopContext[] = [
      { stop_reason: 'user_cancel' },
      { stop_reason: 'max_response_time' },
      { stop_reason: 'complete' }
    ];

    contexts.forEach(context => {
      expect(isContextLimitStop(context)).toBe(false);
    });
  });
});

describe('getMatchingContextPattern', () => {
  it('should return null for undefined context', () => {
    expect(getMatchingContextPattern(undefined)).toBeNull();
  });

  it('should return the matching pattern', () => {
    const context: StopContext = { stop_reason: 'context_limit_reached' };
    expect(getMatchingContextPattern(context)).toBe('context_limit');
  });

  it('should return the first matching pattern when multiple match', () => {
    const context: StopContext = { stop_reason: 'context_window_token_limit' };
    // 'context_window' should match first (appears earlier in array)
    const pattern = getMatchingContextPattern(context);
    expect(pattern).toBe('context_window');
  });

  it('should return null when no pattern matches', () => {
    const context: StopContext = { stop_reason: 'some_other_reason' };
    expect(getMatchingContextPattern(context)).toBeNull();
  });
});

describe('getAllMatchingContextPatterns', () => {
  it('should return empty array for undefined context', () => {
    expect(getAllMatchingContextPatterns(undefined)).toEqual([]);
  });

  it('should return all matching patterns', () => {
    const context: StopContext = {
      stop_reason: 'context_window_token_limit',
      end_turn_reason: 'max_tokens_exceeded'
    };
    const patterns = getAllMatchingContextPatterns(context);

    expect(patterns).toContain('context_window');
    expect(patterns).toContain('token_limit');
    expect(patterns).toContain('max_tokens');
    expect(patterns.length).toBe(3);
  });

  it('should return empty array when no patterns match', () => {
    const context: StopContext = { stop_reason: 'complete' };
    expect(getAllMatchingContextPatterns(context)).toEqual([]);
  });
});

describe('CONTEXT_LIMIT_PATTERNS', () => {
  it('should contain expected patterns', () => {
    expect(CONTEXT_LIMIT_PATTERNS).toContain('context_limit');
    expect(CONTEXT_LIMIT_PATTERNS).toContain('context_window');
    expect(CONTEXT_LIMIT_PATTERNS).toContain('token_limit');
    expect(CONTEXT_LIMIT_PATTERNS).toContain('max_tokens');
    expect(CONTEXT_LIMIT_PATTERNS).toContain('conversation_too_long');
  });

  it('should be readonly array', () => {
    // TypeScript enforces this at compile time
    // This test just verifies the constant exists
    expect(Array.isArray(CONTEXT_LIMIT_PATTERNS)).toBe(true);
  });
});
