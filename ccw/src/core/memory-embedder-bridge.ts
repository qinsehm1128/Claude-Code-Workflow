/**
 * Memory Embedder Bridge - TypeScript interface to Python memory embedder
 *
 * This module provides a TypeScript bridge to the Python memory_embedder.py script,
 * which generates and searches embeddings for memory chunks using CodexLens's embedder.
 *
 * Features:
 * - Reuses CodexLens venv at ~/.codexlens/venv
 * - JSON protocol communication
 * - Three commands: embed, search, status
 * - Automatic availability checking
 * - Stage1 output embedding for V2 pipeline
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { getCodexLensPython } from '../utils/codexlens-path.js';
import { getCoreMemoryStore } from './core-memory-store.js';
import type { Stage1Output } from './core-memory-store.js';
import { StoragePaths } from '../config/storage-paths.js';

// Get directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Venv paths (reuse CodexLens venv)
const VENV_PYTHON = getCodexLensPython();

// Script path
const EMBEDDER_SCRIPT = join(__dirname, '..', '..', 'scripts', 'memory_embedder.py');

// Types
export interface EmbedResult {
  success: boolean;
  chunks_processed: number;
  chunks_failed: number;
  elapsed_time: number;
  error?: string;
}

export interface SearchMatch {
  source_id: string;
  source_type: 'core_memory' | 'workflow' | 'cli_history';
  chunk_index: number;
  content: string;
  score: number;
  restore_command: string;
}

export interface SearchResult {
  success: boolean;
  matches: SearchMatch[];
  query?: string;
  elapsed_time?: number;
  error?: string;
}

export interface EmbeddingStatus {
  success?: boolean;
  total_chunks: number;
  embedded_chunks: number;
  pending_chunks: number;
  by_type: Record<string, { total: number; embedded: number; pending: number }>;
  error?: string;
}

export interface EmbedOptions {
  sourceId?: string;
  batchSize?: number;
  force?: boolean;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  sourceType?: 'core_memory' | 'workflow' | 'cli_history';
}

/**
 * Check if embedder is available (venv and script exist)
 * @returns True if embedder is available
 */
export function isEmbedderAvailable(): boolean {
  // Check venv python exists
  if (!existsSync(VENV_PYTHON)) {
    return false;
  }

  // Check script exists
  if (!existsSync(EMBEDDER_SCRIPT)) {
    return false;
  }

  return true;
}

/**
 * Run Python script with arguments
 * @param args - Command line arguments
 * @param timeout - Timeout in milliseconds
 * @returns JSON output from script
 */
function runPython(args: string[], timeout: number = 300000): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check availability
    if (!isEmbedderAvailable()) {
      reject(
        new Error(
          'Memory embedder not available. Ensure CodexLens venv exists at ~/.codexlens/venv'
        )
      );
      return;
    }

    // Spawn Python process
    const child = spawn(VENV_PYTHON, [EMBEDDER_SCRIPT, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Python script failed (exit code ${code}): ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
        reject(new Error('Python script timed out'));
      } else {
        reject(new Error(`Failed to spawn Python: ${err.message}`));
      }
    });
  });
}

/**
 * Generate embeddings for memory chunks
 * @param dbPath - Path to SQLite database
 * @param options - Embedding options
 * @returns Embedding result
 */
export async function generateEmbeddings(
  dbPath: string,
  options: EmbedOptions = {}
): Promise<EmbedResult> {
  const { sourceId, batchSize = 8, force = false } = options;

  // Build arguments
  const args = ['embed', dbPath];

  if (sourceId) {
    args.push('--source-id', sourceId);
  }

  if (batchSize !== 8) {
    args.push('--batch-size', batchSize.toString());
  }

  if (force) {
    args.push('--force');
  }

  try {
    // Default timeout: 5 minutes
    const output = await runPython(args, 300000);
    const result = JSON.parse(output) as EmbedResult;
    return result;
  } catch (err) {
    return {
      success: false,
      chunks_processed: 0,
      chunks_failed: 0,
      elapsed_time: 0,
      error: (err as Error).message,
    };
  }
}

/**
 * Search memory chunks using semantic search
 * @param dbPath - Path to SQLite database
 * @param query - Search query text
 * @param options - Search options
 * @returns Search results
 */
