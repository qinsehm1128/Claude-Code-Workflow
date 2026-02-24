/**
 * Core Hooks Module
 *
 * Provides detector functions and utilities for Claude Code hooks integration.
 */

// Context Limit Detector
export {
  isContextLimitStop,
  getMatchingContextPattern,
  getAllMatchingContextPatterns,
  CONTEXT_LIMIT_PATTERNS,
  type StopContext
} from './context-limit-detector.js';

// User Abort Detector
export {
  isUserAbort,
  getMatchingAbortPattern,
  getAllMatchingAbortPatterns,
  shouldAllowContinuation,
  USER_ABORT_EXACT_PATTERNS,
  USER_ABORT_SUBSTRING_PATTERNS,
  USER_ABORT_PATTERNS
} from './user-abort-detector.js';

// Keyword Detector
export {
  detectKeywords,
  hasKeyword,
  getAllKeywords,
  getPrimaryKeyword,
  getKeywordType,
  hasKeywordType,
  sanitizeText,
  removeCodeBlocks,
  KEYWORD_PATTERNS,
  KEYWORD_PRIORITY,
  type KeywordType,
  type DetectedKeyword
} from './keyword-detector.js';

// Stop Handler
export {
  StopHandler,
  createStopHandler,
  defaultStopHandler,
  type ExtendedStopContext,
  type StopResult,
  type StopHandlerOptions
} from './stop-handler.js';

// Recovery Handler
export {
  RecoveryHandler,
  createRecoveryHandler,
  type PreCompactInput,
  type HookOutput,
  type RecoveryHandlerOptions
} from './recovery-handler.js';
