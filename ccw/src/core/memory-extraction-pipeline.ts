/**
 * Memory Extraction Pipeline - Phase 1 per-session extraction
 *
 * Orchestrates the full extraction flow for each CLI session:
 *   Filter transcript -> Truncate -> LLM Extract -> SecretRedact -> PostProcess -> Store
 *
 * Uses CliHistoryStore for transcript access, executeCliTool for LLM invocation,
 * CoreMemoryStore for stage1_outputs storage, and MemoryJobScheduler for
 * concurrency control.
 */

import type { ConversationRecord } from '../tools/cli-history-store.js';
import { getHistoryStore } from '../tools/cli-history-store.js';
import { getCoreMemoryStore, type Stage1Output } from './core-memory-store.js';
import { MemoryJobScheduler } from './memory-job-scheduler.js';
import { UnifiedVectorIndex, isUnifiedEmbedderAvailable } from './unified-vector-index.js';
import type { ChunkMetadata } from './unified-vector-index.js';
import { SessionClusteringService } from './session-clustering-service.js';
import { PatternDetector } from './pattern-detector.js';
import {
  MAX_SESSION_AGE_DAYS,
  MIN_IDLE_HOURS,
  MAX_ROLLOUT_BYTES_FOR_PROMPT,
  MAX_RAW_MEMORY_CHARS,
  MAX_SUMMARY_CHARS,
  MAX_SESSIONS_PER_STARTUP,
  PHASE_ONE_CONCURRENCY,
} from './memory-v2-config.js';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './memory-extraction-prompts.js';
import { redactSecrets } from '../utils/secret-redactor.js';

// -- Types --

export interface ExtractionInput {
  sessionId: string;
  transcript: string;
  sourceUpdatedAt: number;
}

export interface ExtractionOutput {
  raw_memory: string;
  rollout_summary: string;
  tags: string[];
}

export interface TranscriptFilterOptions {
  /** Bitmask for turn type selection. Default ALL = 0x7FF */
  bitmask: number;
  /** Maximum bytes for the transcript sent to LLM */
  maxBytes: number;
}

export interface BatchExtractionResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ sessionId: string; error: string }>;
}

// -- Turn type bitmask constants --

/** All turn types included */
export const TURN_TYPE_ALL = 0x7FF;

// Individual turn type bits (for future filtering granularity)
export const TURN_TYPE_USER_PROMPT = 0x001;
export const TURN_TYPE_STDOUT = 0x002;
export const TURN_TYPE_STDERR = 0x004;
export const TURN_TYPE_PARSED = 0x008;

// -- Truncation marker --

const TRUNCATION_MARKER = '\n\n[... CONTENT TRUNCATED ...]\n\n';

// -- Job kind constant --

const JOB_KIND_EXTRACTION = 'phase1_extraction';

// -- Pipeline --

export class MemoryExtractionPipeline {
  private projectPath: string;
  /** Optional: override the LLM tool used for extraction. Defaults to 'gemini'. */
  private tool: string;
  /** Optional: current session ID to exclude from scanning */
  private currentSessionId?: string;

  constructor(projectPath: string, options?: { tool?: string; currentSessionId?: string }) {
    this.projectPath = projectPath;
    this.tool = options?.tool || 'gemini';
    this.currentSessionId = options?.currentSessionId;
  }

  // ========================================================================
  // Eligibility scanning
  // ========================================================================