export async function searchMemories(
  dbPath: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const { topK = 10, minScore = 0.3, sourceType } = options;

  // Build arguments
  const args = ['search', dbPath, query];

  if (topK !== 10) {
    args.push('--top-k', topK.toString());
  }

  if (minScore !== 0.3) {
    args.push('--min-score', minScore.toString());
  }

  if (sourceType) {
    args.push('--type', sourceType);
  }

  try {
    // Default timeout: 30 seconds
    const output = await runPython(args, 30000);
    const result = JSON.parse(output) as SearchResult;
    return result;
  } catch (err) {
    return {
      success: false,
      matches: [],
      error: (err as Error).message,
    };
  }
}

/**
 * Get embedding status statistics
 * @param dbPath - Path to SQLite database
 * @returns Embedding status
 */
export async function getEmbeddingStatus(dbPath: string): Promise<EmbeddingStatus> {
  // Build arguments
  const args = ['status', dbPath];

  try {
    // Default timeout: 30 seconds
    const output = await runPython(args, 30000);
    const result = JSON.parse(output) as EmbeddingStatus;
    return { ...result, success: true };
  } catch (err) {
    return {
      success: false,
      total_chunks: 0,
      embedded_chunks: 0,
      pending_chunks: 0,
      by_type: {},
      error: (err as Error).message,
    };
  }
}

// ============================================================================
// Memory V2: Stage1 Output Embedding
// ============================================================================

/** Result of stage1 embedding operation */
export interface Stage1EmbedResult {
  success: boolean;
  chunksCreated: number;
  chunksEmbedded: number;
  error?: string;
}

/**
 * Chunk and embed stage1_outputs (raw_memory + rollout_summary) for semantic search.
 *
 * Reads all stage1_outputs from the DB, chunks their raw_memory and rollout_summary
 * content, inserts chunks into memory_chunks with source_type='cli_history' and
 * metadata indicating the V2 origin, then triggers embedding generation.
 *
 * Uses source_id format: "s1:{thread_id}" to differentiate from regular cli_history chunks.
 *
 * @param projectPath - Project root path
 * @param force - Force re-chunking even if chunks exist
 * @returns Embedding result
 */
export async function embedStage1Outputs(
  projectPath: string,
  force: boolean = false
): Promise<Stage1EmbedResult> {
  try {
    const store = getCoreMemoryStore(projectPath);
    const stage1Outputs = store.listStage1Outputs();

    if (stage1Outputs.length === 0) {
      return { success: true, chunksCreated: 0, chunksEmbedded: 0 };
    }

    let totalChunksCreated = 0;

    for (const output of stage1Outputs) {
      const sourceId = `s1:${output.thread_id}`;

      // Check if already chunked
      const existingChunks = store.getChunks(sourceId);
      if (existingChunks.length > 0 && !force) continue;

      // Delete old chunks if force
      if (force && existingChunks.length > 0) {
        store.deleteChunks(sourceId);
      }

      // Combine raw_memory and rollout_summary for richer semantic content
      const combinedContent = [
        output.rollout_summary ? `## Summary\n${output.rollout_summary}` : '',
        output.raw_memory ? `## Raw Memory\n${output.raw_memory}` : '',
      ].filter(Boolean).join('\n\n');

      if (!combinedContent.trim()) continue;

      // Chunk using the store's built-in chunking
      const chunks = store.chunkContent(combinedContent, sourceId, 'cli_history');

      // Insert chunks with V2 metadata
      for (let i = 0; i < chunks.length; i++) {
        store.insertChunk({
          source_id: sourceId,
          source_type: 'cli_history',
          chunk_index: i,
          content: chunks[i],
          metadata: JSON.stringify({
            v2_source: 'stage1_output',
            thread_id: output.thread_id,
            generated_at: output.generated_at,
          }),
          created_at: new Date().toISOString(),
        });
        totalChunksCreated++;
      }
    }

    // If we created chunks, generate embeddings
    let chunksEmbedded = 0;
    if (totalChunksCreated > 0) {
      const paths = StoragePaths.project(projectPath);
      const dbPath = join(paths.root, 'core-memory', 'core_memory.db');

      const embedResult = await generateEmbeddings(dbPath, { force: false });
      if (embedResult.success) {
        chunksEmbedded = embedResult.chunks_processed;
      }
    }

    return {
      success: true,
      chunksCreated: totalChunksCreated,
      chunksEmbedded,
    };
  } catch (err) {
    return {
      success: false,
      chunksCreated: 0,
      chunksEmbedded: 0,
      error: (err as Error).message,
    };
  }
}

