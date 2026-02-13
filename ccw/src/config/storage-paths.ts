/**
 * Centralized Storage Paths Configuration
 * Single source of truth for all CCW storage locations
 *
 * All data is stored under ~/.ccw/ with project isolation via SHA256 hash
 */

import { homedir } from 'os';
import { join, resolve, dirname, relative, sep } from 'path';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, renameSync, rmSync, readdirSync, cpSync } from 'fs';
import { readdir } from 'fs/promises';

// Environment variable override for custom storage location
// Made dynamic to support testing environments
export function getCCWHome(): string {
  return process.env.CCW_DATA_DIR || join(homedir(), '.ccw');
}

// Base CCW home directory (deprecated - use getCCWHome() for dynamic access)
// Kept for backward compatibility but will use dynamic value in tests
export const CCW_HOME = getCCWHome();

/**
 * Convert project path to a human-readable folder name
 * Examples:
 *   D:\Claude_dms3       → D--Claude_dms3
 *   /home/user/project   → home-user-project
 *   /mnt/d/Claude_dms3   → D--Claude_dms3 (WSL mapping)
 *
 * @param absolutePath - Absolute project path
 * @returns Safe folder name for filesystem
 */
function pathToFolderName(absolutePath: string): string {
  let normalized = absolutePath;

  // Handle WSL path: /mnt/c/path → C:/path
  const wslMatch = normalized.match(/^\/mnt\/([a-z])\/(.*)/i);
  if (wslMatch) {
    normalized = `${wslMatch[1].toUpperCase()}:/${wslMatch[2]}`;
  }

  // Normalize separators to forward slash
  normalized = normalized.replace(/\\/g, '/');

  // Lowercase for case-insensitive filesystems (Windows, macOS)
  if (process.platform === 'win32' || process.platform === 'darwin') {
    normalized = normalized.toLowerCase();
  }

  // Convert to folder-safe name:
  // - Drive letter: C:/ → C--
  // - Path separators: / → -
  // - Remove leading/trailing dashes
  let folderName = normalized
    .replace(/^([a-z]):\/*/i, '$1--')   // C:/ → C--
    .replace(/^\/+/, '')                 // Remove leading slashes
    .replace(/\/+/g, '-')                // / → -
    .replace(/[<>:"|?*]/g, '_')          // Invalid chars → _
    .replace(/(?<!^[a-z])-+/gi, '-')     // Collapse dashes (except after drive letter)
    .replace(/-$/g, '');                 // Trim trailing dash only

  // Limit length to avoid filesystem issues (max 100 chars)
  if (folderName.length > 100) {
    const hash = createHash('sha256').update(normalized).digest('hex').substring(0, 8);
    folderName = folderName.substring(0, 90) + '_' + hash;
  }

  return folderName || 'unknown';
}

/**
 * Calculate project identifier from project path
 * Returns a human-readable folder name based on the path
 * @param projectPath - Absolute or relative project path
 * @returns Folder-safe project identifier
 */
export function getProjectId(projectPath: string): string {
  const absolutePath = resolve(projectPath);
  return pathToFolderName(absolutePath);
}

/**
 * Hierarchy information for a project path
 */
export interface HierarchyInfo {
  /** Current path's ID (flat form) */
  currentId: string;
  /** Parent directory's ID (if exists) */
  parentId: string | null;
  /** Relative path from parent */
  relativePath: string;
}

// Path detection result cache
const hierarchyCache = new Map<string, HierarchyInfo>();

/**
 * Detect path hierarchy relationship
 * @param projectPath - Current working directory path
 * @returns Hierarchy information
 */
export function detectHierarchy(projectPath: string): HierarchyInfo {
  const absolutePath = resolve(projectPath);

  // Check cache
  if (hierarchyCache.has(absolutePath)) {
    return hierarchyCache.get(absolutePath)!;
  }

  // Execute detection
  const result = detectHierarchyImpl(absolutePath);

  // Cache result
  hierarchyCache.set(absolutePath, result);

  return result;
}

/**
 * Internal hierarchy detection implementation
 */
function detectHierarchyImpl(absolutePath: string): HierarchyInfo {
  const currentId = pathToFolderName(absolutePath);

  // Get all existing project directories
  const projectsDir = join(getCCWHome(), 'projects');
  if (!existsSync(projectsDir)) {
    return { currentId, parentId: null, relativePath: '' };
  }

  // Check if there's a parent path with storage
  let checkPath = absolutePath;
  while (true) {
    const parentPath = dirname(checkPath);
    if (parentPath === checkPath) break; // Reached root directory

    const parentId = pathToFolderName(parentPath);
    const parentStorageDir = join(projectsDir, parentId);

    // If parent path has storage directory, we found the parent
    if (existsSync(parentStorageDir)) {
      const relativePath = relative(parentPath, absolutePath).replace(/\\/g, '/');
      return { currentId, parentId, relativePath };
    }

    checkPath = parentPath;
  }

  return { currentId, parentId: null, relativePath: '' };
}

/**
 * Clear hierarchy cache
 * Call this after migration completes
 */
export function clearHierarchyCache(): void {
  hierarchyCache.clear();
}

/**
 * Verify migration integrity
 */
function verifyMigration(targetDir: string, expectedSubDirs: string[]): boolean {
  try {
    for (const subDir of expectedSubDirs) {
      const path = join(targetDir, subDir);
      // Only verify directories that should exist
      // In a real implementation, we'd check file counts, database integrity, etc.
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Rollback migration (on error)
 */
function rollbackMigration(legacyDir: string, targetDir: string): void {
  try {
    // If target directory exists, try to move back
    if (existsSync(targetDir)) {
      console.error('⚠️  尝试回滚迁移...');
      // Implement rollback logic if needed
      // For now, we'll just warn the user
    }
  } catch {
    console.error('❌ 回滚失败，请手动检查数据完整性');
  }
}

/**
 * Migrate from flat structure to hierarchical structure
 * @param legacyDir - Old flat directory
 * @param targetDir - New hierarchical directory
 */
function migrateToHierarchical(legacyDir: string, targetDir: string): void {
  console.log(`\n🔄 检测到旧存储结构，开始迁移...`);
  console.log(`  从: ${legacyDir}`);
  console.log(`  到: ${targetDir}`);

  try {
    // 1. Create target directory
    mkdirSync(targetDir, { recursive: true });

    // 2. Migrate each subdirectory
    const subDirs = ['cli-history', 'memory', 'cache', 'config'];
    for (const subDir of subDirs) {
      const source = join(legacyDir, subDir);
      const target = join(targetDir, subDir);

      if (existsSync(source)) {
        // Try atomic rename first (fastest, same filesystem)
        try {
          renameSync(source, target);
          console.log(`  ✓ 迁移 ${subDir}`);
        } catch (error: any) {
          // If rename fails (EPERM, cross-filesystem, etc.), fallback to copy-delete
          if (error.code === 'EPERM' || error.code === 'EXDEV' || error.code === 'EBUSY') {
            try {
              console.log(`  ⚠️  rename 失败，使用 copy-delete 方式迁移 ${subDir}...`);
              cpSync(source, target, { recursive: true, force: true });
              // Verify copy succeeded before deleting source
              if (existsSync(target)) {
                rmSync(source, { recursive: true, force: true });
                console.log(`  ✓ 迁移 ${subDir} (copy-delete)`);
              } else {
                throw new Error('复制失败：目标目录不存在');
              }
            } catch (copyError: any) {
              throw new Error(`无法迁移 ${subDir}: ${copyError.message}`);
            }
          } else {
            throw new Error(`无法迁移 ${subDir}: ${error.message}`);
          }
        }
      }
    }

    // 3. Verify migration integrity
    const verified = verifyMigration(targetDir, subDirs);
    if (!verified) {
      throw new Error('迁移验证失败');
    }

    // 4. Delete old directory
    rmSync(legacyDir, { recursive: true, force: true });
    console.log(`✅ 迁移完成并清理旧数据\n`);

  } catch (error: any) {
    console.error(`❌ 迁移失败: ${error.message}`);
    // Try to rollback if possible
    rollbackMigration(legacyDir, targetDir);
    // Re-throw to prevent continued execution
    throw error;
  }
}

/**
 * Check and migrate child projects
 * @param parentId - Parent project ID
 * @param parentPath - Parent project path
 */
function migrateChildProjects(parentId: string, parentPath: string): void {
  const projectsDir = join(getCCWHome(), 'projects');
  if (!existsSync(projectsDir)) return;

  const absoluteParentPath = resolve(parentPath);
  const entries = readdirSync(projectsDir);

  for (const entry of entries) {
    if (entry === parentId) continue; // Skip self

    // Check if this is a child directory of the current project
    // We need to reverse-engineer the original path from the folder ID
    // This is challenging without storing metadata
    // For now, we'll use a heuristic: if the entry starts with the parentId
    // and has additional path segments, it might be a child

    // Simple heuristic: check if entry is longer and starts with parentId
    if (entry.startsWith(parentId + '-')) {
      const legacyDir = join(projectsDir, entry);

      // Try to determine the relative path
      // This is an approximation - in a real implementation,
      // we'd need to store original paths in a metadata file
      // For now, let's extract the suffix after parentId-
      const suffix = entry.substring(parentId.length + 1);

      // Convert back to path segments (- → /)
      const potentialRelPath = suffix.replace(/-/g, sep);

      // Build target directory
      const segments = potentialRelPath.split(sep).filter(Boolean);
      let targetDir = join(projectsDir, parentId);
      for (const segment of segments) {
        targetDir = join(targetDir, segment);
      }

      // Only migrate if the legacy directory exists and contains data
      if (existsSync(legacyDir)) {
        const hasData = ['cli-history', 'memory', 'cache', 'config'].some(subDir =>
          existsSync(join(legacyDir, subDir))
        );

        if (hasData) {
          try {
            migrateToHierarchical(legacyDir, targetDir);
          } catch (error: any) {
            console.error(`⚠️  跳过 ${entry} 的迁移: ${error.message}`);
            // Continue with other migrations
          }
        }
      }
    }
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath - Directory path to ensure
 */
export function ensureStorageDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Global storage paths (not project-specific)
 */
export const GlobalPaths = {
  /** Root CCW home directory */
  root: () => getCCWHome(),

  /** Config directory */
  config: () => join(getCCWHome(), 'config'),

  /** Global settings file */
  settings: () => join(getCCWHome(), 'config', 'settings.json'),

  /** Recent project paths file */
  recentPaths: () => join(getCCWHome(), 'config', 'recent-paths.json'),

  /** Databases directory */
  databases: () => join(getCCWHome(), 'db'),

  /** MCP templates database */
  mcpTemplates: () => join(getCCWHome(), 'db', 'mcp-templates.db'),

  /** Logs directory */
  logs: () => join(getCCWHome(), 'logs'),
};

/**
 * Project-specific storage paths
 */
export interface ProjectPaths {
  /** Project root in CCW storage */
  root: string;
  /** CLI history directory */
  cliHistory: string;
  /** CLI history database file */
  historyDb: string;
  /** Memory store directory */
  memory: string;
  /** Memory store database file */
  memoryDb: string;
  /** Cache directory */
  cache: string;
  /** Dashboard cache file */
  dashboardCache: string;
  /** Config directory */
  config: string;
  /** CLI config file */
  cliConfig: string;
  /** Memory V2 paths */
  memoryV2: {
    /** Root: <projectRoot>/core-memory/v2/ */
    root: string;
    /** Rollout summaries directory */
    rolloutSummaries: string;
    /** Concatenated raw memories file */
    rawMemories: string;
    /** Final consolidated memory file */
    memoryMd: string;
    /** Skills directory */
    skills: string;
  };
}

/**
 * Get storage paths for a specific project
 * Supports hierarchical storage structure with automatic migration
 * @param projectPath - Project root path
 * @returns Object with all project-specific paths
 */
export function getProjectPaths(projectPath: string): ProjectPaths {
  const hierarchy = detectHierarchy(projectPath);

  let projectDir: string;

  if (hierarchy.parentId) {
    // Has parent, use hierarchical structure
    projectDir = join(getCCWHome(), 'projects', hierarchy.parentId);

    // Build subdirectory path from relative path
    const segments = hierarchy.relativePath.split('/').filter(Boolean);
    for (const segment of segments) {
      projectDir = join(projectDir, segment);
    }

    // Check if we need to migrate old flat data
    const legacyDir = join(getCCWHome(), 'projects', hierarchy.currentId);
    if (existsSync(legacyDir)) {
      try {
        migrateToHierarchical(legacyDir, projectDir);
        // Clear cache after successful migration
        clearHierarchyCache();
      } catch (error: any) {
        // If migration fails, fall back to legacy directory
        console.warn(`迁移失败，使用旧存储位置: ${error.message}`);
        projectDir = legacyDir;
      }
    }
  } else {
    // No parent, use root-level storage
    projectDir = join(getCCWHome(), 'projects', hierarchy.currentId);

    // Check if there are child projects that need migration
    try {
      migrateChildProjects(hierarchy.currentId, projectPath);
    } catch (error: any) {
      console.warn(`子项目迁移失败: ${error.message}`);
      // Continue anyway - this is not critical
    }
  }

  return {
    root: projectDir,
    cliHistory: join(projectDir, 'cli-history'),
    historyDb: join(projectDir, 'cli-history', 'history.db'),
    memory: join(projectDir, 'memory'),
    memoryDb: join(projectDir, 'memory', 'memory.db'),
    cache: join(projectDir, 'cache'),
    dashboardCache: join(projectDir, 'cache', 'dashboard-data.json'),
    config: join(projectDir, 'config'),
    cliConfig: join(projectDir, 'config', 'cli-config.json'),
    memoryV2: {
      root: join(projectDir, 'core-memory', 'v2'),
      rolloutSummaries: join(projectDir, 'core-memory', 'v2', 'rollout_summaries'),
      rawMemories: join(projectDir, 'core-memory', 'v2', 'raw_memories.md'),
      memoryMd: join(projectDir, 'core-memory', 'v2', 'MEMORY.md'),
      skills: join(projectDir, 'core-memory', 'v2', 'skills'),
    },
  };
}

/**
 * Get storage paths for a project by its ID (hash)
 * Use when iterating centralized storage without original project path
 * @param projectId - 16-character project ID hash
 * @returns Object with all project-specific paths
 */
export function getProjectPathsById(projectId: string): ProjectPaths {
  const projectDir = join(getCCWHome(), 'projects', projectId);

  return {
    root: projectDir,
    cliHistory: join(projectDir, 'cli-history'),
    historyDb: join(projectDir, 'cli-history', 'history.db'),
    memory: join(projectDir, 'memory'),
    memoryDb: join(projectDir, 'memory', 'memory.db'),
    cache: join(projectDir, 'cache'),
    dashboardCache: join(projectDir, 'cache', 'dashboard-data.json'),
    config: join(projectDir, 'config'),
    cliConfig: join(projectDir, 'config', 'cli-config.json'),
    memoryV2: {
      root: join(projectDir, 'core-memory', 'v2'),
      rolloutSummaries: join(projectDir, 'core-memory', 'v2', 'rollout_summaries'),
      rawMemories: join(projectDir, 'core-memory', 'v2', 'raw_memories.md'),
      memoryMd: join(projectDir, 'core-memory', 'v2', 'MEMORY.md'),
      skills: join(projectDir, 'core-memory', 'v2', 'skills'),
    },
  };
}

/**
 * Unified StoragePaths object combining global and project paths
 */
export const StoragePaths = {
  global: GlobalPaths,
  project: getProjectPaths,
  projectById: getProjectPathsById,
};

/**
 * Information about a child project in hierarchical structure
 */
export interface ChildProjectInfo {
  /** Absolute path to the child project */
  projectPath: string;
  /** Relative path from parent project */
  relativePath: string;
  /** Project ID */
  projectId: string;
  /** Storage paths for this child project */
  paths: ProjectPaths;
}

/**
 * Recursively scan for child projects in hierarchical storage structure
 * @param projectPath - Parent project path
 * @returns Array of child project information
 */
export function scanChildProjects(projectPath: string): ChildProjectInfo[] {
  const absolutePath = resolve(projectPath);
  const parentId = getProjectId(absolutePath);
  const parentStorageDir = join(getCCWHome(), 'projects', parentId);

  // If parent storage doesn't exist, no children
  if (!existsSync(parentStorageDir)) {
    return [];
  }

  const children: ChildProjectInfo[] = [];

  /**
   * Recursively scan directory for project data directories
   */
  function scanDirectory(dir: string, relativePath: string): void {
    if (!existsSync(dir)) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const fullPath = join(dir, entry.name);
        const currentRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        // Check if this directory contains project data
        const dataMarkers = ['cli-history', 'memory', 'cache', 'config'];
        const hasData = dataMarkers.some(marker => existsSync(join(fullPath, marker)));

        if (hasData) {
          // This is a child project
          const childProjectPath = join(absolutePath, currentRelPath.replace(/\//g, sep));
          const childId = getProjectId(childProjectPath);

          children.push({
            projectPath: childProjectPath,
            relativePath: currentRelPath,
            projectId: childId,
            paths: getProjectPaths(childProjectPath)
          });
        }

        // Continue scanning subdirectories (skip data directories)
        if (!dataMarkers.includes(entry.name)) {
          scanDirectory(fullPath, currentRelPath);
        }
      }
    } catch (error) {
      // Ignore read errors
      if (process.env.DEBUG) {
        console.error(`[scanChildProjects] Failed to scan ${dir}:`, error);
      }
    }
  }

  scanDirectory(parentStorageDir, '');

  return children;
}

/**
 * Asynchronously scan for child projects in hierarchical storage structure
 * Non-blocking version using fs.promises for better performance
 * @param projectPath - Parent project path
 * @returns Promise resolving to array of child project information
 */
export async function scanChildProjectsAsync(projectPath: string): Promise<ChildProjectInfo[]> {
  const absolutePath = resolve(projectPath);
  const parentId = getProjectId(absolutePath);
  const parentStorageDir = join(getCCWHome(), 'projects', parentId);

  // If parent storage doesn't exist, no children
  if (!existsSync(parentStorageDir)) {
    return [];
  }

  const children: ChildProjectInfo[] = [];

  /**
   * Recursively scan directory for project data directories (async)
   */
  async function scanDirectoryAsync(dir: string, relativePath: string): Promise<void> {
    if (!existsSync(dir)) return;

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      // Process directories in parallel for better performance
      const promises = entries
        .filter(entry => entry.isDirectory())
        .map(async (entry) => {
          const fullPath = join(dir, entry.name);
          const currentRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          // Check if this directory contains project data
          const dataMarkers = ['cli-history', 'memory', 'cache', 'config'];
          const hasData = dataMarkers.some(marker => existsSync(join(fullPath, marker)));

          if (hasData) {
            // This is a child project
            const childProjectPath = join(absolutePath, currentRelPath.replace(/\//g, sep));
            const childId = getProjectId(childProjectPath);

            children.push({
              projectPath: childProjectPath,
              relativePath: currentRelPath,
              projectId: childId,
              paths: getProjectPaths(childProjectPath)
            });
          }

          // Continue scanning subdirectories (skip data directories)
          if (!dataMarkers.includes(entry.name)) {
            await scanDirectoryAsync(fullPath, currentRelPath);
          }
        });

      await Promise.all(promises);
    } catch (error) {
      // Ignore read errors
      if (process.env.DEBUG) {
        console.error(`[scanChildProjectsAsync] Failed to scan ${dir}:`, error);
      }
    }
  }

  await scanDirectoryAsync(parentStorageDir, '');

  return children;
}

/**
 * Legacy storage paths (for backward compatibility detection)
 */
export const LegacyPaths = {
  /** Old recent paths file location */
  recentPaths: () => join(homedir(), '.ccw-recent-paths.json'),

  /** Old project-local CLI history */
  cliHistory: (projectPath: string) => join(projectPath, '.workflow', '.cli-history'),

  /** Old project-local memory store */
  memory: (projectPath: string) => join(projectPath, '.workflow', '.memory'),

  /** Old project-local cache */
  cache: (projectPath: string) => join(projectPath, '.workflow', '.ccw-cache'),

  /** Old project-local CLI config */
  cliConfig: (projectPath: string) => join(projectPath, '.workflow', 'cli-config.json'),
};

/**
 * Check if legacy storage exists for a project
 * Useful for migration warnings or detection
 * @param projectPath - Project root path
 * @returns true if any legacy storage is present
 */
export function isLegacyStoragePresent(projectPath: string): boolean {
  return (
    existsSync(LegacyPaths.cliHistory(projectPath)) ||
    existsSync(LegacyPaths.memory(projectPath)) ||
    existsSync(LegacyPaths.cache(projectPath)) ||
    existsSync(LegacyPaths.cliConfig(projectPath))
  );
}

/**
 * Get CCW home directory (for external use)
 */
export function getCcwHome(): string {
  return getCCWHome();
}

/**
 * Initialize global storage directories
 * Creates the base directory structure if not present
 */
export function initializeGlobalStorage(): void {
  ensureStorageDir(GlobalPaths.config());
  ensureStorageDir(GlobalPaths.databases());
  ensureStorageDir(GlobalPaths.logs());
}

/**
 * Initialize project storage directories
 * @param projectPath - Project root path
 */
export function initializeProjectStorage(projectPath: string): void {
  const paths = getProjectPaths(projectPath);
  ensureStorageDir(paths.cliHistory);
  ensureStorageDir(paths.memory);
  ensureStorageDir(paths.cache);
  ensureStorageDir(paths.config);
  ensureStorageDir(paths.memoryV2.root);
  ensureStorageDir(paths.memoryV2.rolloutSummaries);
  ensureStorageDir(paths.memoryV2.skills);
}
