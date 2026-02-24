/**
 * ContextLimitDetector - Detects context limit stops
 *
 * When context is exhausted, Claude Code needs to stop so it can compact.
 * Blocking these stops causes a deadlock: can't compact because can't stop,
 * can't continue because context is full.
 *
 * This detector identifies context-limit related stop reasons to allow
 * graceful handling of context exhaustion.
 *
 * @see https://github.com/Yeachan-Heo/oh-my-claudecode/issues/213
 */

/**
 * Context from Stop hook event
 *
 * NOTE: Field names support both camelCase and snake_case variants
 * for compatibility with different Claude Code versions.
 */
export interface StopContext {
  /** Reason for stop (from Claude Code) - snake_case variant */
  stop_reason?: string;
  /** Reason for stop (from Claude Code) - camelCase variant */
  stopReason?: string;
  /** End turn reason (from API) - snake_case variant */
  end_turn_reason?: string;
  /** End turn reason (from API) - camelCase variant */
  endTurnReason?: string;
  /** Whether user explicitly requested stop - snake_case variant */
  user_requested?: boolean;
  /** Whether user explicitly requested stop - camelCase variant */
  userRequested?: boolean;
}

/**
 * Patterns that indicate context limit has been reached
 *
 * These patterns are matched case-insensitively against stop_reason
 * and end_turn_reason fields.
 */
export const CONTEXT_LIMIT_PATTERNS: readonly string[] = [
  'context_limit',
  'context_window',
  'context_exceeded',
  'context_full',
  'max_context',
  'token_limit',
  'max_tokens',
  'conversation_too_long',
  'input_too_long'
] as const;

/**
 * Check if a reason string matches any context limit pattern
 *
 * @param reason - The reason string to check
 * @returns true if the reason matches a context limit pattern
 */
function matchesContextPattern(reason: string): boolean {
  const normalizedReason = reason.toLowerCase();
  return CONTEXT_LIMIT_PATTERNS.some(pattern => normalizedReason.includes(pattern));
}

/**
 * Detect if stop was triggered by context-limit related reasons
 *
 * When context is exhausted, Claude Code needs to stop so it can compact.
 * Blocking these stops causes a deadlock: can't compact because can't stop,
 * can't continue because context is full.
 *
 * @param context - The stop context from the hook event
 * @returns true if the stop was due to context limit
 */
export function isContextLimitStop(context?: StopContext): boolean {
  if (!context) return false;

  // Get reasons from both field naming conventions
  const stopReason = context.stop_reason ?? context.stopReason ?? '';
  const endTurnReason = context.end_turn_reason ?? context.endTurnReason ?? '';

  // Check both stop_reason and end_turn_reason for context limit patterns
  return matchesContextPattern(stopReason) || matchesContextPattern(endTurnReason);
}

/**
 * Get the matching context limit pattern if any
 *
 * @param context - The stop context from the hook event
 * @returns The matching pattern or null if no match
 */
export function getMatchingContextPattern(context?: StopContext): string | null {
  if (!context) return null;

  const stopReason = (context.stop_reason ?? context.stopReason ?? '').toLowerCase();
  const endTurnReason = (context.end_turn_reason ?? context.endTurnReason ?? '').toLowerCase();

  for (const pattern of CONTEXT_LIMIT_PATTERNS) {
    if (stopReason.includes(pattern) || endTurnReason.includes(pattern)) {
      return pattern;
    }
  }

  return null;
}

/**
 * Get all matching context limit patterns
 *
 * @param context - The stop context from the hook event
 * @returns Array of matching patterns (may be empty)
 */
export function getAllMatchingContextPatterns(context?: StopContext): string[] {
  if (!context) return [];

  const stopReason = (context.stop_reason ?? context.stopReason ?? '').toLowerCase();
  const endTurnReason = (context.end_turn_reason ?? context.endTurnReason ?? '').toLowerCase();
  const combinedReasons = `${stopReason} ${endTurnReason}`;

  return CONTEXT_LIMIT_PATTERNS.filter(pattern => combinedReasons.includes(pattern));
}
