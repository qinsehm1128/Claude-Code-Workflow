/**
 * Spec Loader
 *
 * Core loading logic for the spec system. Reads index caches, filters specs
 * by readMode and keyword match, loads MD content, merges by dimension
 * priority, and formats output for CLI or Hook consumption.
 *
 * Single entry point: loadSpecs(options) -> SpecLoadResult
 *
 * Data flow:
 *   Keywords -> IndexCache -> Filter(required + keyword-matched) ->
 *   MDLoader -> PriorityMerger -> OutputFormatter
 */

import matter from 'gray-matter';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import {
  getDimensionIndex,
  SpecIndexEntry,
  DimensionIndex,
  SPEC_DIMENSIONS,
  SPEC_CATEGORIES,
  type SpecDimension,
  type SpecCategory,
} from './spec-index-builder.js';

import {
  extractKeywords,
  calculateMatchScore,
} from './spec-keyword-extractor.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Input options for loadSpecs().
 */
export interface SpecLoadOptions {
  /** Absolute path to the project root */
  projectPath: string;
  /** Specific dimension to load (loads all if omitted) */
  dimension?: SpecDimension;
  /** Workflow stage category filter (loads matching category specs) */
  category?: SpecCategory;
  /** Pre-extracted keywords (skips extraction if provided) */
  keywords?: string[];
  /** Output format: 'cli' for markdown, 'hook' for JSON */
  outputFormat: 'cli' | 'hook';
  /** Raw stdin data from Claude Code hook (used to extract user_prompt) */
  stdinData?: { user_prompt?: string; prompt?: string; [key: string]: unknown };
  /** Enable debug logging to stderr */
  debug?: boolean;
  /** Maximum content length in characters (default: 8000) */
  maxLength?: number;
  /** Whether to truncate content if it exceeds maxLength (default: true) */
  truncateOnExceed?: boolean;
}

/**
 * Output from loadSpecs().
 */
export interface SpecLoadResult {
  /** Formatted content string (markdown or JSON) */
  content: string;
  /** Output format that was used */
  format: 'markdown' | 'json';
  /** List of spec titles that were matched and loaded */
  matchedSpecs: string[];
  /** Total number of spec files loaded */
  totalLoaded: number;
  /** Content length statistics */
  contentLength: {
    /** Original content length before truncation */
    original: number;
    /** Final content length (after truncation if applied) */
    final: number;
    /** Maximum allowed length */
    maxLength: number;
    /** Whether content was truncated */
    truncated: boolean;
    /** Percentage of max length used */
    percentage: number;
  };
}

/**
 * Internal representation of a loaded spec's content.
 */
