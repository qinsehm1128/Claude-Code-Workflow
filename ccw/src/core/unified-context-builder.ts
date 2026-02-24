/**
 * UnifiedContextBuilder - Assembles context for Claude Code hooks
 *
 * Provides componentized context assembly for:
 *   - session-start: MEMORY.md summary + cluster overview + hot entities + solidified patterns
 *   - per-prompt: vector search + intent matching across all categories
 *   - session-end: incremental embedding + clustering + heat score update tasks
 *
 * Character limits:
 *   - session-start: <= 1500 chars
 *   - per-prompt: <= 500 chars
 */

import { existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { getProjectPaths } from '../config/storage-paths.js';
import { getMemoryMdContent } from './memory-consolidation-pipeline.js';
import { getMemoryStore } from './memory-store.js';
import type { HotEntity } from './memory-store.js';
import {
  UnifiedVectorIndex,
  isUnifiedEmbedderAvailable,
} from './unified-vector-index.js';
import type { VectorSearchMatch } from './unified-vector-index.js';
import { SessionClusteringService } from './session-clustering-service.js';

// =============================================================================
// Constants
// =============================================================================

/** Maximum character count for session-start context */
const SESSION_START_LIMIT = 1500;

/** Maximum character count for per-prompt context */
const PER_PROMPT_LIMIT = 500;

/** Maximum characters for the MEMORY.md summary component */
const MEMORY_SUMMARY_LIMIT = 500;

/** Number of top clusters to show in overview */
const TOP_CLUSTERS = 3;

/** Number of top hot entities to show */
const TOP_HOT_ENTITIES = 5;

/** Days to look back for hot entities */
const HOT_ENTITY_DAYS = 7;

/** Number of vector search results for per-prompt */
const VECTOR_TOP_K = 8;

/** Minimum vector similarity score */
const VECTOR_MIN_SCORE = 0.3;

/** Maximum characters for the recent sessions component */
const RECENT_SESSIONS_LIMIT = 300;

/** Number of recent sessions to show */
const RECENT_SESSIONS_COUNT = 5;

// =============================================================================
// Types
// =============================================================================

/** A task to be executed asynchronously at session-end */
export interface SessionEndTask {
  /** Descriptive name of the task */
  name: string;
  /** Async function to execute */
  execute: () => Promise<void>;
}

// =============================================================================
// UnifiedContextBuilder
// =============================================================================

export class UnifiedContextBuilder {
  private projectPath: string;
  private paths: ReturnType<typeof getProjectPaths>;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.paths = getProjectPaths(projectPath);
  }

  // ---------------------------------------------------------------------------
  // Public: session-start context
  // ---------------------------------------------------------------------------

  /**
   * Build context for session-start hook injection.
   *
   * Components (assembled in order, truncated to <= 1500 chars total):
   *   1. MEMORY.md summary (up to 500 chars)
   *   2. Cluster overview (top 3 active clusters)
   *   3. Hot entities (top 5 within last 7 days)
   *   4. Solidified patterns (skills/*.md file list)
   *   5. Recent sessions (last 5 session summaries)
   */
  async buildSessionStartContext(): Promise<string> {
    const sections: string[] = [];

    // Component 1: MEMORY.md summary
    const memorySummary = this.buildMemorySummary();
    if (memorySummary) {
      sections.push(memorySummary);
    }

    // Component 2: Cluster overview
    const clusterOverview = await this.buildClusterOverview();
    if (clusterOverview) {
      sections.push(clusterOverview);
    }

    // Component 3: Hot entities
    const hotEntities = this.buildHotEntities();
    if (hotEntities) {
      sections.push(hotEntities);
    }

    // Component 4: Solidified patterns
    const patterns = this.buildSolidifiedPatterns();
    if (patterns) {
      sections.push(patterns);
    }

    // Component 5: Recent sessions
    const recentSessions = await this.buildRecentSessions();
    if (recentSessions) {
      sections.push(recentSessions);
    }

    if (sections.length === 0) {
      return '';
    }

    // Assemble and truncate
    let content = '<ccw-memory-context>\n' + sections.join('\n') + '\n</ccw-memory-context>';

    if (content.length > SESSION_START_LIMIT) {
      content = content.substring(0, SESSION_START_LIMIT - 20) + '\n</ccw-memory-context>';
    }

    return content;
  }

  // ---------------------------------------------------------------------------
  // Public: per-prompt context
  // ---------------------------------------------------------------------------

  /**
   * Build context for per-prompt hook injection.
   *
   * Uses vector search across all categories to find relevant memories
   * matching the current prompt. Results are ranked by similarity score.
   *
   * @param prompt - Current user prompt text
   * @returns Context string (<= 500 chars) or empty string
   */
  async buildPromptContext(prompt: string): Promise<string> {
    if (!prompt || !prompt.trim()) {
      return '';
    }

    if (!isUnifiedEmbedderAvailable()) {
      return '';
    }

    try {
      const vectorIndex = new UnifiedVectorIndex(this.projectPath);
      const result = await vectorIndex.search(prompt, {
        topK: VECTOR_TOP_K,
        minScore: VECTOR_MIN_SCORE,
      });

      if (!result.success || result.matches.length === 0) {
        return '';
      }

      return this.formatPromptMatches(result.matches);
    } catch {
      return '';
    }
  }

  // ---------------------------------------------------------------------------
  // Public: session-end tasks
  // ---------------------------------------------------------------------------

  /**
   * Build a list of async tasks to run at session-end.
   *
   * Tasks:
   *   1. Incremental vector embedding (index new/updated content)
   *   2. Incremental clustering (cluster unclustered sessions)
   *   3. Heat score updates (recalculate entity heat scores)
   *
   * @param sessionId - Current session ID for context
   * @returns Array of tasks with name and execute function
   */
  buildSessionEndTasks(sessionId: string): SessionEndTask[] {
    const tasks: SessionEndTask[] = [];

    // Task 1: Incremental vector embedding
    if (isUnifiedEmbedderAvailable()) {
      tasks.push({
        name: 'incremental-embedding',
        execute: async () => {
          try {
            const vectorIndex = new UnifiedVectorIndex(this.projectPath);
            // Re-index the MEMORY.md content if available
            const memoryContent = getMemoryMdContent(this.projectPath);
            if (memoryContent) {
              await vectorIndex.indexContent(memoryContent, {
                source_id: 'MEMORY_MD',
                source_type: 'core_memory',
                category: 'core_memory',
              });
            }
          } catch (err) {
            // Log but don't throw - session-end tasks are best-effort
            if (process.env.DEBUG) {
              console.error('[UnifiedContextBuilder] Embedding task failed:', (err as Error).message);
            }
          }
        },
      });
    }

    // Task 2: Incremental clustering
    tasks.push({
      name: 'incremental-clustering',
      execute: async () => {
        try {
          const clusteringService = new SessionClusteringService(this.projectPath);
          await clusteringService.autocluster({ scope: 'unclustered' });
        } catch (err) {
          if (process.env.DEBUG) {
            console.error('[UnifiedContextBuilder] Clustering task failed:', (err as Error).message);
          }
        }
      },
    });

    // Task 3: Heat score updates
    tasks.push({
      name: 'heat-score-update',
      execute: async () => {
        try {
          const memoryStore = getMemoryStore(this.projectPath);
          const hotEntities = memoryStore.getHotEntities(50);
          for (const entity of hotEntities) {
            if (entity.id != null) {
              memoryStore.calculateHeatScore(entity.id);
            }
          }
        } catch (err) {
          if (process.env.DEBUG) {
            console.error('[UnifiedContextBuilder] Heat score update failed:', (err as Error).message);
          }
        }
      },
    });

    return tasks;
  }

  // ---------------------------------------------------------------------------
  // Private: Component builders
  // ---------------------------------------------------------------------------

  /**
   * Build MEMORY.md summary component.
   * Reads MEMORY.md and returns first MEMORY_SUMMARY_LIMIT characters.
   */
  private buildMemorySummary(): string {
    const content = getMemoryMdContent(this.projectPath);
    if (!content) {
      return '';
    }

    let summary = content.trim();
    if (summary.length > MEMORY_SUMMARY_LIMIT) {
      // Truncate at a newline boundary if possible
      const truncated = summary.substring(0, MEMORY_SUMMARY_LIMIT);
      const lastNewline = truncated.lastIndexOf('\n');
      summary = lastNewline > MEMORY_SUMMARY_LIMIT * 0.6
        ? truncated.substring(0, lastNewline) + '...'
        : truncated + '...';
    }

    return `## Memory Summary\n${summary}\n`;
  }

  /**
   * Build cluster overview component.
   * Shows top N active clusters from the clustering service.
   */
  private async buildClusterOverview(): Promise<string> {
    try {
      const { getCoreMemoryStore } = await import('./core-memory-store.js');
      const store = getCoreMemoryStore(this.projectPath);
      const clusters = store.listClusters('active');

      if (clusters.length === 0) {
        return '';
      }

      // Sort by most recent activity
      const sorted = clusters
        .map(c => {
          const members = store.getClusterMembers(c.id);
          return { cluster: c, memberCount: members.length };
        })
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, TOP_CLUSTERS);

      let output = '## Active Clusters\n';
      for (const { cluster, memberCount } of sorted) {
        const intent = cluster.intent ? ` - ${cluster.intent}` : '';
        output += `- **${cluster.name}** (${memberCount})${intent}\n`;
      }

      return output;
    } catch {
      return '';
    }
  }

  /**
   * Build hot entities component.
   * Shows top N entities by heat_score that were active within last 7 days.
   */
  private buildHotEntities(): string {
    try {
      const memoryStore = getMemoryStore(this.projectPath);
      const allHot = memoryStore.getHotEntities(TOP_HOT_ENTITIES * 3);

      if (allHot.length === 0) {
        return '';
      }

      // Filter to entities seen within the last HOT_ENTITY_DAYS days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - HOT_ENTITY_DAYS);
      const cutoffStr = cutoff.toISOString();

      const recentHot = allHot
        .filter(e => (e.last_seen_at || '') >= cutoffStr)
        .slice(0, TOP_HOT_ENTITIES);

      if (recentHot.length === 0) {
        return '';
      }

      let output = '## Hot Entities (7d)\n';
      for (const entity of recentHot) {
        const heat = Math.round(entity.stats.heat_score);
        output += `- ${entity.type}:${entity.value} (heat:${heat})\n`;
      }

      return output;
    } catch {
      return '';
    }
  }

  /**
   * Build solidified patterns component.
   * Scans skills/*.md files and lists their names.
   */
  private buildSolidifiedPatterns(): string {
    try {
      const skillsDir = this.paths.memoryV2.skills;
      if (!existsSync(skillsDir)) {
        return '';
      }

      const files = readdirSync(skillsDir).filter(f => f.endsWith('.md'));
      if (files.length === 0) {
        return '';
      }

      let output = '## Patterns\n';
      for (const file of files.slice(0, 5)) {
        const name = basename(file, '.md');
        output += `- ${name}\n`;
      }

      return output;
    } catch {
      return '';
    }
  }

  /**
   * Build recent sessions component.
   * Shows last N session summaries from CoreMemoryStore.
   */
  private async buildRecentSessions(): Promise<string> {
    try {
      const { getCoreMemoryStore } = await import('./core-memory-store.js');
      const store = getCoreMemoryStore(this.projectPath);
      const summaries = store.getSessionSummaries(RECENT_SESSIONS_COUNT);

      if (summaries.length === 0) {
        return '';
      }

      let output = '## Recent Sessions\n';
      for (const s of summaries) {
        const shortId = s.thread_id.substring(0, 12);
        const summaryText = s.rollout_summary.length > 60
          ? s.rollout_summary.substring(0, 60) + '...'
          : s.rollout_summary;
        output += `- ${shortId}: ${summaryText}\n`;
      }

      if (output.length > RECENT_SESSIONS_LIMIT) {
        output = output.substring(0, RECENT_SESSIONS_LIMIT);
      }

      return output;
    } catch {
      return '';
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Formatting helpers
  // ---------------------------------------------------------------------------

  /**
   * Format vector search matches for per-prompt context.
   * Builds a compact Markdown snippet within PER_PROMPT_LIMIT chars.
   */
  private formatPromptMatches(matches: VectorSearchMatch[]): string {
    let output = '<ccw-related-memory>\n';

    for (const match of matches) {
      const score = Math.round(match.score * 100);
      const snippet = match.content.substring(0, 80).replace(/\n/g, ' ').trim();
      const line = `- [${match.category}] ${snippet} (${score}%)\n`;

      // Check if adding this line would exceed limit
      if (output.length + line.length + 25 > PER_PROMPT_LIMIT) {
        break;
      }
      output += line;
    }

    output += '</ccw-related-memory>';

    return output;
  }
}
