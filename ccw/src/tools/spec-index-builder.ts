/**
 * Spec Index Builder
 *
 * Scans .ccw/{dimension}/*.md files, parses YAML frontmatter via
 * gray-matter, and writes .ccw/.spec-index/{dimension}.index.json cache files.
 *
 * Supports 2 dimensions: specs, personal
 *
 * YAML Frontmatter Schema:
 * ---
 * title: "Document Title"
 * dimension: "specs"
 * category: "general"        # general | exploration | planning | execution
 * keywords: ["auth", "security"]
 * readMode: "required"       # required | optional
 * priority: "high"           # critical | high | medium | low
 * ---
 */

import matter from 'gray-matter';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename, extname, relative } from 'path';
import { homedir } from 'os';

// ============================================================================
// Types
// ============================================================================

/**
 * Spec categories for workflow stage-based loading.
 * - general: Applies to all stages (e.g. coding conventions)
 * - exploration: Code exploration, analysis, debugging context
 * - planning: Task planning, roadmap, requirements context
 * - execution: Implementation, testing, deployment context
 *
 * Usage: Set category field in spec frontmatter:
 *   category: exploration
 *
 * System-level loading by stage: ccw spec load --category exploration
 */
export const SPEC_CATEGORIES = ['general', 'exploration', 'planning', 'execution'] as const;

export type SpecCategory = typeof SPEC_CATEGORIES[number];

/**
 * YAML frontmatter schema for spec MD files.
 */
