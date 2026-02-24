/**
 * Unified Memory Service - Cross-store search with RRF fusion
 *
 * Provides a single search() interface that combines:
 * - Vector search (HNSW via UnifiedVectorIndex)
 * - Full-text search (FTS5 via MemoryStore.searchPrompts)
 * - Heat-based scoring (entity heat from MemoryStore)
 *
 * Fusion: Reciprocal Rank Fusion (RRF)
 *   score = sum(1 / (k + rank_i) * weight_i)
 *   k = 60, weights = { vector: 0.6, fts: 0.3, heat: 0.1 }
 */

import { UnifiedVectorIndex, isUnifiedEmbedderAvailable } from './unified-vector-index.js';
import type {
  VectorCategory,
  VectorSearchMatch,
  VectorIndexStatus,
} from './unified-vector-index.js';
import { CoreMemoryStore, getCoreMemoryStore } from './core-memory-store.js';
import type { CoreMemory } from './core-memory-store.js';
import { MemoryStore, getMemoryStore } from './memory-store.js';
import type { PromptHistory, HotEntity } from './memory-store.js';

// =============================================================================
// Types
// =============================================================================

/** Options for unified search */
export interface UnifiedSearchOptions {
  /** Maximum number of results to return (default: 20) */
  limit?: number;
  /** Minimum relevance score threshold (default: 0.0) */
  minScore?: number;
  /** Filter by category */
  category?: VectorCategory;
  /** Vector search top-k (default: 30, fetched internally for fusion) */
  vectorTopK?: number;
  /** FTS search limit (default: 30, fetched internally for fusion) */
  ftsLimit?: number;
}

/** A unified search result item */
export interface UnifiedSearchResult {
  /** Unique identifier for the source item */
  source_id: string;
  /** Source type: core_memory, cli_history, workflow, entity, pattern */
  source_type: string;
  /** Fused relevance score (0..1 range, higher is better) */
  score: number;
  /** Text content (snippet or full) */
  content: string;
  /** Category of the result */
  category: string;
  /** Which ranking sources contributed to this result */
  rank_sources: {
    vector_rank?: number;
    vector_score?: number;
    fts_rank?: number;
    heat_score?: number;
  };
}

/** Aggregated statistics from all stores + vector index */
export interface UnifiedMemoryStats {
  core_memories: {
    total: number;
    archived: number;
  };
  stage1_outputs: number;
  entities: number;
  prompts: number;
  conversations: number;
  vector_index: {
    available: boolean;
    total_chunks: number;
    hnsw_available: boolean;
    hnsw_count: number;
    dimension: number;
    categories?: Record<string, number>;
  };
}

/** KNN recommendation result */
export interface RecommendationResult {
  source_id: string;
  source_type: string;
  score: number;
  content: string;
  category: string;
}

// =============================================================================
// RRF Constants
// =============================================================================

/** RRF smoothing constant (standard value from the original RRF paper) */
const RRF_K = 60;

/** Fusion weights */
const WEIGHT_VECTOR = 0.6;
const WEIGHT_FTS = 0.3;
const WEIGHT_HEAT = 0.1;

// =============================================================================
// UnifiedMemoryService
// =============================================================================

/**
 * Unified Memory Service providing cross-store search and recommendations.
 *
 * Combines vector similarity, full-text search, and entity heat scores
 * using Reciprocal Rank Fusion (RRF) for result ranking.
 */
export class UnifiedMemoryService {
  private projectPath: string;
  private vectorIndex: UnifiedVectorIndex | null = null;
  private coreMemoryStore: CoreMemoryStore;
  private memoryStore: MemoryStore;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.coreMemoryStore = getCoreMemoryStore(projectPath);
    this.memoryStore = getMemoryStore(projectPath);