  /**
   * Scan CLI history for sessions eligible for memory extraction.
   *
   * Eligibility criteria (from design spec section 4.1):
   * - Session age <= MAX_SESSION_AGE_DAYS (30 days)
   * - Session idle >= MIN_IDLE_HOURS (12 hours) since last update
   * - Not an ephemeral/internal session (category !== 'internal')
   * - Not the currently active session
   * - Has at least one turn with content
   *
   * @returns Array of eligible ConversationRecord objects, capped at MAX_SESSIONS_PER_STARTUP
   */
  scanEligibleSessions(maxSessions?: number): ConversationRecord[] {
    const historyStore = getHistoryStore(this.projectPath);
    const now = Date.now();
    const maxAgeMs = MAX_SESSION_AGE_DAYS * 24 * 60 * 60 * 1000;
    const minIdleMs = MIN_IDLE_HOURS * 60 * 60 * 1000;

    // Fetch recent conversations (generous limit to filter in-memory)
    const { executions } = historyStore.getHistory({ limit: 500 });
    const eligible: ConversationRecord[] = [];

    for (const entry of executions) {
      // Skip current session
      if (this.currentSessionId && entry.id === this.currentSessionId) continue;

      // Age check: created within MAX_SESSION_AGE_DAYS
      const createdAt = new Date(entry.timestamp).getTime();
      if (now - createdAt > maxAgeMs) continue;

      // Idle check: last updated at least MIN_IDLE_HOURS ago
      const updatedAt = new Date(entry.updated_at || entry.timestamp).getTime();
      if (now - updatedAt < minIdleMs) continue;

      // Skip internal/ephemeral sessions
      if (entry.category === 'internal') continue;

      // Must have at least 1 turn
      if (!entry.turn_count || entry.turn_count < 1) continue;

      // Load full conversation to include in result
      const conv = historyStore.getConversation(entry.id);
      if (!conv) continue;

      eligible.push(conv);

      if (eligible.length >= (maxSessions || MAX_SESSIONS_PER_STARTUP)) break;
    }

    return eligible;
  }

  // ========================================================================
  // Transcript filtering
  // ========================================================================

  /**
   * Extract transcript text from a ConversationRecord, keeping only turn types
   * that match the given bitmask.
   *
   * Default bitmask (ALL=0x7FF) includes all turn content: prompt, stdout, stderr, parsed.
   *
   * @param record - The conversation record to filter
   * @param bitmask - Bitmask for type selection (default: TURN_TYPE_ALL)
   * @returns Combined transcript text
   */
  filterTranscript(record: ConversationRecord, bitmask: number = TURN_TYPE_ALL): string {
    const parts: string[] = [];

    for (const turn of record.turns) {
      const turnParts: string[] = [];

      if (bitmask & TURN_TYPE_USER_PROMPT) {
        if (turn.prompt) {
          turnParts.push(`[USER] ${turn.prompt}`);
        }
      }

      if (bitmask & TURN_TYPE_STDOUT) {
        const stdout = turn.output?.parsed_output || turn.output?.stdout;
        if (stdout) {
          turnParts.push(`[ASSISTANT] ${stdout}`);
        }
      }

      if (bitmask & TURN_TYPE_STDERR) {
        if (turn.output?.stderr) {
          turnParts.push(`[STDERR] ${turn.output.stderr}`);
        }
      }

      if (bitmask & TURN_TYPE_PARSED) {
        // Use final_output if available and not already captured
        if (turn.output?.final_output && !(bitmask & TURN_TYPE_STDOUT)) {
          turnParts.push(`[FINAL] ${turn.output.final_output}`);
        }
      }

      if (turnParts.length > 0) {
        parts.push(`--- Turn ${turn.turn} ---\n${turnParts.join('\n')}`);
      }
    }

    return parts.join('\n\n');
  }

  // ========================================================================
  // Truncation
  // ========================================================================

  /**
   * Truncate transcript content to fit within LLM context limit.
   *
   * Strategy: Keep head 33% + truncation marker + tail 67%.
   * This preserves the session opening context and the most recent work.
   *
   * @param content - The full transcript text
   * @param maxBytes - Maximum allowed size in bytes (default: MAX_ROLLOUT_BYTES_FOR_PROMPT)
   * @returns Truncated content, or original if within limit
   */
  truncateTranscript(content: string, maxBytes: number = MAX_ROLLOUT_BYTES_FOR_PROMPT): string {
    const contentBytes = Buffer.byteLength(content, 'utf-8');
    if (contentBytes <= maxBytes) {
      return content;
    }

    // Calculate split sizes accounting for the marker
    const markerBytes = Buffer.byteLength(TRUNCATION_MARKER, 'utf-8');
    const availableBytes = maxBytes - markerBytes;
    const headBytes = Math.floor(availableBytes * 0.33);
    const tailBytes = availableBytes - headBytes;

    // Convert to character-based approximation (safe for multi-byte)
    // Use Buffer slicing for byte-accurate truncation
    const buf = Buffer.from(content, 'utf-8');
    const headBuf = buf.subarray(0, headBytes);
    const tailBuf = buf.subarray(buf.length - tailBytes);

    // Decode back to strings, trimming at character boundaries
    const head = headBuf.toString('utf-8').replace(/[\uFFFD]$/, '');
    const tail = tailBuf.toString('utf-8').replace(/^[\uFFFD]/, '');

    return head + TRUNCATION_MARKER + tail;
  }