interface LoadedSpec {
  title: string;
  dimension: string;
  priority: string;
  content: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Dimension priority for merge ordering.
 * Lower number = loaded first (lower priority, gets overridden).
 * Higher number = loaded last (higher priority, overrides).
 */
const DIMENSION_PRIORITY: Record<string, number> = {
  personal: 1,
  specs: 2,
};

/**
 * Priority weight for ordering specs within a dimension.
 */
const SPEC_PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Load specs based on options.
 *
 * Pipeline:
 *   1. Extract keywords from options.keywords, stdinData, or empty
 *   2. For each dimension: read index cache (fallback to on-the-fly build)
 *   3. Filter: all required specs + optional specs with keyword match
 *   4. Load MD file content (strip frontmatter)
 *   5. Merge by dimension priority
 *   6. Check length and truncate if needed
 *   7. Format for CLI (markdown) or Hook (JSON)
 *
 * @param options - Loading configuration
 * @returns SpecLoadResult with formatted content
 */
export async function loadSpecs(options: SpecLoadOptions): Promise<SpecLoadResult> {
  const { projectPath, outputFormat, debug, category } = options;

  // Get injection control settings
  const maxLength = options.maxLength ?? 8000;
  const truncateOnExceed = options.truncateOnExceed ?? true;

  // Step 1: Resolve keywords
  const keywords = resolveKeywords(options);

  if (debug) {
    debugLog(`Extracted ${keywords.length} keywords: [${keywords.join(', ')}]`);
    if (category) {
      debugLog(`Category filter: ${category}`);
    }
  }

  // Step 2: Determine which dimensions to process
  const dimensions = options.dimension
    ? [options.dimension]
    : [...SPEC_DIMENSIONS];

  // Step 3: For each dimension, read index and filter specs
  const allLoadedSpecs: LoadedSpec[] = [];
  let totalScanned = 0;

  for (const dim of dimensions) {
    const index = await getDimensionIndex(projectPath, dim);
    totalScanned += index.entries.length;

    const { required, matched } = filterSpecs(index, keywords, category);

    if (debug) {
      debugLog(
        `[${dim}] scanned=${index.entries.length} required=${required.length} matched=${matched.length}`
      );
    }

    // Step 4: Load content for filtered entries
    const entriesToLoad = [...required, ...matched];
    const loaded = loadSpecContent(projectPath, entriesToLoad);
    allLoadedSpecs.push(...loaded);
  }

  if (debug) {
    debugLog(
      `Total: scanned=${totalScanned} loaded=${allLoadedSpecs.length}`
    );
  }

  // Step 5: Merge by dimension priority
  const mergedContent = mergeByPriority(allLoadedSpecs);

  // Step 6: Check length and truncate if needed
  const originalLength = mergedContent.length;
  let finalContent = mergedContent;
  let truncated = false;

  if (originalLength > maxLength && truncateOnExceed) {
    // Truncate content, preserving complete sections where possible
    finalContent = truncateContent(mergedContent, maxLength);
    truncated = true;

    if (debug) {
      debugLog(`Content truncated: ${originalLength} -> ${finalContent.length} (max: ${maxLength})`);
    }
  }

  // Step 7: Format output
  const matchedTitles = allLoadedSpecs.map(s => s.title);
  const content = formatOutput(finalContent, matchedTitles, outputFormat);
  const format = outputFormat === 'cli' ? 'markdown' : 'json';

  const percentage = Math.round((originalLength / maxLength) * 100);

  return {
    content,
    format,
    matchedSpecs: matchedTitles,
    totalLoaded: allLoadedSpecs.length,
    contentLength: {
      original: originalLength,
      final: finalContent.length,
      maxLength,
      truncated,
      percentage: Math.min(percentage, 100),
    },
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Filter specs by readMode, category, and keyword match.
 *
 * - required: all entries with readMode === 'required' (and matching category if specified)
 * - matched: entries with readMode === 'optional' that have keyword intersection (and matching category if specified)
 *
 * @param index - The dimension index to filter
 * @param keywords - Extracted prompt keywords
 * @param category - Optional category filter for workflow stage
 * @returns Separated required and matched entries (deduplicated)
 */
export function filterSpecs(
  index: DimensionIndex,
  keywords: string[],
  category?: SpecCategory
): { required: SpecIndexEntry[]; matched: SpecIndexEntry[] } {
  const required: SpecIndexEntry[] = [];
  const matched: SpecIndexEntry[] = [];

  for (const entry of index.entries) {
    // Category filter: skip if category specified and doesn't match
    if (category && entry.category !== category) {
      continue;
    }

    if (entry.readMode === 'required') {
      required.push(entry);
      continue;
    }

    // Optional entries: check keyword intersection
    if (keywords.length > 0 && entry.keywords.length > 0) {
      const score = calculateMatchScore(keywords, entry.keywords);
      if (score > 0) {
        matched.push(entry);
      }
    }
  }

  return { required, matched };
}

/**
 * Merge loaded spec content by dimension priority.
 *
 * Dimension priority order: personal(1) < specs(2).
 * Within a dimension, specs are ordered by priority weight (critical > high > medium > low).
 *
 * @param specs - All loaded specs
 * @returns Merged content string ordered by priority
 */
export function mergeByPriority(specs: LoadedSpec[]): string {
  if (specs.length === 0) {
    return '';
  }

  // Sort by dimension priority (ascending), then by spec priority weight (descending)
  const sorted = [...specs].sort((a, b) => {
    const dimA = DIMENSION_PRIORITY[a.dimension] ?? 0;
    const dimB = DIMENSION_PRIORITY[b.dimension] ?? 0;
    if (dimA !== dimB) {
      return dimA - dimB;
    }
    const priA = SPEC_PRIORITY_WEIGHT[a.priority] ?? 0;
    const priB = SPEC_PRIORITY_WEIGHT[b.priority] ?? 0;
    return priB - priA;
  });

  // Concatenate content with separators
  const sections: string[] = [];
  for (const spec of sorted) {
    sections.push(`## ${spec.title}\n\n${spec.content.trim()}`);
  }

  return sections.join('\n\n---\n\n');
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Resolve keywords from options.
 *
 * Priority:
 *   1. options.keywords (pre-extracted)
 *   2. options.stdinData.user_prompt or options.stdinData.prompt (extract from text)
 *   3. empty array (only required specs will load)
 */
function resolveKeywords(options: SpecLoadOptions): string[] {
  if (options.keywords && options.keywords.length > 0) {
    return options.keywords;
  }

  const prompt = options.stdinData?.user_prompt || options.stdinData?.prompt;
  if (prompt && typeof prompt === 'string') {
    return extractKeywords(prompt);
  }

  return [];
}

/**
 * Load MD file content for a list of spec entries.
 *
 * Reads each file, strips YAML frontmatter via gray-matter, returns body content.
 * Silently skips files that cannot be read.
 *
 * @param projectPath - Project root directory
 * @param entries - Spec index entries to load
 * @returns Array of loaded specs with content
 */
function loadSpecContent(
  projectPath: string,
  entries: SpecIndexEntry[]
): LoadedSpec[] {
  const loaded: LoadedSpec[] = [];

  for (const entry of entries) {
    const filePath = join(projectPath, entry.file);

    if (!existsSync(filePath)) {
      continue;
    }

    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Strip frontmatter using gray-matter
    let body: string;
    try {
      const parsed = matter(raw);
      body = parsed.content;
    } catch {
      // Fallback: use raw content if frontmatter parsing fails
      body = raw;
    }

    // Skip empty content
    if (!body.trim()) {
      continue;
    }

    loaded.push({
      title: entry.title,
      dimension: entry.dimension,
      priority: entry.priority,
      content: body,
    });
  }

  return loaded;
}

/**
 * Format the merged content for output.
 *
 * CLI format: markdown with --- separators and section titles.
 * Hook format: JSON { continue: true, systemMessage: '<project-specs>...</project-specs>' }
 *
 * @param mergedContent - Priority-merged spec content
 * @param matchedTitles - List of matched spec titles
 * @param format - Output format ('cli' or 'hook')
 * @returns Formatted string
 */
function formatOutput(
  mergedContent: string,
  matchedTitles: string[],
  format: 'cli' | 'hook'
): string {
  if (!mergedContent) {
    if (format === 'hook') {
      return JSON.stringify({ continue: true });
    }
    return '(No matching specs found)';
  }

  if (format === 'cli') {
    // CLI: markdown with header
    const header = `# Project Specs (${matchedTitles.length} loaded)`;
    return `${header}\n\n${mergedContent}`;
  }

  // Hook: JSON with systemMessage wrapped in <project-specs> tags
  const wrappedContent = `<project-specs>\n${mergedContent}\n</project-specs>`;
  return JSON.stringify({
    continue: true,
    systemMessage: wrappedContent,
  });
}

/**
 * Write a debug log message to stderr (avoids polluting stdout for hooks).
 */
function debugLog(message: string): void {
  process.stderr.write(`[spec-loader] ${message}\n`);
}

/**
 * Truncate content to fit within maxLength while preserving complete sections.
 *
 * Strategy: Remove sections from the end (lowest priority) until within limit.
 * Each section is delimited by '\n\n---\n\n' from mergeByPriority.
 *
 * @param content - Full merged content
 * @param maxLength - Maximum allowed length
 * @returns Truncated content string
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Split by section separator
  const sections = content.split('\n\n---\n\n');

  // Remove sections from the end until we're within limit
  while (sections.length > 1) {
    sections.pop();

    const newContent = sections.join('\n\n---\n\n');
    if (newContent.length <= maxLength) {
      // Add truncation notice
      return newContent + '\n\n---\n\n[Content truncated due to length limit]';
    }
  }

  // If single section is still too long, hard truncate
  const truncated = sections[0]?.substring(0, maxLength - 50) ?? '';
  return truncated + '\n\n[Content truncated due to length limit]';
}
