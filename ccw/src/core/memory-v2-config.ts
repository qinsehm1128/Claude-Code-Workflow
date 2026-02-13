/**
 * Memory V2 Configuration Constants
 *
 * All tuning parameters for the two-phase memory extraction and consolidation pipeline.
 * Phase 1: Per-session extraction (transcript -> structured memory)
 * Phase 2: Global consolidation (structured memories -> MEMORY.md)
 */

// -- Batch orchestration --

/** Maximum sessions to process per startup/trigger */
export const MAX_SESSIONS_PER_STARTUP = 64;

/** Maximum concurrent Phase 1 extraction jobs */
export const PHASE_ONE_CONCURRENCY = 64;

// -- Session eligibility --

/** Maximum session age in days to consider for extraction */
export const MAX_SESSION_AGE_DAYS = 30;

/** Minimum idle hours before a session becomes eligible */
export const MIN_IDLE_HOURS = 12;

// -- Job scheduler --

/** Default lease duration in seconds (1 hour) */
export const LEASE_SECONDS = 3600;

/** Delay in seconds before retrying a failed job */
export const RETRY_DELAY_SECONDS = 3600;

/** Maximum retry attempts for a failed job */
export const MAX_RETRIES = 3;

/** Interval in seconds between heartbeat renewals */
export const HEARTBEAT_INTERVAL_SECONDS = 30;

// -- Content size limits --

/** Maximum characters for raw_memory field in stage1_outputs */
export const MAX_RAW_MEMORY_CHARS = 300_000;

/** Maximum characters for rollout_summary field in stage1_outputs */
export const MAX_SUMMARY_CHARS = 1200;

/** Maximum bytes of transcript to send to LLM for extraction */
export const MAX_ROLLOUT_BYTES_FOR_PROMPT = 1_000_000;

/** Maximum number of raw memories included in global consolidation input */
export const MAX_RAW_MEMORIES_FOR_GLOBAL = 64;

// -- Typed configuration object --

export interface MemoryV2Config {
  MAX_SESSIONS_PER_STARTUP: number;
  PHASE_ONE_CONCURRENCY: number;
  MAX_SESSION_AGE_DAYS: number;
  MIN_IDLE_HOURS: number;
  LEASE_SECONDS: number;
  RETRY_DELAY_SECONDS: number;
  MAX_RETRIES: number;
  HEARTBEAT_INTERVAL_SECONDS: number;
  MAX_RAW_MEMORY_CHARS: number;
  MAX_SUMMARY_CHARS: number;
  MAX_ROLLOUT_BYTES_FOR_PROMPT: number;
  MAX_RAW_MEMORIES_FOR_GLOBAL: number;
}

/** Default configuration object - use individual exports for direct access */
export const MEMORY_V2_DEFAULTS: Readonly<MemoryV2Config> = {
  MAX_SESSIONS_PER_STARTUP,
  PHASE_ONE_CONCURRENCY,
  MAX_SESSION_AGE_DAYS,
  MIN_IDLE_HOURS,
  LEASE_SECONDS,
  RETRY_DELAY_SECONDS,
  MAX_RETRIES,
  MAX_RAW_MEMORY_CHARS,
  MAX_SUMMARY_CHARS,
  MAX_ROLLOUT_BYTES_FOR_PROMPT,
  MAX_RAW_MEMORIES_FOR_GLOBAL,
  HEARTBEAT_INTERVAL_SECONDS,
} as const;
