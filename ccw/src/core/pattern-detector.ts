/**
 * Pattern Detector - Detects recurring content patterns across sessions
 *
 * Uses vector clustering (cosine similarity > 0.85) to group semantically similar
 * chunks into patterns. Patterns appearing in N>=3 distinct sessions are flagged
 * as candidates. High-confidence patterns (>=0.8) are solidified into CoreMemory
 * and skills/*.md files.
 */

import { CoreMemoryStore, getCoreMemoryStore } from './core-memory-store.js';
import { UnifiedVectorIndex, isUnifiedEmbedderAvailable } from './unified-vector-index.js';
import type { VectorSearchMatch } from './unified-vector-index.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// -- Constants --

/** Minimum cosine similarity to group chunks into the same pattern */
const PATTERN_SIMILARITY_THRESHOLD = 0.85;

/** Minimum number of distinct sessions a pattern must appear in */
const MIN_SESSION_FREQUENCY = 3;

/** Confidence threshold for auto-solidification */
const SOLIDIFY_CONFIDENCE_THRESHOLD = 0.8;

/** Maximum number of chunks to analyze per detection run */
const MAX_CHUNKS_TO_ANALYZE = 200;

/** Top-K neighbors to search per chunk during clustering */
const NEIGHBOR_TOP_K = 15;

// -- Types --

export interface DetectedPattern {
  /** Unique pattern identifier */
  id: string;
  /** Human-readable pattern name derived from content */
  name: string;
  /** Representative content snippet */
  representative: string;
  /** Source IDs (sessions) where this pattern appears */
  sourceIds: string[];
  /** Number of distinct sessions */
  sessionCount: number;
  /** Average similarity score within the pattern group */
  avgSimilarity: number;
  /** Confidence score (0-1), based on frequency and similarity */
  confidence: number;
  /** Category of the chunks in this pattern */
  category: string;
}

export interface PatternDetectionResult {
  /** All detected patterns */
  patterns: DetectedPattern[];
  /** Number of chunks analyzed */
  chunksAnalyzed: number;
  /** Patterns that were solidified (written to CoreMemory + skills) */
  solidified: string[];
  /** Elapsed time in ms */
  elapsedMs: number;
}

export interface SolidifyResult {
  memoryId: string;
  skillPath: string | null;
}

// -- PatternDetector --

export class PatternDetector {
  private projectPath: string;
  private coreMemoryStore: CoreMemoryStore;
  private vectorIndex: UnifiedVectorIndex | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.coreMemoryStore = getCoreMemoryStore(projectPath);