  // ========================================================================
  // LLM extraction
  // ========================================================================

  /**
   * Call the LLM to extract structured memory from a session transcript.
   *
   * Uses executeCliTool with the extraction prompts. The LLM is expected
   * to return a JSON object with raw_memory and rollout_summary fields.
   *
   * @param sessionId - Session ID for prompt context
   * @param transcript - The filtered and truncated transcript
   * @returns Raw LLM output string
   */
  async extractMemory(sessionId: string, transcript: string): Promise<string> {
    const { executeCliTool } = await import('../tools/cli-executor-core.js');

    const userPrompt = buildExtractionUserPrompt(sessionId, transcript);

    const fullPrompt = `${EXTRACTION_SYSTEM_PROMPT}\n\n${userPrompt}`;

    const result = await executeCliTool({
      tool: this.tool,
      prompt: fullPrompt,
      mode: 'analysis',
      cd: this.projectPath,
      category: 'internal',
    });

    // Prefer parsedOutput (extracted text from stream JSON) over raw stdout
    const output = result.parsedOutput?.trim() || result.stdout?.trim() || '';
    return output;
  }

  // ========================================================================
  // Post-processing
  // ========================================================================

  /**
   * Parse LLM output into structured ExtractionOutput.
   *
   * Supports 3 parsing modes:
   * 1. Pure JSON: Output is a valid JSON object
   * 2. Fenced JSON block: JSON wrapped in ```json ... ``` markers
   * 3. Text extraction: Non-conforming output wrapped in fallback structure
   *
   * Applies secret redaction and size limit enforcement.
   *
   * @param llmOutput - Raw text output from the LLM
   * @returns Validated ExtractionOutput with raw_memory, rollout_summary, and tags
   */
  postProcess(llmOutput: string): ExtractionOutput {
    let parsed: { raw_memory?: string; rollout_summary?: string; tags?: string[] } | null = null;

    // Mode 1: Pure JSON
    try {
      parsed = JSON.parse(llmOutput);
    } catch {
      // Not pure JSON, try next mode
    }

    // Mode 2: Fenced JSON block
    if (!parsed) {
      const fencedMatch = llmOutput.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fencedMatch) {
        try {
          parsed = JSON.parse(fencedMatch[1]);
        } catch {
          // Fenced content is not valid JSON either
        }
      }
    }

    // Mode 3: Text extraction fallback
    if (!parsed || typeof parsed.raw_memory !== 'string') {
      parsed = {
        raw_memory: `# summary\n${llmOutput}\n\nMemory context:\n- Extracted from unstructured LLM output\n\nUser preferences:\n- (none detected)`,
        rollout_summary: llmOutput.substring(0, 200).replace(/\n/g, ' ').trim(),
      };
    }

    // Apply secret redaction
    let rawMemory = redactSecrets(parsed.raw_memory || '');
    let rolloutSummary = redactSecrets(parsed.rollout_summary || '');

    // Enforce size limits
    if (rawMemory.length > MAX_RAW_MEMORY_CHARS) {
      rawMemory = rawMemory.substring(0, MAX_RAW_MEMORY_CHARS);
    }
    if (rolloutSummary.length > MAX_SUMMARY_CHARS) {
      rolloutSummary = rolloutSummary.substring(0, MAX_SUMMARY_CHARS);
    }

