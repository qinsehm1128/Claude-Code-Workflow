/**
 * Unified Vector Index - TypeScript bridge to unified_memory_embedder.py
 *
 * Provides HNSW-backed vector indexing and search for all memory content
 * (core_memory, cli_history, workflow, entity, pattern) via CodexLens VectorStore.
 *
 * Features:
 * - JSON stdin/stdout protocol to Python embedder
 * - Content chunking (paragraph -> sentence splitting, CHUNK_SIZE=1500, OVERLAP=200)
 * - Batch embedding via CodexLens EmbedderFactory
 * - HNSW approximate nearest neighbor search (sub-10ms for 1000 chunks)
 * - Category-based filtering
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { getCodexLensPython } from '../utils/codexlens-path.js';
import { StoragePaths, ensureStorageDir } from '../config/storage-paths.js';

// Get directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Venv python path (reuse CodexLens venv)
const VENV_PYTHON = getCodexLensPython();

// Script path
const EMBEDDER_SCRIPT = join(__dirname, '..', '..', 'scripts', 'unified_memory_embedder.py');

// Chunking constants (match existing core-memory-store.ts)
const CHUNK_SIZE = 1500;
const OVERLAP = 200;

// =============================================================================
// Types
// =============================================================================

/** Valid source types for vector content */
export type SourceType = 'core_memory' | 'workflow' | 'cli_history';

/** Valid category values for vector filtering */
export type VectorCategory = 'core_memory' | 'cli_history' | 'workflow' | 'entity' | 'pattern';

/** Metadata attached to each chunk in the vector store */
export interface ChunkMetadata {
  /** Source identifier (e.g., memory ID, session ID) */
  source_id: string;
  /** Source type */
  source_type: SourceType;
  /** Category for filtering */
  category: VectorCategory;
  /** Chunk index within the source */
  chunk_index?: number;
  /** Additional metadata */
  [key: string]: unknown;
}

/** A chunk to be embedded and indexed */
export interface VectorChunk {
  /** Text content */
  content: string;
  /** Source identifier */
  source_id: string;
  /** Source type */
  source_type: SourceType;
  /** Category for filtering */
  category: VectorCategory;
  /** Chunk index */
  chunk_index: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Result of an embed operation */
export interface EmbedResult {
  success: boolean;
  chunks_processed: number;
  chunks_failed: number;
  elapsed_time: number;
  error?: string;
}

/** A single search match */
export interface VectorSearchMatch {
  content: string;
  score: number;
  source_id: string;
  source_type: string;
  chunk_index: number;
  category: string;
  metadata: Record<string, unknown>;
}

/** Result of a search operation */
export interface VectorSearchResult {
  success: boolean;
  matches: VectorSearchMatch[];
  elapsed_time?: number;
  total_searched?: number;
  error?: string;
}

/** Search options */
export interface VectorSearchOptions {
  topK?: number;
  minScore?: number;
  category?: VectorCategory;
}

/** Index status information */
export interface VectorIndexStatus {
  success: boolean;
  total_chunks: number;
  hnsw_available: boolean;
  hnsw_count: number;
  dimension: number;
  categories?: Record<string, number>;
  model_config?: {
    backend: string;
    profile: string;
    dimension: number;
    max_tokens: number;
  };
  error?: string;
}

/** Reindex result */
export interface ReindexResult {
  success: boolean;
  hnsw_count?: number;
  elapsed_time?: number;
  error?: string;
}

// =============================================================================
// Python Bridge
// =============================================================================

/**
 * Check if the unified embedder is available (venv and script exist)
 */
export function isUnifiedEmbedderAvailable(): boolean {
  if (!existsSync(VENV_PYTHON)) {
    return false;
  }
  if (!existsSync(EMBEDDER_SCRIPT)) {
    return false;
  }
  return true;
}

/**
 * Run Python script with JSON stdin/stdout protocol.
 *
 * @param request - JSON request object to send via stdin
 * @param timeout - Timeout in milliseconds (default: 5 minutes)
 * @returns Parsed JSON response
 */
function runPython<T>(request: Record<string, unknown>, timeout: number = 300000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isUnifiedEmbedderAvailable()) {
      reject(
        new Error(
          'Unified embedder not available. Ensure CodexLens venv exists at ~/.codexlens/venv'
        )
      );
      return;
    }

