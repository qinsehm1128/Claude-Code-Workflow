/**
 * UserAbortDetector - Detects user-initiated abort stops
 *
 * Detects if a stop was due to user abort (not natural completion).
 * This allows hooks to gracefully handle user-initiated stops differently
 * from automatic or system-initiated stops.
 *
 * NOTE: Per official Anthropic docs, the Stop hook "Does not run if
 * the stoppage occurred due to a user interrupt." This means this
 * detector may never receive user-abort contexts in practice.
 * It is kept as defensive code in case the behavior changes.
 */

import type { StopContext } from './context-limit-detector.js';

// Re-export StopContext for convenience
export type { StopContext } from './context-limit-detector.js';

/**
 * Patterns that indicate user abort (exact match)
 *
 * These are short generic words that need exact matching to avoid
 * false positives with substring matching (e.g., "cancel" in "cancelled_order").
 */
export const USER_ABORT_EXACT_PATTERNS: readonly string[] = [
  'aborted',
  'abort',
  'cancel',
  'interrupt'
] as const;

/**
 * Patterns that indicate user abort (substring match)
 *
 * These are compound words that are safe for substring matching
 * because they are unlikely to appear as parts of other words.
 */
export const USER_ABORT_SUBSTRING_PATTERNS: readonly string[] = [
  'user_cancel',
  'user_interrupt',
  'ctrl_c',
  'manual_stop'
] as const;

/**
 * All user abort patterns combined
 */
export const USER_ABORT_PATTERNS: readonly string[] = [
  ...USER_ABORT_EXACT_PATTERNS,
  ...USER_ABORT_SUBSTRING_PATTERNS
] as const;

/**
 * Check if a reason matches exact abort patterns
 *
 * @param reason - The reason string to check (should be lowercase)
 * @returns true if the reason exactly matches an abort pattern
 */
function matchesExactPattern(reason: string): boolean {
  return USER_ABORT_EXACT_PATTERNS.some(pattern => reason === pattern);
}

/**
 * Check if a reason matches substring abort patterns
 *
 * @param reason - The reason string to check (should be lowercase)
 * @returns true if the reason contains a substring abort pattern
 */
function matchesSubstringPattern(reason: string): boolean {
  return USER_ABORT_SUBSTRING_PATTERNS.some(pattern => reason.includes(pattern));
}

/**
 * Detect if stop was due to user abort (not natural completion)
 *
 * WARNING: These patterns are ASSUMED based on common conventions.
 * As of 2025-01, Anthropic's Stop hook input schema does not document
 * the exact stop_reason values. The patterns below are educated guesses:
 *
 * - user_cancel, user_interrupt: Likely user-initiated via UI
 * - ctrl_c: Terminal interrupt (Ctrl+C)
 * - manual_stop: Explicit stop button
 * - abort, cancel, interrupt: Generic abort patterns
 *
 * If the detector fails to detect user aborts correctly, these patterns
 * should be updated based on observed Claude Code behavior.
 *
 * @param context - The stop context from the hook event
 * @returns true if the stop was due to user abort
 */
export function isUserAbort(context?: StopContext): boolean {
  if (!context) return false;

  // User explicitly requested stop (supports both camelCase and snake_case)
  if (context.user_requested === true || context.userRequested === true) {
    return true;
  }

  // Get reason from both field naming conventions
  const reason = (context.stop_reason ?? context.stopReason ?? '').toLowerCase();

  // Check exact patterns first (short words that could cause false positives)
  if (matchesExactPattern(reason)) {
    return true;
  }

  // Then check substring patterns (compound words safe for includes)
  if (matchesSubstringPattern(reason)) {
    return true;
  }

  return false;
}

/**
 * Get the matching user abort pattern if any
 *
 * @param context - The stop context from the hook event
 * @returns The matching pattern or null if no match
 */
export function getMatchingAbortPattern(context?: StopContext): string | null {
  if (!context) return null;

  // Check explicit user_requested flag first
  if (context.user_requested === true || context.userRequested === true) {
    return 'user_requested';
  }

  const reason = (context.stop_reason ?? context.stopReason ?? '').toLowerCase();

  // Check exact patterns
  for (const pattern of USER_ABORT_EXACT_PATTERNS) {
    if (reason === pattern) {
      return pattern;
    }
  }

  // Check substring patterns
  for (const pattern of USER_ABORT_SUBSTRING_PATTERNS) {
    if (reason.includes(pattern)) {
      return pattern;
    }
  }

  return null;
}

/**
 * Get all matching user abort patterns
 *
 * @param context - The stop context from the hook event
 * @returns Array of matching patterns (may be empty)
 */
export function getAllMatchingAbortPatterns(context?: StopContext): string[] {
  if (!context) return [];

  const matches: string[] = [];

  // Check explicit user_requested flag first
  if (context.user_requested === true || context.userRequested === true) {
    matches.push('user_requested');
  }

  const reason = (context.stop_reason ?? context.stopReason ?? '').toLowerCase();

  // Check exact patterns
  for (const pattern of USER_ABORT_EXACT_PATTERNS) {
    if (reason === pattern) {
      matches.push(pattern);
    }
  }

  // Check substring patterns
  for (const pattern of USER_ABORT_SUBSTRING_PATTERNS) {
    if (reason.includes(pattern)) {
      matches.push(pattern);
    }
  }

  return Array.from(new Set(matches)); // Remove duplicates
}

/**
 * Check if a stop should allow continuation
 *
 * User aborts should NOT force continuation - if the user explicitly
 * stopped the session, we should respect that decision.
 *
 * @param context - The stop context from the hook event
 * @returns true if continuation should be allowed (not a user abort)
 */
export function shouldAllowContinuation(context?: StopContext): boolean {
  return !isUserAbort(context);
}