    // Extract and validate tags (fallback to empty array)
    let tags: string[] = [];
    if (parsed.tags && Array.isArray(parsed.tags)) {
      tags = parsed.tags
        .filter((t: unknown) => typeof t === 'string')
        .map((t: string) => t.toLowerCase().trim())
        .filter((t: string) => t.length > 0)
        .slice(0, 8);
    }

    return { raw_memory: rawMemory, rollout_summary: rolloutSummary, tags };
  }

  // ========================================================================
  // Single session extraction
  // ========================================================================

  /**
   * Run the full extraction pipeline for a single session.
   *
   * Pipeline stages: Filter -> Truncate -> LLM Extract -> PostProcess -> Store
   *
   * @param sessionId - The session to extract from
   * @returns The stored Stage1Output, or null if extraction failed
   */
  async runExtractionJob(sessionId: string): Promise<Stage1Output | null> {
    const historyStore = getHistoryStore(this.projectPath);
    const record = historyStore.getConversation(sessionId);
    if (!record) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Stage 1: Filter transcript
    const transcript = this.filterTranscript(record);
    if (!transcript.trim()) {
      return null; // Empty transcript, nothing to extract
    }

    // Stage 2: Truncate
    const truncated = this.truncateTranscript(transcript);

    // Stage 3: LLM extraction
    const llmOutput = await this.extractMemory(sessionId, truncated);
    if (!llmOutput) {
      throw new Error(`LLM returned empty output for session: ${sessionId}`);
    }

    // Stage 4: Post-process (parse + redact + validate)
    const extracted = this.postProcess(llmOutput);

    // Stage 5: Store result
    const sourceUpdatedAt = Math.floor(new Date(record.updated_at).getTime() / 1000);
    const generatedAt = Math.floor(Date.now() / 1000);

    const output: Stage1Output = {
      thread_id: sessionId,
      source_updated_at: sourceUpdatedAt,
      raw_memory: extracted.raw_memory,
      rollout_summary: extracted.rollout_summary,
      generated_at: generatedAt,
    };

    const store = getCoreMemoryStore(this.projectPath);
    store.upsertStage1Output(output);

    // Create/update a core memory (CMEM) from extraction results with tags
    store.upsertMemory({
      id: `CMEM-EXT-${sessionId}`,
      content: extracted.raw_memory,
      summary: extracted.rollout_summary,
      tags: extracted.tags,
    });

    // Sync extracted content to vector index (fire-and-forget)
    this.syncExtractionToVectorIndex(output);

    return output;
  }

  /**
   * Sync extraction output to the vector index.
   * Indexes both raw_memory and rollout_summary with category='cli_history'.
   * Fire-and-forget: errors are logged but never thrown.
   */
  private syncExtractionToVectorIndex(output: Stage1Output): void {
    if (!isUnifiedEmbedderAvailable()) return;

    const vectorIndex = new UnifiedVectorIndex(this.projectPath);
    const combinedContent = `${output.raw_memory}\n\n---\n\n${output.rollout_summary}`;
    const metadata: ChunkMetadata = {
      source_id: output.thread_id,
      source_type: 'cli_history',
      category: 'cli_history',
    };

    vectorIndex.indexContent(combinedContent, metadata).catch((err) => {
      if (process.env.DEBUG) {
        console.error(
          `[MemoryExtractionPipeline] Vector index sync failed for ${output.thread_id}:`,
          (err as Error).message
        );
      }
    });
  }

  // ========================================================================
  // Batch orchestration
  // ========================================================================

  /**
   * Run extraction for all eligible sessions with concurrency control.
   *
   * Uses MemoryJobScheduler to claim jobs and enforce PHASE_ONE_CONCURRENCY.
   * Failed extractions are recorded in the scheduler for retry.
   *
   * @returns BatchExtractionResult with counts and error details
   */
  async runBatchExtraction(options?: { maxSessions?: number }): Promise<BatchExtractionResult> {
    const store = getCoreMemoryStore(this.projectPath);
    const scheduler = new MemoryJobScheduler(store.getDb());

    // Scan eligible sessions
    const eligibleSessions = this.scanEligibleSessions(options?.maxSessions);

    const result: BatchExtractionResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    if (eligibleSessions.length === 0) {
      return result;
    }

    // Enqueue all eligible sessions
    for (const session of eligibleSessions) {
      const watermark = Math.floor(new Date(session.updated_at).getTime() / 1000);
      scheduler.enqueueJob(JOB_KIND_EXTRACTION, session.id, watermark);
    }

    // Process with concurrency control using Promise.all with batching
    const batchSize = PHASE_ONE_CONCURRENCY;
    for (let i = 0; i < eligibleSessions.length; i += batchSize) {
      const batch = eligibleSessions.slice(i, i + batchSize);
      const promises = batch.map(async (session) => {
        // Try to claim the job
        const claim = scheduler.claimJob(JOB_KIND_EXTRACTION, session.id, batchSize);
        if (!claim.claimed) {
          result.skipped++;
          return;
        }

        result.processed++;
        const token = claim.ownership_token!;

        try {
          const output = await this.runExtractionJob(session.id);
          if (output) {
            const watermark = output.source_updated_at;
            scheduler.markSucceeded(JOB_KIND_EXTRACTION, session.id, token, watermark);
            result.succeeded++;
          } else {
            // Empty transcript - mark as done (nothing to extract)
            scheduler.markSucceeded(JOB_KIND_EXTRACTION, session.id, token, 0);
            result.skipped++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          scheduler.markFailed(JOB_KIND_EXTRACTION, session.id, token, errorMsg);
          result.failed++;
          result.errors.push({ sessionId: session.id, error: errorMsg });
        }
      });

      await Promise.all(promises);
    }

    // Post-extraction: trigger incremental clustering and pattern detection
    // These are fire-and-forget to avoid blocking the main extraction flow.
    if (result.succeeded > 0) {
      this.triggerPostExtractionHooks(
        eligibleSessions.filter((_, i) => i < result.processed).map(s => s.id)
      );
    }

    return result;
  }

  /**
   * Fire-and-forget: trigger incremental clustering and pattern detection
   * after Phase 1 extraction completes.
   *
   * - incrementalCluster: processes each newly extracted session
   * - detectPatterns: runs pattern detection across all chunks
   *
   * Errors are logged but never thrown, to avoid disrupting the caller.
   */
  private triggerPostExtractionHooks(extractedSessionIds: string[]): void {
    const clusteringService = new SessionClusteringService(this.projectPath);
    const patternDetector = new PatternDetector(this.projectPath);

    // Incremental clustering for each extracted session (fire-and-forget)
    (async () => {
      try {
        // Check frequency control before running clustering
        const shouldCluster = await clusteringService.shouldRunClustering();
        if (!shouldCluster) {
          if (process.env.DEBUG) {
            console.log('[PostExtraction] Clustering skipped: frequency control not met');
          }
          return;
        }

        for (const sessionId of extractedSessionIds) {
          try {
            await clusteringService.incrementalCluster(sessionId);
          } catch (err) {
            if (process.env.DEBUG) {
              console.warn(
                `[PostExtraction] Incremental clustering failed for ${sessionId}:`,
                (err as Error).message
              );
            }
          }
        }
      } catch (err) {
        if (process.env.DEBUG) {
          console.warn('[PostExtraction] Clustering hook failed:', (err as Error).message);
        }
      }
    })();

    // Pattern detection (fire-and-forget)
    (async () => {
      try {
        const result = await patternDetector.detectPatterns();
        if (result.patterns.length > 0) {
          console.log(
            `[PostExtraction] Pattern detection: ${result.patterns.length} patterns found, ` +
            `${result.solidified.length} solidified (${result.elapsedMs}ms)`
          );
        }
      } catch (err) {
        if (process.env.DEBUG) {
          console.warn('[PostExtraction] Pattern detection failed:', (err as Error).message);
        }
      }
    })();
  }
}