    const child = spawn(VENV_PYTHON, [EMBEDDER_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
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
      if (code === 0 && stdout.trim()) {
        try {
          resolve(JSON.parse(stdout.trim()) as T);
        } catch {
          reject(new Error(`Failed to parse Python output: ${stdout.substring(0, 500)}`));
        }
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

    // Write JSON request to stdin and close
    const jsonInput = JSON.stringify(request);
    child.stdin.write(jsonInput);
    child.stdin.end();
  });
}

// =============================================================================
// Content Chunking
// =============================================================================

/**
 * Chunk content into smaller pieces for embedding.
 * Uses paragraph-first, sentence-fallback strategy with overlap.
 *
 * Matches the chunking logic in core-memory-store.ts:
 * - CHUNK_SIZE = 1500 characters
 * - OVERLAP = 200 characters
 * - Split by paragraph boundaries (\n\n) first
 * - Fall back to sentence boundaries (. ) for oversized paragraphs
 *
 * @param content - Text content to chunk
 * @returns Array of chunk strings
 */
export function chunkContent(content: string): string[] {
  const chunks: string[] = [];

  // Split by paragraph boundaries first
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + paragraph.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-OVERLAP);
      currentChunk = overlapText + '\n\n' + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If chunks are still too large, split by sentences
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= CHUNK_SIZE) {
      finalChunks.push(chunk);
    } else {
      // Split by sentence boundaries
      const sentences = chunk.split(/\. +/);
      let sentenceChunk = '';

      for (const sentence of sentences) {
        const sentenceWithPeriod = sentence + '. ';
        if (
          sentenceChunk.length + sentenceWithPeriod.length > CHUNK_SIZE &&
          sentenceChunk.length > 0
        ) {
          finalChunks.push(sentenceChunk.trim());
          const overlapText = sentenceChunk.slice(-OVERLAP);
          sentenceChunk = overlapText + sentenceWithPeriod;
        } else {
          sentenceChunk += sentenceWithPeriod;
        }
      }

      if (sentenceChunk.trim()) {
        finalChunks.push(sentenceChunk.trim());
      }
    }
  }

  return finalChunks.length > 0 ? finalChunks : [content];
}

// =============================================================================
// UnifiedVectorIndex Class
// =============================================================================

/**
 * Unified vector index backed by CodexLens VectorStore (HNSW).
 *
 * Provides content chunking, embedding, storage, and search for all
 * memory content types through a single interface.
 */
export class UnifiedVectorIndex {
  private storePath: string;

  /**
   * Create a UnifiedVectorIndex for a project.
   *
   * @param projectPath - Project root path (used to resolve storage location)
   */
  constructor(projectPath: string) {
    const paths = StoragePaths.project(projectPath);
    this.storePath = paths.unifiedVectors.root;
    ensureStorageDir(this.storePath);
  }

  /**
   * Index content by chunking, embedding, and storing in VectorStore.
   *
   * @param content - Text content to index
   * @param metadata - Metadata for all chunks (source_id, source_type, category)
   * @returns Embed result
   */
  async indexContent(
    content: string,
    metadata: ChunkMetadata
  ): Promise<EmbedResult> {
    if (!content.trim()) {
      return {
        success: true,
        chunks_processed: 0,
        chunks_failed: 0,
        elapsed_time: 0,
      };
    }

    // Chunk content
    const textChunks = chunkContent(content);

    // Build chunk objects for Python
    const chunks: VectorChunk[] = textChunks.map((text, index) => ({
      content: text,
      source_id: metadata.source_id,
      source_type: metadata.source_type,
      category: metadata.category,
      chunk_index: metadata.chunk_index != null ? metadata.chunk_index + index : index,
      metadata: { ...metadata },
    }));

    try {
      const result = await runPython<EmbedResult>({
        operation: 'embed',
        store_path: this.storePath,
        chunks,
        batch_size: 8,
      });
      return result;
    } catch (err) {
      return {
        success: false,
        chunks_processed: 0,
        chunks_failed: textChunks.length,
        elapsed_time: 0,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Search the vector index using semantic similarity.
   *
   * @param query - Natural language search query
   * @param options - Search options (topK, minScore, category)
   * @returns Search results sorted by relevance
   */
  async search(
    query: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult> {
    const { topK = 10, minScore = 0.3, category } = options;

    try {
      const result = await runPython<VectorSearchResult>({
        operation: 'search',
        store_path: this.storePath,
        query,
        top_k: topK,
        min_score: minScore,
        category: category || null,
      });
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
   * Search the vector index using a pre-computed embedding vector.
   * Bypasses text embedding, directly querying HNSW with a raw vector.
   *
   * @param vector - Pre-computed embedding vector (array of floats)
   * @param options - Search options (topK, minScore, category)
   * @returns Search results sorted by relevance
   */
  async searchByVector(
    vector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult> {
    const { topK = 10, minScore = 0.3, category } = options;

    try {
      const result = await runPython<VectorSearchResult>({
        operation: 'search_by_vector',
        store_path: this.storePath,
        vector,
        top_k: topK,
        min_score: minScore,
        category: category || null,
      });
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
   * Rebuild the HNSW index from scratch.
   *
   * @returns Reindex result
   */
  async reindexAll(): Promise<ReindexResult> {
    try {
      const result = await runPython<ReindexResult>({
        operation: 'reindex',
        store_path: this.storePath,
      });
      return result;
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Get the current status of the vector index.
   *
   * @returns Index status including chunk counts, HNSW availability, dimension
   */
  async getStatus(): Promise<VectorIndexStatus> {
    try {
      const result = await runPython<VectorIndexStatus>({
        operation: 'status',
        store_path: this.storePath,
      });
      return result;
    } catch (err) {
      return {
        success: false,
        total_chunks: 0,
        hnsw_available: false,
        hnsw_count: 0,
        dimension: 0,
        error: (err as Error).message,
      };
    }
  }
}