export interface SpecFrontmatter {
  title: string;
  dimension: string;
  category?: SpecCategory;
  keywords: string[];
  readMode: 'required' | 'optional';
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Single entry in the dimension index cache.
 */
export interface SpecIndexEntry {
  /** Document title from frontmatter */
  title: string;
  /** Relative file path from project root */
  file: string;
  /** Dimension this spec belongs to */
  dimension: string;
  /** Workflow stage category for system-level loading */
  category: SpecCategory;
  /** Keywords for matching against user prompts */
  keywords: string[];
  /** Whether this spec is required or optional */
  readMode: 'required' | 'optional';
  /** Priority level for ordering */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Scope: global (from ~/.ccw/) or project (from .ccw/) */
  scope: 'global' | 'project';
  /** Content length (body only, without frontmatter) - cached for performance */
  contentLength: number;
}

/**
 * Complete index for one dimension.
 */
export interface DimensionIndex {
  /** Dimension name */
  dimension: string;
  /** All spec entries in this dimension */
  entries: SpecIndexEntry[];
  /** ISO timestamp when this index was built */
  built_at: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * The 2 supported spec dimensions.
 * - specs: Project rules and conventions
 * - personal: Personal preferences (supports global ~/.ccw/personal/)
 */
export const SPEC_DIMENSIONS = ['specs', 'personal'] as const;

export type SpecDimension = typeof SPEC_DIMENSIONS[number];

/**
 * Valid readMode values.
 */
const VALID_READ_MODES = ['required', 'optional'] as const;

/**
 * Valid priority values.
 */
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Valid category values.
 */
const VALID_CATEGORIES = SPEC_CATEGORIES;

/**
 * Directory name for spec index cache files (inside .ccw/).
 */
const CCW_DIR = '.ccw';
const SPEC_INDEX_DIR = '.spec-index';

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the path to the index JSON file for a given dimension.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension name
 * @returns Absolute path to .ccw/.spec-index/{dimension}.index.json
 */
export function getIndexPath(projectPath: string, dimension: string): string {
  return join(projectPath, CCW_DIR, SPEC_INDEX_DIR, `${dimension}.index.json`);
}

/**
 * Get the path to the .ccw/{dimension} directory.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension name
 * @returns Absolute path to .ccw/{dimension}/
 */
export function getDimensionDir(projectPath: string, dimension: string): string {
  return join(projectPath, CCW_DIR, dimension);
}

/**
 * Build the index for a single dimension.
 *
 * Scans .ccw/{dimension}/*.md files, parses YAML frontmatter,
 * extracts the 5 required fields, and returns a DimensionIndex.
 *
 * Files with malformed or missing frontmatter are skipped gracefully.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension to index (e.g., 'specs')
 * @returns DimensionIndex with all valid entries
 */
export async function buildDimensionIndex(
  projectPath: string,
  dimension: string
): Promise<DimensionIndex> {
  const entries: SpecIndexEntry[] = [];

  // Helper function to scan a directory and add entries
  const scanDirectory = (dir: string, scope: 'global' | 'project') => {
    if (!existsSync(dir)) return;

    let files: string[];
    try {
      files = readdirSync(dir).filter(f => extname(f).toLowerCase() === '.md');
    } catch {
      return;
    }

    for (const file of files) {
      const filePath = join(dir, file);
      const entry = parseSpecFile(filePath, dimension, projectPath, scope);
      if (entry) {
        entries.push(entry);
      } else {
        process.stderr.write(
          `[spec-index-builder] Skipping malformed spec file: ${file}\n`
        );
      }
    }
  };

  // For personal dimension, also scan global ~/.ccw/personal/
  if (dimension === 'personal') {
    const globalPersonalDir = join(homedir(), '.ccw', 'personal');
    scanDirectory(globalPersonalDir, 'global');
  }

  // Scan project dimension directory
  const dimensionDir = getDimensionDir(projectPath, dimension);
  scanDirectory(dimensionDir, 'project');

  return {
    dimension,
    entries,
    built_at: new Date().toISOString(),
  };
}

/**
 * Build indices for all dimensions and write to .ccw/.spec-index/.
 *
 * Creates .ccw/.spec-index/ directory if it doesn't exist.
 * Writes {dimension}.index.json for each dimension.
 *
 * @param projectPath - Project root directory
 */
export async function buildAllIndices(projectPath: string): Promise<void> {
  const indexDir = join(projectPath, CCW_DIR, SPEC_INDEX_DIR);

  // Ensure .spec-index directory exists
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  for (const dimension of SPEC_DIMENSIONS) {
    const index = await buildDimensionIndex(projectPath, dimension);
    const indexPath = getIndexPath(projectPath, dimension);

    try {
      writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (err) {
      // Log but continue with other dimensions
      console.error(
        `[spec-index-builder] Failed to write index for ${dimension}: ${(err as Error).message}`
      );
    }
  }
}

/**
 * Read a cached dimension index from disk.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension to read
 * @returns DimensionIndex if cache exists and is valid, null otherwise
 */
export function readCachedIndex(
  projectPath: string,
  dimension: string
): DimensionIndex | null {
  const indexPath = getIndexPath(projectPath, dimension);

  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(content) as DimensionIndex;

    // Basic validation
    if (
      parsed &&
      typeof parsed.dimension === 'string' &&
      Array.isArray(parsed.entries) &&
      typeof parsed.built_at === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the dimension index, using cache if available, otherwise building fresh.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension to get
 * @param forceRebuild - Skip cache and rebuild from source files
 * @returns DimensionIndex
 */
export async function getDimensionIndex(
  projectPath: string,
  dimension: string,
  forceRebuild = false
): Promise<DimensionIndex> {
  if (!forceRebuild) {
    const cached = readCachedIndex(projectPath, dimension);
    if (cached) {
      return cached;
    }
  }

  // Build fresh and cache
  const index = await buildDimensionIndex(projectPath, dimension);

  const indexDir = join(projectPath, CCW_DIR, SPEC_INDEX_DIR);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  const indexPath = getIndexPath(projectPath, dimension);
  try {
    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  } catch {
    // Cache write failure is non-fatal
  }

  return index;
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Parse a single spec MD file and extract its frontmatter into a SpecIndexEntry.
 *
 * @param filePath - Absolute path to the MD file
 * @param dimension - The dimension this file belongs to
 * @param projectPath - Project root for computing relative paths
 * @returns SpecIndexEntry if frontmatter is valid, null if malformed/missing
 */
function parseSpecFile(
  filePath: string,
  dimension: string,
  projectPath: string,
  scope: 'global' | 'project' = 'project'
): SpecIndexEntry | null {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  // Parse frontmatter
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch {
    // Malformed frontmatter - skip
    return null;
  }

  const data = parsed.data as Record<string, unknown>;
  // Calculate content length (body only, without frontmatter)
  const contentLength = parsed.content.length;

  // Extract and validate frontmatter fields
  const title = extractString(data, 'title');
  if (!title) {
    // Title is required - use filename as fallback
    const fallbackTitle = basename(filePath, extname(filePath));
    return buildEntry(fallbackTitle, filePath, dimension, projectPath, data, scope, contentLength);
  }

  return buildEntry(title, filePath, dimension, projectPath, data, scope, contentLength);
}

/**
 * Build a SpecIndexEntry from parsed frontmatter data.
 */
function buildEntry(
  title: string,
  filePath: string,
  dimension: string,
  projectPath: string,
  data: Record<string, unknown>,
  scope: 'global' | 'project' = 'project',
  contentLength: number = 0
): SpecIndexEntry {
  // Compute relative file path from project root using path.relative
  // Normalize to forward slashes for cross-platform consistency
  const relativePath = relative(projectPath, filePath).replace(/\\/g, '/');

  // Extract category with validation (defaults to 'general')
  const rawCategory = extractString(data, 'category');
  const category = isValidCategory(rawCategory) ? rawCategory : 'general';

  // Extract keywords - accept string[] or single string
  const keywords = extractStringArray(data, 'keywords');

  // Extract readMode with validation
  const rawReadMode = extractString(data, 'readMode');
  const readMode = isValidReadMode(rawReadMode) ? rawReadMode : 'optional';

  // Extract priority with validation
  const rawPriority = extractString(data, 'priority');
  const priority = isValidPriority(rawPriority) ? rawPriority : 'medium';

  return {
    title,
    file: relativePath,
    dimension,
    category,
    keywords,
    readMode,
    priority,
    scope,
    contentLength,
  };
}

/**
 * Extract a string value from parsed YAML data.
 */
function extractString(
  data: Record<string, unknown>,
  key: string
): string | null {
  const value = data[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

/**
 * Extract a string array from parsed YAML data.
 * Handles both array format and comma-separated string format.
 */
function extractStringArray(
  data: Record<string, unknown>,
  key: string
): string[] {
  const value = data[key];

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  return [];
}

/**
 * Type guard for valid readMode values.
 */
function isValidReadMode(value: string | null): value is 'required' | 'optional' {
  return value !== null && (VALID_READ_MODES as readonly string[]).includes(value);
}

/**
 * Type guard for valid priority values.
 */
function isValidPriority(value: string | null): value is 'critical' | 'high' | 'medium' | 'low' {
  return value !== null && (VALID_PRIORITIES as readonly string[]).includes(value);
}

/**
 * Type guard for valid category values.
 */
function isValidCategory(value: string | null): value is SpecCategory {
  return value !== null && (VALID_CATEGORIES as readonly string[]).includes(value);
}