    if (isUnifiedEmbedderAvailable()) {
      this.vectorIndex = new UnifiedVectorIndex(projectPath);
    }
  }

  /**
   * Detect recurring patterns across sessions by vector clustering.
   *
   * Algorithm:
   * 1. Get representative chunks from VectorStore (via search with broad queries)
   * 2. For each chunk, search HNSW for nearest neighbors (cosine > PATTERN_SIMILARITY_THRESHOLD)
   * 3. Group chunks with high mutual similarity into pattern clusters
   * 4. Count distinct source_ids per cluster (session frequency)
   * 5. Patterns with sessionCount >= MIN_SESSION_FREQUENCY become candidates
   *
   * @returns Detection result with candidate patterns
   */
  async detectPatterns(): Promise<PatternDetectionResult> {
    const startTime = Date.now();
    const result: PatternDetectionResult = {
      patterns: [],
      chunksAnalyzed: 0,
      solidified: [],
      elapsedMs: 0,
    };

    if (!this.vectorIndex) {
      result.elapsedMs = Date.now() - startTime;
      return result;
    }

    // Step 1: Gather chunks from the vector store via broad category searches
    const allChunks = await this.gatherChunksForAnalysis();
    result.chunksAnalyzed = allChunks.length;

    if (allChunks.length < MIN_SESSION_FREQUENCY) {
      result.elapsedMs = Date.now() - startTime;
      return result;
    }

    // Step 2: Cluster chunks by vector similarity
    const patternGroups = await this.clusterChunksByVector(allChunks);

    // Step 3: Filter by session frequency and build DetectedPattern objects
    for (const group of patternGroups) {
      const uniqueSources = new Set(group.map(c => c.source_id));
      if (uniqueSources.size < MIN_SESSION_FREQUENCY) continue;

      const avgSim = group.reduce((sum, c) => sum + c.score, 0) / group.length;

      // Confidence: combines frequency (normalized) and avg similarity
      const frequencyScore = Math.min(uniqueSources.size / 10, 1.0);
      const confidence = avgSim * 0.6 + frequencyScore * 0.4;

      const representative = group[0]; // Highest scoring chunk
      const patternName = this.derivePatternName(group);
      const patternId = `PAT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      result.patterns.push({
        id: patternId,
        name: patternName,
        representative: representative.content.substring(0, 500),
        sourceIds: Array.from(uniqueSources),
        sessionCount: uniqueSources.size,
        avgSimilarity: Math.round(avgSim * 1000) / 1000,
        confidence: Math.round(confidence * 1000) / 1000,
        category: representative.category || 'unknown',
      });
    }

    // Sort by confidence descending
    result.patterns.sort((a, b) => b.confidence - a.confidence);

    // Step 4: Auto-solidify high-confidence patterns (fire-and-forget)
    for (const pattern of result.patterns) {
      if (pattern.confidence >= SOLIDIFY_CONFIDENCE_THRESHOLD) {
        try {
          await this.solidifyPattern(pattern);
          result.solidified.push(pattern.id);
        } catch (err) {
          console.warn(
            `[PatternDetector] Failed to solidify pattern ${pattern.id}:`,
            (err as Error).message
          );
        }
      }
    }

    result.elapsedMs = Date.now() - startTime;
    return result;
  }

  /**
   * Gather a representative set of chunks for pattern analysis.
   * Uses broad search queries across categories to collect diverse chunks.
   */
  private async gatherChunksForAnalysis(): Promise<VectorSearchMatch[]> {
    if (!this.vectorIndex) return [];

    const allChunks: VectorSearchMatch[] = [];
    const seenContent = new Set<string>();

    // Search across common categories with broad queries
    const broadQueries = [
      'implementation pattern',
      'configuration setup',
      'error handling',
      'testing approach',
      'workflow process',
    ];

    const categories = ['core_memory', 'cli_history', 'workflow'] as const;

    for (const category of categories) {
      for (const query of broadQueries) {
        if (allChunks.length >= MAX_CHUNKS_TO_ANALYZE) break;

        try {
          const result = await this.vectorIndex.search(query, {
            topK: Math.ceil(MAX_CHUNKS_TO_ANALYZE / (broadQueries.length * categories.length)),
            minScore: 0.1,
            category,
          });

          if (result.success) {
            for (const match of result.matches) {
              // Deduplicate by content hash (first 100 chars)
              const contentKey = match.content.substring(0, 100);
              if (!seenContent.has(contentKey)) {
                seenContent.add(contentKey);
                allChunks.push(match);
              }
              if (allChunks.length >= MAX_CHUNKS_TO_ANALYZE) break;
            }
          }
        } catch {
          // Search failed for this query/category, continue
        }
      }
    }

    return allChunks;
  }

  /**
   * Cluster chunks by vector similarity using HNSW neighbor search.
   *
   * For each unprocessed chunk, search for its nearest neighbors.
   * Chunks with cosine similarity > PATTERN_SIMILARITY_THRESHOLD are grouped together.
   * Uses a union-find-like approach via visited tracking.
   */
  private async clusterChunksByVector(
    chunks: VectorSearchMatch[]
  ): Promise<VectorSearchMatch[][]> {
    if (!this.vectorIndex) return [];

    const groups: VectorSearchMatch[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < chunks.length; i++) {
      if (processed.has(i)) continue;

      const seedChunk = chunks[i];
      const group: VectorSearchMatch[] = [seedChunk];
      processed.add(i);

      // Search for neighbors of this chunk's content
      try {
        const neighbors = await this.vectorIndex.search(seedChunk.content, {
          topK: NEIGHBOR_TOP_K,
          minScore: PATTERN_SIMILARITY_THRESHOLD,
        });

        if (neighbors.success) {
          for (const neighbor of neighbors.matches) {
            // Skip self-matches
            if (neighbor.content === seedChunk.content) continue;

            // Find this neighbor in our chunk list
            for (let j = 0; j < chunks.length; j++) {
              if (processed.has(j)) continue;
              if (
                chunks[j].source_id === neighbor.source_id &&
                chunks[j].chunk_index === neighbor.chunk_index
              ) {
                group.push({ ...chunks[j], score: neighbor.score });
                processed.add(j);
                break;
              }
            }

            // Also include neighbors not in our original list
            if (neighbor.source_id && neighbor.source_id !== seedChunk.source_id) {
              // Check if already in group by source_id
              const alreadyInGroup = group.some(
                g => g.source_id === neighbor.source_id && g.chunk_index === neighbor.chunk_index
              );
              if (!alreadyInGroup) {
                group.push(neighbor);
              }
            }
          }
        }
      } catch {
        // HNSW search failed, skip this chunk's neighborhood
      }

      // Only keep groups with chunks from multiple sources
      const uniqueSources = new Set(group.map(c => c.source_id));
      if (uniqueSources.size >= 2) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Derive a human-readable pattern name from a group of similar chunks.
   * Extracts common keywords/phrases from the representative content.
   */
  private derivePatternName(group: VectorSearchMatch[]): string {
    // Extended stopwords including generic tech terms
    const stopwords = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'will',
      'are', 'was', 'were', 'been', 'what', 'when', 'where', 'which',
      'there', 'their', 'they', 'them', 'then', 'than', 'into', 'some',
      'code', 'file', 'function', 'class', 'import', 'export', 'const',
      'async', 'await', 'return', 'type', 'interface', 'string', 'number',
      'true', 'false', 'null', 'undefined', 'object', 'array', 'value',
      'data', 'result', 'error', 'name', 'path', 'index', 'item', 'list',
      'should', 'would', 'could', 'does', 'make', 'like', 'just', 'also',
      'used', 'using', 'each', 'other', 'more', 'only', 'need', 'very',
    ]);

    const isSignificant = (w: string) => w.length >= 4 && !stopwords.has(w);

    // Count word and bigram frequency across all chunks
    const wordFreq = new Map<string, number>();
    const bigramFreq = new Map<string, number>();

    for (const chunk of group) {
      const words = chunk.content.toLowerCase().split(/[\s\W]+/).filter(isSignificant);
      const uniqueWords = new Set(words);
      for (const word of uniqueWords) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }

      // Extract bigrams from consecutive significant words
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]}-${words[i + 1]}`;
        bigramFreq.set(bigram, (bigramFreq.get(bigram) || 0) + 1);
      }
    }

    // Prefer bigrams that appear in multiple chunks
    const topBigrams = Array.from(bigramFreq.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);

    if (topBigrams.length > 0) {
      // Use top bigram, optionally append a distinguishing single word
      const name = topBigrams[0][0];
      const bigramWords = new Set(name.split('-'));
      const extra = Array.from(wordFreq.entries())
        .filter(([w, count]) => count >= 2 && !bigramWords.has(w))
        .sort((a, b) => b[1] - a[1]);
      if (extra.length > 0) {
        const candidate = `${name}-${extra[0][0]}`;
        return candidate.length <= 50 ? candidate : name;
      }
      return name;
    }

    // Fallback to top single words
    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w);

    if (topWords.length >= 2) {
      const name = topWords.join('-');
      return name.length <= 50 ? name : topWords.slice(0, 2).join('-');
    } else if (topWords.length === 1) {
      return topWords[0];
    }

    return 'unnamed-pattern';
  }

  /**
   * Solidify a detected pattern by writing it to CoreMemory and skills/*.md.
   *
   * Creates:
   * 1. A CoreMemory entry with the pattern content and metadata
   * 2. A skills/{pattern_slug}.md file with the pattern documentation
   *
   * This method is fire-and-forget - errors are logged but not propagated.
   *
   * @param pattern - The detected pattern to solidify
   * @returns Result with memory ID and skill file path
   */
  async solidifyPattern(pattern: DetectedPattern): Promise<SolidifyResult> {
    // 1. Create CoreMemory entry
    const memoryContent = this.buildPatternMemoryContent(pattern);
    const memory = this.coreMemoryStore.upsertMemory({
      content: memoryContent,
      summary: `Detected pattern: ${pattern.name} (${pattern.sessionCount} sessions, confidence: ${pattern.confidence})`,
      metadata: JSON.stringify({
        type: 'detected_pattern',
        pattern_id: pattern.id,
        pattern_name: pattern.name,
        session_count: pattern.sessionCount,
        confidence: pattern.confidence,
        source_ids: pattern.sourceIds,
        detected_at: new Date().toISOString(),
      }),
    });

    // 2. Write skills file
    let skillPath: string | null = null;
    try {
      const slug = pattern.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);

      const skillsDir = join(this.projectPath, '.claude', 'skills');
      if (!existsSync(skillsDir)) {
        mkdirSync(skillsDir, { recursive: true });
      }

      skillPath = join(skillsDir, `${slug}.md`);
      const skillContent = this.buildSkillContent(pattern);
      writeFileSync(skillPath, skillContent, 'utf-8');
    } catch (err) {
      console.warn(
        `[PatternDetector] Failed to write skill file for ${pattern.name}:`,
        (err as Error).message
      );
      skillPath = null;
    }

    console.log(
      `[PatternDetector] Solidified pattern '${pattern.name}' -> memory=${memory.id}, skill=${skillPath || 'none'}`
    );

    return { memoryId: memory.id, skillPath };
  }

  /**
   * Build CoreMemory content for a detected pattern.
   */
  private buildPatternMemoryContent(pattern: DetectedPattern): string {
    const lines: string[] = [
      `# Detected Pattern: ${pattern.name}`,
      '',
      `**Confidence**: ${pattern.confidence}`,
      `**Sessions**: ${pattern.sessionCount} (${pattern.sourceIds.join(', ')})`,
      `**Category**: ${pattern.category}`,
      `**Avg Similarity**: ${pattern.avgSimilarity}`,
      '',
      '## Representative Content',
      '',
      pattern.representative,
      '',
      '## Usage',
      '',
      'This pattern was automatically detected across multiple sessions.',
      'It represents a recurring approach or concept in this project.',
    ];

    return lines.join('\n');
  }

  /**
   * Build skill file content for a detected pattern.
   */
  private buildSkillContent(pattern: DetectedPattern): string {
    const lines: string[] = [
      `# ${pattern.name}`,
      '',
      `> Auto-detected pattern (confidence: ${pattern.confidence}, sessions: ${pattern.sessionCount})`,
      '',
      '## Description',
      '',
      pattern.representative,
      '',
      '## Context',
      '',
      `This pattern was detected across ${pattern.sessionCount} sessions:`,
      ...pattern.sourceIds.map(id => `- ${id}`),
      '',
      '## When to Apply',
      '',
      'Apply this pattern when working on similar tasks or encountering related concepts.',
      '',
      `---`,
      `*Auto-generated by PatternDetector on ${new Date().toISOString()}*`,
    ];

    return lines.join('\n');
  }
}