    if (isUnifiedEmbedderAvailable()) {
      this.vectorIndex = new UnifiedVectorIndex(projectPath);
    }
  }

  // ==========================================================================
  // Search
  // ==========================================================================

  /**
   * Unified search across all memory stores.
   *
   * Pipeline:
   * 1. Vector search via UnifiedVectorIndex (semantic similarity)
   * 2. FTS5 search via MemoryStore.searchPrompts (keyword matching)
   * 3. Heat boost via entity heat scores
   * 4. RRF fusion to combine ranked lists
   *
   * @param query - Natural language search query
   * @param options - Search options
   * @returns Fused search results sorted by relevance
   */
  async search(
    query: string,
    options: UnifiedSearchOptions = {}
  ): Promise<UnifiedSearchResult[]> {
    const {
      limit = 20,
      minScore = 0.0,
      category,
      vectorTopK = 30,
      ftsLimit = 30,
    } = options;

    // Run vector search and FTS search in parallel
    const [vectorResults, ftsResults, hotEntities] = await Promise.all([
      this.runVectorSearch(query, vectorTopK, category),
      this.runFtsSearch(query, ftsLimit),
      this.getHeatScores(),
    ]);

    // Build heat score lookup
    const heatMap = new Map<string, number>();
    for (const entity of hotEntities) {
      // Use normalized_value as key for heat lookup
      heatMap.set(entity.normalized_value, entity.stats.heat_score);
    }

    // Collect all unique source_ids from both result sets
    const allSourceIds = new Set<string>();
    const vectorRankMap = new Map<string, { rank: number; score: number; match: VectorSearchMatch }>();
    const ftsRankMap = new Map<string, { rank: number; item: PromptHistory }>();

    // Build vector rank map
    for (let i = 0; i < vectorResults.length; i++) {
      const match = vectorResults[i];
      const id = match.source_id;
      allSourceIds.add(id);
      vectorRankMap.set(id, { rank: i + 1, score: match.score, match });
    }

    // Build FTS rank map
    for (let i = 0; i < ftsResults.length; i++) {
      const item = ftsResults[i];
      const id = item.session_id;
      allSourceIds.add(id);
      ftsRankMap.set(id, { rank: i + 1, item });
    }

    // Calculate RRF score for each unique source_id
    const results: UnifiedSearchResult[] = [];

    for (const sourceId of allSourceIds) {
      const vectorEntry = vectorRankMap.get(sourceId);
      const ftsEntry = ftsRankMap.get(sourceId);

      // RRF: score = sum(weight_i / (k + rank_i))
      let rrfScore = 0;
      const rankSources: UnifiedSearchResult['rank_sources'] = {};

      // Vector component
      if (vectorEntry) {
        rrfScore += WEIGHT_VECTOR / (RRF_K + vectorEntry.rank);
        rankSources.vector_rank = vectorEntry.rank;
        rankSources.vector_score = vectorEntry.score;
      }

      // FTS component
      if (ftsEntry) {
        rrfScore += WEIGHT_FTS / (RRF_K + ftsEntry.rank);
        rankSources.fts_rank = ftsEntry.rank;
      }

      // Heat component (boost based on entity heat)
      const heatScore = this.lookupHeatScore(sourceId, heatMap);
      if (heatScore > 0) {
        // Normalize heat score to a rank-like value (1 = hottest)
        // Use inverse: higher heat = lower rank number = higher contribution
        const heatRank = Math.max(1, Math.ceil(100 / (1 + heatScore)));
        rrfScore += WEIGHT_HEAT / (RRF_K + heatRank);
        rankSources.heat_score = heatScore;
      }

      if (rrfScore < minScore) continue;

      // Build result entry
      let content = '';
      let sourceType = '';
      let resultCategory = '';

      if (vectorEntry) {
        content = vectorEntry.match.content;
        sourceType = vectorEntry.match.source_type;
        resultCategory = vectorEntry.match.category;
      } else if (ftsEntry) {
        content = ftsEntry.item.prompt_text || ftsEntry.item.context_summary || '';
        sourceType = 'cli_history';
        resultCategory = 'cli_history';
      }

      results.push({
        source_id: sourceId,
        source_type: sourceType,
        score: rrfScore,
        content,
        category: resultCategory,
        rank_sources: rankSources,
      });
    }

    // Sort by RRF score descending, take top `limit`
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // ==========================================================================
  // Recommendations
  // ==========================================================================

  /**
   * Get recommendations based on a memory's vector neighbors (KNN).
   *
   * Fetches the content of the given memory, then runs a vector search
   * to find similar content across all stores.
   *
   * @param memoryId - Core memory ID (CMEM-*)
   * @param limit - Number of recommendations (default: 5)
   * @returns Recommended items sorted by similarity
   */
  async getRecommendations(
    memoryId: string,
    limit: number = 5
  ): Promise<RecommendationResult[]> {
    // Get the memory content
    const memory = this.coreMemoryStore.getMemory(memoryId);
    if (!memory) {
      return [];
    }

    if (!this.vectorIndex) {
      return [];
    }

    // Use memory content as query for KNN search
    // Request extra results so we can filter out self
    const searchResult = await this.vectorIndex.search(memory.content, {
      topK: limit + 5,
      minScore: 0.3,
    });

    if (!searchResult.success) {
      return [];
    }

    // Filter out self and map to recommendations
    const recommendations: RecommendationResult[] = [];
    for (const match of searchResult.matches) {
      // Skip the source memory itself
      if (match.source_id === memoryId) continue;

      recommendations.push({
        source_id: match.source_id,
        source_type: match.source_type,
        score: match.score,
        content: match.content,
        category: match.category,
      });

      if (recommendations.length >= limit) break;
    }

    return recommendations;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get aggregated statistics from all stores and the vector index.
   *
   * @returns Unified stats across core memories, V2 outputs, entities, prompts, and vectors
   */
  async getStats(): Promise<UnifiedMemoryStats> {
    // Get core memory stats
    const allMemories = this.coreMemoryStore.getMemories({ limit: 100000 });
    const archivedMemories = allMemories.filter(m => m.archived);
    const stage1Count = this.coreMemoryStore.countStage1Outputs();

    // Get memory store stats (entities, prompts, conversations)
    const db = (this.memoryStore as any).db;
    let entityCount = 0;
    let promptCount = 0;
    let conversationCount = 0;

    try {
      entityCount = (db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number }).count;
    } catch { /* table may not exist */ }

    try {
      promptCount = (db.prepare('SELECT COUNT(*) as count FROM prompt_history').get() as { count: number }).count;
    } catch { /* table may not exist */ }

    try {
      conversationCount = (db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count;
    } catch { /* table may not exist */ }

    // Get vector index status
    let vectorStatus: VectorIndexStatus = {
      success: false,
      total_chunks: 0,
      hnsw_available: false,
      hnsw_count: 0,
      dimension: 0,
    };

    if (this.vectorIndex) {
      try {
        vectorStatus = await this.vectorIndex.getStatus();
      } catch {
        // Vector index not available
      }
    }

    return {
      core_memories: {
        total: allMemories.length,
        archived: archivedMemories.length,
      },
      stage1_outputs: stage1Count,
      entities: entityCount,
      prompts: promptCount,
      conversations: conversationCount,
      vector_index: {
        available: vectorStatus.success,
        total_chunks: vectorStatus.total_chunks,
        hnsw_available: vectorStatus.hnsw_available,
        hnsw_count: vectorStatus.hnsw_count,
        dimension: vectorStatus.dimension,
        categories: vectorStatus.categories,
      },
    };
  }

  // ==========================================================================
  // Internal helpers
  // ==========================================================================

  /**
   * Run vector search via UnifiedVectorIndex.
   * Returns empty array if vector index is not available.
   */
  private async runVectorSearch(
    query: string,
    topK: number,
    category?: VectorCategory
  ): Promise<VectorSearchMatch[]> {
    if (!this.vectorIndex) {
      return [];
    }

    try {
      const result = await this.vectorIndex.search(query, {
        topK,
        minScore: 0.1,
        category,
      });

      if (!result.success) {
        return [];
      }

      return result.matches;
    } catch {
      return [];
    }
  }

  /**
   * Run FTS5 full-text search via MemoryStore.searchPrompts.
   * Returns empty array on error.
   */
  private async runFtsSearch(
    query: string,
    limit: number
  ): Promise<PromptHistory[]> {
    try {
      // FTS5 requires sanitized query (no special characters)
      const sanitized = this.sanitizeFtsQuery(query);
      if (!sanitized) return [];

      return this.memoryStore.searchPrompts(sanitized, limit);
    } catch {
      return [];
    }
  }

  /**
   * Get hot entities for heat-based scoring.
   */
  private async getHeatScores(): Promise<HotEntity[]> {
    try {
      return this.memoryStore.getHotEntities(50);
    } catch {
      return [];
    }
  }

  /**
   * Look up heat score for a source ID.
   * Checks if any entity's normalized_value matches the source_id.
   */
  private lookupHeatScore(
    sourceId: string,
    heatMap: Map<string, number>
  ): number {
    // Direct match
    if (heatMap.has(sourceId)) {
      return heatMap.get(sourceId)!;
    }

    // Check if source_id is a substring of any entity value (file paths)
    for (const [key, score] of heatMap) {
      if (sourceId.includes(key) || key.includes(sourceId)) {
        return score;
      }
    }

    return 0;
  }

  /**
   * Sanitize a query string for FTS5 MATCH syntax.
   * Removes special characters that would cause FTS5 parse errors.
   */
  private sanitizeFtsQuery(query: string): string {
    // Remove FTS5 special operators and punctuation
    return query
      .replace(/[*":(){}[\]^~\\/<>!@#$%&=+|;,.'`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
