/**
 * Session Clustering Service
 * Intelligently groups related sessions into clusters using multi-dimensional similarity analysis
 */

import { CoreMemoryStore, SessionCluster, ClusterMember, SessionMetadataCache } from './core-memory-store.js';
import { CliHistoryStore } from '../tools/cli-history-store.js';
import { UnifiedVectorIndex, isUnifiedEmbedderAvailable } from './unified-vector-index.js';
import { StoragePaths } from '../config/storage-paths.js';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

// Clustering dimension weights
const WEIGHTS = {
  fileOverlap: 0.2,
  temporalProximity: 0.15,
  keywordSimilarity: 0.15,
  vectorSimilarity: 0.3,
  intentAlignment: 0.2,
};

// Clustering threshold (0.4 = moderate similarity required)
const CLUSTER_THRESHOLD = 0.4;

// Incremental clustering frequency control
const MIN_CLUSTER_INTERVAL_HOURS = 6;
const MIN_NEW_SESSIONS_FOR_CLUSTER = 5;

export interface ClusteringOptions {
  scope?: 'all' | 'recent' | 'unclustered';
  timeRange?: { start: string; end: string };
  minClusterSize?: number;
}

export interface ClusteringResult {
  clustersCreated: number;
  sessionsProcessed: number;
  sessionsClustered: number;
}

export interface IncrementalClusterResult {
  sessionId: string;
  clusterId: string | null;
  action: 'joined_existing' | 'created_new' | 'skipped';
}

export class SessionClusteringService {
  private coreMemoryStore: CoreMemoryStore;
  private cliHistoryStore: CliHistoryStore;
  private projectPath: string;
  private vectorIndex: UnifiedVectorIndex | null = null;
  /** Cache: sessionId -> list of nearby session source_ids from HNSW search */
  private vectorNeighborCache: Map<string, Map<string, number>> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.coreMemoryStore = new CoreMemoryStore(projectPath);
    this.cliHistoryStore = new CliHistoryStore(projectPath);

