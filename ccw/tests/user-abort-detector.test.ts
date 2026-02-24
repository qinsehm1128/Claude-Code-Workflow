/**
 * Tests for UserAbortDetector
 */

import { describe, it, expect } from 'vitest';
import {
  isUserAbort,
  getMatchingAbortPattern,
  getAllMatchingAbortPatterns,
  shouldAllowContinuation,
  USER_ABORT_EXACT_PATTERNS,
  USER_ABORT_SUBSTRING_PATTERNS
} from '../src/core/hooks/user-abort-detector.js';
import type { StopContext } from '../src/core/hooks/context-limit-detector.js';

describe('isUserAbort', () => {
  describe('user_requested flag', () => {
    it('should detect user_requested true (snake_case)', () => {
      const context: StopContext = { user_requested: true };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should detect userRequested true (camelCase)', () => {
      const context: StopContext = { userRequested: true };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should not treat user_requested false as abort', () => {
      const context: StopContext = { user_requested: false };
      expect(isUserAbort(context)).toBe(false);
    });
  });

  describe('exact patterns', () => {
    it('should detect "aborted" exactly', () => {
      const context: StopContext = { stop_reason: 'aborted' };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should detect "abort" exactly', () => {
      const context: StopContext = { stop_reason: 'abort' };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should detect "cancel" exactly', () => {
      const context: StopContext = { stop_reason: 'cancel' };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should detect "interrupt" exactly', () => {
      const context: StopContext = { stop_reason: 'interrupt' };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should NOT detect exact patterns as substrings', () => {
      // This tests that "cancel" doesn't match "cancelled_order"
      const context: StopContext = { stop_reason: 'cancelled_order' };
      expect(isUserAbort(context)).toBe(false);
    });

    it('should NOT detect "abort" in "aborted_request"', () => {
      // This tests exact match behavior
      const context: StopContext = { stop_reason: 'aborted_request' };
      expect(isUserAbort(context)).toBe(false);
    });
  });

  describe('substring patterns', () => {
    it('should detect "user_cancel"', () => {
      const context: StopContext = { stop_reason: 'user_cancel' };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should detect "user_interrupt"', () => {
      const context: StopContext = { stop_reason: 'user_interrupt' };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should detect "ctrl_c"', () => {
      const context: StopContext = { stop_reason: 'ctrl_c' };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should detect "manual_stop"', () => {
      const context: StopContext = { stop_reason: 'manual_stop' };
      expect(isUserAbort(context)).toBe(true);
    });

    it('should detect substring patterns within larger strings', () => {
      const context: StopContext = { stop_reason: 'user_cancelled_by_client' };
      expect(isUserAbort(context)).toBe(true);
    });
  });

  describe('camelCase support', () => {
    it('should detect patterns in stopReason (camelCase)', () => {
      const context: StopContext = { stopReason: 'user_cancel' };
      expect(isUserAbort(context)).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('should be case-insensitive', () => {
      const contexts: StopContext[] = [
        { stop_reason: 'ABORTED' },
        { stop_reason: 'Abort' },
        { stop_reason: 'USER_CANCEL' },
        { stop_reason: 'User_Interrupt' }
      ];

      contexts.forEach(context => {
        expect(isUserAbort(context)).toBe(true);
      });
    });
  });

  describe('non-abort cases', () => {
    it('should return false for undefined context', () => {
      expect(isUserAbort(undefined)).toBe(false);
    });

    it('should return false for empty reason', () => {
      const context: StopContext = { stop_reason: '' };
      expect(isUserAbort(context)).toBe(false);
    });

    it('should return false for non-abort reasons', () => {
      const contexts: StopContext[] = [
        { stop_reason: 'end_turn' },
        { stop_reason: 'complete' },
        { stop_reason: 'context_limit' },
        { stop_reason: 'max_tokens' }
      ];

      contexts.forEach(context => {
        expect(isUserAbort(context)).toBe(false);
      });
    });
  });
});

describe('getMatchingAbortPattern', () => {
  it('should return null for undefined context', () => {
    expect(getMatchingAbortPattern(undefined)).toBeNull();
  });

  it('should return "user_requested" for user_requested flag', () => {
    const context: StopContext = { user_requested: true };
    expect(getMatchingAbortPattern(context)).toBe('user_requested');
  });

  it('should return the exact matching pattern', () => {
    const context: StopContext = { stop_reason: 'cancel' };
    expect(getMatchingAbortPattern(context)).toBe('cancel');
  });

  it('should return the substring matching pattern', () => {
    const context: StopContext = { stop_reason: 'user_cancel' };
    expect(getMatchingAbortPattern(context)).toBe('user_cancel');
  });

  it('should return null when no pattern matches', () => {
    const context: StopContext = { stop_reason: 'complete' };
    expect(getMatchingAbortPattern(context)).toBeNull();
  });
});

describe('getAllMatchingAbortPatterns', () => {
  it('should return empty array for undefined context', () => {
    expect(getAllMatchingAbortPatterns(undefined)).toEqual([]);
  });

  it('should return all matching patterns', () => {
    const context: StopContext = {
      user_requested: true,
      stop_reason: 'user_cancel'
    };
    const patterns = getAllMatchingAbortPatterns(context);

    expect(patterns).toContain('user_requested');
    expect(patterns).toContain('user_cancel');
  });

  it('should deduplicate patterns', () => {
    const context: StopContext = { stop_reason: 'cancel' };
    const patterns = getAllMatchingAbortPatterns(context);

    // Should only have one 'cancel' entry
    expect(patterns.filter(p => p === 'cancel')).toHaveLength(1);
  });
});

describe('shouldAllowContinuation', () => {
  it('should return true for undefined context', () => {
    expect(shouldAllowContinuation(undefined)).toBe(true);
  });

  it('should return true for non-abort context', () => {
    const context: StopContext = { stop_reason: 'complete' };
    expect(shouldAllowContinuation(context)).toBe(true);
  });

  it('should return false for user abort', () => {
    const context: StopContext = { user_requested: true };
    expect(shouldAllowContinuation(context)).toBe(false);
  });

  it('should return false for cancel reason', () => {
    const context: StopContext = { stop_reason: 'cancel' };
    expect(shouldAllowContinuation(context)).toBe(false);
  });
});

describe('pattern exports', () => {
  it('should export exact patterns', () => {
    expect(USER_ABORT_EXACT_PATTERNS).toContain('aborted');
    expect(USER_ABORT_EXACT_PATTERNS).toContain('abort');
    expect(USER_ABORT_EXACT_PATTERNS).toContain('cancel');
    expect(USER_ABORT_EXACT_PATTERNS).toContain('interrupt');
  });

  it('should export substring patterns', () => {
    expect(USER_ABORT_SUBSTRING_PATTERNS).toContain('user_cancel');
    expect(USER_ABORT_SUBSTRING_PATTERNS).toContain('user_interrupt');
    expect(USER_ABORT_SUBSTRING_PATTERNS).toContain('ctrl_c');
    expect(USER_ABORT_SUBSTRING_PATTERNS).toContain('manual_stop');
  });
});