    // Initialize vector index if available
    if (isUnifiedEmbedderAvailable()) {
      this.vectorIndex = new UnifiedVectorIndex(projectPath);
    }
  }

  /**
   * Collect all session sources
   */
  async collectSessions(options?: ClusteringOptions): Promise<SessionMetadataCache[]> {
    const sessions: SessionMetadataCache[] = [];

    // 1. Core Memories
    const memories = this.coreMemoryStore.getMemories({ archived: false, limit: 1000 });
    for (const memory of memories) {
      const cached = this.coreMemoryStore.getSessionMetadata(memory.id);
      if (cached) {
        sessions.push(cached);
      } else {
        const metadata = this.extractMetadata(memory, 'core_memory');
        sessions.push(metadata);
      }
    }

    // 2. CLI History
    const history = this.cliHistoryStore.getHistory({ limit: 1000 });
    for (const exec of history.executions) {
      const cached = this.coreMemoryStore.getSessionMetadata(exec.id);
      if (cached) {
        sessions.push(cached);
      } else {
        const conversation = this.cliHistoryStore.getConversation(exec.id);
        if (conversation) {
          const metadata = this.extractMetadata(conversation, 'cli_history');
          sessions.push(metadata);
        }
      }
    }

    // 3. Workflow Sessions (WFS-*)
    const workflowSessions = await this.parseWorkflowSessions();
    sessions.push(...workflowSessions);

    // Apply scope filter
    if (options?.scope === 'recent') {
      // Last 30 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString();
      return sessions.filter(s => (s.created_at || '') >= cutoffStr);
    } else if (options?.scope === 'unclustered') {
      // Only sessions not in any cluster
      return sessions.filter(s => {
        const clusters = this.coreMemoryStore.getSessionClusters(s.session_id);
        return clusters.length === 0;
      });
    }

    return sessions;
  }

  /**
   * Extract metadata from a session
   */
  extractMetadata(session: any, type: 'core_memory' | 'workflow' | 'cli_history' | 'native'): SessionMetadataCache {
    let content = '';
    let title = '';
    let created_at = '';

    if (type === 'core_memory') {
      content = session.content || '';
      created_at = session.created_at;
      // Extract title from first line
      const lines = content.split('\n');
      title = lines[0].replace(/^#+\s*/, '').trim().substring(0, 100);
    } else if (type === 'cli_history') {
      // Extract from conversation turns
      const turns = session.turns || [];
      if (turns.length > 0) {
        content = turns.map((t: any) => t.prompt).join('\n');
        title = turns[0].prompt.substring(0, 100);
        created_at = session.created_at || turns[0].timestamp;
      }
    } else if (type === 'workflow') {
      content = session.content || '';
      title = session.title || 'Workflow Session';
      created_at = session.created_at || '';
    }

    const summary = content.substring(0, 200).trim();
    const keywords = this.extractKeywords(content);
    const file_patterns = this.extractFilePatterns(content);
    const token_estimate = Math.ceil(content.length / 4);

    return {
      session_id: session.id,
      session_type: type,
      title,
      summary,
      keywords,
      token_estimate,
      file_patterns,
      created_at,
      last_accessed: new Date().toISOString(),
      access_count: 0
    };
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    const keywords = new Set<string>();

    // 1. File paths (src/xxx, .ts, .js, etc)
    const filePathRegex = /(?:^|\s|["'`])((?:\.\/|\.\.\/|\/)?[\w-]+(?:\/[\w-]+)*\.[\w]+)(?:\s|["'`]|$)/g;
    let match;
    while ((match = filePathRegex.exec(content)) !== null) {
      keywords.add(match[1]);
    }

    // 2. Function/Class names (camelCase, PascalCase)
    const camelCaseRegex = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+[A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/g;
    while ((match = camelCaseRegex.exec(content)) !== null) {
      keywords.add(match[1]);
    }

    // 3. Technical terms (common frameworks/libraries/concepts)
    const techTerms = [
      // Frameworks
      'react', 'vue', 'angular', 'typescript', 'javascript', 'node', 'express',
      // Auth
      'auth', 'authentication', 'jwt', 'oauth', 'session', 'token',
      // Data
      'api', 'rest', 'graphql', 'database', 'sql', 'mongodb', 'redis',
      // Testing
      'test', 'testing', 'jest', 'mocha', 'vitest',
      // Development
      'refactor', 'refactoring', 'optimization', 'performance',
      'bug', 'fix', 'error', 'issue', 'debug',
      // CCW-specific terms
      'cluster', 'clustering', 'memory', 'hook', 'service', 'context',
      'workflow', 'skill', 'prompt', 'embedding', 'vector', 'semantic',
      'dashboard', 'view', 'route', 'command', 'cli', 'mcp'
    ];

    const lowerContent = content.toLowerCase();
    for (const term of techTerms) {
      if (lowerContent.includes(term)) {
        keywords.add(term);
      }
    }

    // 4. Generic word extraction (words >= 4 chars, not stopwords)
    const stopwords = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'will',
      'are', 'was', 'were', 'been', 'being', 'what', 'when', 'where', 'which',
      'there', 'their', 'they', 'them', 'then', 'than', 'into', 'some', 'such',
      'only', 'also', 'just', 'more', 'most', 'other', 'after', 'before'
    ]);

    const wordRegex = /\b([a-z]{4,})\b/g;
    let wordMatch;
    while ((wordMatch = wordRegex.exec(lowerContent)) !== null) {
      const word = wordMatch[1];
      if (!stopwords.has(word)) {
        keywords.add(word);
      }
    }

    // Return top 20 keywords
    return Array.from(keywords).slice(0, 20);
  }

  /**
   * Extract file patterns from content
   */
  private extractFilePatterns(content: string): string[] {
    const patterns = new Set<string>();

    // Extract directory patterns (src/xxx/, lib/xxx/)
    const dirRegex = /\b((?:src|lib|test|dist|build|public|components|utils|services|config|core|tools)(?:\/[\w-]+)*)\//g;
    let match;
    while ((match = dirRegex.exec(content)) !== null) {
      patterns.add(match[1] + '/**');
    }

    // Extract file extension patterns
    const extRegex = /\.(\w+)(?:\s|$|["'`])/g;
    const extensions = new Set<string>();
    while ((match = extRegex.exec(content)) !== null) {
      extensions.add(match[1]);
    }

    // Add extension patterns
    if (extensions.size > 0) {
      patterns.add(`**/*.{${Array.from(extensions).join(',')}}`);
    }

    return Array.from(patterns).slice(0, 10);
  }

  /**
   * Calculate relevance score between two sessions
   */
  calculateRelevance(session1: SessionMetadataCache, session2: SessionMetadataCache): number {
    const fileScore = this.calculateFileOverlap(session1, session2);
    const temporalScore = this.calculateTemporalProximity(session1, session2);
    const keywordScore = this.calculateSemanticSimilarity(session1, session2);
    const vectorScore = this.calculateVectorSimilarity(session1, session2);
    const intentScore = this.calculateIntentAlignment(session1, session2);

    return (
      fileScore * WEIGHTS.fileOverlap +
      temporalScore * WEIGHTS.temporalProximity +
      keywordScore * WEIGHTS.keywordSimilarity +
      vectorScore * WEIGHTS.vectorSimilarity +
      intentScore * WEIGHTS.intentAlignment
    );
  }

  /**
   * Calculate file path overlap score (Jaccard similarity)
   */
  private calculateFileOverlap(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    const files1 = new Set(s1.file_patterns || []);
    const files2 = new Set(s2.file_patterns || []);

    if (files1.size === 0 || files2.size === 0) return 0;

    const intersection = new Set([...files1].filter(f => files2.has(f)));
    const union = new Set([...files1, ...files2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate temporal proximity score
   * 24h: 1.0, 7d: 0.7, 30d: 0.4, >30d: 0.1
   */
  private calculateTemporalProximity(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    if (!s1.created_at || !s2.created_at) return 0.1;

    const t1 = new Date(s1.created_at).getTime();
    const t2 = new Date(s2.created_at).getTime();
    const diffMs = Math.abs(t1 - t2);
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 24) return 1.0;
    if (diffHours <= 24 * 7) return 0.7;
    if (diffHours <= 24 * 30) return 0.4;
    return 0.1;
  }

  /**
   * Calculate semantic similarity using keyword overlap (Jaccard similarity)
   */
  private calculateSemanticSimilarity(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    const kw1 = new Set(s1.keywords || []);
    const kw2 = new Set(s2.keywords || []);

    if (kw1.size === 0 || kw2.size === 0) return 0;

    const intersection = new Set([...kw1].filter(k => kw2.has(k)));
    const union = new Set([...kw1, ...kw2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate intent alignment score
   * Based on title/summary keyword matching
   */
  private calculateIntentAlignment(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    const text1 = ((s1.title || '') + ' ' + (s1.summary || '')).toLowerCase();
    const text2 = ((s2.title || '') + ' ' + (s2.summary || '')).toLowerCase();

    if (!text1 || !text2) return 0;

    // Simple word-based TF-IDF approximation
    const words1 = text1.split(/\s+/).filter(w => w.length > 3);
    const words2 = text2.split(/\s+/).filter(w => w.length > 3);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(w => set2.has(w)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate vector similarity using HNSW index when available.
   * Falls back to direct cosine similarity on pre-computed embeddings from memory_chunks.
   *
   * HNSW path: Uses cached neighbor lookup from vectorNeighborCache (populated by
   * preloadVectorNeighbors). This replaces the O(N) full-table scan with O(1) cache lookup.
   *
   * Fallback path: Averages chunk embeddings from SQLite and computes cosine similarity directly.
   */
  private calculateVectorSimilarity(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    // HNSW path: check if we have pre-loaded neighbor scores
    const neighbors1 = this.vectorNeighborCache.get(s1.session_id);
    if (neighbors1) {
      const score = neighbors1.get(s2.session_id);
      if (score !== undefined) return score;
      // s2 is not a neighbor of s1 via HNSW - low similarity
      return 0;
    }

    // Also check reverse direction
    const neighbors2 = this.vectorNeighborCache.get(s2.session_id);
    if (neighbors2) {
      const score = neighbors2.get(s1.session_id);
      if (score !== undefined) return score;
      return 0;
    }

    // Fallback: direct cosine similarity on chunk embeddings
    const embedding1 = this.getSessionEmbedding(s1.session_id);
    const embedding2 = this.getSessionEmbedding(s2.session_id);

    if (!embedding1 || !embedding2) {
      return 0;
    }

    return this.cosineSimilarity(embedding1, embedding2);
  }

  /**
   * Preload vector neighbors for a set of sessions using HNSW search.
   * For each session, gets its average embedding and searches for nearby chunks,
   * then aggregates scores by source_id to get session-level similarity scores.
   *
   * This replaces the O(N^2) full-table scan with O(N * topK) HNSW lookups.
   */
  async preloadVectorNeighbors(sessionIds: string[], topK: number = 20): Promise<void> {
    if (!this.vectorIndex) return;

    this.vectorNeighborCache.clear();

    for (const sessionId of sessionIds) {
      const avgEmbedding = this.getSessionEmbedding(sessionId);
      if (!avgEmbedding) continue;

      try {
        const result = await this.vectorIndex.searchByVector(avgEmbedding, {
          topK,
          minScore: 0.1,
        });

        if (!result.success || !result.matches.length) continue;

        // Aggregate scores by source_id (session-level similarity)
        const neighborScores = new Map<string, number[]>();
        for (const match of result.matches) {
          const sourceId = match.source_id;
          if (sourceId === sessionId) continue; // skip self
          if (!neighborScores.has(sourceId)) {
            neighborScores.set(sourceId, []);
          }
          neighborScores.get(sourceId)!.push(match.score);
        }

        // Average scores per neighbor session
        const avgScores = new Map<string, number>();
        for (const [neighborId, scores] of neighborScores) {
          const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          avgScores.set(neighborId, avg);
        }

        this.vectorNeighborCache.set(sessionId, avgScores);
      } catch {
        // HNSW search failed for this session, skip
      }
    }
  }

  /**
   * Get session embedding by averaging all chunk embeddings
   */
  private getSessionEmbedding(sessionId: string): number[] | null {
    const chunks = this.coreMemoryStore.getChunks(sessionId);

    if (chunks.length === 0) {
      return null;
    }

    // Filter chunks that have embeddings
    const embeddedChunks = chunks.filter(chunk => chunk.embedding && chunk.embedding.length > 0);

    if (embeddedChunks.length === 0) {
      return null;
    }

    // Convert Buffer embeddings to number arrays and calculate average
    const embeddings = embeddedChunks.map(chunk => {
      // Convert Buffer to Float32Array
      const buffer = chunk.embedding!;
      const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
      return Array.from(float32Array);
    });

    // Check all embeddings have same dimension
    const dimension = embeddings[0].length;
    if (!embeddings.every(emb => emb.length === dimension)) {
      console.warn(`[VectorSimilarity] Inconsistent embedding dimensions for session ${sessionId}`);
      return null;
    }

    // Calculate average embedding
    const avgEmbedding = new Array(dimension).fill(0);
    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        avgEmbedding[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      avgEmbedding[i] /= embeddings.length;
    }

    return avgEmbedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn('[VectorSimilarity] Vector dimension mismatch');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Find the most relevant existing cluster for a set of session IDs
   * Returns the cluster with highest session overlap
   */
  private findExistingClusterForSessions(sessionIds: string[]): SessionCluster | null {
    if (sessionIds.length === 0) return null;

    const clusterCounts = new Map<string, number>();
    let maxCount = 0;
    let bestClusterId: string | null = null;

    for (const sessionId of sessionIds) {
      const clusters = this.coreMemoryStore.getSessionClusters(sessionId);
      for (const cluster of clusters) {
        if (cluster.status !== 'active') continue;

        const count = (clusterCounts.get(cluster.id) || 0) + 1;
        clusterCounts.set(cluster.id, count);

        if (count > maxCount) {
          maxCount = count;
          bestClusterId = cluster.id;
        }
      }
    }

    if (bestClusterId) {
      return this.coreMemoryStore.getCluster(bestClusterId);
    }
    return null;
  }

  /**
   * Determine if a new cluster should merge with an existing one
   * Based on 70% session overlap threshold
   */
  private shouldMergeWithExisting(newClusterSessions: SessionMetadataCache[], existingCluster: SessionCluster): boolean {
    const MERGE_THRESHOLD = 0.7;

    const existingMembers = this.coreMemoryStore.getClusterMembers(existingCluster.id);
    const newSessionIds = new Set(newClusterSessions.map(s => s.session_id));
    const existingSessionIds = new Set(existingMembers.map(m => m.session_id));

    if (newSessionIds.size === 0) return false;

    const intersection = new Set([...newSessionIds].filter(id => existingSessionIds.has(id)));
    const overlapRatio = intersection.size / newSessionIds.size;

    return overlapRatio > MERGE_THRESHOLD;
  }

  /**
   * Run auto-clustering algorithm
   * Optimized to prevent duplicate clusters by checking existing clusters first
   */
  async autocluster(options?: ClusteringOptions): Promise<ClusteringResult> {
    // 1. Collect sessions based on user-specified scope (default: 'recent')
    const allSessions = await this.collectSessions(options);
    console.log(`[Clustering] Collected ${allSessions.length} sessions (scope: ${options?.scope || 'recent'})`);

    // 2. Filter out already-clustered sessions to prevent duplicates
    const sessions = allSessions.filter(s => {
      const clusters = this.coreMemoryStore.getSessionClusters(s.session_id);
      return clusters.length === 0;
    });
    console.log(`[Clustering] ${sessions.length} unclustered sessions after filtering`);

    // 3. Update metadata cache
    for (const session of sessions) {
      this.coreMemoryStore.upsertSessionMetadata(session);
    }

    // 4. Preload HNSW vector neighbors for efficient similarity calculation
    if (this.vectorIndex) {
      const sessionIds = sessions.map(s => s.session_id);
      await this.preloadVectorNeighbors(sessionIds);
      console.log(`[Clustering] Preloaded HNSW vector neighbors for ${sessionIds.length} sessions`);
    }

    // 5. Calculate relevance matrix
    const n = sessions.length;
    const relevanceMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));    let maxScore = 0;
    let avgScore = 0;
    let pairCount = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const score = this.calculateRelevance(sessions[i], sessions[j]);
        relevanceMatrix[i][j] = score;
        relevanceMatrix[j][i] = score;

        if (score > maxScore) maxScore = score;
        avgScore += score;
        pairCount++;
      }
    }

    if (pairCount > 0) {
      avgScore = avgScore / pairCount;
      console.log(`[Clustering] Relevance stats: max=${maxScore.toFixed(3)}, avg=${avgScore.toFixed(3)}, pairs=${pairCount}, threshold=${CLUSTER_THRESHOLD}`);
    }

    // 6. Agglomerative clustering
    const minClusterSize = options?.minClusterSize || 2;

    // Early return if not enough sessions
    if (sessions.length < minClusterSize) {
      console.log('[Clustering] Not enough unclustered sessions to form new clusters');
      return { clustersCreated: 0, sessionsProcessed: allSessions.length, sessionsClustered: 0 };
    }

    const newPotentialClusters = this.agglomerativeClustering(sessions, relevanceMatrix, CLUSTER_THRESHOLD);
    console.log(`[Clustering] Generated ${newPotentialClusters.length} potential clusters`);

    // 7. Process clusters: create new or merge with existing
    let clustersCreated = 0;
    let clustersMerged = 0;
    let sessionsClustered = 0;

    for (const clusterSessions of newPotentialClusters) {
      if (clusterSessions.length < minClusterSize) {
        continue; // Skip small clusters
      }

      const sessionIds = clusterSessions.map(s => s.session_id);
      const existingCluster = this.findExistingClusterForSessions(sessionIds);

      // Check if we should merge with an existing cluster
      if (existingCluster && this.shouldMergeWithExisting(clusterSessions, existingCluster)) {
        const existingMembers = this.coreMemoryStore.getClusterMembers(existingCluster.id);
        const existingSessionIds = new Set(existingMembers.map(m => m.session_id));

        // Only add sessions not already in the cluster
        const newSessions = clusterSessions.filter(s => !existingSessionIds.has(s.session_id));

        if (newSessions.length > 0) {
          newSessions.forEach((session, index) => {
            this.coreMemoryStore.addClusterMember({
              cluster_id: existingCluster.id,
              session_id: session.session_id,
              session_type: session.session_type as 'core_memory' | 'workflow' | 'cli_history' | 'native',
              sequence_order: existingMembers.length + index + 1,
              relevance_score: 1.0
            });
          });

          // Update cluster description
          this.coreMemoryStore.updateCluster(existingCluster.id, {
            description: `Auto-generated cluster with ${existingMembers.length + newSessions.length} sessions`
          });

          clustersMerged++;
          sessionsClustered += newSessions.length;
          console.log(`[Clustering] Merged ${newSessions.length} sessions into existing cluster '${existingCluster.name}'`);
        }
      } else {
        // Create new cluster
        const clusterName = this.generateClusterName(clusterSessions);
        const clusterIntent = this.generateClusterIntent(clusterSessions);

        const clusterRecord = this.coreMemoryStore.createCluster({
          name: clusterName,
          description: `Auto-generated cluster with ${clusterSessions.length} sessions`,
          intent: clusterIntent,
          status: 'active'
        });

        // Add members
        clusterSessions.forEach((session, index) => {
          this.coreMemoryStore.addClusterMember({
            cluster_id: clusterRecord.id,
            session_id: session.session_id,
            session_type: session.session_type as 'core_memory' | 'workflow' | 'cli_history' | 'native',
            sequence_order: index + 1,
            relevance_score: 1.0
          });
        });

        clustersCreated++;
        sessionsClustered += clusterSessions.length;
      }
    }

    console.log(`[Clustering] Summary: ${clustersCreated} created, ${clustersMerged} merged, ${allSessions.length - sessions.length} already clustered`);

    return {
      clustersCreated,
      sessionsProcessed: allSessions.length,
      sessionsClustered
    };
  }

  /**
   * Deduplicate clusters by merging similar ones
   * Clusters with same name or >50% member overlap are merged
   * @returns Statistics about deduplication
   */
  async deduplicateClusters(): Promise<{ merged: number; deleted: number; remaining: number }> {
    const clusters = this.coreMemoryStore.listClusters('active');
    console.log(`[Dedup] Analyzing ${clusters.length} active clusters`);

    if (clusters.length < 2) {
      return { merged: 0, deleted: 0, remaining: clusters.length };
    }

    // Group clusters by name (case-insensitive)
    const byName = new Map<string, typeof clusters>();
    for (const cluster of clusters) {
      const key = cluster.name.toLowerCase().trim();
      if (!byName.has(key)) {
        byName.set(key, []);
      }
      byName.get(key)!.push(cluster);
    }

    let merged = 0;
    let deleted = 0;

    // Merge clusters with same name
    for (const [name, group] of byName) {
      if (group.length < 2) continue;

      // Sort by created_at (oldest first) to keep the original
      group.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const target = group[0];
      const sources = group.slice(1).map(c => c.id);

      console.log(`[Dedup] Merging ${sources.length} duplicate clusters named '${name}' into ${target.id}`);

      try {
        const membersMoved = this.coreMemoryStore.mergeClusters(target.id, sources);
        merged += sources.length;
        console.log(`[Dedup] Moved ${membersMoved} members, deleted ${sources.length} clusters`);
      } catch (error) {
        console.warn(`[Dedup] Failed to merge: ${(error as Error).message}`);
      }
    }

    // Check for clusters with high member overlap
    const remainingClusters = this.coreMemoryStore.listClusters('active');
    const clusterMembers = new Map<string, Set<string>>();

    for (const cluster of remainingClusters) {
      const members = this.coreMemoryStore.getClusterMembers(cluster.id);
      clusterMembers.set(cluster.id, new Set(members.map(m => m.session_id)));
    }

    // Find and merge overlapping clusters
    const processed = new Set<string>();
    for (let i = 0; i < remainingClusters.length; i++) {
      const clusterA = remainingClusters[i];
      if (processed.has(clusterA.id)) continue;

      const membersA = clusterMembers.get(clusterA.id)!;
      const toMerge: string[] = [];

      for (let j = i + 1; j < remainingClusters.length; j++) {
        const clusterB = remainingClusters[j];
        if (processed.has(clusterB.id)) continue;

        const membersB = clusterMembers.get(clusterB.id)!;
        const intersection = new Set([...membersA].filter(m => membersB.has(m)));

        // Calculate overlap ratio (based on smaller cluster)
        const minSize = Math.min(membersA.size, membersB.size);
        if (minSize > 0 && intersection.size / minSize >= 0.5) {
          toMerge.push(clusterB.id);
          processed.add(clusterB.id);
        }
      }

      if (toMerge.length > 0) {
        console.log(`[Dedup] Merging ${toMerge.length} overlapping clusters into ${clusterA.id}`);
        try {
          this.coreMemoryStore.mergeClusters(clusterA.id, toMerge);
          merged += toMerge.length;
        } catch (error) {
          console.warn(`[Dedup] Failed to merge overlapping: ${(error as Error).message}`);
        }
      }
    }

    // Delete empty clusters
    const finalClusters = this.coreMemoryStore.listClusters('active');
    for (const cluster of finalClusters) {
      const members = this.coreMemoryStore.getClusterMembers(cluster.id);
      if (members.length === 0) {
        this.coreMemoryStore.deleteCluster(cluster.id);
        deleted++;
        console.log(`[Dedup] Deleted empty cluster: ${cluster.id}`);
      }
    }

    const remaining = this.coreMemoryStore.listClusters('active').length;
    console.log(`[Dedup] Complete: ${merged} merged, ${deleted} deleted, ${remaining} remaining`);

    return { merged, deleted, remaining };
  }

  /**
   * Check whether clustering should run based on frequency control.
   * Conditions: last clustering > MIN_CLUSTER_INTERVAL_HOURS ago AND
   * new unclustered sessions >= MIN_NEW_SESSIONS_FOR_CLUSTER.
   *
   * Stores last_cluster_time in session_clusters metadata.
   */
  async shouldRunClustering(): Promise<boolean> {
    // Check last cluster time from cluster metadata
    const clusters = this.coreMemoryStore.listClusters('active');
    let lastClusterTime = 0;

    for (const cluster of clusters) {
      const createdMs = new Date(cluster.created_at).getTime();
      if (createdMs > lastClusterTime) {
        lastClusterTime = createdMs;
      }
      const updatedMs = new Date(cluster.updated_at).getTime();
      if (updatedMs > lastClusterTime) {
        lastClusterTime = updatedMs;
      }
    }

    // Check time interval
    const now = Date.now();
    const hoursSinceLastCluster = (now - lastClusterTime) / (1000 * 60 * 60);
    if (lastClusterTime > 0 && hoursSinceLastCluster < MIN_CLUSTER_INTERVAL_HOURS) {
      return false;
    }

    // Check number of unclustered sessions
    const allSessions = await this.collectSessions({ scope: 'recent' });
    const unclusteredCount = allSessions.filter(s => {
      const sessionClusters = this.coreMemoryStore.getSessionClusters(s.session_id);
      return sessionClusters.length === 0;
    }).length;

    return unclusteredCount >= MIN_NEW_SESSIONS_FOR_CLUSTER;
  }

  /**
   * Incremental clustering: process only a single new session.
   *
   * Computes the new session's similarity against existing cluster centroids
   * using HNSW search. If similarity >= CLUSTER_THRESHOLD, joins the best
   * matching cluster. Otherwise, remains unclustered until enough sessions
   * accumulate for a new cluster.
   *
   * @param sessionId - The session to incrementally cluster
   * @returns Result indicating what action was taken
   */
  async incrementalCluster(sessionId: string): Promise<IncrementalClusterResult> {
    // Get or create session metadata
    let sessionMeta = this.coreMemoryStore.getSessionMetadata(sessionId);
    if (!sessionMeta) {
      // Try to build metadata from available sources
      const allSessions = await this.collectSessions({ scope: 'all' });
      sessionMeta = allSessions.find(s => s.session_id === sessionId) || null;

      if (!sessionMeta) {
        return { sessionId, clusterId: null, action: 'skipped' };
      }
      this.coreMemoryStore.upsertSessionMetadata(sessionMeta);
    }

    // Check if already clustered
    const existingClusters = this.coreMemoryStore.getSessionClusters(sessionId);
    if (existingClusters.length > 0) {
      return { sessionId, clusterId: existingClusters[0].id, action: 'skipped' };
    }

    // Get all active clusters and their representative sessions
    const activeClusters = this.coreMemoryStore.listClusters('active');

    if (activeClusters.length === 0) {
      return { sessionId, clusterId: null, action: 'skipped' };
    }

    // Use HNSW to find nearest neighbors for the new session
    if (this.vectorIndex) {
      await this.preloadVectorNeighbors([sessionId]);
    }

    // Calculate similarity against each cluster's member sessions
    let bestCluster: SessionCluster | null = null;
    let bestScore = 0;

    for (const cluster of activeClusters) {
      const members = this.coreMemoryStore.getClusterMembers(cluster.id);
      if (members.length === 0) continue;

      // Calculate average relevance against cluster members (sample up to 5)
      const sampleMembers = members.slice(0, 5);
      let totalScore = 0;
      let validCount = 0;

      for (const member of sampleMembers) {
        const memberMeta = this.coreMemoryStore.getSessionMetadata(member.session_id);
        if (!memberMeta) continue;

        const score = this.calculateRelevance(sessionMeta, memberMeta);
        totalScore += score;
        validCount++;
      }

      if (validCount === 0) continue;

      const avgScore = totalScore / validCount;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestCluster = cluster;
      }
    }

    // Join best cluster if above threshold
    if (bestCluster && bestScore >= CLUSTER_THRESHOLD) {
      const existingMembers = this.coreMemoryStore.getClusterMembers(bestCluster.id);

      this.coreMemoryStore.addClusterMember({
        cluster_id: bestCluster.id,
        session_id: sessionId,
        session_type: sessionMeta.session_type as 'core_memory' | 'workflow' | 'cli_history' | 'native',
        sequence_order: existingMembers.length + 1,
        relevance_score: bestScore,
      });

      // Update cluster description
      this.coreMemoryStore.updateCluster(bestCluster.id, {
        description: `Auto-generated cluster with ${existingMembers.length + 1} sessions`
      });

      console.log(`[Clustering] Session ${sessionId} joined cluster '${bestCluster.name}' (score: ${bestScore.toFixed(3)})`);
      return { sessionId, clusterId: bestCluster.id, action: 'joined_existing' };
    }

    // Not similar enough to any existing cluster
    return { sessionId, clusterId: null, action: 'skipped' };
  }

  /**
   * Agglomerative clustering algorithm
   * Returns array of clusters (each cluster is array of sessions)
   */
  private agglomerativeClustering(
    sessions: SessionMetadataCache[],
    relevanceMatrix: number[][],
    threshold: number
  ): SessionMetadataCache[][] {
    const n = sessions.length;

    // Initialize: each session is its own cluster
    const clusters: Set<number>[] = sessions.map((_, i) => new Set([i]));

    while (true) {
      let maxScore = -1;
      let mergeI = -1;
      let mergeJ = -1;

      // Find pair of clusters with highest average linkage
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const score = this.averageLinkage(clusters[i], clusters[j], relevanceMatrix);
          if (score > maxScore) {
            maxScore = score;
            mergeI = i;
            mergeJ = j;
          }
        }
      }

      // Stop if no pair exceeds threshold
      if (maxScore < threshold) break;

      // Merge clusters
      const merged = new Set([...clusters[mergeI], ...clusters[mergeJ]]);
      clusters.splice(mergeJ, 1); // Remove j first (higher index)
      clusters.splice(mergeI, 1);
      clusters.push(merged);
    }

    // Convert cluster indices to sessions
    return clusters.map(cluster =>
      Array.from(cluster).map(i => sessions[i])
    );
  }

  /**
   * Calculate average linkage between two clusters
   */
  private averageLinkage(
    cluster1: Set<number>,
    cluster2: Set<number>,
    relevanceMatrix: number[][]
  ): number {
    let sum = 0;
    let count = 0;

    for (const i of cluster1) {
      for (const j of cluster2) {
        sum += relevanceMatrix[i][j];
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Generate cluster name from members
   */
  private generateClusterName(members: SessionMetadataCache[]): string {
    // Count keyword frequency
    const keywordFreq = new Map<string, number>();
    for (const member of members) {
      for (const keyword of member.keywords || []) {
        keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
      }
    }

    // Get top 2 keywords
    const sorted = Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw);

    if (sorted.length >= 2) {
      return `${sorted[0]}-${sorted[1]}`;
    } else if (sorted.length === 1) {
      return sorted[0];
    } else {
      return 'unnamed-cluster';
    }
  }

  /**
   * Generate cluster intent from members
   */
  private generateClusterIntent(members: SessionMetadataCache[]): string {
    // Extract common action words from titles
    const actionWords = ['implement', 'refactor', 'fix', 'add', 'create', 'update', 'optimize'];
    const titles = members.map(m => (m.title || '').toLowerCase());

    for (const action of actionWords) {
      const count = titles.filter(t => t.includes(action)).length;
      if (count >= members.length / 2) {
        const topic = this.generateClusterName(members);
        return `${action.charAt(0).toUpperCase() + action.slice(1)} ${topic}`;
      }
    }

    return `Work on ${this.generateClusterName(members)}`;
  }

  /**
   * Get progressive disclosure index for hook
   * @param options - Configuration options
   * @param options.type - 'session-start' returns recent sessions, 'context' returns intent-matched sessions
   * @param options.sessionId - Current session ID (optional)
   * @param options.prompt - User prompt for intent matching (required for 'context' type)
   */
  async getProgressiveIndex(options: {
    type: 'session-start' | 'context';
    sessionId?: string;
    prompt?: string;
  }): Promise<string> {
    const { type, sessionId, prompt } = options;

    // For session-start: return recent sessions by time
    if (type === 'session-start') {
      return this.getRecentSessionsIndex();
    }

    // For context: return intent-matched sessions based on prompt
    if (type === 'context' && prompt) {
      return this.getIntentMatchedIndex(prompt, sessionId);
    }

    // Fallback to recent sessions
    return this.getRecentSessionsIndex();
  }

  /**
   * Get recent sessions index (for session-start)
   * Shows sessions grouped by clusters with progressive disclosure
   */
  private async getRecentSessionsIndex(): Promise<string> {
    // 1. Get all active clusters
    const allClusters = this.coreMemoryStore.listClusters('active');

    // Sort clusters by most recent activity (based on member last_accessed)
    const clustersWithActivity = allClusters.map(cluster => {
      const members = this.coreMemoryStore.getClusterMembers(cluster.id);
      const memberMetadata = members
        .map(m => this.coreMemoryStore.getSessionMetadata(m.session_id))
        .filter((m): m is SessionMetadataCache => m !== null);

      const lastActivity = memberMetadata.reduce((latest, m) => {
        const accessed = m.last_accessed || m.created_at || '';
        return accessed > latest ? accessed : latest;
      }, '');

      return { cluster, members, memberMetadata, lastActivity };
    }).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

    // 2. Get unclustered recent sessions
    const allSessions = await this.collectSessions({ scope: 'recent' });
    const clusteredSessionIds = new Set<string>();
    clustersWithActivity.forEach(c => {
      c.members.forEach(m => clusteredSessionIds.add(m.session_id));
    });

    const unclusteredSessions = allSessions
      .filter(s => !clusteredSessionIds.has(s.session_id))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 3);

    // 3. Build output
    let output = `<ccw-session-context>\n## 📋 Session Context (Progressive Disclosure)\n\n`;

    // Show top 2 active clusters
    const topClusters = clustersWithActivity.slice(0, 2);
    if (topClusters.length > 0) {
      output += `### 🔗 Active Clusters\n\n`;

      for (const { cluster, memberMetadata } of topClusters) {
        output += `**${cluster.name}** (${memberMetadata.length} sessions)\n`;
        if (cluster.intent) {
          output += `> Intent: ${cluster.intent}\n`;
        }
        output += `\n| Session | Type | Title |\n|---------|------|-------|\n`;

        // Show top 3 members per cluster
        const displayMembers = memberMetadata.slice(0, 3);
        for (const m of displayMembers) {
          const type = m.session_type === 'core_memory' ? 'Core' :
                       m.session_type === 'workflow' ? 'Workflow' : 'CLI';
          const title = (m.title || '').substring(0, 35);
          output += `| ${m.session_id} | ${type} | ${title} |\n`;
        }

        if (memberMetadata.length > 3) {
          output += `| ... | ... | +${memberMetadata.length - 3} more |\n`;
        }
        output += `\n`;
      }
    }

    // Show unclustered recent sessions
    if (unclusteredSessions.length > 0) {
      output += `### 📝 Recent Sessions (Unclustered)\n\n`;
      output += `| Session | Type | Title | Date |\n`;
      output += `|---------|------|-------|------|\n`;

      for (const s of unclusteredSessions) {
        const type = s.session_type === 'core_memory' ? 'Core' :
                     s.session_type === 'workflow' ? 'Workflow' : 'CLI';
        const title = (s.title || '').substring(0, 30);
        const date = s.created_at ? new Date(s.created_at).toLocaleDateString() : '';
        output += `| ${s.session_id} | ${type} | ${title} | ${date} |\n`;
      }
      output += `\n`;
    }

    // If nothing found
    if (topClusters.length === 0 && unclusteredSessions.length === 0) {
      output += `No recent sessions found. Start a new workflow to begin tracking.\n\n`;
    }

    // Add MCP tools reference
    const topSession = topClusters[0]?.memberMetadata[0] || unclusteredSessions[0];
    const topClusterId = topClusters[0]?.cluster.id;

    output += `**MCP Tools**:\n\`\`\`\n`;
    if (topSession) {
      output += `# Resume session\nmcp__ccw-tools__core_memory({ "operation": "export", "id": "${topSession.session_id}" })\n\n`;
    }
    if (topClusterId) {
      output += `# Load cluster context\nmcp__ccw-tools__core_memory({ "operation": "search", "query": "cluster:${topClusterId}" })\n`;
    }
    output += `\`\`\`\n</ccw-session-context>`;

    return output;
  }

  /**
   * Get intent-matched sessions index (for context with prompt)
   * Shows sessions grouped by clusters and ranked by relevance
   */
  private async getIntentMatchedIndex(prompt: string, sessionId?: string): Promise<string> {
    const sessions = await this.collectSessions({ scope: 'all' });

    if (sessions.length === 0) {
      return `<ccw-session-context>
## 📋 Related Sessions

No sessions available for intent matching.
</ccw-session-context>`;
    }

    // Create a virtual session from the prompt for similarity calculation
    const promptSession: SessionMetadataCache = {
      session_id: 'prompt-virtual',
      session_type: 'native',
      title: prompt.substring(0, 100),
      summary: prompt.substring(0, 200),
      keywords: this.extractKeywords(prompt),
      token_estimate: Math.ceil(prompt.length / 4),
      file_patterns: this.extractFilePatterns(prompt),
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      access_count: 0
    };

    // Build session-to-cluster mapping
    const sessionClusterMap = new Map<string, SessionCluster[]>();
    const allClusters = this.coreMemoryStore.listClusters('active');
    for (const cluster of allClusters) {
      const members = this.coreMemoryStore.getClusterMembers(cluster.id);
      for (const member of members) {
        const existing = sessionClusterMap.get(member.session_id) || [];
        existing.push(cluster);
        sessionClusterMap.set(member.session_id, existing);
      }
    }

    // Calculate relevance scores for all sessions
    const scoredSessions = sessions
      .filter(s => s.session_id !== sessionId) // Exclude current session
      .map(s => ({
        session: s,
        score: this.calculateRelevance(promptSession, s),
        clusters: sessionClusterMap.get(s.session_id) || []
      }))
      .filter(item => item.score >= 0.15) // Minimum relevance threshold (lowered for file-path-based keywords)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Top 8 relevant sessions

    if (scoredSessions.length === 0) {
      return `<ccw-session-context>
## 📋 Related Sessions

No sessions match current intent. Consider:
- Starting fresh with a new approach
- Using \`search\` to find sessions by keyword

**MCP Tools**:
\`\`\`
mcp__ccw-tools__core_memory({ "operation": "search", "query": "<keyword>" })
\`\`\`
</ccw-session-context>`;
    }

    // Group sessions by cluster
    const clusterGroups = new Map<string, { cluster: SessionCluster; sessions: typeof scoredSessions }>();
    const unclusteredSessions: typeof scoredSessions = [];

    for (const item of scoredSessions) {
      if (item.clusters.length > 0) {
        // Add to the highest-priority cluster
        const primaryCluster = item.clusters[0];
        const existing = clusterGroups.get(primaryCluster.id) || { cluster: primaryCluster, sessions: [] };
        existing.sessions.push(item);
        clusterGroups.set(primaryCluster.id, existing);
      } else {
        unclusteredSessions.push(item);
      }
    }

    // Sort cluster groups by best session score
    const sortedGroups = Array.from(clusterGroups.values())
      .sort((a, b) => Math.max(...b.sessions.map(s => s.score)) - Math.max(...a.sessions.map(s => s.score)));

    // Generate output
    let output = `<ccw-session-context>\n## 📋 Intent-Matched Sessions\n\n`;
    output += `**Detected Intent**: ${(promptSession.keywords || []).slice(0, 5).join(', ') || 'General'}\n\n`;

    // Show clustered sessions
    if (sortedGroups.length > 0) {
      output += `### 🔗 Matched Clusters\n\n`;

      for (const { cluster, sessions: clusterSessions } of sortedGroups.slice(0, 2)) {
        const avgScore = Math.round(clusterSessions.reduce((sum, s) => sum + s.score, 0) / clusterSessions.length * 100);
        output += `**${cluster.name}** (${avgScore}% avg match)\n`;
        if (cluster.intent) {
          output += `> ${cluster.intent}\n`;
        }
        output += `\n| Session | Match | Title |\n|---------|-------|-------|\n`;

        for (const item of clusterSessions.slice(0, 3)) {
          const matchPct = Math.round(item.score * 100);
          const title = (item.session.title || '').substring(0, 35);
          output += `| ${item.session.session_id} | ${matchPct}% | ${title} |\n`;
        }
        output += `\n`;
      }
    }

    // Show unclustered sessions
    if (unclusteredSessions.length > 0) {
      output += `### 📝 Individual Matches\n\n`;
      output += `| Session | Type | Match | Title |\n`;
      output += `|---------|------|-------|-------|\n`;

      for (const item of unclusteredSessions.slice(0, 4)) {
        const type = item.session.session_type === 'core_memory' ? 'Core' :
                     item.session.session_type === 'workflow' ? 'Workflow' : 'CLI';
        const matchPct = Math.round(item.score * 100);
        const title = (item.session.title || '').substring(0, 30);
        output += `| ${item.session.session_id} | ${type} | ${matchPct}% | ${title} |\n`;
      }
      output += `\n`;
    }

    // Add MCP tools reference
    const topSession = scoredSessions[0];
    const topCluster = sortedGroups[0]?.cluster;

    output += `**MCP Tools**:\n\`\`\`\n`;
    output += `# Resume top match\nmcp__ccw-tools__core_memory({ "operation": "export", "id": "${topSession.session.session_id}" })\n`;
    if (topCluster) {
      output += `\n# Load cluster context\nmcp__ccw-tools__core_memory({ "operation": "search", "query": "cluster:${topCluster.id}" })\n`;
    }
    output += `\`\`\`\n</ccw-session-context>`;

    return output;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getProgressiveIndex({ type, sessionId, prompt }) instead
   */
  async getProgressiveIndexLegacy(sessionId?: string): Promise<string> {
    let activeCluster: SessionCluster | null = null;
    let members: SessionMetadataCache[] = [];

    if (sessionId) {
      const clusters = this.coreMemoryStore.getSessionClusters(sessionId);
      if (clusters.length > 0) {
        activeCluster = clusters[0];
        const clusterMembers = this.coreMemoryStore.getClusterMembers(activeCluster.id);
        members = clusterMembers
          .map(m => this.coreMemoryStore.getSessionMetadata(m.session_id))
          .filter((m): m is SessionMetadataCache => m !== null)
          .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      }
    }

    if (!activeCluster || members.length === 0) {
      return `<ccw-session-context>
## 📋 Related Sessions Index

No active cluster found. Start a new workflow or continue from recent sessions.

**MCP Tools**:
\`\`\`
# Search sessions
Use tool: mcp__ccw-tools__core_memory
Parameters: { "action": "search", "query": "<keyword>" }

# Trigger clustering
Parameters: { "action": "cluster", "scope": "auto" }
\`\`\`
</ccw-session-context>`;
    }

    // Generate table
    let table = `| # | Session | Type | Summary | Tokens |\n`;
    table += `|---|---------|------|---------|--------|\n`;

    members.forEach((m, idx) => {
      const type = m.session_type === 'core_memory' ? 'Core' :
                   m.session_type === 'workflow' ? 'Workflow' : 'CLI';
      const summary = (m.summary || '').substring(0, 40);
      const token = `~${m.token_estimate || 0}`;
      table += `| ${idx + 1} | ${m.session_id} | ${type} | ${summary} | ${token} |\n`;
    });

    // Generate timeline - show multiple recent sessions
    let timeline = '';
    if (members.length > 0) {
      const timelineEntries: string[] = [];
      const displayCount = Math.min(members.length, 3); // Show last 3 sessions

      for (let i = members.length - displayCount; i < members.length; i++) {
        const member = members[i];
        const date = member.created_at ? new Date(member.created_at).toLocaleDateString() : '';
        const title = member.title?.substring(0, 30) || 'Untitled';
        const isCurrent = i === members.length - 1;
        const marker = isCurrent ? ' ← Current' : '';
        timelineEntries.push(`${date} ─●─ ${member.session_id} (${title})${marker}`);
      }

      timeline = `\`\`\`\n${timelineEntries.join('\n        │\n')}\n\`\`\``;
    }

    return `<ccw-session-context>
## 📋 Related Sessions Index

### 🔗 Active Cluster: ${activeCluster.name} (${members.length} sessions)
**Intent**: ${activeCluster.intent || 'No intent specified'}

${table}

**Resume via MCP**:
\`\`\`
Use tool: mcp__ccw-tools__core_memory
Parameters: { "action": "load", "id": "${members[members.length - 1].session_id}" }

Or load entire cluster:
{ "action": "load-cluster", "clusterId": "${activeCluster.id}" }
\`\`\`

### 📊 Timeline
${timeline}

---
**Tip**: Use \`mcp__ccw-tools__core_memory({ action: "search", query: "<keyword>" })\` to find more sessions
</ccw-session-context>`;
  }

  /**
   * Parse workflow session files
   */
  private async parseWorkflowSessions(): Promise<SessionMetadataCache[]> {
    const sessions: SessionMetadataCache[] = [];
    const workflowDir = join(this.projectPath, '.workflow', 'sessions');

    if (!existsSync(workflowDir)) {
      return sessions;
    }

    try {
      const sessionDirs = readdirSync(workflowDir).filter(d => d.startsWith('WFS-'));

      for (const sessionDir of sessionDirs) {
        const sessionFile = join(workflowDir, sessionDir, 'session.json');
        if (!existsSync(sessionFile)) continue;

        try {
          const content = readFileSync(sessionFile, 'utf8');
          const sessionData = JSON.parse(content);

          const metadata: SessionMetadataCache = {
            session_id: sessionDir,
            session_type: 'workflow',
            title: sessionData.title || sessionDir,
            summary: (sessionData.description || '').substring(0, 200),
            keywords: this.extractKeywords(JSON.stringify(sessionData)),
            token_estimate: Math.ceil(JSON.stringify(sessionData).length / 4),
            file_patterns: this.extractFilePatterns(JSON.stringify(sessionData)),
            created_at: sessionData.created_at || statSync(sessionFile).mtime.toISOString(),
            last_accessed: new Date().toISOString(),
            access_count: 0
          };

          sessions.push(metadata);
        } catch (err) {
          console.warn(`[Clustering] Failed to parse ${sessionFile}:`, err);
        }
      }
    } catch (err) {
      console.warn('[Clustering] Failed to read workflow sessions:', err);
    }

    return sessions;
  }

  /**
   * Update metadata cache for all sessions
   */
  async refreshMetadataCache(): Promise<number> {
    const sessions = await this.collectSessions({ scope: 'all' });

    for (const session of sessions) {
      this.coreMemoryStore.upsertSessionMetadata(session);
    }

    return sessions.length;
  }
}
